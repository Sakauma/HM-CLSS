/**
 * 运行时存储与数据整形。
 * 负责共享状态的初始化、归一化与持久化，不承担页面渲染职责。
 */

function initData() {
    const savedCheckinData = localStorage.getItem('checkinData');
    const savedPhoneResistData = localStorage.getItem('phoneResistData');
    const savedTaskData = localStorage.getItem('taskData');
    const savedLeaveData = localStorage.getItem('leaveData');
    const savedAchievements = localStorage.getItem('achievements');
    const savedNotes = localStorage.getItem('quickNotesData');
    const savedTavernData = localStorage.getItem('tavernData');
    const savedCurrentTask = localStorage.getItem(CURRENT_TASK_STORAGE_KEY);
    const savedAmbientPrefs = localStorage.getItem(AMBIENT_PREFS_STORAGE_KEY);

    try {
        quickNotesData = savedNotes ? JSON.parse(savedNotes) : {};
        checkinData = savedCheckinData ? JSON.parse(savedCheckinData) : {};
        phoneResistData = savedPhoneResistData ? JSON.parse(savedPhoneResistData) : { totalCount: 0, records: {} };
        taskData = savedTaskData ? JSON.parse(savedTaskData) : {};
        leaveData = savedLeaveData ? JSON.parse(savedLeaveData) : [];
        achievements = savedAchievements ? JSON.parse(savedAchievements) : [];
        tavernData = savedTavernData ? JSON.parse(savedTavernData) : [];
        ambientPreferences = savedAmbientPrefs ? JSON.parse(savedAmbientPrefs) : null;
    } catch (error) {
        quickNotesData = {};
        checkinData = {};
        phoneResistData = { totalCount: 0, records: {} };
        taskData = {};
        leaveData = [];
        achievements = [];
        tavernData = [];
        ambientPreferences = null;
    }

    try {
        currentTask = savedCurrentTask ? JSON.parse(savedCurrentTask) : null;
    } catch (error) {
        currentTask = null;
    }

    if (
        !currentTask ||
        typeof currentTask !== 'object' ||
        typeof currentTask.name !== 'string' ||
        typeof currentTask.startTimestamp !== 'number' ||
        typeof currentTask.startTime !== 'string'
    ) {
        currentTask = null;
        localStorage.removeItem(CURRENT_TASK_STORAGE_KEY);
    }

    if (!phoneResistData.records) phoneResistData.records = {};
    if (!Array.isArray(leaveData)) leaveData = [];
    leaveData = leaveData.map((leave) => normalizeLeaveRecord(leave));
    Object.keys(checkinData).forEach((date) => {
        checkinData[date] = ensureDayRecord(checkinData[date]);
    });
    ambientPreferences = normalizeAmbientPreferences(ambientPreferences);

    const today = getTodayString();
    if (!checkinData[today]) checkinData[today] = createEmptyDayRecord();
    if (!phoneResistData.records[today]) phoneResistData.records[today] = { count: 0, times: [] };
    if (!taskData[today]) taskData[today] = [];

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

function saveData(preventAutoSync = false) {
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

