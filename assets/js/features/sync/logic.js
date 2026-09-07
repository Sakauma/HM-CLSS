/**
 * 云同步控制层。
 * 负责拉取/推送流程和节流自动同步。
 */

function getUploadGuardCancelMessage(reason) {
    if (reason === 'missing_etag') {
        return '无法确认云端版本，已取消上传。请稍后重试或先拉取确认。';
    }
    return '已拦截上传操作，保护了云端数据';
}

function isCloudUploadBlockedByStorage() {
    return typeof isStoragePersistenceBlocked === 'function' && isStoragePersistenceBlocked();
}

function getCorruptedCloudUploadKeys() {
    if (typeof getCorruptedStorageKeys !== 'function') return [];
    const keys = getCorruptedStorageKeys();
    return Array.isArray(keys) ? keys : [];
}

function isCloudUploadBlockedByLocalIntegrity() {
    return isCloudUploadBlockedByStorage() || getCorruptedCloudUploadKeys().length > 0;
}

function getStorageUploadBlockMessage() {
    if (isCloudUploadBlockedByStorage()) {
        const reason = typeof getStorageBlockReason === 'function'
            ? getStorageBlockReason()
            : 'storageConsistency';
        return reason === 'startupRead'
            ? '本地数据未完整读取，当前处于只读保护；恢复浏览器存储后刷新页面再同步'
            : '本地保存回滚未完整完成，当前处于只读保护；请先导出数据并刷新页面再同步';
    }
    const corruptedKeys = getCorruptedCloudUploadKeys();
    return `检测到本地数据损坏（${corruptedKeys.join(', ')}），不能上传不完整快照，以免覆盖云端；请修复存储后刷新页面再同步`;
}

function stopCloudUploadForStorageProtection() {
    if (!isCloudUploadBlockedByLocalIntegrity()) return false;
    if (typeof showToast === 'function') {
        showToast(getStorageUploadBlockMessage(), 'warning');
    }
    return true;
}

function reportAcceptedUploadDuringStorageProtection(syncTime) {
    autoSyncRemoteBaselineTime = syncTime;
    if (typeof showToast === 'function') {
        showToast('云端已接收上传开始前的快照，但本地随后进入只读保护；当前状态未标记为同步完成，请先导出数据并刷新页面', 'warning');
    }
}

let autoSyncDirtyRevision = 0;
let autoSyncCompletedRevision = 0;
let autoSyncInFlightPromise = null;
let manualSyncInFlight = false;
let autoSyncEnabled = true;
let autoSyncEpoch = 0;
let autoSyncRemoteBaselineTime = localLastSyncTime || '';

function getSyncTimestamp(timeStr) {
    const timestamp = timeStr ? new Date(timeStr).getTime() : NaN;
    return Number.isFinite(timestamp) ? timestamp : NaN;
}

function isCloudSyncNewerThanKnownBaseline(cloudSyncTime) {
    const cloudTimestamp = getSyncTimestamp(cloudSyncTime);
    if (!Number.isFinite(cloudTimestamp)) return false;

    const localTimestamp = getSyncTimestamp(localLastSyncTime);
    const uploadedTimestamp = getSyncTimestamp(autoSyncRemoteBaselineTime);
    const knownTimestamps = [localTimestamp, uploadedTimestamp].filter(Number.isFinite);
    if (!knownTimestamps.length) return true;
    return cloudTimestamp > Math.max(...knownTimestamps);
}

function recordSuccessfulCloudUpload(syncTime, uploadedRevision) {
    autoSyncRemoteBaselineTime = syncTime;
    autoSyncCompletedRevision = Math.max(autoSyncCompletedRevision, uploadedRevision);
}

function resetAutoSyncTracking() {
    autoSyncEpoch += 1;
    autoSyncRemoteBaselineTime = '';
    autoSyncCompletedRevision = autoSyncDirtyRevision;
}

function enableAutoSync() {
    autoSyncEnabled = true;
    schedulePendingAutoSync();
}

function disableAutoSync() {
    autoSyncEnabled = false;
    clearAutoSyncTimer();
}

function schedulePendingAutoSync() {
    if (
        !autoSyncEnabled ||
        !hasSyncCredentials() ||
        isCloudUploadBlockedByLocalIntegrity() ||
        autoSyncTimer ||
        autoSyncInFlightPromise ||
        manualSyncInFlight ||
        autoSyncDirtyRevision <= autoSyncCompletedRevision
    ) {
        return false;
    }

    appLogger.info('☁️ 检测到数据变动，开始10分钟同步倒计时...');
    const timer = setTimeout(() => runScheduledAutoSync(timer), AUTO_SYNC_INTERVAL_MS);
    autoSyncTimer = timer;
    return true;
}

async function waitForAutoSyncUpload() {
    while (autoSyncInFlightPromise) {
        await autoSyncInFlightPromise;
    }
}

async function handlePushCloud() {
    if (stopCloudUploadForStorageProtection()) return;
    if (!hasSyncCredentials()) {
        showSyncMissingConfigToast();
        return;
    }

    const btn = document.getElementById('push-cloud-btn');
    const originalChildren = cloneChildNodesSnapshot(btn);
    const originalDisabled = btn.disabled;
    btn.disabled = true;
    clearAutoSyncTimer();
    manualSyncInFlight = true;

    setSyncButtonLoading(btn, '检查冲突...');

    const attemptStartRevision = autoSyncDirtyRevision;
    let allowAutoReschedule = false;
    let manualUploadCompleted = false;

    try {
        await waitForAutoSyncUpload();
        if (stopCloudUploadForStorageProtection()) return;
        if (!hasSyncCredentials()) {
            showSyncMissingConfigToast();
            return;
        }

        const uploadEpoch = autoSyncEpoch;
        const uploadGuard = await inspectCloudBeforeUpload();
        if (stopCloudUploadForStorageProtection()) return;
        if (!uploadGuard.confirmed) {
            showToast(getUploadGuardCancelMessage(uploadGuard.reason), 'warning');
            return;
        }

        setSyncButtonLoading(btn, '上传中...');

        const currentSyncTime = new Date().toISOString();
        const uploadedRevision = autoSyncDirtyRevision;
        const payload = buildCloudSyncPayload(currentSyncTime);
        await pushCloudWorkspaceData(payload, { etag: uploadGuard.etag });
        if (uploadEpoch !== autoSyncEpoch) {
            allowAutoReschedule = true;
            return;
        }
        if (isCloudUploadBlockedByLocalIntegrity()) {
            reportAcceptedUploadDuringStorageProtection(currentSyncTime);
            return;
        }

        recordSuccessfulCloudUpload(currentSyncTime, uploadedRevision);
        allowAutoReschedule = true;
        manualUploadCompleted = true;
        const syncTimeResult = updateLocalSyncTime(currentSyncTime);
        if (syncTimeResult.ok) {
            showToast('✅ 成功同步至云端！', 'success');
        } else {
            showToast('云端已上传，但本地同步时间保存失败。请检查浏览器存储后重试。', 'warning');
        }
    } catch (error) {
        const message = String(error?.message || '');
        if (message === 'fetch_invalid_payload') {
            showToast('❌ 云端数据文件内容损坏，请先修复后再同步。', 'error');
        } else if (message === 'push_failed_412') {
            showToast('❌ 云端数据已变化，本次上传已取消。请先拉取确认。', 'warning');
        } else if (message === 'push_missing_etag') {
            showToast('无法确认云端版本，已取消上传。请稍后重试或先拉取确认。', 'warning');
        } else if (message.startsWith('fetch_failed_') || message.startsWith('push_failed_')) {
            showToast('❌ 上传失败，请检查配置信息。', 'error');
            allowAutoReschedule = message !== 'push_failed_412';
        } else {
            showToast(`🌐 网络请求失败：${error.message}`, 'error');
            allowAutoReschedule = true;
        }
    } finally {
        manualSyncInFlight = false;
        restoreChildNodesSnapshot(btn, originalChildren);
        btn.disabled = originalDisabled;
        lucide.createIcons();
        if (
            allowAutoReschedule &&
            autoSyncDirtyRevision > autoSyncCompletedRevision &&
            (manualUploadCompleted || autoSyncDirtyRevision > attemptStartRevision)
        ) {
            schedulePendingAutoSync();
        }
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
            if (applyImportedData(cloudData)) {
                showToast('✅ 成功从云端拉取并应用数据！', 'success');
            }
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

async function performAutoSyncUpload(uploadEpoch, attemptStartRevision) {
    if (stopCloudUploadForStorageProtection()) {
        return { allowReschedule: false, uploaded: false, attemptStartRevision };
    }
    try {
        const cloudSnapshot = await fetchCloudWorkspaceSnapshot();
        if (stopCloudUploadForStorageProtection()) {
            return { allowReschedule: false, uploaded: false, attemptStartRevision };
        }
        if (uploadEpoch !== autoSyncEpoch || !autoSyncEnabled || !hasSyncCredentials()) {
            return { allowReschedule: false, uploaded: false, attemptStartRevision };
        }

        const cloudData = cloudSnapshot.data;
        if (isCloudSyncNewerThanKnownBaseline(cloudData?.lastSyncTime)) {
            if (typeof showToast === 'function') {
                showToast('检测到云端已有更新，已取消自动上传。请先手动拉取确认。', 'warning');
            }
            return { allowReschedule: false, uploaded: false, attemptStartRevision };
        }

        if (!hasConditionalCloudUploadToken(cloudSnapshot)) {
            throw new Error('push_missing_etag');
        }

        if (stopCloudUploadForStorageProtection()) {
            return { allowReschedule: false, uploaded: false, attemptStartRevision };
        }

        const currentSyncTime = new Date().toISOString();
        const uploadedRevision = autoSyncDirtyRevision;
        const payload = buildCloudSyncPayload(currentSyncTime);
        await pushCloudWorkspaceData(payload, { etag: cloudSnapshot.etag });
        if (uploadEpoch !== autoSyncEpoch) {
            return { allowReschedule: true, uploaded: false, attemptStartRevision };
        }
        if (isCloudUploadBlockedByLocalIntegrity()) {
            reportAcceptedUploadDuringStorageProtection(currentSyncTime);
            return { allowReschedule: false, uploaded: false, attemptStartRevision };
        }

        recordSuccessfulCloudUpload(currentSyncTime, uploadedRevision);
        const syncTimeResult = updateLocalSyncTime(currentSyncTime);
        if (!syncTimeResult.ok) {
            appLogger.error('☁️ 云端已上传，但本地同步时间保存失败。');
            if (typeof showToast === 'function') {
                showToast('云端已上传，但本地同步时间保存失败。请检查浏览器存储。', 'warning');
            }
        } else {
            appLogger.info('☁️ 后台节流自动同步成功：', new Date().toLocaleTimeString());
        }
        return { allowReschedule: true, uploaded: true, attemptStartRevision };
    } catch (error) {
        appLogger.error('☁️ 后台同步失败:', error);
        const message = String(error?.message || '');
        const blockedByConflict = message === 'push_failed_412' || message === 'push_missing_etag';
        if (typeof showToast === 'function') {
            showToast(
                message === 'push_failed_412'
                    ? '自动同步检测到云端已变化，已取消上传。请先手动拉取确认。'
                    : message === 'push_missing_etag'
                        ? '自动同步无法确认云端版本，已取消上传。请稍后手动同步。'
                        : '自动同步失败，未覆盖云端数据。请稍后手动同步。',
                'warning'
            );
        }
        return { allowReschedule: !blockedByConflict, uploaded: false, attemptStartRevision };
    }
}

async function runScheduledAutoSync(timer) {
    if (autoSyncTimer !== timer) return;
    autoSyncTimer = null;
    if (!autoSyncEnabled || !hasSyncCredentials() || autoSyncInFlightPromise || manualSyncInFlight) return;

    const uploadEpoch = autoSyncEpoch;
    const attemptStartRevision = autoSyncDirtyRevision;
    const uploadPromise = performAutoSyncUpload(uploadEpoch, attemptStartRevision);
    autoSyncInFlightPromise = uploadPromise;

    let shouldReschedule = false;
    try {
        const result = await uploadPromise;
        const hasNewerChanges = autoSyncDirtyRevision > result.attemptStartRevision;
        shouldReschedule = result.allowReschedule && (
            autoSyncDirtyRevision > autoSyncCompletedRevision &&
            (result.uploaded || hasNewerChanges)
        );
    } finally {
        if (autoSyncInFlightPromise === uploadPromise) {
            autoSyncInFlightPromise = null;
        }
        if (shouldReschedule) {
            schedulePendingAutoSync();
        }
    }
}

function triggerAutoSync() {
    if (!autoSyncEnabled || !hasSyncCredentials() || isCloudUploadBlockedByLocalIntegrity()) return;
    autoSyncDirtyRevision += 1;
    schedulePendingAutoSync();
}

async function autoPullOnStartup(runState = null) {
    if (!hasSyncCredentials()) return;

    try {
        const cloudData = await fetchCloudWorkspaceData();
        if (runState && runState.active === false) return;
        if (cloudData && shouldAutoApplyCloudData(cloudData)) {
            if (applyImportedData(cloudData)) {
                showToast('已自动为您同步云端最新数据 ☁️', 'success');
            }
        }
    } catch (error) {
        if (runState && runState.active === false) return;
        const message = String(error?.message || '');
        if (message === 'fetch_invalid_payload') {
            appLogger.error('☁️ [Auto-Sync] 云端数据文件内容损坏，已跳过自动拉取。');
            return;
        }
        appLogger.error('☁️ [Auto-Sync] 启动检查失败:', error);
    }
}
