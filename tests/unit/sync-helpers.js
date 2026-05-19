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
    loadScript(context, 'assets/js/features/sync/apply-transaction.js');
    context.refreshWorkspaceUiAfterSync = () => {};

    return { context, localStorage, toastEvents };
}

module.exports = {
    createButtonElement,
    createClassList,
    createSyncApplyContext
};
