/**
 * 云同步状态模块。
 * 负责同步凭据、本地同步时间与自动同步计时器的共享状态。
 */

const SYNC_GIST_FILE = 'workspace_data.json';
const AUTO_SYNC_INTERVAL_MS = 600000;

let githubToken = localStorage.getItem('githubToken') || '';
let gistId = localStorage.getItem('gistId') || '';
let localLastSyncTime = localStorage.getItem('localLastSyncTime') || '';
let autoSyncTimer = null;

function hasSyncCredentials() {
    return Boolean(githubToken && gistId);
}

function getSyncCredentials() {
    return { githubToken, gistId };
}

function saveSyncCredentials(nextToken, nextGistId) {
    githubToken = nextToken;
    gistId = nextGistId;
    localStorage.setItem('githubToken', githubToken);
    localStorage.setItem('gistId', gistId);
}

function updateLocalSyncTime(timeStr) {
    localLastSyncTime = timeStr;
    localStorage.setItem('localLastSyncTime', timeStr);
}
