/**
 * 存储结构归一化层。
 * 负责日记录、离舰记录和环境偏好的结构整理。
 */

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
