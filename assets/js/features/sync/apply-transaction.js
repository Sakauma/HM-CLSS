function hasCloudWorkspaceState(cloudData) {
    return Boolean(cloudData?.state && typeof cloudData.state === 'object' && !Array.isArray(cloudData.state));
}

function getCloudWorkspaceSyncTime(cloudData) {
    return cloudData?.lastSyncTime || new Date().toISOString();
}

function buildCloudWorkspaceApplyState(cloudData) {
    if (!hasCloudWorkspaceState(cloudData)) return null;
    return {
        ...cloudData.state,
        lastSyncTime: getCloudWorkspaceSyncTime(cloudData)
    };
}

function runWorkspaceApplyTransaction({ reason, payload, applyDatasets, applyState } = {}) {
    const beforeSnapshot = createWorkspaceApplySnapshot();
    const backupResult = backupLocalDataBeforeCloudApply(reason || 'cloud-apply');
    if (!backupResult.ok) {
        refreshLocalBackupRestoreState();
        showToast(getWorkspaceSaveFailureMessage('云端数据未应用，覆盖前本地备份失败', backupResult), 'error');
        return false;
    }

    const cloudState = buildCloudWorkspaceApplyState(payload);
    const applyWorkspaceDatasets = applyDatasets || applyWorkspaceDatasetSnapshot;
    const applyWorkspaceState = applyState || applyWorkspaceStateSnapshot;

    applyWorkspaceDatasets(payload);
    if (cloudState) {
        applyWorkspaceState(cloudState, { persist: false });
    }

    const saveResult = saveData(true) || { ok: true, failedKeys: [] };

    if (!saveResult.ok) {
        return rollbackFailedWorkspaceApply(beforeSnapshot, '云端数据未应用', saveResult);
    }

    const stateResult = cloudState
        ? commitWorkspaceStatePersistence(cloudState)
        : updateLocalSyncTime(getCloudWorkspaceSyncTime(payload));
    if (!stateResult.ok) {
        return rollbackFailedWorkspaceApply(beforeSnapshot, '云端数据未应用', stateResult);
    }

    refreshWorkspaceUiAfterSync();
    refreshLocalBackupRestoreState();
    return true;
}
