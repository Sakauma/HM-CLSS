/**
 * 工作区数据边界模块。
 * 负责定义“可同步数据集”和“仅本地运行态”的边界，并提供快照与应用能力。
 */

function cloneWorkspaceValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function buildWorkspaceDatasetSnapshot() {
    return {
        checkinData: cloneWorkspaceValue(checkinData),
        phoneResistData: cloneWorkspaceValue(phoneResistData),
        taskData: cloneWorkspaceValue(taskData),
        leaveData: cloneWorkspaceValue(leaveData),
        achievements: cloneWorkspaceValue(achievements),
        quickNotesData: cloneWorkspaceValue(quickNotesData),
        tavernData: cloneWorkspaceValue(tavernData)
    };
}

function buildWorkspaceStateSnapshot() {
    return {
        currentTask: currentTask ? cloneWorkspaceValue(currentTask) : null,
        ambientPreferences: cloneWorkspaceValue(normalizeAmbientPreferences(ambientPreferences)),
        lastSyncTime: typeof localLastSyncTime === 'string' && localLastSyncTime ? localLastSyncTime : null
    };
}

function extractWorkspaceDatasetSource(source) {
    if (source?.datasets && typeof source.datasets === 'object') {
        return source.datasets;
    }
    return source && typeof source === 'object' ? source : {};
}

function ensureWorkspaceTodayDefaults() {
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

    const today = getTodayString();
    if (!checkinData[today]) checkinData[today] = createEmptyDayRecord();
    if (!phoneResistData.records[today]) phoneResistData.records[today] = { count: 0, times: [] };
    if (!taskData[today]) taskData[today] = [];
    if (!quickNotesData[today]) quickNotesData[today] = [];
}

function applyWorkspaceDatasetSnapshot(snapshot) {
    const source = extractWorkspaceDatasetSource(snapshot);
    setRuntimeValue('checkinData', source.checkinData || {});
    setRuntimeValue('phoneResistData', source.phoneResistData || { totalCount: 0, records: {} });
    setRuntimeValue('taskData', source.taskData || {});
    setRuntimeValue('leaveData', source.leaveData || []);
    setRuntimeValue('achievements', source.achievements || []);
    setRuntimeValue('quickNotesData', source.quickNotesData || {});
    setRuntimeValue('tavernData', source.tavernData || []);
    ensureWorkspaceTodayDefaults();
}

function buildCloudSyncPayload(syncTime = new Date().toISOString()) {
    return {
        ...buildWorkspaceDatasetSnapshot(),
        lastSyncTime: syncTime
    };
}
