/**
 * 运行时存储与数据整形。
 * 负责共享状态的初始化、归一化与持久化，不承担页面渲染职责。
 */

const STORAGE_SCHEMA_VERSION_KEY = 'hmclss_storage_schema_version';
const CURRENT_STORAGE_SCHEMA_VERSION = 1;

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

function migrateStoredWorkspacePayload(payload, fromVersion) {
    return applyRegisteredStorageMigrations(payload, fromVersion, CURRENT_STORAGE_SCHEMA_VERSION);
}

function initData() {
    const storedVersion = getStoredSchemaVersion();
    const payload = storedVersion < CURRENT_STORAGE_SCHEMA_VERSION
        ? migrateStoredWorkspacePayload(readStoredWorkspacePayload(), storedVersion)
        : readStoredWorkspacePayload();

    setRuntimeValue('quickNotesData', payload.quickNotesData);
    setRuntimeValue('checkinData', payload.checkinData);
    setRuntimeValue('phoneResistData', payload.phoneResistData);
    setRuntimeValue('taskData', payload.taskData);
    setRuntimeValue('leaveData', payload.leaveData);
    setRuntimeValue('achievements', payload.achievements);
    setRuntimeValue('tavernData', payload.tavernData);
    setRuntimeValue('ambientPreferences', payload.ambientPreferences);
    setRuntimeValue('currentTask', payload.currentTask);

    if (!isValidCurrentTaskRecord(currentTask)) {
        setRuntimeValue('currentTask', null);
        localStorage.removeItem(CURRENT_TASK_STORAGE_KEY);
    }

    normalizeWorkspaceRuntimeState({
        ensureTodayDefaults: true,
        normalizeAmbient: true
    });

    saveData(true);
}

function createEmptyPeriodRecord() {
    return {
        checkIn: null,
        checkOut: null,
        status: { checkIn: null, checkOut: null },
        entrySource: null,
        updatedAt: null,
        correctionReason: ''
    };
}

function createEmptyDayRecord() {
    return {
        morning: createEmptyPeriodRecord(),
        afternoon: createEmptyPeriodRecord(),
        evening: createEmptyPeriodRecord(),
        leave: false,
        leaveReason: '',
        leaveMeta: null,
        partialLeaves: []
    };
}

function normalizePeriodRecord(periodData) {
    const fallback = createEmptyPeriodRecord();
    const normalized = periodData && typeof periodData === 'object' ? periodData : {};
    const status = normalized.status && typeof normalized.status === 'object'
        ? normalized.status
        : fallback.status;

    const hasSavedRecord = normalized.checkIn || normalized.checkOut;
    const entrySource = normalized.entrySource || (hasSavedRecord ? 'live' : null);

    return {
        checkIn: typeof normalized.checkIn === 'string' ? normalized.checkIn : null,
        checkOut: typeof normalized.checkOut === 'string' ? normalized.checkOut : null,
        status: {
            checkIn: getNormalizedCheckInStatus(status.checkIn ?? null),
            checkOut: status.checkOut ?? null
        },
        entrySource,
        updatedAt: typeof normalized.updatedAt === 'string' ? normalized.updatedAt : null,
        correctionReason: typeof normalized.correctionReason === 'string' ? normalized.correctionReason : ''
    };
}

function ensureDayRecord(dayData) {
    const normalized = dayData && typeof dayData === 'object' ? dayData : {};

    return {
        morning: normalizePeriodRecord(normalized.morning),
        afternoon: normalizePeriodRecord(normalized.afternoon),
        evening: normalizePeriodRecord(normalized.evening),
        leave: Boolean(normalized.leave),
        leaveReason: typeof normalized.leaveReason === 'string' ? normalized.leaveReason : '',
        leaveMeta: normalized.leaveMeta && typeof normalized.leaveMeta === 'object'
            ? {
                requestMode: normalized.leaveMeta.requestMode || 'normal',
                createdAt: typeof normalized.leaveMeta.createdAt === 'string' ? normalized.leaveMeta.createdAt : null,
                correctionNote: typeof normalized.leaveMeta.correctionNote === 'string' ? normalized.leaveMeta.correctionNote : ''
            }
            : null,
        partialLeaves: Array.isArray(normalized.partialLeaves)
            ? normalized.partialLeaves.map((leave) => normalizeLeaveRecord(leave, true))
            : []
    };
}

function normalizeLeaveRecord(leave, forPartialOnly = false) {
    const normalized = leave && typeof leave === 'object' ? leave : {};
    const nowIso = new Date().toISOString();

    return {
        id: typeof normalized.id === 'string' ? normalized.id : `leave_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        date: typeof normalized.date === 'string' ? normalized.date : getTodayString(),
        reason: typeof normalized.reason === 'string' ? normalized.reason : '',
        type: normalized.type === 'partial' ? 'partial' : 'full',
        startTime: typeof normalized.startTime === 'string' ? normalized.startTime : null,
        endTime: typeof normalized.endTime === 'string' ? normalized.endTime : null,
        requestMode: normalized.requestMode || 'normal',
        createdAt: typeof normalized.createdAt === 'string' ? normalized.createdAt : nowIso,
        correctionNote: typeof normalized.correctionNote === 'string' ? normalized.correctionNote : '',
        ...(forPartialOnly ? {} : {})
    };
}

function normalizeAmbientPreferences(preferences) {
    const normalized = preferences && typeof preferences === 'object' ? preferences : {};
    return {
        enabled: normalized.enabled !== false,
        intensity: 'subtle',
        easterEggs: normalized.easterEggs !== false
    };
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
    if (currentTask) {
        localStorage.setItem(CURRENT_TASK_STORAGE_KEY, JSON.stringify(currentTask));
    } else {
        localStorage.removeItem(CURRENT_TASK_STORAGE_KEY);
    }
}
