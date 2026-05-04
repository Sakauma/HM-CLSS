/**
 * 存储载荷读取层。
 * 负责本地 JSON 安全读取、schema 版本读取和启动载荷组装。
 */

const corruptedStorageKeys = new Set();

function clearCorruptedStorageKeys() {
    corruptedStorageKeys.clear();
}

function getCorruptedStorageKeys() {
    return [...corruptedStorageKeys];
}

function isCorruptedStorageKey(key) {
    return corruptedStorageKeys.has(key);
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
    const rawVersion = Number(localStorage.getItem(STORAGE_SCHEMA_VERSION_KEY));
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
    clearCorruptedStorageKeys();

    return {
        checkinData: safeParseStoredJson(localStorage.getItem('checkinData'), {}, 'checkinData'),
        phoneResistData: safeParseStoredJson(localStorage.getItem('phoneResistData'), { totalCount: 0, records: {} }, 'phoneResistData'),
        taskData: safeParseStoredJson(localStorage.getItem('taskData'), {}, 'taskData'),
        leaveData: safeParseStoredJson(localStorage.getItem('leaveData'), [], 'leaveData'),
        achievements: safeParseStoredJson(localStorage.getItem('achievements'), [], 'achievements'),
        quickNotesData: safeParseStoredJson(localStorage.getItem('quickNotesData'), {}, 'quickNotesData'),
        tavernData: safeParseStoredJson(localStorage.getItem('tavernData'), [], 'tavernData'),
        currentTask: safeParseStoredJson(localStorage.getItem(CURRENT_TASK_STORAGE_KEY), null, CURRENT_TASK_STORAGE_KEY),
        ambientPreferences: safeParseStoredJson(localStorage.getItem(AMBIENT_PREFS_STORAGE_KEY), null, AMBIENT_PREFS_STORAGE_KEY),
        checkinPreferences: safeParseStoredJson(localStorage.getItem(CHECKIN_PREFS_STORAGE_KEY), null, CHECKIN_PREFS_STORAGE_KEY)
    };
}
