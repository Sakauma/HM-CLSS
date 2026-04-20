/**
 * 云同步控制器模块。
 * 负责同步表单、拉取/推送流程、冲突确认和节流自动同步。
 */

function hasMeaningfulLocalData() {
    if (currentTask) return true;

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
    updateCheckinButtons();
    updateTodayCheckinTable();

    document.getElementById('phone-resist-count').textContent = phoneResistData.totalCount;
    document.getElementById('today-phone-resist-count').textContent = phoneResistData.records[today].count;
    updateTodayPhoneResistTimes();
    updateAchievementsList();
    updateTodayTasksList();
    updateSchedule();
    updateLeaveRecordsList();
    renderCurrentTaskState();
    updateTodayStatus();
    if (typeof updateQuickNotesList === 'function') updateQuickNotesList();
    if (typeof renderTavernHistory === 'function') renderTavernHistory();
}

/**
 * 把云端数据完整覆盖到本地内存态，并刷新所有受影响视图。
 * @param {object} cloudData
 */
function applyImportedData(cloudData) {
    applyWorkspaceDatasetSnapshot(cloudData);
    saveData(true);
    updateLocalSyncTime(cloudData.lastSyncTime || new Date().toISOString());
    refreshWorkspaceUiAfterSync();
}

/**
 * 判断启动时是否应自动采用云端版本。
 * 仅在云端时间更新，或本地尚无有效数据时自动覆盖。
 * @param {object} cloudData
 * @returns {boolean}
 */
function shouldAutoApplyCloudData(cloudData) {
    if (!cloudData?.lastSyncTime) return false;
    if (!localLastSyncTime) return !hasMeaningfulLocalData();
    return new Date(cloudData.lastSyncTime) > new Date(localLastSyncTime);
}

function setSyncButtonLoading(button, markup) {
    button.innerHTML = markup;
    lucide.createIcons();
}

function populateSyncConfigInputs() {
    document.getElementById('github-token-input').value = githubToken;
    document.getElementById('gist-id-input').value = gistId;
}

function readSyncConfigForm() {
    return {
        token: document.getElementById('github-token-input').value.trim(),
        nextGistId: document.getElementById('gist-id-input').value.trim()
    };
}

function saveSyncConfig() {
    const { token, nextGistId } = readSyncConfigForm();
    saveSyncCredentials(token, nextGistId);
    showToast('⚙️ 配置已保存到本地！', 'success');
}

function showSyncMissingConfigToast() {
    showToast('请先配置并保存 GitHub Token 和 Gist ID', 'error');
}

async function maybeConfirmCloudOverwrite() {
    const cloudData = await fetchCloudWorkspaceData();
    if (!cloudData?.lastSyncTime) return true;

    if (!localLastSyncTime || new Date(cloudData.lastSyncTime) > new Date(localLastSyncTime)) {
        return confirm('⚠️ 严重警告：\n\n检测到云端存在比您本地更新的数据（可能来自您的另一台设备），或您的本地缺乏同步记录。\n如果您执意上传，云端的新数据将被彻底抹除！\n\n强烈建议点击"取消"，并先执行"拉取云端数据"。\n\n是否仍然要强制覆盖云端？');
    }

    return true;
}

async function handlePushCloud() {
    if (!hasSyncCredentials()) {
        showSyncMissingConfigToast();
        return;
    }

    const btn = document.getElementById('push-cloud-btn');
    const originalText = btn.innerHTML;

    setSyncButtonLoading(btn, '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 检查冲突...');

    try {
        const confirmed = await maybeConfirmCloudOverwrite();
        if (!confirmed) {
            showToast('已拦截上传操作，保护了云端数据', 'warning');
            return;
        }

        setSyncButtonLoading(btn, '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 上传中...');

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
        btn.innerHTML = originalText;
        lucide.createIcons();
    }
}

async function handlePullCloud() {
    if (!hasSyncCredentials()) {
        showSyncMissingConfigToast();
        return;
    }
    if (!confirm('⚠️ 拉取云端数据将覆盖你当前的本地数据！确定要继续吗？')) return;

    const btn = document.getElementById('pull-cloud-btn');
    const originalText = btn.innerHTML;
    setSyncButtonLoading(btn, '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 拉取中...');

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
        btn.innerHTML = originalText;
        lucide.createIcons();
    }
}

/**
 * 在数据变更后启动一个节流自动同步定时器，避免频繁网络写入。
 */
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

/**
 * 页面启动后尝试静默检查云端版本，并在合适时自动应用。
 */
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

function initSyncModule() {
    populateSyncConfigInputs();
    document.getElementById('save-config-btn')?.addEventListener('click', saveSyncConfig);
    document.getElementById('push-cloud-btn')?.addEventListener('click', handlePushCloud);
    document.getElementById('pull-cloud-btn')?.addEventListener('click', handlePullCloud);
    autoPullOnStartup();
}

registerAppModule({
    id: 'sync',
    order: 95,
    init: initSyncModule
});
