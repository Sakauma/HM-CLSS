const assert = require('node:assert/strict');
const test = require('node:test');

const {
    loadScript,
    createBaseContext,
    createStorageMock
} = require('./helpers');
const {
    createButtonElement,
    createSyncApplyContext
} = require('./sync-helpers');

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
    loadScript(context, 'assets/js/features/sync/apply-transaction.js');
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
    loadScript(context, 'assets/js/features/sync/apply-transaction.js');

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
