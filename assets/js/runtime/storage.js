/**
 * 运行时存储与数据整形。
 * 负责共享状态的初始化、归一化与持久化，不承担页面渲染职责。
 */

const STORAGE_SCHEMA_VERSION_KEY = 'hmclss_storage_schema_version';
const CURRENT_STORAGE_SCHEMA_VERSION = 1;
const STORAGE_FAILURE_TOAST_COOLDOWN_MS = 5000;
let lastStorageFailureToast = { signature: '', time: 0 };
let storageSessionMode = false;
let storageWriteBlocked = false;
let storageStartupReadBlocked = false;

function migrateStoredWorkspacePayload(payload, fromVersion) {
    return applyRegisteredStorageMigrations(payload, fromVersion, CURRENT_STORAGE_SCHEMA_VERSION);
}

function createStorageOperationResult() {
    return {
        ok: true,
        failedKeys: [],
        rollbackFailedKeys: [],
        rollbackSucceeded: true,
        persistedKeys: [],
        unchangedKeys: [],
        blocked: false,
        blockReason: null
    };
}

function recordStorageFailure(result, key, error) {
    result.ok = false;
    if (!result.failedKeys.includes(key)) {
        result.failedKeys.push(key);
    }
    appLogger.error(`localStorage write failed for "${key}":`, error);
    return false;
}

function recordStorageReadFailure(result, key, error) {
    result.ok = false;
    if (!result.failedKeys.includes(key)) {
        result.failedKeys.push(key);
    }
    appLogger.error(`localStorage read failed for "${key}":`, error);
    return false;
}

function safeSetStorageItem(key, value, result = createStorageOperationResult()) {
    if (isStoragePersistenceBlocked()) return applyStorageBlockToResult(result);
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        return recordStorageFailure(result, key, error);
    }
}

function safeRemoveStorageItem(key, result = createStorageOperationResult()) {
    if (isStoragePersistenceBlocked()) return applyStorageBlockToResult(result);
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        return recordStorageFailure(result, key, error);
    }
}

function notifyStorageWriteFailure(result) {
    if (result.ok || typeof showToast !== 'function') return;
    const signature = result.failedKeys.join(',');
    const now = Date.now();
    if (
        lastStorageFailureToast.signature === signature &&
        now - lastStorageFailureToast.time < STORAGE_FAILURE_TOAST_COOLDOWN_MS
    ) {
        return;
    }
    lastStorageFailureToast = { signature, time: now };
    const rollbackMessage = result.blockReason === 'startupRead'
        ? '；启动读取失败，为避免覆盖旧数据，后续写入已阻止，请刷新页面恢复读取后再操作'
        : result.rollbackSucceeded === false
            ? '；磁盘状态无法确认，后续写入已阻止，请先导出当前会话数据并刷新页面'
            : '';
    showToast(`本地保存失败，本次改动未落盘，已暂停自动同步：${result.failedKeys.join(', ')}${rollbackMessage}`, 'error');
}

function setStorageSessionMode(enabled) {
    storageSessionMode = Boolean(enabled);
}

function isStorageSessionMode() {
    return storageSessionMode;
}

function isStorageWriteBlocked() {
    return storageWriteBlocked;
}

function isStorageStartupReadBlocked() {
    return storageStartupReadBlocked;
}

function isStoragePersistenceBlocked() {
    return storageWriteBlocked || storageStartupReadBlocked;
}

function getStorageBlockReason() {
    return storageStartupReadBlocked ? 'startupRead' : 'storageConsistency';
}

function blockStoragePersistence() {
    storageWriteBlocked = true;
    setStorageSessionMode(true);
}

function applyStorageBlockToResult(result) {
    const reason = getStorageBlockReason();
    const failureKey = reason === 'startupRead' ? 'storageReadUnavailable' : 'storageConsistency';
    result.ok = false;
    result.rollbackSucceeded = false;
    result.blocked = true;
    result.blockReason = reason;
    if (!result.failedKeys.includes(failureKey)) {
        result.failedKeys.push(failureKey);
    }
    return false;
}

function createStorageBlockedResult() {
    const result = createStorageOperationResult();
    applyStorageBlockToResult(result);
    return result;
}

function notifyStorageReadFailure(keys) {
    if (!keys.length || typeof showToast !== 'function') return;
    setTimeout(() => {
        showToast(`浏览器存储不可读取，已进入会话模式；关闭页面前请先导出数据：${keys.join(', ')}`, 'warning');
    }, 0);
}

function initData() {
    clearCorruptedStorageKeys();
    clearFailedStorageReadKeys();
    const storedVersion = getStoredSchemaVersion();
    const payload = storedVersion < CURRENT_STORAGE_SCHEMA_VERSION
        ? migrateStoredWorkspacePayload(readStoredWorkspacePayload(), storedVersion)
        : readStoredWorkspacePayload();

    runtimeActions.set('quickNotesData', payload.quickNotesData);
    runtimeActions.set('checkinData', payload.checkinData);
    runtimeActions.set('phoneResistData', payload.phoneResistData);
    runtimeActions.set('taskData', payload.taskData);
    runtimeActions.set('leaveData', payload.leaveData);
    runtimeActions.set('achievements', payload.achievements);
    runtimeActions.set('tavernData', payload.tavernData);
    runtimeActions.setAmbientPreferences(payload.ambientPreferences);
    runtimeActions.setCheckinPreferences(payload.checkinPreferences);
    runtimeActions.setCurrentTask(payload.currentTask);

    const normalizedCurrentTask = normalizeCurrentTaskRecord(runtimeSelectors.currentTask());
    runtimeActions.setCurrentTask(normalizedCurrentTask);

    normalizeWorkspaceRuntimeState({
        ensureTodayDefaults: true,
        normalizeAmbient: true
    });

    const corruptedKeys = getCorruptedStorageKeys();
    const failedReadKeys = getFailedStorageReadKeys();
    if (failedReadKeys.length) {
        setStorageSessionMode(true);
        storageStartupReadBlocked = true;
        notifyStorageReadFailure(failedReadKeys);
    } else {
        const currentTaskResult = isCorruptedStorageKey(CURRENT_TASK_STORAGE_KEY)
            ? createStorageOperationResult()
            : persistCurrentTask();
        const dataResult = saveData(true, { skipKeys: corruptedKeys });
        if (!currentTaskResult.ok || !dataResult.ok) {
            setStorageSessionMode(true);
        }
    }

    if (corruptedKeys.length && typeof showToast === 'function') {
        setTimeout(() => {
            showToast(`检测到本地缓存损坏，已临时回退：${corruptedKeys.join(', ')}`, 'warning');
        }, 0);
    }
}

function normalizeWorkspaceRuntimeState(options = {}) {
    const {
        ensureTodayDefaults = false,
        normalizeAmbient = false
    } = options;

    runtimeActions.setPhoneResistData(normalizePhoneResistDataShape(runtimeSelectors.phoneResistData()));
    runtimeActions.setLeaveData(Array.isArray(runtimeSelectors.leaveData())
        ? runtimeSelectors.leaveData().map((leave) => normalizeLeaveRecord(leave))
        : []);
    const currentAchievements = runtimeSelectors.achievements();
    runtimeActions.setAchievements(Array.isArray(currentAchievements)
        ? currentAchievements.filter((achievementId) => typeof achievementId === 'string')
        : []);
    runtimeActions.setTavernData(Array.isArray(runtimeSelectors.tavernData())
        ? runtimeSelectors.tavernData().filter((drink) => drink && typeof drink === 'object')
        : []);
    const notesData = runtimeSelectors.quickNotesData();
    runtimeActions.setQuickNotesData(notesData && typeof notesData === 'object' && !Array.isArray(notesData)
        ? notesData
        : {});
    runtimeActions.setTaskData(normalizeTaskDataByDate(runtimeSelectors.taskData()));
    const currentCheckinData = runtimeSelectors.checkinData();
    runtimeActions.setCheckinData(currentCheckinData && typeof currentCheckinData === 'object' && !Array.isArray(currentCheckinData)
        ? Object.fromEntries(Object.entries(currentCheckinData).map(([date, day]) => [date, ensureDayRecord(day)]))
        : {});

    if (normalizeAmbient) {
        runtimeActions.setAmbientPreferences(normalizeAmbientPreferences(runtimeSelectors.ambientPreferences()));
    }

    runtimeActions.setCheckinPreferences(normalizeCheckinPreferences(runtimeSelectors.checkinPreferences()));

    if (!ensureTodayDefaults) return;

    const today = getTodayString();
    if (!runtimeSelectors.checkinData()[today]) {
        runtimeActions.updateCheckinDay(today, (day) => ensureDayRecord(day), createEmptyDayRecord);
    }
    if (!runtimeSelectors.phoneResistData().records[today]) {
        runtimeActions.updatePhoneResistRecord(today, (record) => ({
            count: Number.isFinite(Number(record?.count)) ? Number(record.count) : 0,
            times: Array.isArray(record?.times) ? record.times : []
        }));
    }
    if (!runtimeSelectors.taskData()[today]) {
        runtimeActions.updateTaskEntries(today, (entries) => (Array.isArray(entries) ? entries : []));
    }
    if (!runtimeSelectors.quickNotesData()[today]) {
        runtimeActions.updateQuickNoteEntries(today, (entries) => (Array.isArray(entries) ? entries : []));
    }
}

function readStorageValueForTransaction(key, result) {
    try {
        return { ok: true, value: localStorage.getItem(key) };
    } catch (error) {
        recordStorageReadFailure(result, key, error);
        return { ok: false, value: null };
    }
}

function restoreStorageValue(key, previousValue, result) {
    try {
        if (previousValue == null) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, previousValue);
        }
        return true;
    } catch (error) {
        if (!result.rollbackFailedKeys.includes(key)) {
            result.rollbackFailedKeys.push(key);
        }
        result.rollbackSucceeded = false;
        appLogger.error(`localStorage rollback failed for "${key}":`, error);
        return false;
    }
}

function persistStorageEntries(entries) {
    if (isStoragePersistenceBlocked()) return createStorageBlockedResult();

    const result = createStorageOperationResult();
    const previousValues = new Map();

    for (const entry of entries) {
        const readResult = readStorageValueForTransaction(entry.key, result);
        if (!readResult.ok) {
            setStorageSessionMode(true);
            return result;
        }
        previousValues.set(entry.key, readResult.value);
    }

    const changedEntries = entries.filter((entry) => {
        const nextValue = entry.remove ? null : entry.value;
        if (previousValues.get(entry.key) === nextValue) {
            result.unchangedKeys.push(entry.key);
            return false;
        }
        return true;
    });

    const attemptedEntries = [];
    for (const entry of changedEntries) {
        attemptedEntries.push(entry);
        const written = entry.remove
            ? safeRemoveStorageItem(entry.key, result)
            : safeSetStorageItem(entry.key, entry.value, result);
        if (!written) {
            attemptedEntries.slice().reverse().forEach((attemptedEntry) => {
                restoreStorageValue(attemptedEntry.key, previousValues.get(attemptedEntry.key), result);
            });
            if (result.rollbackSucceeded) {
                result.persistedKeys = [];
            } else {
                blockStoragePersistence();
            }
            setStorageSessionMode(true);
            return result;
        }
        result.persistedKeys.push(entry.key);
    }

    setStorageSessionMode(false);
    return result;
}

function buildSaveDataEntries(options = {}) {
    const skipKeys = new Set(options.skipKeys || []);
    const requestedKeys = options.keys ? new Set(options.keys) : null;
    const shouldInclude = (key) => !skipKeys.has(key) && (!requestedKeys || requestedKeys.has(key));
    const entries = [];
    const addJsonEntry = (key, value) => {
        if (shouldInclude(key)) entries.push({ key, value: JSON.stringify(value), remove: false });
    };

    if (shouldInclude(STORAGE_SCHEMA_VERSION_KEY)) {
        entries.push({ key: STORAGE_SCHEMA_VERSION_KEY, value: String(CURRENT_STORAGE_SCHEMA_VERSION), remove: false });
    }
    addJsonEntry('checkinData', checkinData);
    addJsonEntry('phoneResistData', phoneResistData);
    addJsonEntry('taskData', taskData);
    addJsonEntry('leaveData', leaveData);
    addJsonEntry('achievements', achievements);
    addJsonEntry('quickNotesData', quickNotesData);
    addJsonEntry('tavernData', tavernData);
    addJsonEntry(AMBIENT_PREFS_STORAGE_KEY, normalizeAmbientPreferences(ambientPreferences));
    addJsonEntry(CHECKIN_PREFS_STORAGE_KEY, normalizeCheckinPreferences(checkinPreferences));

    if (requestedKeys?.has(CURRENT_TASK_STORAGE_KEY) && !skipKeys.has(CURRENT_TASK_STORAGE_KEY)) {
        const activeTask = runtimeSelectors.currentTask();
        entries.push(activeTask
            ? { key: CURRENT_TASK_STORAGE_KEY, value: JSON.stringify(activeTask), remove: false }
            : { key: CURRENT_TASK_STORAGE_KEY, value: null, remove: true });
    }
    return entries;
}

function refreshViewsAfterSave() {
    if (typeof refreshStatisticsView === 'function') {
        refreshStatisticsView();
    } else if (typeof updateSummaryStatistics === 'function') {
        updateSummaryStatistics();
    }

    if (typeof refreshExportPreview === 'function') {
        refreshExportPreview();
    }

    if (typeof updateVoyageAmbientPresentation === 'function') {
        updateVoyageAmbientPresentation();
    }
}

function saveData(preventAutoSync = false, options = {}) {
    let entries;
    try {
        entries = buildSaveDataEntries(options);
    } catch (error) {
        const result = createStorageOperationResult();
        recordStorageFailure(result, 'serialization', error);
        setStorageSessionMode(true);
        notifyStorageWriteFailure(result);
        return result;
    }

    const result = persistStorageEntries(entries);

    notifyStorageWriteFailure(result);

    if (result.ok) {
        refreshViewsAfterSave();
    }

    if (!preventAutoSync && result.ok && typeof triggerAutoSync === 'function') {
        triggerAutoSync();
    }

    return result;
}

function persistCurrentTask() {
    const activeTask = runtimeSelectors.currentTask();
    let entry;
    try {
        entry = activeTask
            ? { key: CURRENT_TASK_STORAGE_KEY, value: JSON.stringify(activeTask), remove: false }
            : { key: CURRENT_TASK_STORAGE_KEY, value: null, remove: true };
    } catch (error) {
        const result = createStorageOperationResult();
        recordStorageFailure(result, CURRENT_TASK_STORAGE_KEY, error);
        notifyStorageWriteFailure(result);
        return result;
    }
    const result = persistStorageEntries([entry]);
    notifyStorageWriteFailure(result);
    return result;
}

function cloneRuntimeStorageValue(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function commitRuntimeMutation(stateKeys, mutate, options = {}) {
    if (isStoragePersistenceBlocked()) {
        const blockedResult = createStorageBlockedResult();
        notifyStorageWriteFailure(blockedResult);
        return blockedResult;
    }

    const snapshots = new Map(stateKeys.map((key) => [
        key,
        cloneRuntimeStorageValue(runtimeSelectors.value(key))
    ]));
    const mutationResult = mutate();
    const saveResult = saveData(Boolean(options.preventAutoSync), {
        keys: options.storageKeys || stateKeys
    });

    if (!saveResult.ok && saveResult.rollbackSucceeded !== false) {
        snapshots.forEach((value, key) => runtimeActions.set(key, value));
        saveResult.memoryRestored = true;
    } else {
        saveResult.memoryRestored = false;
        if (!saveResult.ok && typeof refreshExportPreview === 'function') {
            refreshExportPreview();
        }
    }
    saveResult.mutationResult = mutationResult;
    return saveResult;
}
