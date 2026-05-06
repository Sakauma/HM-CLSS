/**
 * 云同步状态模块。
 * 负责同步凭据、本地同步时间与自动同步计时器的共享状态。
 */

const SYNC_GIST_FILE = 'workspace_data.json';
const AUTO_SYNC_INTERVAL_MS = 600000;
const SYNC_TOKEN_STORAGE_KEY = 'githubToken';
const SYNC_GIST_STORAGE_KEY = 'gistId';
const SYNC_TIME_STORAGE_KEY = 'localLastSyncTime';
const LOCAL_BACKUP_BEFORE_CLOUD_APPLY_KEY = 'lastLocalBackupBeforeCloudApply';

function getSyncTokenStorage() {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : localStorage;
}

function readStoredSyncToken() {
    const tokenStorage = getSyncTokenStorage();
    const sessionToken = tokenStorage.getItem(SYNC_TOKEN_STORAGE_KEY) || '';
    const legacyToken = localStorage.getItem(SYNC_TOKEN_STORAGE_KEY) || '';

    if (!sessionToken && legacyToken && tokenStorage !== localStorage) {
        tokenStorage.setItem(SYNC_TOKEN_STORAGE_KEY, legacyToken);
        localStorage.removeItem(SYNC_TOKEN_STORAGE_KEY);
        return legacyToken;
    }

    if (sessionToken && tokenStorage !== localStorage && legacyToken) {
        localStorage.removeItem(SYNC_TOKEN_STORAGE_KEY);
    }

    return sessionToken || legacyToken;
}

function persistStorageValue(storage, key, value) {
    if (!storage) return;
    if (value) {
        storage.setItem(key, value);
    } else {
        storage.removeItem(key);
    }
}

function createSyncStorageOperationResult() {
    return typeof createStorageOperationResult === 'function'
        ? createStorageOperationResult()
        : { ok: true, failedKeys: [] };
}

function recordSyncStorageFailure(result, key, error) {
    result.ok = false;
    if (!result.failedKeys.includes(key)) {
        result.failedKeys.push(key);
    }
    console.error(`storage write failed for "${key}":`, error);
}

function persistSyncStorageValue(storage, key, value, result) {
    try {
        persistStorageValue(storage, key, value);
        return true;
    } catch (error) {
        recordSyncStorageFailure(result, key, error);
        return false;
    }
}

let githubToken = readStoredSyncToken();
let gistId = localStorage.getItem(SYNC_GIST_STORAGE_KEY) || '';
let localLastSyncTime = localStorage.getItem(SYNC_TIME_STORAGE_KEY) || '';
let autoSyncTimer = null;

function hasSyncCredentials() {
    return Boolean(githubToken && gistId);
}

function getSyncCredentials() {
    return { githubToken, gistId };
}

function clearAutoSyncTimer() {
    if (!autoSyncTimer) return false;
    clearTimeout(autoSyncTimer);
    autoSyncTimer = null;
    return true;
}

function saveSyncCredentials(nextToken, nextGistId) {
    const result = createSyncStorageOperationResult();
    const tokenStorage = getSyncTokenStorage();
    const credentialsChanged = githubToken !== nextToken || gistId !== nextGistId;
    const previousToken = githubToken;
    const previousGistId = gistId;

    persistSyncStorageValue(tokenStorage, SYNC_TOKEN_STORAGE_KEY, nextToken, result);
    if (tokenStorage !== localStorage) {
        persistSyncStorageValue(localStorage, SYNC_TOKEN_STORAGE_KEY, '', result);
    }
    persistSyncStorageValue(localStorage, SYNC_GIST_STORAGE_KEY, nextGistId, result);

    if (!result.ok) {
        persistSyncStorageValue(tokenStorage, SYNC_TOKEN_STORAGE_KEY, previousToken, createSyncStorageOperationResult());
        if (tokenStorage !== localStorage) {
            persistSyncStorageValue(localStorage, SYNC_TOKEN_STORAGE_KEY, '', createSyncStorageOperationResult());
        }
        persistSyncStorageValue(localStorage, SYNC_GIST_STORAGE_KEY, previousGistId, createSyncStorageOperationResult());
        if (typeof notifyStorageWriteFailure === 'function') {
            notifyStorageWriteFailure(result);
        }
        return result;
    }

    if (credentialsChanged) {
        clearAutoSyncTimer();
    }
    githubToken = nextToken;
    gistId = nextGistId;
    return result;
}

function updateLocalSyncTime(timeStr) {
    const result = typeof createStorageOperationResult === 'function'
        ? createStorageOperationResult()
        : { ok: true, failedKeys: [] };
    try {
        if (typeof safeSetStorageItem === 'function' && typeof safeRemoveStorageItem === 'function') {
            if (timeStr) {
                safeSetStorageItem(SYNC_TIME_STORAGE_KEY, timeStr, result);
            } else {
                safeRemoveStorageItem(SYNC_TIME_STORAGE_KEY, result);
            }
        } else {
            persistStorageValue(localStorage, SYNC_TIME_STORAGE_KEY, timeStr);
        }
    } catch (error) {
        result.ok = false;
        if (!result.failedKeys.includes(SYNC_TIME_STORAGE_KEY)) {
            result.failedKeys.push(SYNC_TIME_STORAGE_KEY);
        }
        console.error(`localStorage write failed for "${SYNC_TIME_STORAGE_KEY}":`, error);
    }
    if (!result.ok && typeof notifyStorageWriteFailure === 'function') {
        notifyStorageWriteFailure(result);
    }
    if (result.ok) {
        localLastSyncTime = timeStr;
    }
    return result;
}
