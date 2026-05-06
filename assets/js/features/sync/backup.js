/**
 * 云同步备份与工作区应用层。
 * 负责覆盖前备份、备份恢复和工作区数据替换的回滚边界。
 */

function refreshWorkspaceUiAfterSync() {
    const today = getTodayString();
    refreshCheckinViews();

    document.getElementById('phone-resist-count').textContent = phoneResistData.totalCount;
    document.getElementById('today-phone-resist-count').textContent = phoneResistData.records[today].count;
    updateTodayPhoneResistTimes();
    updateAchievementsList();
    updateTodayTasksList();
    updateSchedule();
    updateLeaveRecordsList();
    renderCurrentTaskState();
    if (typeof refreshDashboardHome === 'function') {
        refreshDashboardHome();
    } else if (typeof updateTodayStatus === 'function') {
        updateTodayStatus();
        if (typeof updateQuickNotesList === 'function') updateQuickNotesList();
    }
    if (typeof renderTavernHistory === 'function') renderTavernHistory();
}

function createWorkspaceApplySnapshot() {
    return {
        datasets: buildWorkspaceDatasetSnapshot(),
        state: buildWorkspaceStateSnapshot()
    };
}

function restoreWorkspaceApplySnapshot(snapshot) {
    applyWorkspaceDatasetSnapshot(snapshot.datasets);
    applyWorkspaceStateSnapshot(snapshot.state || {}, { persist: false });
}

function rollbackWorkspaceApplySnapshot(snapshot) {
    restoreWorkspaceApplySnapshot(snapshot);
    const saveResult = saveData(true) || { ok: true, failedKeys: [] };
    if (!saveResult.ok) return saveResult;
    return commitWorkspaceStatePersistence(snapshot.state || {});
}

function rollbackFailedWorkspaceApply(beforeSnapshot, failurePrefix, failureResult) {
    const rollbackResult = rollbackWorkspaceApplySnapshot(beforeSnapshot);
    refreshWorkspaceUiAfterSync();
    refreshLocalBackupRestoreState();
    if (!rollbackResult.ok) {
        showToast(getWorkspaceSaveFailureMessage(`${failurePrefix}，且回滚当前工作区保存失败`, rollbackResult), 'error');
        return false;
    }

    showToast(getWorkspaceSaveFailureMessage(`${failurePrefix}，已回滚当前工作区`, failureResult), 'error');
    return false;
}

function commitWorkspaceStatePersistence(snapshot = {}) {
    const taskResult = persistCurrentTask() || { ok: true, failedKeys: [] };
    if (!taskResult.ok) return taskResult;
    return updateLocalSyncTime(snapshot.lastSyncTime || '') || { ok: true, failedKeys: [] };
}

function applyWorkspaceStateSnapshot(snapshot = {}, options = {}) {
    const normalizedCurrentTask = normalizeCurrentTaskRecord(snapshot.currentTask);
    runtimeActions.setCurrentTask(normalizedCurrentTask);

    runtimeActions.setAmbientPreferences(normalizeAmbientPreferences(snapshot.ambientPreferences));
    runtimeActions.setCheckinPreferences(normalizeCheckinPreferences(snapshot.checkinPreferences));

    if (typeof renderCheckinPreferenceForm === 'function') {
        renderCheckinPreferenceForm(runtimeSelectors.checkinPreferences());
    }
    if (typeof renderCheckinPreferenceSummary === 'function') {
        renderCheckinPreferenceSummary(runtimeSelectors.checkinPreferences());
    }

    if (options.persist === false) {
        return { ok: true, failedKeys: [] };
    }
    return commitWorkspaceStatePersistence(snapshot);
}

function getWorkspaceSaveFailureMessage(prefix, result) {
    const failedKeys = Array.isArray(result?.failedKeys) && result.failedKeys.length
        ? `：${result.failedKeys.join(', ')}`
        : '';
    return `${prefix}，本地保存失败${failedKeys}`;
}

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

function backupLocalDataBeforeCloudApply(reason) {
    const result = createStorageOperationResult();
    safeSetStorageItem(LOCAL_BACKUP_BEFORE_CLOUD_APPLY_KEY, JSON.stringify({
        datasets: buildWorkspaceDatasetSnapshot(),
        state: buildWorkspaceStateSnapshot(),
        backupReason: reason,
        backupTime: new Date().toISOString()
    }), result);
    if (!result.ok) console.error('本地覆盖前备份失败');
    return result;
}

function readLocalBackupBeforeCloudApply() {
    const rawBackup = localStorage.getItem(LOCAL_BACKUP_BEFORE_CLOUD_APPLY_KEY);
    if (!rawBackup) return null;

    try {
        const backup = JSON.parse(rawBackup);
        if (!backup || typeof backup !== 'object' || !backup.datasets || typeof backup.datasets !== 'object') {
            return null;
        }
        return backup;
    } catch (error) {
        console.error('覆盖前备份读取失败:', error);
        return null;
    }
}

function getLocalBackupSummary(backup = readLocalBackupBeforeCloudApply()) {
    if (!backup) return '暂无可恢复的覆盖前备份。';

    const backupTime = backup.backupTime
        ? new Date(backup.backupTime).toLocaleString('zh-CN')
        : '未知时间';
    const taskCount = countTotalTaskEntries(backup.datasets.taskData || {});
    const noteCount = countQuickNoteEntries(backup.datasets.quickNotesData || {});
    return `最近备份：${backupTime}，含 ${taskCount} 条任务、${noteCount} 条速记。`;
}

function refreshLocalBackupRestoreState() {
    const summaryEl = document.getElementById('local-backup-summary');
    const restoreBtn = document.getElementById('restore-local-backup-btn');
    const clearBtn = document.getElementById('clear-local-backup-btn');
    const backup = readLocalBackupBeforeCloudApply();

    if (summaryEl) summaryEl.textContent = getLocalBackupSummary(backup);
    if (restoreBtn) restoreBtn.disabled = !backup;
    if (clearBtn) clearBtn.disabled = !backup;
}

async function restoreLocalBackupBeforeCloudApply() {
    const backup = readLocalBackupBeforeCloudApply();
    if (!backup) {
        showToast('没有可恢复的覆盖前备份。', 'warning');
        refreshLocalBackupRestoreState();
        return false;
    }

    const confirmed = await showConfirmDialog({
        title: '恢复覆盖前本地备份？',
        message: '确认后会用最近一次云端覆盖前的本地备份替换当前工作区。建议恢复后先检查数据，再决定是否上传云端。',
        badge: 'LOCAL BACKUP',
        confirmLabel: '恢复备份',
        cancelLabel: '暂不恢复',
        tone: 'warning'
    });
    if (!confirmed) return false;

    const beforeSnapshot = createWorkspaceApplySnapshot();
    applyWorkspaceDatasetSnapshot(backup.datasets);
    applyWorkspaceStateSnapshot(backup.state || {}, { persist: false });
    const saveResult = saveData(true) || { ok: true, failedKeys: [] };

    if (!saveResult.ok) {
        restoreWorkspaceApplySnapshot(beforeSnapshot);
        refreshWorkspaceUiAfterSync();
        refreshLocalBackupRestoreState();
        showToast(getWorkspaceSaveFailureMessage('恢复失败，已保留当前工作区', saveResult), 'error');
        return false;
    }

    const stateResult = commitWorkspaceStatePersistence(backup.state || {});
    if (stateResult.ok) {
        refreshWorkspaceUiAfterSync();
        refreshLocalBackupRestoreState();
        showToast('已恢复覆盖前本地备份，请检查后再同步。', 'success');
        return true;
    }

    const rollbackResult = rollbackWorkspaceApplySnapshot(beforeSnapshot);
    refreshWorkspaceUiAfterSync();
    refreshLocalBackupRestoreState();
    if (!rollbackResult.ok) {
        showToast(getWorkspaceSaveFailureMessage('恢复失败，且回滚当前工作区保存失败', rollbackResult), 'error');
        return false;
    }

    showToast(getWorkspaceSaveFailureMessage('恢复失败，已回滚并保留当前工作区', stateResult), 'error');
    return false;
}

function clearLocalBackupBeforeCloudApply() {
    const result = createStorageOperationResult();
    safeRemoveStorageItem(LOCAL_BACKUP_BEFORE_CLOUD_APPLY_KEY, result);
    refreshLocalBackupRestoreState();
    if (result.ok) {
        showToast('已清除覆盖前本地备份。', 'success');
    }
}

function applyImportedData(cloudData) {
    const beforeSnapshot = createWorkspaceApplySnapshot();
    const backupResult = backupLocalDataBeforeCloudApply('cloud-apply');
    if (!backupResult.ok) {
        refreshLocalBackupRestoreState();
        showToast(getWorkspaceSaveFailureMessage('云端数据未应用，覆盖前本地备份失败', backupResult), 'error');
        return false;
    }

    const cloudState = buildCloudWorkspaceApplyState(cloudData);
    applyWorkspaceDatasetSnapshot(cloudData);
    if (cloudState) {
        applyWorkspaceStateSnapshot(cloudState, { persist: false });
    }

    const saveResult = saveData(true) || { ok: true, failedKeys: [] };

    if (!saveResult.ok) {
        return rollbackFailedWorkspaceApply(beforeSnapshot, '云端数据未应用', saveResult);
    }

    const stateResult = cloudState
        ? commitWorkspaceStatePersistence(cloudState)
        : updateLocalSyncTime(getCloudWorkspaceSyncTime(cloudData));
    if (!stateResult.ok) {
        return rollbackFailedWorkspaceApply(beforeSnapshot, '云端数据未应用', stateResult);
    }

    refreshWorkspaceUiAfterSync();
    refreshLocalBackupRestoreState();
    return true;
}
