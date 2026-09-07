const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const {
    loadScript,
    createBaseContext,
    createCheckinDay,
    createStorageMock
} = require('./helpers');

test('export data builds stable monthly snapshot summaries', () => {
    const context = createBaseContext({
        getTodayString: () => '2026-04-20',
        tagMap: { paper: '论文', code: '代码', experiment: '实验', write: '写作', other: '其他' },
        noteTagConfig: {
            idea: { label: '灵感' },
            todo: { label: '待办' }
        },
        buildWorkspaceStateSnapshot: () => ({
            currentTask: null,
            ambientPreferences: { enabled: true },
            checkinPreferences: { lateGraceMins: 30, earlyGraceMins: 30 },
            lastSyncTime: null
        }),
        buildWorkspaceDatasetSnapshot: () => ({ snapshot: true }),
        countCheckinDays: () => 12,
        countQuickNoteEntries: () => 3,
        calculateTotalTaskHours: () => 18.5,
        calculateCheckinRateForRange: () => 87.34,
        cloneWorkspaceValue: (value) => JSON.parse(JSON.stringify(value)),
        ensureDayRecord: (day) => createCheckinDay(day),
        createEmptyDayRecord: () => createCheckinDay(),
        formatLocalDate: (date) => date.toISOString().slice(0, 10),
        formatDisplayDate: (date) => `D:${date}`,
        normalizeDrinkRecord: (drink) => ({ ...drink }),
        getNormalizedCheckInStatus: (status) => status,
        summarizeShiftStatuses: (inStatus, outStatus) => ({ text: `${inStatus}/${outStatus}`, tone: 'info', detail: '' }),
        getPeriodLabel: (period) => ({ morning: 'Alpha 班次', afternoon: 'Beta 班次', evening: 'Gamma 班次' }[period]),
        getNoteText: (note) => note.text || '',
        phoneResistData: {
            totalCount: 2,
            records: {
                '2026-04-01': { count: 2, times: ['09:00', '11:00'] }
            }
        },
        checkinData: {
            '2026-04-01': createCheckinDay({
                morning: {
                    checkIn: '08:50',
                    checkOut: '12:00',
                    status: { checkIn: 'success', checkOut: 'success' },
                    entrySource: 'live',
                    updatedAt: null,
                    correctionReason: ''
                }
            }),
            '2026-04-02': createCheckinDay({
                morning: {
                    checkIn: '09:20',
                    checkOut: '09:50',
                    status: { checkIn: 'warning', checkOut: 'danger' },
                    entrySource: 'retro',
                    updatedAt: null,
                    correctionReason: '补录'
                }
            })
        },
        taskData: {
            '2026-04-01': [{ id: 't1', name: 'Paper Draft', tag: 'paper', startTime: '09:00', endTime: '10:30', duration: 90 }],
            '2026-04-02': [{ id: 't2', name: 'Build Probe', tag: 'code', startTime: '14:00', endTime: '16:00', duration: 120 }]
        },
        quickNotesData: {
            '2026-04-01': [{ time: '09:10', tag: 'idea', text: 'Signal locked' }]
        },
        leaveData: [
            { date: '2026-04-03', type: 'full', requestMode: 'planned', reason: 'Transit' },
            { date: '2026-04-02', type: 'partial', requestMode: 'retro', reason: 'Repair', correctionNote: '补录' }
        ],
        tavernData: [
            { date: '2026-04-01', name: 'Drift Glass', family: 'Calm', style: 'Still', reason: 'Steady hands', secret: true }
        ],
        achievements: ['a1', 'a2']
    });

    loadScript(context, 'assets/js/features/export/profiles.js');
    loadScript(context, 'assets/js/features/export/monthly.js');
    loadScript(context, 'assets/js/features/export/data.js');

    assert.equal(context.getExportProfile('missing').id, 'month_json');

    const overview = context.buildWorkspaceExportOverview();
    assert.equal(overview.metrics.checkinDays, 12);
    assert.equal(overview.metrics.taskHours, 18.5);
    assert.match(overview.note, /JSON|CSV|Markdown/);

    const snapshot = context.buildMonthlyExportSnapshot('2026-04');
    assert.equal(snapshot.meta.monthLabel, '2026年4月');
    assert.equal(snapshot.summary.activeCheckinDays, 2);
    assert.equal(snapshot.summary.retroCheckinDays, 1);
    assert.equal(snapshot.summary.totalTasks, 2);
    assert.equal(snapshot.summary.taskHoursTotal, 3.5);
    assert.equal(snapshot.summary.fullLeaveCount, 1);
    assert.equal(snapshot.summary.partialLeaveEntryCount, 1);
    assert.equal(snapshot.summary.plannedLeaveCount, 1);
    assert.equal(snapshot.summary.retroLeaveCount, 1);
    assert.equal(snapshot.summary.topTaskTag.label, '代码');
    assert.equal(snapshot.summary.topDrinkFamily.family, 'Calm');
    assert.equal(snapshot.details.quickNotes[0].text, 'Signal locked');
});

test('workspace cloning prefers structuredClone and falls back safely', () => {
    const cloneContext = createBaseContext({
        structuredClone: (value) => ({ copied: true, value })
    });
    loadScript(cloneContext, 'assets/js/workspace/data.js');
    const structuredResult = cloneContext.cloneWorkspaceValue({ nested: { a: 1 } });
    assert.equal(structuredResult.copied, true);
    assert.equal(structuredResult.value.nested.a, 1);

    const fallbackContext = createBaseContext({
        structuredClone: undefined
    });
    loadScript(fallbackContext, 'assets/js/workspace/data.js');
    const original = { nested: { a: 1 } };
    const fallbackClone = fallbackContext.cloneWorkspaceValue(original);
    fallbackClone.nested.a = 2;
    assert.equal(original.nested.a, 1);
    assert.equal(fallbackContext.cloneWorkspaceValue(undefined), undefined);
});

test('cloud sync payload includes workspace state without leaking sync credentials', () => {
    const context = createBaseContext({
        localLastSyncTime: '2026-04-20T08:00:00.000Z',
        normalizeAmbientPreferences: (prefs) => ({
            enabled: prefs?.enabled !== false,
            intensity: 'subtle',
            easterEggs: prefs?.easterEggs !== false
        }),
        normalizeCheckinPreferences: (prefs) => ({
            lateGraceMins: Number.isFinite(Number(prefs?.lateGraceMins)) ? Number(prefs.lateGraceMins) : 30,
            earlyGraceMins: Number.isFinite(Number(prefs?.earlyGraceMins)) ? Number(prefs.earlyGraceMins) : 30
        })
    });
    const state = {
        checkinData: {},
        phoneResistData: { totalCount: 1, records: {} },
        taskData: { '2026-04-20': [{ name: 'Task' }] },
        leaveData: [],
        achievements: ['first'],
        quickNotesData: {},
        tavernData: [],
        currentTask: { id: 'task_active', name: 'Active Task', startTimestamp: 1770000000000, startTime: '09:00' },
        ambientPreferences: { enabled: false, easterEggs: false },
        checkinPreferences: { lateGraceMins: 45, earlyGraceMins: 10 }
    };

    context.runtimeSelectors = {
        state: () => state,
        currentTask: () => state.currentTask,
        ambientPreferences: () => state.ambientPreferences,
        checkinPreferences: () => state.checkinPreferences
    };

    loadScript(context, 'assets/js/workspace/data.js');

    const payload = context.buildCloudSyncPayload('2026-04-20T10:00:00.000Z');
    assert.equal(payload.lastSyncTime, '2026-04-20T10:00:00.000Z');
    assert.equal(payload.taskData['2026-04-20'][0].name, 'Task');
    assert.equal(payload.state.currentTask.name, 'Active Task');
    assert.equal(payload.state.ambientPreferences.enabled, false);
    assert.equal(payload.state.checkinPreferences.lateGraceMins, 45);
    assert.equal(payload.state.lastSyncTime, undefined);
    assert.equal(JSON.stringify(payload).includes('githubToken'), false);
    assert.equal(JSON.stringify(payload).includes('gistId'), false);
});

test('export formats serialize markdown, csv and file descriptors', () => {
    const snapshot = {
        meta: {
            month: '2026-04',
            monthLabel: '2026年4月',
            exportedAt: '2026-04-20T12:00:00.000Z'
        },
        summary: {
            activeCheckinDays: 5,
            daysInMonth: 30,
            checkinRate: 88.4,
            totalTasks: 4,
            taskHoursTotal: 12.5,
            phoneResistTotal: 3,
            quickNoteCount: 2,
            leaveCount: 1,
            tavernCount: 2,
            shiftCheckins: 6,
            shiftCheckouts: 6,
            retroCheckinDays: 1,
            fullLeaveDays: 1,
            partialLeaveCount: 1,
            plannedLeaveCount: 1,
            retroLeaveCount: 0,
            topTaskTag: { label: '代码', hours: 6 },
            deepestWorkDay: { displayDate: 'D:2026-04-12', hours: 4 },
            achievementsSnapshot: 3,
            strongestResistDay: { displayDate: 'D:2026-04-05', count: 2 },
            topDrinkFamily: { family: 'Calm', count: 2 },
            secretDrinkCount: 1
        },
        details: {
            checkins: [{ date: '2026-04-01', displayDate: 'D:2026-04-01', periodLabel: 'Alpha 班次', checkIn: '08:55', checkOut: '12:00', summary: '合规', entrySource: 'live', correctionReason: '' }],
            tasks: [{ date: '2026-04-01', displayDate: 'D:2026-04-01', startTime: '09:00', endTime: '11:00', name: 'Build \"A\"', tagLabel: '代码', durationMins: 120 }],
            quickNotes: [{ date: '2026-04-01', displayDate: 'D:2026-04-01', time: '09:30', tagLabel: '灵感', text: 'quoted, \"note\"' }],
            phoneResist: [{ date: '2026-04-01', displayDate: 'D:2026-04-01', count: 2, times: ['09:00', '11:00'] }],
            leaves: [{ date: '2026-04-02', type: 'full', requestMode: 'planned', reason: 'Transit', correctionNote: '' }],
            tavern: [{ date: '2026-04-03', time: '20:00', name: 'Drift Glass', style: 'Still', abv: '12%', family: 'Calm', reason: 'Steady' }]
        }
    };

    const context = createBaseContext({
        buildWorkspaceExportSnapshot: () => ({ meta: { scope: 'workspace' }, datasets: { foo: 'bar' } }),
        buildMonthlyExportSnapshot: () => snapshot,
        formatMonthLabel: () => '2026年4月',
        getDownloadTimestamp: () => '202604201200',
        formatDisplayDate: (date) => `D:${date}`
    });

    loadScript(context, 'assets/js/features/export/formats.js');

    const markdown = context.buildMonthlyMarkdown(snapshot);
    assert.match(markdown, /HM-CLSS 月度复盘｜2026年4月/);
    assert.match(markdown, /主导标签：代码（6h）/);

    const csv = context.buildMonthlyCsv(snapshot);
    assert.match(csv, /^category,date,display_date,/);
    assert.match(csv, /"quoted, ""note"""/);
    assert.match(csv, /Build ""A""/);

    const workspaceDescriptor = context.buildExportFileDescriptor({ id: 'workspace_json' }, '2026-04');
    assert.equal(workspaceDescriptor.filename, 'hm-clss-workspace-202604201200.json');

    const markdownDescriptor = context.buildExportFileDescriptor({ id: 'month_markdown' }, '2026-04');
    assert.equal(markdownDescriptor.filename, 'hm-clss-month-2026-04-202604201200.md');
    assert.match(markdownDescriptor.content, /月度复盘/);
});

test('storage migration normalizes legacy payloads and saveData persists schema version', () => {
    const localStorage = createStorageMock({
        checkinData: JSON.stringify({
            '2026-04-19': {
                morning: {
                    checkIn: '08:55',
                    status: { checkIn: true, checkOut: true }
                }
            }
        }),
        phoneResistData: JSON.stringify({
            totalCount: '2',
            records: {
                '2026-04-19': { count: '1', times: ['09:00'] }
            }
        }),
        taskData: JSON.stringify({
            '2026-04-19': [{ name: 'Legacy Task', duration: '45' }]
        }),
        leaveData: JSON.stringify([{ date: '2026-04-19', reason: 'Transit', type: 'full' }]),
        achievements: JSON.stringify(['keep-me', 1]),
        quickNotesData: JSON.stringify({
            '2026-04-19': ['legacy note', { time: '10:00', text: 'structured note', tag: 'todo' }]
        }),
        tavernData: JSON.stringify([{ name: 'Drift Glass' }]),
        currentTask: JSON.stringify({ name: 'Broken Task' }),
        ambientPrefs: JSON.stringify({ enabled: false, easterEggs: false }),
        checkinPrefs: JSON.stringify({ lateGraceMins: 45, earlyGraceMins: 20 })
    });

    let refreshStatisticsCalls = 0;
    let refreshExportCalls = 0;
    let ambientCalls = 0;
    let autoSyncCalls = 0;

    const context = createBaseContext({
        console: { ...console, error() {} },
        localStorage,
        CURRENT_TASK_STORAGE_KEY: 'currentTask',
        AMBIENT_PREFS_STORAGE_KEY: 'ambientPrefs',
        CHECKIN_PREFS_STORAGE_KEY: 'checkinPrefs',
        getNoteText: (note) => (note && typeof note.text === 'string' ? note.text : ''),
        ensureDayRecord: (day) => createCheckinDay(day),
        getNormalizedCheckInStatus: (status) => {
            if (status === true) return 'success';
            if (status === false) return 'warning';
            return status;
        },
        createEmptyDayRecord: () => createCheckinDay(),
        getTodayString: () => '2026-04-20',
        formatLocalDate: (date) => date.toISOString().slice(0, 10),
        normalizeLeaveRecord: (leave) => ({
            id: leave.id || 'leave_1',
            date: leave.date || '2026-04-20',
            reason: leave.reason || '',
            type: leave.type === 'partial' ? 'partial' : 'full',
            startTime: leave.startTime || null,
            endTime: leave.endTime || null,
            requestMode: leave.requestMode || 'normal',
            createdAt: leave.createdAt || '2026-04-20T00:00:00.000Z',
            correctionNote: leave.correctionNote || ''
        }),
        normalizeAmbientPreferences: (prefs) => ({
            enabled: prefs?.enabled !== false,
            intensity: 'subtle',
            easterEggs: prefs?.easterEggs !== false
        }),
        normalizeCheckinPreferences: (prefs) => ({
            lateGraceMins: Number.isFinite(Number(prefs?.lateGraceMins)) ? Number(prefs.lateGraceMins) : 30,
            earlyGraceMins: Number.isFinite(Number(prefs?.earlyGraceMins)) ? Number(prefs.earlyGraceMins) : 30
        }),
        refreshStatisticsView: () => { refreshStatisticsCalls += 1; },
        refreshExportPreview: () => { refreshExportCalls += 1; },
        updateVoyageAmbientPresentation: () => { ambientCalls += 1; },
        triggerAutoSync: () => { autoSyncCalls += 1; },
        checkinData: {},
        phoneResistData: { totalCount: 0, records: {} },
        taskData: {},
        leaveData: [],
        achievements: [],
        quickNotesData: {},
        tavernData: [],
        ambientPreferences: null,
        checkinPreferences: null,
        currentTask: null
    });

    context.setRuntimeValue = (key, value) => {
        context[key] = value;
        return value;
    };
    context.mapRuntimeItems = (key, mapper) => {
        context[key] = (Array.isArray(context[key]) ? context[key] : []).map(mapper);
        return context[key];
    };

    loadScript(context, 'assets/js/runtime/store.js');
    loadScript(context, 'assets/js/runtime/storage-migrations.js');
    loadScript(context, 'assets/js/runtime/storage-payload.js');
    loadScript(context, 'assets/js/runtime/storage-shapes.js');
    loadScript(context, 'assets/js/runtime/storage.js');

    assert.deepEqual(context.safeParseStoredJson('{\"ok\":true}', {}), { ok: true });
    assert.deepEqual(context.safeParseStoredJson('{broken', { fallback: true }), { fallback: true });

    context.initData();

    assert.equal(context.localStorage.getItem('hmclss_storage_schema_version'), '1');
    assert.equal(context.currentTask, null);
    assert.equal(context.quickNotesData['2026-04-19'][0].text, 'legacy note');
    assert.equal(context.quickNotesData['2026-04-19'][1].tag, 'todo');
    assert.equal(context.phoneResistData.records['2026-04-19'].count, 1);
    assert.equal(context.taskData['2026-04-19'][0].duration, 45);
    assert.equal(context.taskData['2026-04-19'][0].startDate, '2026-04-19');
    assert.equal(context.taskData['2026-04-19'][0].endDate, '2026-04-19');
    assert.equal(context.achievements.length, 1);
    assert.equal(context.ambientPreferences.enabled, false);
    assert.equal(context.checkinPreferences.lateGraceMins, 45);
    assert.equal(context.checkinPreferences.earlyGraceMins, 20);
    assert.equal(context.checkinData['2026-04-20'].leave, false);
    assert.equal(autoSyncCalls, 0);

    context.saveData();
    assert.equal(context.localStorage.getItem('hmclss_storage_schema_version'), '1');
    assert.ok(refreshStatisticsCalls > 0);
    assert.ok(refreshExportCalls > 0);
    assert.ok(ambientCalls > 0);
    assert.equal(autoSyncCalls, 1);
});

test('initData preserves corrupted localStorage keys instead of overwriting them', () => {
    const localStorage = createStorageMock({
        taskData: '{broken',
        checkinData: JSON.stringify({}),
        phoneResistData: JSON.stringify({ totalCount: 0, records: {} })
    });

    const context = createBaseContext({
        localStorage,
        CURRENT_TASK_STORAGE_KEY: 'currentTask',
        AMBIENT_PREFS_STORAGE_KEY: 'ambientPrefs',
        CHECKIN_PREFS_STORAGE_KEY: 'checkinPrefs',
        getNoteText: (note) => (note && typeof note.text === 'string' ? note.text : ''),
        getNormalizedCheckInStatus: (status) => status,
        getTodayString: () => '2026-04-20',
        formatLocalDate: (date) => date.toISOString().slice(0, 10),
        refreshStatisticsView() {},
        refreshExportPreview() {},
        updateVoyageAmbientPresentation() {},
        checkinData: {},
        phoneResistData: { totalCount: 0, records: {} },
        taskData: {},
        leaveData: [],
        achievements: [],
        quickNotesData: {},
        tavernData: [],
        ambientPreferences: null,
        checkinPreferences: null,
        currentTask: null
    });

    loadScript(context, 'assets/js/runtime/store.js');
    loadScript(context, 'assets/js/runtime/storage-migrations.js');
    loadScript(context, 'assets/js/runtime/storage-payload.js');
    loadScript(context, 'assets/js/runtime/storage-shapes.js');
    loadScript(context, 'assets/js/runtime/storage.js');

    context.initData();

    const corruptedKeys = context.getCorruptedStorageKeys();
    assert.equal(corruptedKeys.length, 1);
    assert.equal(corruptedKeys[0], 'taskData');
    assert.equal(context.localStorage.getItem('taskData'), '{broken');
    assert.equal(context.taskData['2026-04-20'].length, 0);
});

test('saveData reports storage write failures and skips auto sync', () => {
    let autoSyncCalls = 0;
    const toastEvents = [];
    const localStorage = {
        getItem() {
            return null;
        },
        setItem(key) {
            if (key === 'taskData') {
                throw new Error('quota exceeded');
            }
        },
        removeItem() {}
    };

    const context = createBaseContext({
        console: { ...console, error() {} },
        localStorage,
        AMBIENT_PREFS_STORAGE_KEY: 'ambientPrefs',
        CHECKIN_PREFS_STORAGE_KEY: 'checkinPrefs',
        normalizeAmbientPreferences: (prefs) => prefs || { enabled: true },
        normalizeCheckinPreferences: (prefs) => prefs || { lateGraceMins: 30, earlyGraceMins: 30 },
        refreshStatisticsView() {},
        refreshExportPreview() {},
        updateVoyageAmbientPresentation() {},
        triggerAutoSync() {
            autoSyncCalls += 1;
        },
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        },
        checkinData: {},
        phoneResistData: { totalCount: 0, records: {} },
        taskData: { '2026-04-20': [] },
        leaveData: [],
        achievements: [],
        quickNotesData: {},
        tavernData: [],
        ambientPreferences: null,
        checkinPreferences: null
    });

    loadScript(context, 'assets/js/runtime/storage.js');

    const result = context.saveData();
    assert.equal(result.ok, false);
    assert.equal(result.failedKeys.length, 1);
    assert.equal(result.failedKeys[0], 'taskData');
    assert.equal(autoSyncCalls, 0);
    assert.equal(toastEvents.at(-1).tone, 'error');

    context.saveData();
    assert.equal(toastEvents.length, 1);
});

test('initData enters session mode without overwriting storage when reads are blocked', () => {
    let writeCalls = 0;
    let readsBlocked = true;
    const toastEvents = [];
    const storedQuickNotes = JSON.stringify({ '2026-04-19': [{ text: 'preserve me' }] });
    const store = new Map([['quickNotesData', storedQuickNotes]]);
    const context = createBaseContext({
        console: { ...console, error() {} },
        localStorage: {
            getItem(key) {
                if (readsBlocked) {
                    const error = new Error('blocked');
                    error.name = 'SecurityError';
                    throw error;
                }
                return store.has(key) ? store.get(key) : null;
            },
            setItem(key, value) {
                writeCalls += 1;
                store.set(key, String(value));
            },
            removeItem(key) {
                writeCalls += 1;
                store.delete(key);
            }
        },
        getTodayString: () => '2026-04-20',
        formatLocalDate: (date) => date.toISOString().slice(0, 10),
        getNormalizedCheckInStatus: (status) => status,
        refreshStatisticsView() {},
        refreshExportPreview() {},
        updateVoyageAmbientPresentation() {},
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        },
        setTimeout(callback) {
            callback();
            return 1;
        }
    });

    loadScript(context, 'assets/js/runtime/state.js');
    loadScript(context, 'assets/js/runtime/store.js');
    loadScript(context, 'assets/js/runtime/storage-migrations.js');
    loadScript(context, 'assets/js/runtime/storage-payload.js');
    loadScript(context, 'assets/js/runtime/storage-shapes.js');
    loadScript(context, 'assets/js/runtime/storage.js');

    assert.doesNotThrow(() => context.initData());
    assert.equal(writeCalls, 0);
    assert.equal(context.isStorageSessionMode(), true);
    assert.equal(context.isStorageStartupReadBlocked(), true);
    assert.ok(context.getFailedStorageReadKeys().includes('taskData'));
    assert.match(toastEvents.at(-1).message, /会话模式/);

    readsBlocked = false;
    let mutationCalls = 0;
    const result = context.commitRuntimeMutation(['quickNotesData'], () => {
        mutationCalls += 1;
        context.runtimeActions.setQuickNotesData({ overwritten: true });
    });

    assert.equal(result.blocked, true);
    assert.equal(result.blockReason, 'startupRead');
    assert.equal(mutationCalls, 0);
    assert.equal(writeCalls, 0);
    assert.equal(store.get('quickNotesData'), storedQuickNotes);
    assert.match(toastEvents.at(-1).message, /避免覆盖旧数据/);
});

test('saveData rolls back earlier keys when a later key write fails', () => {
    const store = new Map([
        ['taskData', JSON.stringify({ old: ['task'] })],
        ['quickNotesData', JSON.stringify({ old: ['note'] })]
    ]);
    let quickNoteFailures = 1;
    let autoSyncCalls = 0;
    const context = createBaseContext({
        console: { ...console, error() {} },
        localStorage: {
            getItem(key) {
                return store.has(key) ? store.get(key) : null;
            },
            setItem(key, value) {
                if (key === 'quickNotesData' && quickNoteFailures > 0) {
                    quickNoteFailures -= 1;
                    throw new Error('quota exceeded');
                }
                store.set(key, String(value));
            },
            removeItem(key) {
                store.delete(key);
            }
        },
        CURRENT_TASK_STORAGE_KEY: 'currentTask',
        AMBIENT_PREFS_STORAGE_KEY: 'ambientPrefs',
        CHECKIN_PREFS_STORAGE_KEY: 'checkinPrefs',
        normalizeAmbientPreferences: (value) => value || {},
        normalizeCheckinPreferences: (value) => value || {},
        triggerAutoSync() {
            autoSyncCalls += 1;
        },
        showToast() {},
        checkinData: {},
        phoneResistData: {},
        taskData: { fresh: ['task'] },
        leaveData: [],
        achievements: [],
        quickNotesData: { fresh: ['note'] },
        tavernData: [],
        ambientPreferences: {},
        checkinPreferences: {}
    });
    loadScript(context, 'assets/js/runtime/storage.js');

    const result = context.saveData(false, { keys: ['taskData', 'quickNotesData'] });

    assert.equal(result.ok, false);
    assert.equal(result.rollbackSucceeded, true);
    assert.deepEqual(JSON.parse(store.get('taskData')), { old: ['task'] });
    assert.deepEqual(JSON.parse(store.get('quickNotesData')), { old: ['note'] });
    assert.deepEqual(Array.from(result.persistedKeys), []);
    assert.equal(autoSyncCalls, 0);
});

test('rollback failure blocks repeated runtime mutations and keeps the latest memory for export', () => {
    const store = new Map([
        ['taskData', JSON.stringify({ old: [] })],
        ['quickNotesData', JSON.stringify({ old: [] })]
    ]);
    const toastEvents = [];
    const context = createBaseContext({
        console: { ...console, error() {} },
        localStorage: {
            getItem(key) {
                return store.has(key) ? store.get(key) : null;
            },
            setItem(key, value) {
                if (key === 'quickNotesData') throw new Error('write blocked');
                store.set(key, String(value));
            },
            removeItem(key) {
                store.delete(key);
            }
        },
        CURRENT_TASK_STORAGE_KEY: 'currentTask',
        AMBIENT_PREFS_STORAGE_KEY: 'ambientPrefs',
        CHECKIN_PREFS_STORAGE_KEY: 'checkinPrefs',
        normalizeAmbientPreferences: (value) => value || {},
        normalizeCheckinPreferences: (value) => value || {},
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        },
        checkinData: {},
        phoneResistData: {},
        taskData: { old: [] },
        leaveData: [],
        achievements: [],
        quickNotesData: { old: [] },
        tavernData: [],
        currentTask: null,
        ambientPreferences: {},
        checkinPreferences: {}
    });
    context.setRuntimeValue = (key, value) => {
        context[key] = value;
        return value;
    };
    loadScript(context, 'assets/js/runtime/store.js');
    loadScript(context, 'assets/js/runtime/storage.js');

    let mutationCalls = 0;
    const mutate = () => {
        mutationCalls += 1;
        context.runtimeActions.setTaskData({ fresh: [{ id: mutationCalls }] });
        context.runtimeActions.setQuickNotesData({ fresh: [{ id: mutationCalls }] });
    };
    const firstResult = context.commitRuntimeMutation(['taskData', 'quickNotesData'], mutate);
    const secondResult = context.commitRuntimeMutation(['taskData', 'quickNotesData'], mutate);

    assert.equal(firstResult.rollbackSucceeded, false);
    assert.equal(firstResult.memoryRestored, false);
    assert.equal(context.isStorageWriteBlocked(), true);
    assert.equal(secondResult.blocked, true);
    assert.equal(mutationCalls, 1);
    assert.deepEqual(context.taskData, { fresh: [{ id: 1 }] });
    assert.match(toastEvents.at(-1).message, /导出.*刷新页面/);
});

test('quick capture retry uses the edited draft once after an initial save failure', () => {
    const store = new Map();
    let failuresRemaining = 1;
    const toastEvents = [];
    const quickInput = { value: 'first draft' };
    const quickTagSelect = { value: 'idea' };
    let closeCalls = 0;
    const context = createBaseContext({
        console: { ...console, error() {} },
        localStorage: {
            getItem(key) {
                return store.has(key) ? store.get(key) : null;
            },
            setItem(key, value) {
                if (key === 'quickNotesData' && failuresRemaining > 0) {
                    failuresRemaining -= 1;
                    throw new Error('quota exceeded');
                }
                store.set(key, String(value));
            },
            removeItem(key) {
                store.delete(key);
            }
        },
        getTodayString: () => '2026-04-20',
        getCurrentTimeString: () => '09:30',
        CURRENT_TASK_STORAGE_KEY: 'currentTask',
        AMBIENT_PREFS_STORAGE_KEY: 'ambientPrefs',
        CHECKIN_PREFS_STORAGE_KEY: 'checkinPrefs',
        normalizeAmbientPreferences: (value) => value || {},
        normalizeCheckinPreferences: (value) => value || {},
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        },
        updateQuickCaptureCount() {},
        closeQuickCaptureModal() {
            closeCalls += 1;
        },
        updateQuickNotesList() {},
        rerenderVisiblePanel() {},
        checkAchievements() {},
        lucide: { createIcons() {} },
        registerAppModule() {},
        checkinData: {},
        phoneResistData: {},
        taskData: {},
        leaveData: [],
        achievements: [],
        quickNotesData: {},
        tavernData: [],
        currentTask: null,
        ambientPreferences: {},
        checkinPreferences: {}
    });
    context.setRuntimeValue = (key, value) => {
        context[key] = value;
        return value;
    };
    loadScript(context, 'assets/js/runtime/store.js');
    loadScript(context, 'assets/js/runtime/storage.js');
    context.__quickInput = quickInput;
    context.__quickTagSelect = quickTagSelect;
    vm.runInContext('const quickInput = __quickInput; const quickTagSelect = __quickTagSelect;', context);
    loadScript(context, 'assets/js/features/notes/index.js');

    context.saveQuickCapture();
    assert.equal(quickInput.value, 'first draft');
    assert.equal(context.quickNotesData['2026-04-20'], undefined);
    assert.equal(closeCalls, 0);

    quickInput.value = 'edited draft';
    context.saveQuickCapture();

    assert.equal(context.quickNotesData['2026-04-20'].length, 1);
    assert.equal(context.quickNotesData['2026-04-20'][0].text, 'edited draft');
    assert.equal(JSON.parse(store.get('quickNotesData'))['2026-04-20'].length, 1);
    assert.equal(quickInput.value, '');
    assert.equal(closeCalls, 1);
    assert.equal(toastEvents.filter((event) => event.tone === 'success').length, 1);
});
