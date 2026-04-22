/**
 * 运行时存储与数据整形。
 * 负责共享状态的初始化、归一化与持久化，不承担页面渲染职责。
 */

const STORAGE_SCHEMA_VERSION_KEY = 'hmclss_storage_schema_version';
const CURRENT_STORAGE_SCHEMA_VERSION = 1;

function migrateStoredWorkspacePayload(payload, fromVersion) {
    return applyRegisteredStorageMigrations(payload, fromVersion, CURRENT_STORAGE_SCHEMA_VERSION);
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

    if (!isValidCurrentTaskRecord(runtimeSelectors.currentTask())) {
        runtimeActions.clearCurrentTask();
        localStorage.removeItem(CURRENT_TASK_STORAGE_KEY);
    }

    normalizeWorkspaceRuntimeState({
        ensureTodayDefaults: true,
        normalizeAmbient: true
    });

    saveData(true);
}

function normalizeWorkspaceRuntimeState(options = {}) {
    const {
        ensureTodayDefaults = false,
        normalizeAmbient = false
    } = options;

    if (!phoneResistData || typeof phoneResistData !== 'object') {
        setRuntimeValue('phoneResistData', { totalCount: 0, records: {} });
    }
    if (!phoneResistData.records) phoneResistData.records = {};
    if (!Array.isArray(leaveData)) setRuntimeValue('leaveData', []);
    if (!Array.isArray(achievements)) setRuntimeValue('achievements', []);
    if (!Array.isArray(tavernData)) setRuntimeValue('tavernData', []);
    if (!quickNotesData || typeof quickNotesData !== 'object') setRuntimeValue('quickNotesData', {});
    if (!taskData || typeof taskData !== 'object') setRuntimeValue('taskData', {});
    if (!checkinData || typeof checkinData !== 'object') setRuntimeValue('checkinData', {});

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

function saveData(preventAutoSync = false) {
    localStorage.setItem(STORAGE_SCHEMA_VERSION_KEY, String(CURRENT_STORAGE_SCHEMA_VERSION));
    localStorage.setItem('checkinData', JSON.stringify(checkinData));
    localStorage.setItem('phoneResistData', JSON.stringify(phoneResistData));
    localStorage.setItem('taskData', JSON.stringify(taskData));
    localStorage.setItem('leaveData', JSON.stringify(leaveData));
    localStorage.setItem('achievements', JSON.stringify(achievements));
    localStorage.setItem('quickNotesData', JSON.stringify(quickNotesData));
    localStorage.setItem('tavernData', JSON.stringify(tavernData));
    localStorage.setItem(AMBIENT_PREFS_STORAGE_KEY, JSON.stringify(normalizeAmbientPreferences(ambientPreferences)));
    localStorage.setItem(CHECKIN_PREFS_STORAGE_KEY, JSON.stringify(normalizeCheckinPreferences(checkinPreferences)));

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

    if (!preventAutoSync && typeof triggerAutoSync === 'function') {
        triggerAutoSync();
    }
}

function persistCurrentTask() {
    const activeTask = runtimeSelectors.currentTask();
    if (activeTask) {
        localStorage.setItem(CURRENT_TASK_STORAGE_KEY, JSON.stringify(activeTask));
    } else {
        localStorage.removeItem(CURRENT_TASK_STORAGE_KEY);
    }
}
