const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

function loadScript(context, relativePath) {
    const absolutePath = path.join(ROOT_DIR, relativePath);
    const source = fs.readFileSync(absolutePath, 'utf8');
    vm.runInContext(source, context, { filename: absolutePath });
}

function createBaseContext(overrides = {}) {
    const context = vm.createContext({
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        JSON,
        Math,
        Number,
        String,
        Boolean,
        Array,
        Object,
        Date,
        Map,
        Set,
        Promise,
        Error,
        ...overrides
    });

    context.globalThis = context;
    context.window = context;
    return context;
}

function createStorageMock(initialEntries = {}) {
    const store = new Map(
        Object.entries(initialEntries).map(([key, value]) => [key, String(value)])
    );

    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        }
    };
}

function createButtonElement() {
    return {
        disabled: false,
        childNodes: [],
        value: '',
        className: '',
        addEventListener() {},
        focus() {},
        setAttribute(name, value) {
            this[name] = value;
        },
        getAttribute(name) {
            return this[name] ?? null;
        }
    };
}

test('module registry disposes cleanups in reverse order and allows reinitialization', () => {
    const context = createBaseContext();
    loadScript(context, 'assets/js/runtime/module-registry.js');

    const events = [];
    context.registerAppModule({
        id: 'alpha',
        order: 10,
        init() {
            events.push('init:alpha');
            return () => events.push('dispose:alpha');
        }
    });
    context.registerAppModule({
        id: 'beta',
        order: 20,
        init() {
            events.push('init:beta');
            return () => events.push('dispose:beta');
        }
    });

    assert.deepEqual(Array.from(context.initializeAppModules()), ['alpha', 'beta']);
    assert.deepEqual(Array.from(context.disposeAppModules()), ['beta', 'alpha']);
    assert.deepEqual(events, ['init:alpha', 'init:beta', 'dispose:beta', 'dispose:alpha']);
    assert.deepEqual(Array.from(context.initializeAppModules()), ['alpha', 'beta']);
});

test('module registry flushes deferred module registrars registered before the registry script loads', () => {
    const context = createBaseContext({
        __hmClssDeferredModuleRegistrars: [
            () => {
                context.registerAppModule({
                    id: 'deferred-theme',
                    order: 15,
                    init() {
                        context.__deferredInitialized = true;
                    }
                });
            }
        ]
    });

    loadScript(context, 'assets/js/runtime/module-registry.js');

    const moduleIds = Array.from(context.getRegisteredAppModules()).map((module) => module.id);
    assert.deepEqual(moduleIds, ['deferred-theme']);
    context.initializeAppModules();
    assert.equal(context.__deferredInitialized, true);
});

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

test('local cloud-apply backup can be restored and cleared', async () => {
    const backup = {
        datasets: {
            taskData: { '2026-04-20': [{ name: 'Backup Task' }] },
            quickNotesData: { '2026-04-20': [{ text: 'Backup Note' }] }
        },
        state: {
            currentTask: { name: 'Active Backup', startTimestamp: 1770000000000, startTime: '09:00' },
            ambientPreferences: { enabled: false },
            checkinPreferences: { lateGraceMins: 45, earlyGraceMins: 15 },
            lastSyncTime: '2026-04-20T09:00:00.000Z'
        },
        backupTime: '2026-04-20T10:00:00.000Z'
    };
    const localStorage = createStorageMock({
        gistId: 'gist_test',
        lastLocalBackupBeforeCloudApply: JSON.stringify(backup)
    });
    const elements = {
        'local-backup-summary': { textContent: '' },
        'restore-local-backup-btn': createButtonElement(),
        'clear-local-backup-btn': createButtonElement()
    };
    const toastEvents = [];
    let appliedDatasets = null;
    let refreshed = 0;
    const context = createBaseContext({
        localStorage,
        sessionStorage: createStorageMock({ githubToken: 'ghp_test' }),
        document: {
            getElementById(id) {
                return elements[id] || null;
            }
        },
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        },
        showConfirmDialog: async () => true,
        createStorageOperationResult: () => ({ ok: true, failedKeys: [] }),
        safeRemoveStorageItem(key, result) {
            localStorage.removeItem(key);
            return result.ok;
        },
        safeSetStorageItem(key, value, result) {
            localStorage.setItem(key, value);
            return result.ok;
        },
        countTotalTaskEntries(source = {}) {
            return Object.values(source).reduce((sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0), 0);
        },
        countQuickNoteEntries(source = {}) {
            return Object.values(source).reduce((sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0), 0);
        },
        normalizeCurrentTaskRecord(task) {
            return task || null;
        },
        normalizeAmbientPreferences(prefs) {
            return prefs || { enabled: true };
        },
        normalizeCheckinPreferences(prefs) {
            return prefs || { lateGraceMins: 30, earlyGraceMins: 30 };
        },
        runtimeActions: {
            setCurrentTask(task) {
                context.currentTask = task;
            },
            setAmbientPreferences(preferences) {
                context.ambientPreferences = preferences;
            },
            setCheckinPreferences(preferences) {
                context.checkinPreferences = preferences;
            }
        },
        runtimeSelectors: {
            checkinPreferences() {
                return context.checkinPreferences;
            }
        },
        buildWorkspaceDatasetSnapshot() {
            return {
                taskData: context.taskData || {},
                quickNotesData: context.quickNotesData || {}
            };
        },
        buildWorkspaceStateSnapshot() {
            return {
                currentTask: context.currentTask,
                ambientPreferences: context.ambientPreferences,
                checkinPreferences: context.checkinPreferences,
                lastSyncTime: localStorage.getItem('localLastSyncTime')
            };
        },
        applyWorkspaceDatasetSnapshot(datasets) {
            appliedDatasets = datasets;
            context.taskData = datasets.taskData || {};
            context.quickNotesData = datasets.quickNotesData || {};
        },
        persistCurrentTask() {},
        saveData: () => ({ ok: true, failedKeys: [] }),
        refreshWorkspaceUiAfterSync() {
            refreshed += 1;
        },
        currentTask: null,
        ambientPreferences: null,
        checkinPreferences: null
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/backup.js');
    context.refreshWorkspaceUiAfterSync = () => {
        refreshed += 1;
    };

    context.refreshLocalBackupRestoreState();
    assert.match(elements['local-backup-summary'].textContent, /最近备份/);
    assert.equal(elements['restore-local-backup-btn'].disabled, false);

    await context.restoreLocalBackupBeforeCloudApply();

    assert.equal(appliedDatasets.taskData['2026-04-20'][0].name, 'Backup Task');
    assert.equal(context.currentTask.name, 'Active Backup');
    assert.equal(context.localStorage.getItem('localLastSyncTime'), '2026-04-20T09:00:00.000Z');
    assert.equal(refreshed, 1);
    assert.equal(toastEvents.at(-1).tone, 'success');

    context.clearLocalBackupBeforeCloudApply();
    assert.equal(context.localStorage.getItem('lastLocalBackupBeforeCloudApply'), null);
    assert.equal(elements['restore-local-backup-btn'].disabled, true);
});

test('local cloud-apply backup restore rolls back memory when save fails', async () => {
    const backup = {
        datasets: {
            taskData: { '2026-04-20': [{ name: 'Backup Task' }] },
            quickNotesData: {}
        },
        state: {
            currentTask: { name: 'Backup Active', startTimestamp: 1770000000000, startTime: '09:00' },
            ambientPreferences: { enabled: false },
            checkinPreferences: { lateGraceMins: 45, earlyGraceMins: 15 },
            lastSyncTime: '2026-04-20T09:00:00.000Z'
        },
        backupTime: '2026-04-20T10:00:00.000Z'
    };
    const localStorage = createStorageMock({
        gistId: 'gist_test',
        localLastSyncTime: '2026-04-20T08:00:00.000Z',
        lastLocalBackupBeforeCloudApply: JSON.stringify(backup)
    });
    const elements = {
        'local-backup-summary': { textContent: '' },
        'restore-local-backup-btn': createButtonElement(),
        'clear-local-backup-btn': createButtonElement()
    };
    const toastEvents = [];
    const originalTaskData = { '2026-04-19': [{ name: 'Original Task' }] };
    const context = createBaseContext({
        localStorage,
        sessionStorage: createStorageMock({ githubToken: 'ghp_test' }),
        document: {
            getElementById(id) {
                return elements[id] || null;
            }
        },
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        },
        showConfirmDialog: async () => true,
        countTotalTaskEntries(source = {}) {
            return Object.values(source).reduce((sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0), 0);
        },
        countQuickNoteEntries(source = {}) {
            return Object.values(source).reduce((sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0), 0);
        },
        normalizeCurrentTaskRecord(task) {
            return task || null;
        },
        normalizeAmbientPreferences(prefs) {
            return prefs || { enabled: true };
        },
        normalizeCheckinPreferences(prefs) {
            return prefs || { lateGraceMins: 30, earlyGraceMins: 30 };
        },
        runtimeActions: {
            setCurrentTask(task) {
                context.currentTask = task;
            },
            setAmbientPreferences(preferences) {
                context.ambientPreferences = preferences;
            },
            setCheckinPreferences(preferences) {
                context.checkinPreferences = preferences;
            }
        },
        runtimeSelectors: {
            checkinPreferences() {
                return context.checkinPreferences;
            }
        },
        buildWorkspaceDatasetSnapshot() {
            return {
                taskData: JSON.parse(JSON.stringify(context.taskData)),
                quickNotesData: JSON.parse(JSON.stringify(context.quickNotesData))
            };
        },
        buildWorkspaceStateSnapshot() {
            return {
                currentTask: context.currentTask,
                ambientPreferences: context.ambientPreferences,
                checkinPreferences: context.checkinPreferences,
                lastSyncTime: localStorage.getItem('localLastSyncTime')
            };
        },
        applyWorkspaceDatasetSnapshot(datasets) {
            context.taskData = datasets.taskData || {};
            context.quickNotesData = datasets.quickNotesData || {};
        },
        saveData: () => ({ ok: false, failedKeys: ['taskData'] }),
        refreshWorkspaceUiAfterSync() {},
        taskData: originalTaskData,
        quickNotesData: {},
        currentTask: { name: 'Original Active', startTimestamp: 1769990000000, startTime: '08:00' },
        ambientPreferences: { enabled: true },
        checkinPreferences: { lateGraceMins: 30, earlyGraceMins: 30 }
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/backup.js');
    context.refreshWorkspaceUiAfterSync = () => {};

    await context.restoreLocalBackupBeforeCloudApply();

    assert.equal(context.taskData['2026-04-19'][0].name, 'Original Task');
    assert.equal(context.currentTask.name, 'Original Active');
    assert.equal(context.localStorage.getItem('localLastSyncTime'), '2026-04-20T08:00:00.000Z');
    assert.equal(toastEvents.at(-1).tone, 'error');
    assert.match(toastEvents.at(-1).message, /已保留当前工作区/);
});

test('cloud import rolls back memory when workspace save fails', () => {
    const localStorage = createStorageMock({
        gistId: 'gist_test',
        localLastSyncTime: '2026-04-20T08:00:00.000Z'
    });
    const toastEvents = [];
    const context = createBaseContext({
        localStorage,
        sessionStorage: createStorageMock({ githubToken: 'ghp_test' }),
        document: {
            getElementById() {
                return null;
            }
        },
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        },
        createStorageOperationResult: () => ({ ok: true, failedKeys: [] }),
        safeSetStorageItem(key, value, result) {
            localStorage.setItem(key, value);
            return result.ok;
        },
        countTotalTaskEntries() { return 0; },
        countQuickNoteEntries() { return 0; },
        normalizeCurrentTaskRecord(task) {
            return task || null;
        },
        normalizeAmbientPreferences(prefs) {
            return prefs || { enabled: true };
        },
        normalizeCheckinPreferences(prefs) {
            return prefs || { lateGraceMins: 30, earlyGraceMins: 30 };
        },
        runtimeActions: {
            setCurrentTask(task) {
                context.currentTask = task;
            },
            setAmbientPreferences(preferences) {
                context.ambientPreferences = preferences;
            },
            setCheckinPreferences(preferences) {
                context.checkinPreferences = preferences;
            }
        },
        runtimeSelectors: {
            checkinPreferences() {
                return context.checkinPreferences;
            }
        },
        buildWorkspaceDatasetSnapshot() {
            return {
                taskData: JSON.parse(JSON.stringify(context.taskData)),
                quickNotesData: JSON.parse(JSON.stringify(context.quickNotesData))
            };
        },
        buildWorkspaceStateSnapshot() {
            return {
                currentTask: context.currentTask,
                ambientPreferences: context.ambientPreferences,
                checkinPreferences: context.checkinPreferences,
                lastSyncTime: localStorage.getItem('localLastSyncTime')
            };
        },
        applyWorkspaceDatasetSnapshot(datasets) {
            context.taskData = datasets.taskData || {};
            context.quickNotesData = datasets.quickNotesData || {};
        },
        saveData: () => ({ ok: false, failedKeys: ['taskData'] }),
        refreshWorkspaceUiAfterSync() {},
        taskData: { '2026-04-19': [{ name: 'Original Task' }] },
        quickNotesData: {},
        currentTask: null,
        ambientPreferences: { enabled: true },
        checkinPreferences: { lateGraceMins: 30, earlyGraceMins: 30 }
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/backup.js');
    context.refreshWorkspaceUiAfterSync = () => {};

    const applied = context.applyImportedData({
        taskData: { '2026-04-20': [{ name: 'Cloud Task' }] },
        quickNotesData: {},
        lastSyncTime: '2026-04-20T10:00:00.000Z'
    });

    assert.equal(applied, false);
    assert.equal(context.taskData['2026-04-19'][0].name, 'Original Task');
    assert.equal(context.localStorage.getItem('localLastSyncTime'), '2026-04-20T08:00:00.000Z');
    assert.equal(toastEvents.at(-1).tone, 'error');
    assert.match(toastEvents.at(-1).message, /已回滚当前工作区/);
});

test('sync controller covers conflict confirmation and failure branches', async () => {
    const toastEvents = [];
    let confirmOptions = null;
    const elements = {
        'github-token-input': { value: 'ghp_test' },
        'gist-id-input': { value: 'gist_test' },
        'save-config-btn': createButtonElement(),
        'push-cloud-btn': createButtonElement(),
        'pull-cloud-btn': createButtonElement(),
        'restore-local-backup-btn': createButtonElement(),
        'clear-local-backup-btn': createButtonElement(),
        'local-backup-summary': { textContent: '' }
    };

    const context = createBaseContext({
        localStorage: createStorageMock({
            gistId: 'gist_test',
            localLastSyncTime: '2026-04-20T10:00:00.000Z'
        }),
        sessionStorage: createStorageMock({
            githubToken: 'ghp_test'
        }),
        document: {
            activeElement: null,
            getElementById(id) {
                return elements[id] || null;
            }
        },
        lucide: { createIcons() {} },
        registerAppModule() {},
        cloneChildNodesSnapshot() { return []; },
        restoreChildNodesSnapshot() {},
        setElementIconLabel() {},
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        },
        showConfirmDialog: async (options) => {
            confirmOptions = options;
            return false;
        },
        applyWorkspaceDatasetSnapshot(data) {
            context.__appliedData = data;
        },
        buildCloudSyncPayload(syncTime) {
            return { lastSyncTime: syncTime };
        },
        saveData() {},
        getTodayString() { return '2026-04-20'; },
        refreshCheckinViews() {},
        updateTodayPhoneResistTimes() {},
        updateAchievementsList() {},
        updateTodayTasksList() {},
        updateSchedule() {},
        updateLeaveRecordsList() {},
        renderCurrentTaskState() {},
        refreshDashboardHome() {},
        renderTavernHistory() {},
        countTotalTaskEntries() { return 0; },
        countQuickNoteEntries() { return 0; },
        ensureDayRecord(day) { return day; },
        hasAnyCheckinRecord() { return false; },
        checkinData: {},
        phoneResistData: { totalCount: 0, records: { '2026-04-20': { count: 0 } } },
        leaveData: [],
        achievements: [],
        tavernData: [],
        currentTask: null
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/ui.js');
    loadScript(context, 'assets/js/features/sync/backup.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');
    loadScript(context, 'assets/js/features/sync/index.js');

    context.saveSyncConfig();
    assert.deepEqual(toastEvents.at(-1), {
        message: '⚙️ Token 仅保存在当前会话，Gist ID 已保存到本地。',
        tone: 'success'
    });
    assert.equal(context.sessionStorage.getItem('githubToken'), 'ghp_test');
    assert.equal(context.localStorage.getItem('githubToken'), null);
    assert.equal(context.localStorage.getItem('gistId'), 'gist_test');

    context.fetchCloudWorkspaceSnapshot = async () => ({
        data: { lastSyncTime: '2026-04-21T10:00:00.000Z' },
        etag: 'etag-newer'
    });
    const overwriteConfirmed = await context.maybeConfirmCloudOverwrite();
    assert.equal(overwriteConfirmed, false);
    assert.equal(confirmOptions.badge, 'SYNC OVERRIDE');
    assert.match(confirmOptions.message, /云端较新的数据/);

    context.fetchCloudWorkspaceSnapshot = async () => ({
        data: { lastSyncTime: '2026-04-20T09:00:00.000Z' },
        etag: null
    });
    const missingEtagConfirmed = await context.maybeConfirmCloudOverwrite();
    assert.equal(missingEtagConfirmed, false);

    toastEvents.length = 0;
    let pushAttempted = false;
    context.pushCloudWorkspaceData = async () => {
        pushAttempted = true;
    };
    await context.handlePushCloud();
    assert.equal(pushAttempted, false);
    assert.deepEqual(toastEvents.at(-1), {
        message: '无法确认云端版本，已取消上传。请稍后重试或先拉取确认。',
        tone: 'warning'
    });

    toastEvents.length = 0;
    context.fetchCloudWorkspaceSnapshot = async () => { throw new Error('fetch_failed_401'); };
    context.pushCloudWorkspaceData = async () => ({ ok: true });
    await context.handlePushCloud();
    assert.deepEqual(toastEvents.at(-1), { message: '❌ 上传失败，请检查配置信息。', tone: 'error' });
    assert.equal(elements['push-cloud-btn'].disabled, false);

    toastEvents.length = 0;
    context.fetchCloudWorkspaceSnapshot = async () => ({
        data: { lastSyncTime: '2026-04-20T09:00:00.000Z' },
        etag: '"etag-conflict"'
    });
    context.pushCloudWorkspaceData = async (_payload, options = {}) => {
        assert.equal(options.etag, '"etag-conflict"');
        throw new Error('push_failed_412');
    };
    await context.handlePushCloud();
    assert.deepEqual(toastEvents.at(-1), { message: '❌ 云端数据已变化，本次上传已取消。请先拉取确认。', tone: 'warning' });

    toastEvents.length = 0;
    context.showConfirmDialog = async () => true;
    context.fetchCloudWorkspaceData = async () => { throw new Error('network down'); };
    await context.handlePullCloud();
    assert.deepEqual(toastEvents.at(-1), { message: '🌐 网络请求失败：network down', tone: 'error' });
    assert.equal(elements['pull-cloud-btn'].disabled, false);

    toastEvents.length = 0;
    context.fetchCloudWorkspaceData = async () => { throw new Error('fetch_invalid_payload'); };
    await context.handlePullCloud();
    assert.deepEqual(toastEvents.at(-1), { message: '❌ 云端数据文件内容损坏，当前无法拉取。', tone: 'error' });
});
