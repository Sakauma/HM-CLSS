/**
 * 存储载荷读取层。
 * 负责本地 JSON 安全读取、schema 版本读取和启动载荷组装。
 */

function safeParseStoredJson(rawValue, fallbackValue) {
    if (rawValue == null) return fallbackValue;

    try {
        return JSON.parse(rawValue);
    } catch (error) {
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
        typeof task.startTimestamp === 'number' &&
        typeof task.startTime === 'string'
    );
}

function readStoredWorkspacePayload() {
    return {
        checkinData: safeParseStoredJson(localStorage.getItem('checkinData'), {}),
        phoneResistData: safeParseStoredJson(localStorage.getItem('phoneResistData'), { totalCount: 0, records: {} }),
        taskData: safeParseStoredJson(localStorage.getItem('taskData'), {}),
        leaveData: safeParseStoredJson(localStorage.getItem('leaveData'), []),
        achievements: safeParseStoredJson(localStorage.getItem('achievements'), []),
        quickNotesData: safeParseStoredJson(localStorage.getItem('quickNotesData'), {}),
        tavernData: safeParseStoredJson(localStorage.getItem('tavernData'), []),
        currentTask: safeParseStoredJson(localStorage.getItem(CURRENT_TASK_STORAGE_KEY), null),
        ambientPreferences: safeParseStoredJson(localStorage.getItem(AMBIENT_PREFS_STORAGE_KEY), null)
    };
}
