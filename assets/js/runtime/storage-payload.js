/**
 * 存储载荷读取层。
 * 负责本地 JSON 安全读取、schema 版本读取和启动载荷组装。
 */

const corruptedStorageKeys = new Set();
const failedStorageReadKeys = new Set();

function clearCorruptedStorageKeys() {
    corruptedStorageKeys.clear();
}

function clearFailedStorageReadKeys() {
    failedStorageReadKeys.clear();
}

function getCorruptedStorageKeys() {
    return [...corruptedStorageKeys];
}

function getFailedStorageReadKeys() {
    return [...failedStorageReadKeys];
}

function isCorruptedStorageKey(key) {
    return corruptedStorageKeys.has(key);
}

function safeGetStorageItem(key) {
    try {
        return {
            ok: true,
            value: localStorage.getItem(key),
            error: null
        };
    } catch (error) {
        failedStorageReadKeys.add(key);
        if (typeof appLogger !== 'undefined') {
            appLogger.error(`localStorage read failed for "${key}":`, error);
        }
        return {
            ok: false,
            value: null,
            error
        };
    }
}

function safeParseStoredJson(rawValue, fallbackValue, storageKey = null) {
    if (rawValue == null) return fallbackValue;

    try {
        return JSON.parse(rawValue);
    } catch (error) {
        if (storageKey) corruptedStorageKeys.add(storageKey);
        return fallbackValue;
    }
}

function getStoredSchemaVersion() {
    const readResult = safeGetStorageItem(STORAGE_SCHEMA_VERSION_KEY);
    if (!readResult.ok) return 0;
    const rawVersion = Number(readResult.value);
    return Number.isFinite(rawVersion) && rawVersion > 0 ? rawVersion : 0;
}

function isValidCurrentTaskRecord(task) {
    return Boolean(
        task &&
        typeof task === 'object' &&
        typeof task.name === 'string' &&
        Number.isFinite(task.startTimestamp) &&
        typeof task.startTime === 'string'
    );
}

function readStoredWorkspacePayload() {
    const readJson = (key, fallbackValue) => {
        const readResult = safeGetStorageItem(key);
        return readResult.ok
            ? safeParseStoredJson(readResult.value, fallbackValue, key)
            : fallbackValue;
    };

    return {
        checkinData: readJson('checkinData', {}),
        phoneResistData: readJson('phoneResistData', { totalCount: 0, records: {} }),
        taskData: readJson('taskData', {}),
        leaveData: readJson('leaveData', []),
        achievements: readJson('achievements', []),
        quickNotesData: readJson('quickNotesData', {}),
        tavernData: readJson('tavernData', []),
        currentTask: readJson(CURRENT_TASK_STORAGE_KEY, null),
        ambientPreferences: readJson(AMBIENT_PREFS_STORAGE_KEY, null),
        checkinPreferences: readJson(CHECKIN_PREFS_STORAGE_KEY, null)
    };
}
