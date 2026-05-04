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
            showToast(getUploadGuardCancelMessage(uploadGuard.reason), 'warning');
            return;
        }

        setSyncButtonLoading(btn, '上传中...');

        const currentSyncTime = new Date().toISOString();
        await pushCloudWorkspaceData(buildCloudSyncPayload(currentSyncTime), { etag: uploadGuard.etag });
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

            if (!hasConditionalCloudUploadToken(cloudSnapshot)) {
                throw new Error('push_missing_etag');
            }

            const currentSyncTime = new Date().toISOString();
            await pushCloudWorkspaceData(buildCloudSyncPayload(currentSyncTime), { etag: cloudSnapshot.etag });
            const syncTimeResult = updateLocalSyncTime(currentSyncTime);
            if (!syncTimeResult.ok) {
                throw new Error('sync_time_save_failed');
            }
            console.log('☁️ 后台节流自动同步成功：', new Date().toLocaleTimeString());
        } catch (error) {
            console.error('☁️ 后台同步失败:', error);
            if (typeof showToast === 'function') {
                const message = String(error?.message || '');
                showToast(
                    message === 'push_failed_412'
                        ? '自动同步检测到云端已变化，已取消上传。请先手动拉取确认。'
                        : message === 'push_missing_etag'
                            ? '自动同步无法确认云端版本，已取消上传。请稍后手动同步。'
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
            if (applyImportedData(cloudData)) {
                showToast('已自动为您同步云端最新数据 ☁️', 'success');
            }
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
