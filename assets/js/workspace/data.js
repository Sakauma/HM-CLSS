/**
 * 工作区数据边界模块。
 * 负责定义“可同步数据集”和“仅本地运行态”的边界，并提供快照与应用能力。
 */

function cloneWorkspaceValue(value) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (error) {
            // 回退到 JSON 序列化，以兼容不可克隆值混入的旧数据。
        }
    }

    if (typeof value === 'undefined') {
        return undefined;
    }

    return JSON.parse(JSON.stringify(value));
}

function buildWorkspaceDatasetSnapshot() {
    const state = runtimeSelectors.state();
    return {
        checkinData: cloneWorkspaceValue(state.checkinData),
        phoneResistData: cloneWorkspaceValue(state.phoneResistData),
        taskData: cloneWorkspaceValue(state.taskData),
        leaveData: cloneWorkspaceValue(state.leaveData),
        achievements: cloneWorkspaceValue(state.achievements),
        quickNotesData: cloneWorkspaceValue(state.quickNotesData),
        tavernData: cloneWorkspaceValue(state.tavernData)
    };
}

function buildWorkspaceStateSnapshot() {
    const activeTask = runtimeSelectors.currentTask();
    const preferences = runtimeSelectors.ambientPreferences();
    const checkinPreferences = runtimeSelectors.checkinPreferences();
    return {
        currentTask: activeTask ? cloneWorkspaceValue(activeTask) : null,
        ambientPreferences: cloneWorkspaceValue(normalizeAmbientPreferences(preferences)),
        checkinPreferences: cloneWorkspaceValue(normalizeCheckinPreferences(checkinPreferences)),
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
    normalizeWorkspaceRuntimeState({
        ensureTodayDefaults: true,
        normalizeAmbient: false
    });
}

function applyWorkspaceDatasetSnapshot(snapshot) {
    const source = extractWorkspaceDatasetSource(snapshot);
    runtimeActions.setCheckinData(source.checkinData && typeof source.checkinData === 'object' && !Array.isArray(source.checkinData)
        ? source.checkinData
        : {});
    runtimeActions.setPhoneResistData(normalizePhoneResistDataShape(source.phoneResistData));
    runtimeActions.setTaskData(normalizeTaskDataByDate(source.taskData));
    runtimeActions.setLeaveData(Array.isArray(source.leaveData)
        ? source.leaveData.map((leave) => normalizeLeaveRecord(leave))
        : []);
    runtimeActions.setAchievements(Array.isArray(source.achievements)
        ? source.achievements.filter((achievementId) => typeof achievementId === 'string')
        : []);
    runtimeActions.setQuickNotesData(source.quickNotesData && typeof source.quickNotesData === 'object' && !Array.isArray(source.quickNotesData)
        ? source.quickNotesData
        : {});
    runtimeActions.setTavernData(Array.isArray(source.tavernData)
        ? source.tavernData.filter((drink) => drink && typeof drink === 'object')
        : []);
    ensureWorkspaceTodayDefaults();
}

function buildCloudSyncPayload(syncTime = new Date().toISOString()) {
    return {
        ...buildWorkspaceDatasetSnapshot(),
        lastSyncTime: syncTime
    };
}
