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

function applyImportedData(cloudData) {
    applyWorkspaceDatasetSnapshot(cloudData);
    saveData(true);
    updateLocalSyncTime(cloudData.lastSyncTime || new Date().toISOString());
    refreshWorkspaceUiAfterSync();
}

function shouldAutoApplyCloudData(cloudData) {
    if (!cloudData?.lastSyncTime) return false;
    if (!localLastSyncTime) return !hasMeaningfulLocalData();
    return new Date(cloudData.lastSyncTime) > new Date(localLastSyncTime);
}

async function maybeConfirmCloudOverwrite() {
    const cloudData = await fetchCloudWorkspaceData();
    if (!cloudData?.lastSyncTime) return true;

    if (!localLastSyncTime || new Date(cloudData.lastSyncTime) > new Date(localLastSyncTime)) {
        return showConfirmDialog({
            title: '云端版本更新于本地之后',
            message: '如果继续上传，云端较新的数据会被本地版本覆盖。更稳妥的做法是先拉取云端数据再决定。',
            badge: 'SYNC OVERRIDE',
            confirmLabel: '仍然上传',
            cancelLabel: '先去拉取',
            tone: 'danger'
        });
    }

    return true;
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
        const confirmed = await maybeConfirmCloudOverwrite();
        if (!confirmed) {
            showToast('已拦截上传操作，保护了云端数据', 'warning');
            return;
        }

        setSyncButtonLoading(btn, '上传中...');

        const currentSyncTime = new Date().toISOString();
        await pushCloudWorkspaceData(buildCloudSyncPayload(currentSyncTime));
        updateLocalSyncTime(currentSyncTime);
        showToast('✅ 成功同步至云端！', 'success');
    } catch (error) {
        const message = String(error?.message || '');
        if (message.startsWith('fetch_failed_') || message.startsWith('push_failed_')) {
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
        if (message.startsWith('fetch_failed_')) {
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
            const currentSyncTime = new Date().toISOString();
            await pushCloudWorkspaceData(buildCloudSyncPayload(currentSyncTime));
            updateLocalSyncTime(currentSyncTime);
            console.log('☁️ 后台节流自动同步成功：', new Date().toLocaleTimeString());
        } catch (error) {
            console.error('☁️ 后台同步失败:', error);
        } finally {
            autoSyncTimer = null;
        }
    }, AUTO_SYNC_INTERVAL_MS);
}

async function autoPullOnStartup() {
    if (!hasSyncCredentials()) return;

    try {
        const cloudData = await fetchCloudWorkspaceData();
        if (cloudData && shouldAutoApplyCloudData(cloudData)) {
            applyImportedData(cloudData);
            showToast('已自动为您同步云端最新数据 ☁️', 'success');
        }
    } catch (error) {
        console.error('☁️ [Auto-Sync] 启动检查失败:', error);
    }
}
