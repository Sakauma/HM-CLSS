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
    await assert.rejects(() => context.pushCloudWorkspaceData({ ok: true }), /push_failed_404/);
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
    loadScript(context, 'assets/js/features/sync/logic.js');

    context.triggerAutoSync();
    assert.equal(scheduledTimers.length, 1);
    assert.equal(context.clearAutoSyncTimer(), true);
    assert.deepEqual(clearedTimers, [scheduledTimers[0]]);

    context.triggerAutoSync();
    context.saveSyncCredentials('ghp_other', 'gist_other');
    assert.deepEqual(clearedTimers, [scheduledTimers[0], scheduledTimers[1]]);
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
    loadScript(context, 'assets/js/features/sync/logic.js');

    const runState = { active: true };
    const pendingPull = context.autoPullOnStartup(runState);
    runState.active = false;
    resolveFetch({ lastSyncTime: '2026-04-21T10:00:00.000Z' });
    await pendingPull;

    assert.deepEqual(appliedPayloads, []);
    assert.deepEqual(toastEvents, []);
});

test('sync controller covers conflict confirmation and failure branches', async () => {
    const toastEvents = [];
    let confirmOptions = null;
    const elements = {
        'github-token-input': { value: 'ghp_test' },
        'gist-id-input': { value: 'gist_test' },
        'save-config-btn': createButtonElement(),
        'push-cloud-btn': createButtonElement(),
        'pull-cloud-btn': createButtonElement()
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

    context.fetchCloudWorkspaceData = async () => ({ lastSyncTime: '2026-04-21T10:00:00.000Z' });
    const overwriteConfirmed = await context.maybeConfirmCloudOverwrite();
    assert.equal(overwriteConfirmed, false);
    assert.equal(confirmOptions.badge, 'SYNC OVERRIDE');
    assert.match(confirmOptions.message, /云端较新的数据/);

    toastEvents.length = 0;
    context.fetchCloudWorkspaceData = async () => { throw new Error('fetch_failed_401'); };
    context.pushCloudWorkspaceData = async () => ({ ok: true });
    await context.handlePushCloud();
    assert.deepEqual(toastEvents.at(-1), { message: '❌ 上传失败，请检查配置信息。', tone: 'error' });
    assert.equal(elements['push-cloud-btn'].disabled, false);

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
