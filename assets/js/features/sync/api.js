/**
 * 云同步 API 模块。
 * 负责与 GitHub Gist 交互，不处理界面状态。
 */

function buildSyncHeaders() {
    const { githubToken: token } = getSyncCredentials();
    return {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
    };
}

function getResponseEtag(response) {
    return response?.headers?.get?.('ETag') || response?.headers?.get?.('etag') || null;
}

async function fetchWorkspaceGistResponse() {
    const { gistId: currentGistId } = getSyncCredentials();
    return fetch(`https://api.github.com/gists/${currentGistId}`, {
        headers: buildSyncHeaders()
    });
}

function parseWorkspaceGistContent(gistResponseData) {
    const file = gistResponseData?.files?.[SYNC_GIST_FILE];
    if (!file?.content) return null;
    try {
        return JSON.parse(file.content);
    } catch (error) {
        throw new Error('fetch_invalid_payload');
    }
}

async function fetchCloudWorkspaceSnapshot() {
    const response = await fetchWorkspaceGistResponse();
    if (!response.ok) {
        throw new Error(`fetch_failed_${response.status}`);
    }

    const gistResponseData = await response.json();
    return {
        data: parseWorkspaceGistContent(gistResponseData),
        etag: getResponseEtag(response)
    };
}

async function fetchCloudWorkspaceData() {
    const snapshot = await fetchCloudWorkspaceSnapshot();
    return snapshot.data;
}

async function pushCloudWorkspaceData(payload, options = {}) {
    const { gistId: currentGistId } = getSyncCredentials();
    const headers = buildSyncHeaders();
    if (options.etag) {
        headers['If-Match'] = options.etag;
    }

    const response = await fetch(`https://api.github.com/gists/${currentGistId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
            files: {
                [SYNC_GIST_FILE]: {
                    content: JSON.stringify(payload, null, 2)
                }
            }
        })
    });

    if (!response.ok) {
        throw new Error(`push_failed_${response.status}`);
    }

    return response;
}
