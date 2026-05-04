/**
 * 运行时存储与数据整形。
 * 负责共享状态的初始化、归一化与持久化，不承担页面渲染职责。
 */

const STORAGE_SCHEMA_VERSION_KEY = 'hmclss_storage_schema_version';
const CURRENT_STORAGE_SCHEMA_VERSION = 1;

function migrateStoredWorkspacePayload(payload, fromVersion) {
    return applyRegisteredStorageMigrations(payload, fromVersion, CURRENT_STORAGE_SCHEMA_VERSION);
}

function createStorageOperationResult() {
    return {
        ok: true,
        failedKeys: []
    };
}

function recordStorageFailure(result, key, error) {
    result.ok = false;
    if (!result.failedKeys.includes(key)) {
        result.failedKeys.push(key);
    }
    console.error(`localStorage write failed for "${key}":`, error);
    return false;
}

function safeSetStorageItem(key, value, result = createStorageOperationResult()) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        return recordStorageFailure(result, key, error);
    }
}

function safeRemoveStorageItem(key, result = createStorageOperationResult()) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        return recordStorageFailure(result, key, error);
    }
}

function notifyStorageWriteFailure(result) {
    if (result.ok || typeof showToast !== 'function') return;
    showToast(`本地保存失败，已暂停自动同步：${result.failedKeys.join(', ')}`, 'error');
}

function initData() {
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
    if (normalizedCurrentTask) {
        runtimeActions.setCurrentTask(normalizedCurrentTask);
        persistCurrentTask();
    } else if (!isCorruptedStorageKey(CURRENT_TASK_STORAGE_KEY)) {
        runtimeActions.clearCurrentTask();
        safeRemoveStorageItem(CURRENT_TASK_STORAGE_KEY);
    }

    normalizeWorkspaceRuntimeState({
        ensureTodayDefaults: true,
        normalizeAmbient: true
    });

    const corruptedKeys = getCorruptedStorageKeys();
    saveData(true, { skipKeys: corruptedKeys });

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

    setRuntimeValue('phoneResistData', normalizePhoneResistDataShape(phoneResistData));
    if (!Array.isArray(leaveData)) setRuntimeValue('leaveData', []);
    setRuntimeValue('achievements', Array.isArray(achievements)
        ? achievements.filter((achievementId) => typeof achievementId === 'string')
        : []);
    setRuntimeValue('tavernData', Array.isArray(tavernData)
        ? tavernData.filter((drink) => drink && typeof drink === 'object')
        : []);
    if (!quickNotesData || typeof quickNotesData !== 'object' || Array.isArray(quickNotesData)) setRuntimeValue('quickNotesData', {});
    setRuntimeValue('taskData', normalizeTaskDataByDate(taskData));
    if (!checkinData || typeof checkinData !== 'object' || Array.isArray(checkinData)) setRuntimeValue('checkinData', {});

    mapRuntimeItems('leaveData', (leave) => normalizeLeaveRecord(leave));
    Object.keys(checkinData).forEach((date) => {
        checkinData[date] = ensureDayRecord(checkinData[date]);
    });

    if (normalizeAmbient) {
        setRuntimeValue('ambientPreferences', normalizeAmbientPreferences(ambientPreferences));
    }

    setRuntimeValue('checkinPreferences', normalizeCheckinPreferences(checkinPreferences));

    if (!ensureTodayDefaults) return;

    const today = getTodayString();
    if (!checkinData[today]) checkinData[today] = createEmptyDayRecord();
    if (!phoneResistData.records[today]) phoneResistData.records[today] = { count: 0, times: [] };
    if (!taskData[today]) taskData[today] = [];
    if (!quickNotesData[today]) quickNotesData[today] = [];
}

function saveData(preventAutoSync = false, options = {}) {
    const skipKeys = new Set(options.skipKeys || []);
    const result = createStorageOperationResult();
    const writeStorageValue = (key, value) => {
        if (skipKeys.has(key)) return;
        safeSetStorageItem(key, value, result);
    };

    writeStorageValue(STORAGE_SCHEMA_VERSION_KEY, String(CURRENT_STORAGE_SCHEMA_VERSION));
    writeStorageValue('checkinData', JSON.stringify(checkinData));
    writeStorageValue('phoneResistData', JSON.stringify(phoneResistData));
    writeStorageValue('taskData', JSON.stringify(taskData));
    writeStorageValue('leaveData', JSON.stringify(leaveData));
    writeStorageValue('achievements', JSON.stringify(achievements));
    writeStorageValue('quickNotesData', JSON.stringify(quickNotesData));
    writeStorageValue('tavernData', JSON.stringify(tavernData));
    writeStorageValue(AMBIENT_PREFS_STORAGE_KEY, JSON.stringify(normalizeAmbientPreferences(ambientPreferences)));
    writeStorageValue(CHECKIN_PREFS_STORAGE_KEY, JSON.stringify(normalizeCheckinPreferences(checkinPreferences)));

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

    notifyStorageWriteFailure(result);

    if (!preventAutoSync && result.ok && typeof triggerAutoSync === 'function') {
        triggerAutoSync();
    }

    return result;
}

function persistCurrentTask() {
    const result = createStorageOperationResult();
    const activeTask = runtimeSelectors.currentTask();
    if (activeTask) {
        safeSetStorageItem(CURRENT_TASK_STORAGE_KEY, JSON.stringify(activeTask), result);
    } else {
        safeRemoveStorageItem(CURRENT_TASK_STORAGE_KEY, result);
    }
    notifyStorageWriteFailure(result);
    return result;
}
