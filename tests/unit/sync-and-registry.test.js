const assert = require('node:assert/strict');
const test = require('node:test');

const {
    loadScript,
    createBaseContext,
    createStorageMock
} = require('./helpers');

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

function createClassList(initialValues = []) {
    const values = new Set(initialValues);
    return {
        add(...tokens) {
            tokens.forEach((token) => values.add(token));
        },
        remove(...tokens) {
            tokens.forEach((token) => values.delete(token));
        },
        toggle(token, force) {
            if (force === true) {
                values.add(token);
                return true;
            }
            if (force === false) {
                values.delete(token);
                return false;
            }
            if (values.has(token)) {
                values.delete(token);
                return false;
            }
            values.add(token);
            return true;
        },
        contains(token) {
            return values.has(token);
        }
    };
}

function createSyncApplyContext(options = {}) {
    const localStorage = options.localStorage || createStorageMock({
        gistId: 'gist_test',
        localLastSyncTime: options.localLastSyncTime || '2026-04-20T08:00:00.000Z'
    });
    const toastEvents = [];
    const context = createBaseContext({
        console: { ...console, error() {} },
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
        safeRemoveStorageItem(key, result) {
            localStorage.removeItem(key);
            return result.ok;
        },
        countTotalTaskEntries() { return 0; },
        countQuickNoteEntries() { return 0; },
        normalizeCurrentTaskRecord(task) {
            return task && typeof task.name === 'string' && Number.isFinite(task.startTimestamp) && typeof task.startTime === 'string'
                ? { id: task.id || `task_${task.startTimestamp}`, tag: task.tag || 'other', ...task }
                : null;
        },
        normalizeAmbientPreferences(prefs) {
            return {
                enabled: prefs?.enabled !== false,
                intensity: 'subtle',
                easterEggs: prefs?.easterEggs !== false
            };
        },
        normalizeCheckinPreferences(prefs) {
            return {
                lateGraceMins: Number.isFinite(Number(prefs?.lateGraceMins)) ? Number(prefs.lateGraceMins) : 30,
                earlyGraceMins: Number.isFinite(Number(prefs?.earlyGraceMins)) ? Number(prefs.earlyGraceMins) : 30
            };
        },
        refreshWorkspaceUiAfterSync() {},
        taskData: options.taskData || { '2026-04-19': [{ name: 'Original Task' }] },
        quickNotesData: options.quickNotesData || {},
        currentTask: options.currentTask || { name: 'Original Active', startTimestamp: 1769990000000, startTime: '08:00' },
        ambientPreferences: options.ambientPreferences || { enabled: true, easterEggs: true },
        checkinPreferences: options.checkinPreferences || { lateGraceMins: 30, earlyGraceMins: 30 }
    });

    Object.assign(context, {
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
                currentTask: context.currentTask ? JSON.parse(JSON.stringify(context.currentTask)) : null,
                ambientPreferences: JSON.parse(JSON.stringify(context.ambientPreferences)),
                checkinPreferences: JSON.parse(JSON.stringify(context.checkinPreferences)),
                lastSyncTime: localStorage.getItem('localLastSyncTime')
            };
        },
        applyWorkspaceDatasetSnapshot(datasets) {
            context.taskData = datasets.taskData || {};
            context.quickNotesData = datasets.quickNotesData || {};
        },
        persistCurrentTask() {
            if (typeof options.persistCurrentTask === 'function') {
                return options.persistCurrentTask(context, localStorage);
            }
            if (context.currentTask) {
                localStorage.setItem('currentTask', JSON.stringify(context.currentTask));
            } else {
                localStorage.removeItem('currentTask');
            }
            return { ok: true, failedKeys: [] };
        },
        saveData() {
            if (typeof options.saveData === 'function') {
                return options.saveData(context, localStorage);
            }
            localStorage.setItem('taskData', JSON.stringify(context.taskData));
            localStorage.setItem('quickNotesData', JSON.stringify(context.quickNotesData));
            localStorage.setItem('ambientPreferences', JSON.stringify(context.ambientPreferences));
            localStorage.setItem('checkinPreferences', JSON.stringify(context.checkinPreferences));
            return { ok: true, failedKeys: [] };
        }
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/backup.js');
    context.refreshWorkspaceUiAfterSync = () => {};

    return { context, localStorage, toastEvents };
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

test('theme module tolerates unavailable localStorage', () => {
    const htmlClassList = createClassList();
    const themeToggle = createButtonElement();
    let registeredModule = null;
    const context = createBaseContext({
        console: { ...console, error() {} },
        localStorage: {
            getItem() {
                throw new Error('storage disabled');
            },
            setItem() {
                throw new Error('storage disabled');
            }
        },
        document: {
            documentElement: { classList: htmlClassList },
            getElementById(id) {
                if (id === 'theme-toggle') return themeToggle;
                if (id === 'theme-icon-dark' || id === 'theme-icon-light') {
                    return { classList: createClassList(['hidden']) };
                }
                return null;
            },
            querySelector() {
                return null;
            }
        },
        matchMedia: () => ({
            matches: true,
            addEventListener() {},
            removeEventListener() {}
        }),
        lucide: { createIcons() {} },
        createDisposables: () => ({
            listen() { return () => {}; },
            dispose() {}
        }),
        registerAppModule(module) {
            registeredModule = module;
        }
    });

    loadScript(context, 'assets/js/runtime/theme.js');

    assert.equal(htmlClassList.contains('dark'), true);
    assert.equal(registeredModule.id, 'runtime-theme');
    assert.doesNotThrow(() => context.handleThemeToggleClick());
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

test('local cloud-apply backup restore rolls back when state persistence fails', async () => {
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
    let saveCalls = 0;
    let persistCalls = 0;
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
        persistCurrentTask() {
            persistCalls += 1;
            if (persistCalls === 1) {
                return { ok: false, failedKeys: ['currentTask'] };
            }
            localStorage.setItem('currentTask', JSON.stringify(context.currentTask));
            return { ok: true, failedKeys: [] };
        },
        saveData() {
            saveCalls += 1;
            localStorage.setItem('taskData', JSON.stringify(context.taskData));
            return { ok: true, failedKeys: [] };
        },
        refreshWorkspaceUiAfterSync() {},
        taskData: { '2026-04-19': [{ name: 'Original Task' }] },
        quickNotesData: {},
        currentTask: { name: 'Original Active', startTimestamp: 1769990000000, startTime: '08:00' },
        ambientPreferences: { enabled: true },
        checkinPreferences: { lateGraceMins: 30, earlyGraceMins: 30 }
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/backup.js');
    context.refreshWorkspaceUiAfterSync = () => {};

    const restored = await context.restoreLocalBackupBeforeCloudApply();

    assert.equal(restored, false);
    assert.equal(saveCalls, 2);
    assert.equal(context.taskData['2026-04-19'][0].name, 'Original Task');
    assert.equal(context.currentTask.name, 'Original Active');
    assert.equal(context.localStorage.getItem('localLastSyncTime'), '2026-04-20T08:00:00.000Z');
    assert.match(context.localStorage.getItem('taskData'), /Original Task/);
    assert.equal(toastEvents.at(-1).tone, 'error');
    assert.match(toastEvents.at(-1).message, /已回滚并保留当前工作区/);
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
    assert.match(toastEvents.at(-1).message, /回滚当前工作区/);
});

test('cloud import applies workspace state when payload includes state', () => {
    const { context, localStorage } = createSyncApplyContext();

    const applied = context.applyImportedData({
        taskData: { '2026-04-20': [{ name: 'Cloud Task' }] },
        quickNotesData: {},
        state: {
            currentTask: { name: 'Cloud Active', startTimestamp: 1770000000000, startTime: '09:00', tag: 'code' },
            ambientPreferences: { enabled: false, easterEggs: false },
            checkinPreferences: { lateGraceMins: 45, earlyGraceMins: 10 }
        },
        lastSyncTime: '2026-04-20T10:00:00.000Z'
    });

    assert.equal(applied, true);
    assert.equal(context.taskData['2026-04-20'][0].name, 'Cloud Task');
    assert.equal(context.currentTask.name, 'Cloud Active');
    assert.equal(context.ambientPreferences.enabled, false);
    assert.equal(context.checkinPreferences.lateGraceMins, 45);
    assert.match(localStorage.getItem('currentTask'), /Cloud Active/);
    assert.equal(localStorage.getItem('localLastSyncTime'), '2026-04-20T10:00:00.000Z');
});

test('legacy cloud import keeps local workspace state when payload has no state', () => {
    const { context, localStorage } = createSyncApplyContext();

    const applied = context.applyImportedData({
        taskData: { '2026-04-20': [{ name: 'Legacy Cloud Task' }] },
        quickNotesData: {},
        lastSyncTime: '2026-04-20T10:00:00.000Z'
    });

    assert.equal(applied, true);
    assert.equal(context.taskData['2026-04-20'][0].name, 'Legacy Cloud Task');
    assert.equal(context.currentTask.name, 'Original Active');
    assert.equal(context.ambientPreferences.enabled, true);
    assert.equal(context.checkinPreferences.lateGraceMins, 30);
    assert.equal(localStorage.getItem('localLastSyncTime'), '2026-04-20T10:00:00.000Z');
});

test('cloud import rolls back datasets and state when state persistence fails', () => {
    let persistCalls = 0;
    const { context, localStorage, toastEvents } = createSyncApplyContext({
        persistCurrentTask() {
            persistCalls += 1;
            if (persistCalls === 1) {
                return { ok: false, failedKeys: ['currentTask'] };
            }
            localStorage.setItem('currentTask', JSON.stringify(context.currentTask));
            return { ok: true, failedKeys: [] };
        }
    });

    const applied = context.applyImportedData({
        taskData: { '2026-04-20': [{ name: 'Cloud Task' }] },
        quickNotesData: {},
        state: {
            currentTask: { name: 'Cloud Active', startTimestamp: 1770000000000, startTime: '09:00' },
            ambientPreferences: { enabled: false },
            checkinPreferences: { lateGraceMins: 45, earlyGraceMins: 10 }
        },
        lastSyncTime: '2026-04-20T10:00:00.000Z'
    });

    assert.equal(applied, false);
    assert.equal(context.taskData['2026-04-19'][0].name, 'Original Task');
    assert.equal(context.currentTask.name, 'Original Active');
    assert.equal(context.ambientPreferences.enabled, true);
    assert.equal(context.checkinPreferences.lateGraceMins, 30);
    assert.match(localStorage.getItem('taskData'), /Original Task/);
    assert.equal(localStorage.getItem('localLastSyncTime'), '2026-04-20T08:00:00.000Z');
    assert.equal(toastEvents.at(-1).tone, 'error');
    assert.match(toastEvents.at(-1).message, /已回滚当前工作区/);
});

test('cloud import aborts when pre-apply local backup cannot be written', () => {
    const localStorage = createStorageMock({
        gistId: 'gist_test',
        localLastSyncTime: '2026-04-20T08:00:00.000Z'
    });
    const toastEvents = [];
    let applyCalls = 0;
    let saveCalls = 0;
    const context = createBaseContext({
        console: { ...console, error() {} },
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
        safeSetStorageItem(key, _value, result) {
            result.ok = false;
            result.failedKeys.push(key);
            return false;
        },
        countTotalTaskEntries() { return 0; },
        countQuickNoteEntries() { return 0; },
        buildWorkspaceDatasetSnapshot() {
            return {
                taskData: JSON.parse(JSON.stringify(context.taskData)),
                quickNotesData: JSON.parse(JSON.stringify(context.quickNotesData))
            };
        },
        buildWorkspaceStateSnapshot() {
            return {
                currentTask: context.currentTask,
                lastSyncTime: localStorage.getItem('localLastSyncTime')
            };
        },
        applyWorkspaceDatasetSnapshot(datasets) {
            applyCalls += 1;
            context.taskData = datasets.taskData || {};
            context.quickNotesData = datasets.quickNotesData || {};
        },
        saveData() {
            saveCalls += 1;
            return { ok: true, failedKeys: [] };
        },
        taskData: { '2026-04-19': [{ name: 'Original Task' }] },
        quickNotesData: {},
        currentTask: null
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/backup.js');

    const applied = context.applyImportedData({
        taskData: { '2026-04-20': [{ name: 'Cloud Task' }] },
        quickNotesData: {},
        lastSyncTime: '2026-04-20T10:00:00.000Z'
    });

    assert.equal(applied, false);
    assert.equal(applyCalls, 0);
    assert.equal(saveCalls, 0);
    assert.equal(context.taskData['2026-04-19'][0].name, 'Original Task');
    assert.equal(context.localStorage.getItem('localLastSyncTime'), '2026-04-20T08:00:00.000Z');
    assert.equal(context.localStorage.getItem('lastLocalBackupBeforeCloudApply'), null);
    assert.equal(toastEvents.at(-1).tone, 'error');
    assert.match(toastEvents.at(-1).message, /覆盖前本地备份失败/);
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
