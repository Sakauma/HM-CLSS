/**
 * 云同步逻辑层。
 * 负责冲突判断、拉取/推送流程和节流自动同步。
 */

function hasMeaningfulLocalData() {
    if (runtimeSelectors.currentTask()) return true;

    if (phoneResistData.totalCount > 0 || leaveData.length > 0 || achievements.length > 0 || tavernData.length > 0) {
        return true;
    }

    if (countTotalTaskEntries() > 0 || countQuickNoteEntries() > 0) {
        return true;
    }

    return Object.values(checkinData).some((day) => {
        if (!day || typeof day !== 'object') return false;
        const normalizedDay = ensureDayRecord(day);
        if (normalizedDay.leave) return true;
        if (Array.isArray(normalizedDay.partialLeaves) && normalizedDay.partialLeaves.length > 0) return true;
        return hasAnyCheckinRecord(normalizedDay);
    });
}

function isCloudSyncNewerThanLocal(cloudSyncTime) {
    if (!cloudSyncTime) return false;
    const cloudTimestamp = new Date(cloudSyncTime).getTime();
    const localTimestamp = localLastSyncTime ? new Date(localLastSyncTime).getTime() : NaN;

    if (!Number.isFinite(cloudTimestamp)) return false;
    return !Number.isFinite(localTimestamp) || cloudTimestamp > localTimestamp;
}

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

function backupLocalDataBeforeCloudApply(reason) {
    const result = createStorageOperationResult();
    safeSetStorageItem(LOCAL_BACKUP_BEFORE_CLOUD_APPLY_KEY, JSON.stringify({
        datasets: buildWorkspaceDatasetSnapshot(),
        state: buildWorkspaceStateSnapshot(),
        backupReason: reason,
        backupTime: new Date().toISOString()
    }), result);
    if (!result.ok) console.error('本地覆盖前备份失败');
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

function applyWorkspaceStateSnapshot(snapshot = {}) {
    const normalizedCurrentTask = normalizeCurrentTaskRecord(snapshot.currentTask);
    runtimeActions.setCurrentTask(normalizedCurrentTask);
    persistCurrentTask();

    runtimeActions.setAmbientPreferences(normalizeAmbientPreferences(snapshot.ambientPreferences));
    runtimeActions.setCheckinPreferences(normalizeCheckinPreferences(snapshot.checkinPreferences));
    updateLocalSyncTime(snapshot.lastSyncTime || '');

    if (typeof renderCheckinPreferenceForm === 'function') {
        renderCheckinPreferenceForm(runtimeSelectors.checkinPreferences());
    }
    if (typeof renderCheckinPreferenceSummary === 'function') {
        renderCheckinPreferenceSummary(runtimeSelectors.checkinPreferences());
    }
}

async function restoreLocalBackupBeforeCloudApply() {
    const backup = readLocalBackupBeforeCloudApply();
    if (!backup) {
        showToast('没有可恢复的覆盖前备份。', 'warning');
        refreshLocalBackupRestoreState();
        return;
    }

    const confirmed = await showConfirmDialog({
        title: '恢复覆盖前本地备份？',
        message: '确认后会用最近一次云端覆盖前的本地备份替换当前工作区。建议恢复后先检查数据，再决定是否上传云端。',
        badge: 'LOCAL BACKUP',
        confirmLabel: '恢复备份',
        cancelLabel: '暂不恢复',
        tone: 'warning'
    });
    if (!confirmed) return;

    applyWorkspaceDatasetSnapshot(backup.datasets);
    applyWorkspaceStateSnapshot(backup.state || {});
    const saveResult = saveData(true) || { ok: true };
    refreshWorkspaceUiAfterSync();
    refreshLocalBackupRestoreState();
    if (saveResult.ok) {
        showToast('已恢复覆盖前本地备份，请检查后再同步。', 'success');
    }
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
    backupLocalDataBeforeCloudApply('cloud-apply');
    applyWorkspaceDatasetSnapshot(cloudData);
    const saveResult = saveData(true) || { ok: true };
    if (saveResult.ok) {
        updateLocalSyncTime(cloudData.lastSyncTime || new Date().toISOString());
    }
    refreshWorkspaceUiAfterSync();
    refreshLocalBackupRestoreState();
}

function shouldAutoApplyCloudData(cloudData) {
    if (!cloudData?.lastSyncTime) return false;
    if (!localLastSyncTime) return !hasMeaningfulLocalData();
    return isCloudSyncNewerThanLocal(cloudData.lastSyncTime);
}

async function maybeConfirmCloudOverwrite() {
    const uploadGuard = await inspectCloudBeforeUpload();
    return uploadGuard.confirmed;
}

async function inspectCloudBeforeUpload() {
    const cloudSnapshot = await fetchCloudWorkspaceSnapshot();
    const cloudData = cloudSnapshot.data;
    if (!cloudData?.lastSyncTime) {
        return {
            confirmed: true,
            etag: cloudSnapshot.etag
        };
    }

    if (isCloudSyncNewerThanLocal(cloudData.lastSyncTime)) {
        const confirmed = await showConfirmDialog({
            title: '云端版本更新于本地之后',
            message: '如果继续上传，云端较新的数据会被本地版本覆盖。更稳妥的做法是先拉取云端数据再决定。',
            badge: 'SYNC OVERRIDE',
            confirmLabel: '仍然上传',
            cancelLabel: '先去拉取',
            tone: 'danger'
        });
        return {
            confirmed,
            etag: cloudSnapshot.etag
        };
    }

    return {
        confirmed: true,
        etag: cloudSnapshot.etag
    };
}

async function handlePushCloud() {
    if (!hasSyncCredentials()) {
        showSyncMissingConfigToast();
        return;
    }

    const btn = document.getElementById('push-cloud-btn');
    const originalChildren = cloneChildNodesSnapshot(btn);
    const originalDisabled = btn.disabled;
    btn.disabled = true;

    setSyncButtonLoading(btn, '检查冲突...');

    try {
        const uploadGuard = await inspectCloudBeforeUpload();
        if (!uploadGuard.confirmed) {
            showToast('已拦截上传操作，保护了云端数据', 'warning');
            return;
        }

        setSyncButtonLoading(btn, '上传中...');

        const currentSyncTime = new Date().toISOString();
        await pushCloudWorkspaceData(buildCloudSyncPayload(currentSyncTime), { etag: uploadGuard.etag });
        updateLocalSyncTime(currentSyncTime);
        showToast('✅ 成功同步至云端！', 'success');
    } catch (error) {
        const message = String(error?.message || '');
        if (message === 'fetch_invalid_payload') {
            showToast('❌ 云端数据文件内容损坏，请先修复后再同步。', 'error');
        } else if (message === 'push_failed_412') {
            showToast('❌ 云端数据已变化，本次上传已取消。请先拉取确认。', 'warning');
        } else if (message.startsWith('fetch_failed_') || message.startsWith('push_failed_')) {
            showToast('❌ 上传失败，请检查配置信息。', 'error');
        } else {
            showToast(`🌐 网络请求失败：${error.message}`, 'error');
        }
    } finally {
        restoreChildNodesSnapshot(btn, originalChildren);
        btn.disabled = originalDisabled;
        lucide.createIcons();
    }
}

async function handlePullCloud() {
    if (!hasSyncCredentials()) {
        showSyncMissingConfigToast();
        return;
    }
    const confirmed = await showConfirmDialog({
        title: '拉取云端数据并覆盖本地？',
        message: '确认后会用云端版本替换当前本地数据，未导出的本地改动会丢失。',
        badge: 'SYNC PULL',
        confirmLabel: '确认拉取',
        cancelLabel: '暂不拉取',
        tone: 'warning'
    });
    if (!confirmed) return;

    const btn = document.getElementById('pull-cloud-btn');
    const originalChildren = cloneChildNodesSnapshot(btn);
    const originalDisabled = btn.disabled;
    btn.disabled = true;
    setSyncButtonLoading(btn, '拉取中...');

    try {
        const cloudData = await fetchCloudWorkspaceData();
        if (cloudData) {
            applyImportedData(cloudData);
            showToast('✅ 成功从云端拉取并应用数据！', 'success');
        } else {
            showToast('❌ 未找到云端数据文件。', 'error');
        }
    } catch (error) {
        const message = String(error?.message || '');
        if (message === 'fetch_invalid_payload') {
            showToast('❌ 云端数据文件内容损坏，当前无法拉取。', 'error');
        } else if (message.startsWith('fetch_failed_')) {
            showToast('❌ 拉取失败，请检查配置。', 'error');
        } else {
            showToast(`🌐 网络请求失败：${error.message}`, 'error');
        }
    } finally {
        restoreChildNodesSnapshot(btn, originalChildren);
        btn.disabled = originalDisabled;
        lucide.createIcons();
    }
}

function triggerAutoSync() {
    if (!hasSyncCredentials() || autoSyncTimer) return;

    console.log('☁️ 检测到数据变动，开始10分钟同步倒计时...');
    autoSyncTimer = setTimeout(async () => {
        try {
            const cloudSnapshot = await fetchCloudWorkspaceSnapshot();
            const cloudData = cloudSnapshot.data;
            if (isCloudSyncNewerThanLocal(cloudData?.lastSyncTime)) {
                if (typeof showToast === 'function') {
                    showToast('检测到云端已有更新，已取消自动上传。请先手动拉取确认。', 'warning');
                }
                return;
            }

            const currentSyncTime = new Date().toISOString();
            await pushCloudWorkspaceData(buildCloudSyncPayload(currentSyncTime), { etag: cloudSnapshot.etag });
            updateLocalSyncTime(currentSyncTime);
            console.log('☁️ 后台节流自动同步成功：', new Date().toLocaleTimeString());
        } catch (error) {
            console.error('☁️ 后台同步失败:', error);
            if (typeof showToast === 'function') {
                const message = String(error?.message || '');
                showToast(
                    message === 'push_failed_412'
                        ? '自动同步检测到云端已变化，已取消上传。请先手动拉取确认。'
                        : '自动同步失败，未覆盖云端数据。请稍后手动同步。',
                    'warning'
                );
            }
        } finally {
            autoSyncTimer = null;
        }
    }, AUTO_SYNC_INTERVAL_MS);
}

async function autoPullOnStartup(runState = null) {
    if (!hasSyncCredentials()) return;

    try {
        const cloudData = await fetchCloudWorkspaceData();
        if (runState && runState.active === false) return;
        if (cloudData && shouldAutoApplyCloudData(cloudData)) {
            applyImportedData(cloudData);
            showToast('已自动为您同步云端最新数据 ☁️', 'success');
        }
    } catch (error) {
        if (runState && runState.active === false) return;
        const message = String(error?.message || '');
        if (message === 'fetch_invalid_payload') {
            console.error('☁️ [Auto-Sync] 云端数据文件内容损坏，已跳过自动拉取。');
            return;
        }
        console.error('☁️ [Auto-Sync] 启动检查失败:', error);
    }
}
