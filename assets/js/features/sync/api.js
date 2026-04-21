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

async function fetchCloudWorkspaceData() {
    const response = await fetchWorkspaceGistResponse();
    if (!response.ok) {
        throw new Error(`fetch_failed_${response.status}`);
    }

    const gistResponseData = await response.json();
    return parseWorkspaceGistContent(gistResponseData);
}

async function pushCloudWorkspaceData(payload) {
    const { gistId: currentGistId } = getSyncCredentials();
    const response = await fetch(`https://api.github.com/gists/${currentGistId}`, {
        method: 'PATCH',
        headers: buildSyncHeaders(),
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
