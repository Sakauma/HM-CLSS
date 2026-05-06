/**
 * 云同步界面层。
 * 负责按钮状态、表单读写和本地提示文案。
 */

function setSyncButtonLoading(button, label) {
    if (!button) return;
    setElementIconLabel(button, 'loader-2', label, {
        iconClass: 'w-4 h-4 animate-spin'
    });
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
    const result = saveSyncCredentials(token, nextGistId) || { ok: true, failedKeys: [] };
    if (!result.ok) {
        showToast(`同步配置保存失败：${result.failedKeys.join(', ')}`, 'error');
        populateSyncConfigInputs();
        return false;
    }
    const tokenStorageCopy = getSyncTokenStorage() === localStorage
        ? 'Token 与 Gist ID 已保存到本地。'
        : 'Token 仅保存在当前会话，Gist ID 已保存到本地。';
    showToast(`⚙️ ${tokenStorageCopy}`, 'success');
    return true;
}

function showSyncMissingConfigToast() {
    showToast('请先配置并保存 GitHub Token 和 Gist ID', 'error');
}
