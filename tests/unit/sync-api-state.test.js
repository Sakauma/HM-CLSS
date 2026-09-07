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
        gistId: 'gist_old',
        localLastSyncTime: '2026-04-20T10:00:00.000Z'
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
    assert.equal(backingStorage.getItem('localLastSyncTime'), '2026-04-20T10:00:00.000Z');
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

test('manual push refuses to build fallback data while startup storage reads are blocked', async () => {
    const toastEvents = [];
    let fetchCalls = 0;
    let payloadCalls = 0;
    let pushCalls = 0;
    const pushButton = { disabled: false, childNodes: [] };
    const context = createBaseContext({
        localStorage: createStorageMock({ gistId: 'gist_test' }),
        sessionStorage: createStorageMock({ githubToken: 'ghp_test' }),
        document: {
            getElementById(id) {
                return id === 'push-cloud-btn' ? pushButton : null;
            }
        },
        isStoragePersistenceBlocked: () => true,
        getStorageBlockReason: () => 'startupRead',
        fetchCloudWorkspaceSnapshot: async () => {
            fetchCalls += 1;
            return { data: {}, etag: 'etag' };
        },
        buildCloudSyncPayload() {
            payloadCalls += 1;
            return {};
        },
        async pushCloudWorkspaceData() {
            pushCalls += 1;
        },
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        }
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');

    await context.handlePushCloud();

    assert.equal(fetchCalls, 0);
    assert.equal(payloadCalls, 0);
    assert.equal(pushCalls, 0);
    assert.deepEqual(toastEvents.at(-1), {
        message: '本地数据未完整读取，当前处于只读保护；恢复浏览器存储后刷新页面再同步',
        tone: 'warning'
    });
});

test('manual push refuses to upload a snapshot containing parse fallbacks', async () => {
    const toastEvents = [];
    let fetchCalls = 0;
    let payloadCalls = 0;
    let pushCalls = 0;
    const context = createBaseContext({
        localStorage: createStorageMock({ gistId: 'gist_test' }),
        sessionStorage: createStorageMock({ githubToken: 'ghp_test' }),
        getCorruptedStorageKeys: () => ['quickNotesData'],
        fetchCloudWorkspaceSnapshot: async () => {
            fetchCalls += 1;
            return { data: {}, etag: 'etag' };
        },
        buildCloudSyncPayload() {
            payloadCalls += 1;
            return { quickNotesData: {} };
        },
        async pushCloudWorkspaceData() {
            pushCalls += 1;
        },
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        }
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');

    await context.handlePushCloud();

    assert.equal(fetchCalls, 0);
    assert.equal(payloadCalls, 0);
    assert.equal(pushCalls, 0);
    assert.deepEqual(toastEvents.at(-1), {
        message: '检测到本地数据损坏（quickNotesData），不能上传不完整快照，以免覆盖云端；请修复存储后刷新页面再同步',
        tone: 'warning'
    });
});

test('saving an unrelated valid dataset does not auto-upload corrupted fallback data', () => {
    const scheduledTimers = [];
    let pushCalls = 0;
    const localStorage = createStorageMock({
        gistId: 'gist_test',
        taskData: JSON.stringify({ old: [] })
    });
    const context = createBaseContext({
        localStorage,
        sessionStorage: createStorageMock({ githubToken: 'ghp_test' }),
        setTimeout(callback, delay) {
            const timer = { callback, delay };
            scheduledTimers.push(timer);
            return timer;
        },
        getCorruptedStorageKeys: () => ['quickNotesData'],
        pushCloudWorkspaceData: async () => {
            pushCalls += 1;
        },
        CURRENT_TASK_STORAGE_KEY: 'currentTask',
        AMBIENT_PREFS_STORAGE_KEY: 'ambientPreferences',
        CHECKIN_PREFS_STORAGE_KEY: 'checkinPreferences',
        normalizeAmbientPreferences: (value) => value || {},
        normalizeCheckinPreferences: (value) => value || {},
        checkinData: {},
        phoneResistData: { totalCount: 0, records: {} },
        taskData: { fresh: [{ id: 1 }] },
        leaveData: [],
        achievements: [],
        quickNotesData: {},
        tavernData: [],
        ambientPreferences: {},
        checkinPreferences: {}
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');
    loadScript(context, 'assets/js/runtime/storage.js');

    const result = context.saveData(false, { keys: ['taskData'] });

    assert.equal(result.ok, true);
    assert.deepEqual(JSON.parse(localStorage.getItem('taskData')), { fresh: [{ id: 1 }] });
    assert.equal(scheduledTimers.length, 0);
    assert.equal(pushCalls, 0);
});

test('manual push rechecks storage protection after awaiting the cloud baseline', async () => {
    const toastEvents = [];
    let blocked = false;
    let payloadCalls = 0;
    let pushCalls = 0;
    const pushButton = { disabled: false, childNodes: [] };
    const context = createBaseContext({
        localStorage: createStorageMock({
            gistId: 'gist_test',
            localLastSyncTime: '2026-04-20T10:00:00.000Z'
        }),
        sessionStorage: createStorageMock({ githubToken: 'ghp_test' }),
        document: {
            getElementById(id) {
                return id === 'push-cloud-btn' ? pushButton : null;
            }
        },
        cloneChildNodesSnapshot: () => [],
        restoreChildNodesSnapshot() {},
        setSyncButtonLoading() {},
        lucide: { createIcons() {} },
        isStoragePersistenceBlocked: () => blocked,
        getStorageBlockReason: () => 'storageConsistency',
        fetchCloudWorkspaceSnapshot: async () => {
            blocked = true;
            return {
                data: { lastSyncTime: '2026-04-20T09:00:00.000Z' },
                etag: 'etag-current'
            };
        },
        buildCloudSyncPayload() {
            payloadCalls += 1;
            return {};
        },
        async pushCloudWorkspaceData() {
            pushCalls += 1;
        },
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        }
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');

    await context.handlePushCloud();

    assert.equal(payloadCalls, 0);
    assert.equal(pushCalls, 0);
    assert.equal(pushButton.disabled, false);
    assert.deepEqual(toastEvents.at(-1), {
        message: '本地保存回滚未完整完成，当前处于只读保护；请先导出数据并刷新页面再同步',
        tone: 'warning'
    });
});

test('auto sync stops without completing or rescheduling a revision blocked during fetch', async () => {
    const scheduledTimers = [];
    const toastEvents = [];
    let blocked = false;
    let payloadCalls = 0;
    let pushCalls = 0;
    const context = createBaseContext({
        localStorage: createStorageMock({
            gistId: 'gist_test',
            localLastSyncTime: '2026-04-20T10:00:00.000Z'
        }),
        sessionStorage: createStorageMock({ githubToken: 'ghp_test' }),
        setTimeout(callback, delay) {
            const timer = { callback, delay };
            scheduledTimers.push(timer);
            return timer;
        },
        isStoragePersistenceBlocked: () => blocked,
        getStorageBlockReason: () => 'storageConsistency',
        fetchCloudWorkspaceSnapshot: async () => {
            blocked = true;
            return {
                data: { lastSyncTime: '2026-04-20T09:00:00.000Z' },
                etag: 'etag-current'
            };
        },
        buildCloudSyncPayload() {
            payloadCalls += 1;
            return {};
        },
        async pushCloudWorkspaceData() {
            pushCalls += 1;
        },
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        }
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');

    context.triggerAutoSync();
    assert.equal(scheduledTimers.length, 1);
    await scheduledTimers[0].callback();

    assert.equal(payloadCalls, 0);
    assert.equal(pushCalls, 0);
    assert.equal(scheduledTimers.length, 1);
    assert.deepEqual(toastEvents.at(-1), {
        message: '本地保存回滚未完整完成，当前处于只读保护；请先导出数据并刷新页面再同步',
        tone: 'warning'
    });

    blocked = false;
    context.enableAutoSync();
    assert.equal(scheduledTimers.length, 2);
});

test('auto sync does not complete the revision when storage protection starts during upload', async () => {
    const scheduledTimers = [];
    const toastEvents = [];
    let blocked = false;
    let pushCalls = 0;
    const context = createBaseContext({
        localStorage: createStorageMock({
            gistId: 'gist_test',
            localLastSyncTime: '2026-04-20T10:00:00.000Z'
        }),
        sessionStorage: createStorageMock({ githubToken: 'ghp_test' }),
        setTimeout(callback, delay) {
            const timer = { callback, delay };
            scheduledTimers.push(timer);
            return timer;
        },
        isStoragePersistenceBlocked: () => blocked,
        getStorageBlockReason: () => 'storageConsistency',
        fetchCloudWorkspaceSnapshot: async () => ({
            data: { lastSyncTime: '2026-04-20T09:00:00.000Z' },
            etag: 'etag-current'
        }),
        buildCloudSyncPayload: (syncTime) => ({ lastSyncTime: syncTime }),
        async pushCloudWorkspaceData() {
            pushCalls += 1;
            blocked = true;
        },
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        }
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');

    context.triggerAutoSync();
    await scheduledTimers[0].callback();

    assert.equal(pushCalls, 1);
    assert.equal(scheduledTimers.length, 1);
    assert.deepEqual(toastEvents.at(-1), {
        message: '云端已接收上传开始前的快照，但本地随后进入只读保护；当前状态未标记为同步完成，请先导出数据并刷新页面',
        tone: 'warning'
    });

    blocked = false;
    context.enableAutoSync();
    assert.equal(scheduledTimers.length, 2);
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

test('auto sync uploads a stable revision and reschedules changes made in flight', async () => {
    const scheduledTimers = [];
    const pushes = [];
    const localStorage = createStorageMock({
        gistId: 'gist_test',
        localLastSyncTime: '2026-04-20T10:00:00.000Z'
    });
    let marker = 'first';
    let remoteSyncTime = '2026-04-20T10:00:00.000Z';
    let resolveFirstPush;
    const firstPushGate = new Promise((resolve) => {
        resolveFirstPush = resolve;
    });
    const context = createBaseContext({
        localStorage,
        sessionStorage: createStorageMock({ githubToken: 'ghp_test' }),
        setTimeout(callback, delay) {
            const timer = { callback, delay };
            scheduledTimers.push(timer);
            return timer;
        },
        clearTimeout() {},
        fetchCloudWorkspaceSnapshot: async () => ({
            data: { lastSyncTime: remoteSyncTime },
            etag: `"etag-${pushes.length + 1}"`
        }),
        async pushCloudWorkspaceData(payload, options) {
            pushes.push({ payload, options });
            if (pushes.length === 1) await firstPushGate;
            remoteSyncTime = payload.lastSyncTime;
        },
        buildCloudSyncPayload(syncTime) {
            return { lastSyncTime: syncTime, marker };
        }
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');

    context.triggerAutoSync();
    const firstRun = scheduledTimers[0].callback();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].payload.marker, 'first');
    assert.equal(pushes[0].options.etag, '"etag-1"');

    marker = 'second';
    context.triggerAutoSync();
    assert.equal(scheduledTimers.length, 1);

    resolveFirstPush();
    await firstRun;
    assert.equal(localStorage.getItem('localLastSyncTime'), pushes[0].payload.lastSyncTime);
    assert.equal(scheduledTimers.length, 2);

    await scheduledTimers[1].callback();
    assert.equal(pushes.length, 2);
    assert.equal(pushes[1].payload.marker, 'second');
    assert.equal(pushes[1].options.etag, '"etag-2"');

    const reloadTimers = [];
    let reloadPushes = 0;
    const reloadedContext = createBaseContext({
        localStorage,
        sessionStorage: createStorageMock({ githubToken: 'ghp_test' }),
        setTimeout(callback, delay) {
            const timer = { callback, delay };
            reloadTimers.push(timer);
            return timer;
        },
        clearTimeout() {},
        fetchCloudWorkspaceSnapshot: async () => ({
            data: { lastSyncTime: remoteSyncTime },
            etag: '"etag-after-reload"'
        }),
        pushCloudWorkspaceData: async (_payload, options) => {
            reloadPushes += 1;
            assert.equal(options.etag, '"etag-after-reload"');
        },
        buildCloudSyncPayload: (syncTime) => ({ lastSyncTime: syncTime })
    });
    loadScript(reloadedContext, 'assets/js/features/sync/state.js');
    loadScript(reloadedContext, 'assets/js/features/sync/conflict.js');
    loadScript(reloadedContext, 'assets/js/features/sync/logic.js');

    reloadedContext.triggerAutoSync();
    await reloadTimers[0].callback();
    assert.equal(reloadPushes, 1);
});

test('auto sync retries only when a newer revision arrives during a transient failure', async () => {
    const scheduledTimers = [];
    const toastEvents = [];
    let pushCalls = 0;
    let rejectFirstPush;
    const firstPushGate = new Promise((_resolve, reject) => {
        rejectFirstPush = reject;
    });
    const context = createBaseContext({
        localStorage: createStorageMock({
            gistId: 'gist_test',
            localLastSyncTime: '2026-04-20T10:00:00.000Z'
        }),
        sessionStorage: createStorageMock({ githubToken: 'ghp_test' }),
        setTimeout(callback, delay) {
            const timer = { callback, delay };
            scheduledTimers.push(timer);
            return timer;
        },
        clearTimeout() {},
        fetchCloudWorkspaceSnapshot: async () => ({
            data: { lastSyncTime: '2026-04-20T10:00:00.000Z' },
            etag: '"etag-current"'
        }),
        async pushCloudWorkspaceData() {
            pushCalls += 1;
            if (pushCalls === 1) await firstPushGate;
        },
        buildCloudSyncPayload: (syncTime) => ({ lastSyncTime: syncTime }),
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        }
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');

    context.triggerAutoSync();
    const firstRun = scheduledTimers[0].callback();
    await new Promise((resolve) => setImmediate(resolve));
    context.triggerAutoSync();
    rejectFirstPush(new Error('network down'));
    await firstRun;

    assert.equal(scheduledTimers.length, 2);
    assert.equal(toastEvents.at(-1).tone, 'warning');
    await scheduledTimers[1].callback();
    assert.equal(pushCalls, 2);
});

test('disabling auto sync prevents an in-flight upload from scheduling newer dirty data', async () => {
    const scheduledTimers = [];
    let resolvePush;
    const pushGate = new Promise((resolve) => {
        resolvePush = resolve;
    });
    const context = createBaseContext({
        localStorage: createStorageMock({
            gistId: 'gist_test',
            localLastSyncTime: '2026-04-20T10:00:00.000Z'
        }),
        sessionStorage: createStorageMock({ githubToken: 'ghp_test' }),
        setTimeout(callback, delay) {
            const timer = { callback, delay };
            scheduledTimers.push(timer);
            return timer;
        },
        clearTimeout() {},
        fetchCloudWorkspaceSnapshot: async () => ({
            data: { lastSyncTime: '2026-04-20T10:00:00.000Z' },
            etag: '"etag-current"'
        }),
        pushCloudWorkspaceData: async () => pushGate,
        buildCloudSyncPayload: (syncTime) => ({ lastSyncTime: syncTime })
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');

    context.triggerAutoSync();
    const firstRun = scheduledTimers[0].callback();
    await new Promise((resolve) => setImmediate(resolve));
    context.triggerAutoSync();
    context.disableAutoSync();
    resolvePush();
    await firstRun;

    assert.equal(scheduledTimers.length, 1);
    context.triggerAutoSync();
    assert.equal(scheduledTimers.length, 1);
});

test('manual push waits for auto upload and uses a fresh Gist baseline and ETag after credentials change', async () => {
    const scheduledTimers = [];
    const pushCalls = [];
    const localStorage = createStorageMock({
        gistId: 'gist_old',
        localLastSyncTime: '2026-05-01T10:00:00.000Z'
    });
    const sessionStorage = createStorageMock({ githubToken: 'token_old' });
    let confirmCalls = 0;
    let resolveOldPush;
    const oldPushGate = new Promise((resolve) => {
        resolveOldPush = resolve;
    });
    const pushButton = { disabled: false, childNodes: [] };
    const context = createBaseContext({
        localStorage,
        sessionStorage,
        setTimeout(callback, delay) {
            const timer = { callback, delay };
            scheduledTimers.push(timer);
            return timer;
        },
        clearTimeout() {},
        document: {
            getElementById(id) {
                return id === 'push-cloud-btn' ? pushButton : null;
            }
        },
        cloneChildNodesSnapshot: () => [],
        restoreChildNodesSnapshot() {},
        setSyncButtonLoading() {},
        showSyncMissingConfigToast() {},
        lucide: { createIcons() {} },
        showToast() {},
        showConfirmDialog: async () => {
            confirmCalls += 1;
            return true;
        },
        runtimeSelectors: { currentTask: () => null },
        countTotalTaskEntries: () => 0,
        countQuickNoteEntries: () => 0,
        ensureDayRecord: (day) => day,
        hasAnyCheckinRecord: () => false,
        checkinData: {},
        phoneResistData: { totalCount: 0, records: {} },
        leaveData: [],
        achievements: [],
        tavernData: [],
        fetchCloudWorkspaceSnapshot: async () => {
            const { gistId } = context.getSyncCredentials();
            return gistId === 'gist_old'
                ? { data: { lastSyncTime: '2026-05-01T10:00:00.000Z' }, etag: '"etag-old"' }
                : { data: { lastSyncTime: '2026-04-15T10:00:00.000Z' }, etag: '"etag-new"' };
        },
        async pushCloudWorkspaceData(payload, options) {
            pushCalls.push({
                gistId: context.getSyncCredentials().gistId,
                payload,
                etag: options.etag
            });
            if (pushCalls.length === 1) await oldPushGate;
        },
        buildCloudSyncPayload: (syncTime) => ({ lastSyncTime: syncTime })
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');

    context.triggerAutoSync();
    const autoRun = scheduledTimers[0].callback();
    await new Promise((resolve) => setImmediate(resolve));
    const manualRun = context.handlePushCloud();
    context.saveSyncCredentials('token_new', 'gist_new');
    context.triggerAutoSync();
    resolveOldPush();
    await Promise.all([autoRun, manualRun]);

    assert.deepEqual(pushCalls.map(({ gistId, etag }) => ({ gistId, etag })), [
        { gistId: 'gist_old', etag: '"etag-old"' },
        { gistId: 'gist_new', etag: '"etag-new"' }
    ]);
    assert.equal(confirmCalls, 1);
    assert.equal(localStorage.getItem('gistId'), 'gist_new');
    assert.notEqual(localStorage.getItem('localLastSyncTime'), null);
    assert.equal(scheduledTimers.length, 1);
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
