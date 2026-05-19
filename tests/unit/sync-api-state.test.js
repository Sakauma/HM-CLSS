const assert = require('node:assert/strict');
const test = require('node:test');

const {
    loadScript,
    createBaseContext,
    createStorageMock
} = require('./helpers');

test('sync api surfaces fetch and push status codes', async () => {
    const context = createBaseContext({
        localStorage: createStorageMock({
            gistId: 'gist_test'
        }),
        sessionStorage: createStorageMock({
            githubToken: 'ghp_test'
        }),
        fetch: async (_url, options = {}) => ({
            ok: false,
            status: options.method === 'PATCH' ? 404 : 401,
            json: async () => ({})
        })
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/api.js');

    await assert.rejects(() => context.fetchCloudWorkspaceData(), /fetch_failed_401/);
    await assert.rejects(() => context.pushCloudWorkspaceData({ ok: true }), /push_missing_etag/);
    await assert.rejects(() => context.pushCloudWorkspaceData({ ok: true }, { etag: '"etag-stale"' }), /push_failed_404/);
});

test('sync api classifies malformed gist payloads', async () => {
    const context = createBaseContext({
        localStorage: createStorageMock({
            gistId: 'gist_test'
        }),
        sessionStorage: createStorageMock({
            githubToken: 'ghp_test'
        }),
        fetch: async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                files: {
                    'workspace_data.json': {
                        content: '{not-valid-json}'
                    }
                }
            })
        })
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/api.js');

    await assert.rejects(() => context.fetchCloudWorkspaceData(), /fetch_invalid_payload/);
});

test('sync api returns gist ETag and sends If-Match on conditional push', async () => {
    const requests = [];
    const context = createBaseContext({
        localStorage: createStorageMock({
            gistId: 'gist_test'
        }),
        sessionStorage: createStorageMock({
            githubToken: 'ghp_test'
        }),
        fetch: async (url, options = {}) => {
            requests.push({ url, options });
            if (options.method === 'PATCH') {
                return {
                    ok: false,
                    status: 412
                };
            }
            return {
                ok: true,
                status: 200,
                headers: {
                    get(name) {
                        return String(name).toLowerCase() === 'etag' ? '"etag-1"' : null;
                    }
                },
                json: async () => ({
                    files: {
                        'workspace_data.json': {
                            content: JSON.stringify({ lastSyncTime: '2026-04-20T10:00:00.000Z' })
                        }
                    }
                })
            };
        }
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/api.js');

    const snapshot = await context.fetchCloudWorkspaceSnapshot();
    assert.equal(snapshot.etag, '"etag-1"');
    assert.equal(snapshot.data.lastSyncTime, '2026-04-20T10:00:00.000Z');

    await assert.rejects(() => context.pushCloudWorkspaceData({ ok: true }, { etag: snapshot.etag }), /push_failed_412/);
    assert.equal(requests.at(-1).options.headers['If-Match'], '"etag-1"');
});

test('sync state migrates legacy token storage into session scope', () => {
    const localStorage = createStorageMock({
        githubToken: 'legacy_token',
        gistId: 'gist_test'
    });
    const sessionStorage = createStorageMock();
    const context = createBaseContext({
        localStorage,
        sessionStorage
    });

    loadScript(context, 'assets/js/features/sync/state.js');

    assert.equal(sessionStorage.getItem('githubToken'), 'legacy_token');
    assert.equal(localStorage.getItem('githubToken'), null);
    const credentials = context.getSyncCredentials();
    assert.equal(credentials.githubToken, 'legacy_token');
    assert.equal(credentials.gistId, 'gist_test');
});

test('sync state tolerates storage read and migration failures', () => {
    const localStorage = {
        getItem(key) {
            if (key === 'githubToken') return 'legacy_token';
            throw new Error('read blocked');
        },
        setItem() {
            throw new Error('write blocked');
        },
        removeItem() {
            throw new Error('remove blocked');
        }
    };
    const sessionStorage = {
        getItem() {
            return null;
        },
        setItem() {
            throw new Error('session write blocked');
        },
        removeItem() {
            throw new Error('session remove blocked');
        }
    };
    const context = createBaseContext({
        console: { ...console, error() {} },
        localStorage,
        sessionStorage
    });

    assert.doesNotThrow(() => loadScript(context, 'assets/js/features/sync/state.js'));
    assert.equal(context.getSyncCredentials().githubToken, 'legacy_token');
    assert.equal(context.getSyncCredentials().gistId, '');

    const result = context.updateLocalSyncTime('2026-04-20T10:00:00.000Z');
    assert.equal(result.ok, false);
    assert.equal(result.failedKeys.length, 1);
    assert.equal(result.failedKeys[0], 'localLastSyncTime');
});

test('sync config save fails without mutating credentials when storage write fails', () => {
    const backingStorage = createStorageMock({
        gistId: 'gist_old'
    });
    const failingLocalStorage = {
        getItem: backingStorage.getItem,
        setItem(key, value) {
            if (key === 'gistId') {
                throw new Error('quota exceeded');
            }
            backingStorage.setItem(key, value);
        },
        removeItem: backingStorage.removeItem
    };
    const sessionStorage = createStorageMock({
        githubToken: 'token_old'
    });
    const toastEvents = [];
    const elements = {
        'github-token-input': { value: 'token_new' },
        'gist-id-input': { value: 'gist_new' }
    };
    const context = createBaseContext({
        console: { ...console, error() {} },
        localStorage: failingLocalStorage,
        sessionStorage,
        document: {
            getElementById(id) {
                return elements[id] || null;
            }
        },
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        }
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/ui.js');

    assert.equal(context.saveSyncConfig(), false);
    const credentials = context.getSyncCredentials();
    assert.equal(credentials.githubToken, 'token_old');
    assert.equal(credentials.gistId, 'gist_old');
    assert.equal(sessionStorage.getItem('githubToken'), 'token_old');
    assert.equal(backingStorage.getItem('gistId'), 'gist_old');
    assert.equal(elements['github-token-input'].value, 'token_old');
    assert.equal(elements['gist-id-input'].value, 'gist_old');
    assert.equal(toastEvents.at(-1).tone, 'error');
    assert.match(toastEvents.at(-1).message, /同步配置保存失败/);
});

test('sync state clears pending auto-sync timers on demand and on credential changes', () => {
    const scheduledTimers = [];
    const clearedTimers = [];
    const context = createBaseContext({
        localStorage: createStorageMock({
            gistId: 'gist_test'
        }),
        sessionStorage: createStorageMock({
            githubToken: 'ghp_test'
        }),
        setTimeout(callback, delay) {
            const timer = { callback, delay };
            scheduledTimers.push(timer);
            return timer;
        },
        clearTimeout(timer) {
            clearedTimers.push(timer);
        },
        countTotalTaskEntries() { return 0; },
        countQuickNoteEntries() { return 0; },
        ensureDayRecord(day) { return day; },
        hasAnyCheckinRecord() { return false; },
        checkinData: {},
        phoneResistData: { totalCount: 0, records: {} },
        leaveData: [],
        achievements: [],
        tavernData: [],
        currentTask: null
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');

    context.triggerAutoSync();
    assert.equal(scheduledTimers.length, 1);
    assert.equal(context.clearAutoSyncTimer(), true);
    assert.deepEqual(clearedTimers, [scheduledTimers[0]]);

    context.triggerAutoSync();
    context.saveSyncCredentials('ghp_other', 'gist_other');
    assert.deepEqual(clearedTimers, [scheduledTimers[0], scheduledTimers[1]]);
});

test('auto sync cancels upload when cloud data is newer than local state', async () => {
    const scheduledTimers = [];
    const toastEvents = [];
    let pushCalls = 0;
    const context = createBaseContext({
        console: { ...console, error() {} },
        localStorage: createStorageMock({
            gistId: 'gist_test',
            localLastSyncTime: '2026-04-20T10:00:00.000Z'
        }),
        sessionStorage: createStorageMock({
            githubToken: 'ghp_test'
        }),
        setTimeout(callback, delay) {
            const timer = { callback, delay };
            scheduledTimers.push(timer);
            return timer;
        },
        fetchCloudWorkspaceSnapshot: async () => ({
            data: { lastSyncTime: '2026-04-21T10:00:00.000Z' },
            etag: 'etag-newer'
        }),
        pushCloudWorkspaceData: async () => {
            pushCalls += 1;
        },
        buildCloudSyncPayload: () => ({ ok: true }),
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        },
        countTotalTaskEntries() { return 0; },
        countQuickNoteEntries() { return 0; },
        ensureDayRecord(day) { return day; },
        hasAnyCheckinRecord() { return false; },
        checkinData: {},
        phoneResistData: { totalCount: 0, records: {} },
        leaveData: [],
        achievements: [],
        tavernData: [],
        currentTask: null
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');

    context.triggerAutoSync();
    assert.equal(scheduledTimers.length, 1);

    await scheduledTimers[0].callback();

    assert.equal(pushCalls, 0);
    assert.deepEqual(toastEvents.at(-1), {
        message: '检测到云端已有更新，已取消自动上传。请先手动拉取确认。',
        tone: 'warning'
    });
});

test('auto sync cancels upload when cloud ETag is unavailable', async () => {
    const scheduledTimers = [];
    const toastEvents = [];
    let pushCalls = 0;
    const context = createBaseContext({
        console: { ...console, error() {} },
        localStorage: createStorageMock({
            gistId: 'gist_test',
            localLastSyncTime: '2026-04-20T10:00:00.000Z'
        }),
        sessionStorage: createStorageMock({
            githubToken: 'ghp_test'
        }),
        setTimeout(callback, delay) {
            const timer = { callback, delay };
            scheduledTimers.push(timer);
            return timer;
        },
        fetchCloudWorkspaceSnapshot: async () => ({
            data: { lastSyncTime: '2026-04-20T09:00:00.000Z' },
            etag: null
        }),
        pushCloudWorkspaceData: async () => {
            pushCalls += 1;
        },
        buildCloudSyncPayload: () => ({ ok: true }),
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        },
        countTotalTaskEntries() { return 0; },
        countQuickNoteEntries() { return 0; },
        ensureDayRecord(day) { return day; },
        hasAnyCheckinRecord() { return false; },
        checkinData: {},
        phoneResistData: { totalCount: 0, records: {} },
        leaveData: [],
        achievements: [],
        tavernData: [],
        currentTask: null
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');

    context.triggerAutoSync();
    await scheduledTimers[0].callback();

    assert.equal(pushCalls, 0);
    assert.deepEqual(toastEvents.at(-1), {
        message: '自动同步无法确认云端版本，已取消上传。请稍后手动同步。',
        tone: 'warning'
    });
});

test('startup auto pull stops applying cloud data after module cleanup deactivates the run', async () => {
    let resolveFetch = null;
    const appliedPayloads = [];
    const toastEvents = [];
    const context = createBaseContext({
        localStorage: createStorageMock({
            gistId: 'gist_test'
        }),
        sessionStorage: createStorageMock({
            githubToken: 'ghp_test'
        }),
        fetchCloudWorkspaceData() {
            return new Promise((resolve) => {
                resolveFetch = resolve;
            });
        },
        applyImportedData(payload) {
            appliedPayloads.push(payload);
        },
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        },
        runtimeSelectors: {
            currentTask() {
                return null;
            }
        },
        countTotalTaskEntries() { return 0; },
        countQuickNoteEntries() { return 0; },
        ensureDayRecord(day) { return day; },
        hasAnyCheckinRecord() { return false; },
        checkinData: {},
        phoneResistData: { totalCount: 0, records: {} },
        leaveData: [],
        achievements: [],
        tavernData: []
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');

    const runState = { active: true };
    const pendingPull = context.autoPullOnStartup(runState);
    runState.active = false;
    resolveFetch({ lastSyncTime: '2026-04-21T10:00:00.000Z' });
    await pendingPull;

    assert.deepEqual(appliedPayloads, []);
    assert.deepEqual(toastEvents, []);
});
