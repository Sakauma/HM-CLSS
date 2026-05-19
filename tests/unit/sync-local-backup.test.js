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
