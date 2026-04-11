let githubToken = localStorage.getItem('githubToken') || '';
let gistId = localStorage.getItem('gistId') || '';
let localLastSyncTime = localStorage.getItem('localLastSyncTime') || '';
let autoSyncTimer = null;

function updateLocalSyncTime(timeStr) {
    localLastSyncTime = timeStr;
    localStorage.setItem('localLastSyncTime', timeStr);
}

function hasMeaningfulLocalData() {
    if (currentTask) return true;

    if (phoneResistData.totalCount > 0 || leaveData.length > 0 || achievements.length > 0 || tavernData.length > 0) {
        return true;
    }

    if (Object.values(taskData).some((day) => Array.isArray(day) && day.length > 0)) {
        return true;
    }

    if (Object.values(quickNotesData).some((notes) => Array.isArray(notes) && notes.length > 0)) {
        return true;
    }

    return Object.values(checkinData).some((day) => {
        if (!day || typeof day !== 'object') return false;
        if (day.leave) return true;
        if (Array.isArray(day.partialLeaves) && day.partialLeaves.length > 0) return true;
        return ['morning', 'afternoon', 'evening'].some((period) => {
            const periodData = day[period];
            return periodData && (periodData.checkIn || periodData.checkOut);
        });
    });
}

function applyImportedData(cloudData) {
    checkinData = cloudData.checkinData || {};
    phoneResistData = cloudData.phoneResistData || { totalCount: 0, records: {} };
    taskData = cloudData.taskData || {};
    leaveData = cloudData.leaveData || [];
    achievements = cloudData.achievements || [];
    tavernData = cloudData.tavernData || [];
    if (cloudData.quickNotesData) quickNotesData = cloudData.quickNotesData;

    const today = getTodayString();
    if (!checkinData[today]) {
        checkinData[today] = {
            morning: { checkIn: null, checkOut: null, status: { checkIn: null, checkOut: null } },
            afternoon: { checkIn: null, checkOut: null, status: { checkIn: null, checkOut: null } },
            evening: { checkIn: null, checkOut: null, status: { checkIn: null, checkOut: null } },
            leave: false,
            leaveReason: ''
        };
    }
    if (!phoneResistData.records[today]) phoneResistData.records[today] = { count: 0, times: [] };
    if (!taskData[today]) taskData[today] = [];
    if (!quickNotesData[today]) quickNotesData[today] = [];

    saveData(true);
    updateLocalSyncTime(cloudData.lastSyncTime || new Date().toISOString());

    updateCheckinButtons();
    updateTodayCheckinTable();
    document.getElementById('phone-resist-count').textContent = phoneResistData.totalCount;
    document.getElementById('today-phone-resist-count').textContent = phoneResistData.records[today].count;
    updateTodayPhoneResistTimes();
    updateAchievementsList();
    updateTodayTasksList();
    updateSchedule();
    updateLeaveRecordsList();
    updateSummaryStatistics();
    renderCurrentTaskState();
    updateTodayStatus();
    if (typeof updateQuickNotesList === 'function') updateQuickNotesList();
}

function shouldAutoApplyCloudData(cloudData) {
    if (!cloudData.lastSyncTime) return false;
    if (!localLastSyncTime) return !hasMeaningfulLocalData();
    return new Date(cloudData.lastSyncTime) > new Date(localLastSyncTime);
}

document.getElementById('github-token-input').value = githubToken;
document.getElementById('gist-id-input').value = gistId;

document.getElementById('save-config-btn').addEventListener('click', () => {
    githubToken = document.getElementById('github-token-input').value.trim();
    gistId = document.getElementById('gist-id-input').value.trim();
    localStorage.setItem('githubToken', githubToken);
    localStorage.setItem('gistId', gistId);
    showToast('⚙️ 配置已保存到本地！', 'success');
});

function buildExportData() {
    return {
        checkinData,
        phoneResistData,
        taskData,
        leaveData,
        achievements,
        quickNotesData,
        tavernData,
        lastSyncTime: new Date().toISOString()
    };
}

document.getElementById('push-cloud-btn').addEventListener('click', async () => {
    if (!githubToken || !gistId) return showToast('请先配置并保存 GitHub Token 和 Gist ID', 'error');

    const btn = document.getElementById('push-cloud-btn');
    const originalText = btn.innerHTML;

    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 检查冲突...';
    lucide.createIcons();

    try {
        const getRes = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { Authorization: `token ${githubToken}`, Accept: 'application/vnd.github.v3+json' }
        });

        if (getRes.ok) {
            const data = await getRes.json();
            const file = data.files['workspace_data.json'];
            if (file && file.content) {
                const cloudData = JSON.parse(file.content);
                if (cloudData.lastSyncTime) {
                    if (!localLastSyncTime || new Date(cloudData.lastSyncTime) > new Date(localLastSyncTime)) {
                        const confirmPush = confirm('⚠️ 严重警告：\n\n检测到云端存在比您本地更新的数据（可能来自您的另一台设备），或您的本地缺乏同步记录。\n如果您执意上传，云端的新数据将被彻底抹除！\n\n强烈建议点击"取消"，并先执行"拉取云端数据"。\n\n是否仍然要强制覆盖云端？');
                        if (!confirmPush) {
                            btn.innerHTML = originalText;
                            lucide.createIcons();
                            return showToast('已拦截上传操作，保护了云端数据', 'warning');
                        }
                    }
                }
            }
        }

        btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 上传中...';
        lucide.createIcons();

        const currentSyncTime = new Date().toISOString();
        const exportData = buildExportData();
        exportData.lastSyncTime = currentSyncTime;

        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                Authorization: `token ${githubToken}`,
                Accept: 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                files: {
                    'workspace_data.json': {
                        content: JSON.stringify(exportData, null, 2)
                    }
                }
            })
        });

        if (response.ok) {
            updateLocalSyncTime(currentSyncTime);
            showToast('✅ 成功同步至云端！', 'success');
        } else {
            showToast('❌ 上传失败，请检查配置信息。', 'error');
        }
    } catch (error) {
        showToast('🌐 网络请求失败：' + error.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        lucide.createIcons();
    }
});

document.getElementById('pull-cloud-btn').addEventListener('click', async () => {
    if (!githubToken || !gistId) return showToast('请先配置并保存 GitHub Token 和 Gist ID', 'error');
    if (!confirm('⚠️ 拉取云端数据将覆盖你当前的本地数据！确定要继续吗？')) return;

    const btn = document.getElementById('pull-cloud-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 拉取中...';
    lucide.createIcons();

    try {
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: {
                Authorization: `token ${githubToken}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const file = data.files['workspace_data.json'];
            if (file && file.content) {
                const cloudData = JSON.parse(file.content);
                applyImportedData(cloudData);
                showToast('✅ 成功从云端拉取并应用数据！', 'success');
            } else {
                showToast('❌ 未找到云端数据文件。', 'error');
            }
        } else {
            showToast('❌ 拉取失败，请检查配置。', 'error');
        }
    } catch (error) {
        showToast('🌐 网络请求失败：' + error.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        lucide.createIcons();
    }
});

function triggerAutoSync() {
    if (!githubToken || !gistId) return;
    if (autoSyncTimer) return;

    const syncInterval = 600000;

    console.log('☁️ 检测到数据变动，开始10分钟同步倒计时...');
    autoSyncTimer = setTimeout(async () => {
        try {
            const currentSyncTime = new Date().toISOString();
            const exportData = buildExportData();
            exportData.lastSyncTime = currentSyncTime;

            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: { Authorization: `token ${githubToken}`, Accept: 'application/vnd.github.v3+json' },
                body: JSON.stringify({
                    files: {
                        'workspace_data.json': {
                            content: JSON.stringify(exportData, null, 2)
                        }
                    }
                })
            });
            if (response.ok) {
                updateLocalSyncTime(currentSyncTime);
                console.log('☁️ 后台节流自动同步成功：', new Date().toLocaleTimeString());
            }
        } catch (error) {
            console.error('☁️ 后台同步失败:', error);
        } finally {
            autoSyncTimer = null;
        }
    }, syncInterval);
}

async function autoPullOnStartup() {
    if (!githubToken || !gistId) return;

    try {
        const getRes = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { Authorization: `token ${githubToken}`, Accept: 'application/vnd.github.v3+json' }
        });

        if (getRes.ok) {
            const data = await getRes.json();
            const file = data.files['workspace_data.json'];
            if (file && file.content) {
                const cloudData = JSON.parse(file.content);

                if (shouldAutoApplyCloudData(cloudData)) {
                    applyImportedData(cloudData);
                    showToast('已自动为您同步云端最新数据 ☁️', 'success');
                }
            }
        }
    } catch (error) {
        console.error('☁️ [Auto-Sync] 启动检查失败:', error);
    }
}
