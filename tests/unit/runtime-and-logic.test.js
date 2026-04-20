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
        JSON,
        Math,
        Number,
        String,
        Boolean,
        Array,
        Object,
        Date,
        Intl,
        structuredClone: global.structuredClone,
        ...overrides
    });

    context.globalThis = context;
    context.window = context;
    return context;
}

function createCheckinDay(overrides = {}) {
    const emptyPeriod = () => ({
        checkIn: null,
        checkOut: null,
        status: { checkIn: null, checkOut: null },
        entrySource: null,
        updatedAt: null,
        correctionReason: ''
    });

    return {
        morning: emptyPeriod(),
        afternoon: emptyPeriod(),
        evening: emptyPeriod(),
        leave: false,
        leaveReason: '',
        leaveMeta: null,
        partialLeaves: [],
        ...overrides
    };
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
        },
        dump() {
            return Object.fromEntries(store.entries());
        }
    };
}

test('runtime store subscriptions receive updates and can unsubscribe', () => {
    const context = createBaseContext();
    loadScript(context, 'assets/js/runtime/store.js');

    const seen = [];
    const unsubscribe = context.subscribeRuntimeValue('currentTask', (value, previousValue, key) => {
        seen.push({ value, previousValue, key });
    }, { immediate: true });

    context.setRuntimeValue('currentTask', { id: 'task_1' });
    unsubscribe();
    context.setRuntimeValue('currentTask', { id: 'task_2' });

    assert.equal(seen.length, 2);
    assert.equal(seen[0].key, 'currentTask');
    assert.equal(seen[0].value, null);
    assert.equal(seen[1].previousValue, null);
    assert.equal(seen[1].value.id, 'task_1');
    assert.equal(context.getRuntimeValue('currentTask').id, 'task_2');
});

test('checkin rules evaluate statuses and write retro records', () => {
    const context = createBaseContext({
        CONFIG: {
            schedule: {
                morning: { okCheckInBefore: 9, okCheckOutBefore: 12 },
                afternoon: { okCheckInBefore: 14, okCheckOutBefore: 18 },
                evening: { okCheckInBefore: 20, okCheckOutBefore: 23 }
            },
            task: { minDurationMins: 30 }
        },
        checkinData: {},
        createEmptyDayRecord: () => createCheckinDay(),
        ensureDayRecord: (day) => createCheckinDay(day),
        formatLocalDate: (date) => date.toISOString().slice(0, 10)
    });

    loadScript(context, 'assets/js/features/checkin/rules.js');

    assert.equal(context.getNormalizedCheckInStatus(true), 'success');
    assert.equal(context.getNormalizedCheckInStatus(false), 'warning');
    assert.equal(context.timeStrToMins('08:30'), 510);

    const normalResult = context.evaluateShiftRecord('2026-04-19', 'morning', '09:20', '10:10');
    assert.equal(normalResult.valid, true);
    assert.equal(normalResult.inStatus, 'warning');
    assert.equal(normalResult.outStatus, 'success');

    context.checkinData['2026-04-18'] = createCheckinDay({
        partialLeaves: [{ startTime: '08:45', endTime: '12:30' }]
    });
    const excusedResult = context.evaluateShiftRecord('2026-04-18', 'morning', '09:10', '11:30');
    assert.equal(excusedResult.inStatus, 'excused');
    assert.equal(excusedResult.outStatus, 'excused');

    context.applyShiftRecord('2026-04-17', 'afternoon', {
        checkIn: '14:05',
        checkOut: '18:01',
        inStatus: 'success',
        outStatus: 'warning',
        entrySource: 'retro',
        correctionReason: '补录说明'
    });

    const written = context.checkinData['2026-04-17'].afternoon;
    assert.equal(written.checkIn, '14:05');
    assert.equal(written.checkOut, '18:01');
    assert.equal(written.status.checkIn, 'success');
    assert.equal(written.status.checkOut, 'warning');
    assert.equal(written.entrySource, 'retro');
    assert.equal(written.correctionReason, '补录说明');

    const summary = context.summarizeShiftStatuses('warning', 'success');
    assert.equal(summary.text, '警告');
    assert.equal(summary.tone, 'warning');
});

test('checkin and dashboard status presentation map internal states to user copy', () => {
    const context = createBaseContext({
        CONFIG: {
            schedule: {
                morning: { okCheckInBefore: 9, okCheckOutBefore: 12 },
                afternoon: { okCheckInBefore: 14, okCheckOutBefore: 18 },
                evening: { okCheckInBefore: 20, okCheckOutBefore: 23 }
            }
        },
        checkinData: {},
        createEmptyDayRecord: () => createCheckinDay(),
        ensureDayRecord: (day) => createCheckinDay(day),
        formatLocalDate: (date) => date.toISOString().slice(0, 10)
    });

    loadScript(context, 'assets/js/features/checkin/rules.js');
    loadScript(context, 'assets/js/features/checkin/status.js');
    loadScript(context, 'assets/js/features/dashboard/status.js');

    const checkinWarning = context.getCheckinStatusPresentation('warning', true);
    assert.equal(checkinWarning.text, '警告');
    assert.match(checkinWarning.className, /text-warning/);

    const checkoutExcused = context.getCheckoutStatusPresentation('excused', true);
    assert.equal(checkoutExcused.text, '离舰豁免');
    assert.match(checkoutExcused.className, /text-blue-500/);

    const activeDay = createCheckinDay({
        morning: {
            checkIn: '08:55',
            checkOut: null,
            status: { checkIn: 'success', checkOut: null },
            entrySource: 'live',
            updatedAt: null,
            correctionReason: ''
        }
    });
    const activePresentation = context.getTodayPeriodStatusPresentation(activeDay, 'morning');
    assert.equal(activePresentation.text, '工作中');
    assert.match(activePresentation.className, /text-primary/);

    const excusedDay = createCheckinDay({
        morning: {
            checkIn: '09:10',
            checkOut: '11:20',
            status: { checkIn: 'excused', checkOut: 'excused' },
            entrySource: 'live',
            updatedAt: null,
            correctionReason: ''
        }
    });
    const excusedPresentation = context.getTodayPeriodStatusPresentation(excusedDay, 'morning');
    assert.equal(excusedPresentation.text, '已离舰');
    assert.match(excusedPresentation.className, /text-blue-500/);
});

test('export data builds stable monthly snapshot summaries', () => {
    const context = createBaseContext({
        getTodayString: () => '2026-04-20',
        tagMap: { paper: '论文', code: '代码', experiment: '实验', write: '写作', other: '其他' },
        noteTagConfig: {
            idea: { label: '灵感' },
            todo: { label: '待办' }
        },
        buildWorkspaceStateSnapshot: () => ({ currentTask: null, ambientPreferences: { enabled: true }, lastSyncTime: null }),
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
            tasks: [{ date: '2026-04-01', displayDate: 'D:2026-04-01', startTime: '09:00', endTime: '11:00', name: 'Build "A"', tagLabel: '代码', durationMins: 120 }],
            quickNotes: [{ date: '2026-04-01', displayDate: 'D:2026-04-01', time: '09:30', tagLabel: '灵感', text: 'quoted, "note"' }],
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
        ambientPrefs: JSON.stringify({ enabled: false, easterEggs: false })
    });

    let refreshStatisticsCalls = 0;
    let refreshExportCalls = 0;
    let ambientCalls = 0;
    let autoSyncCalls = 0;

    const context = createBaseContext({
        localStorage,
        CURRENT_TASK_STORAGE_KEY: 'currentTask',
        AMBIENT_PREFS_STORAGE_KEY: 'ambientPrefs',
        getNoteText: (note) => (note && typeof note.text === 'string' ? note.text : ''),
        ensureDayRecord: (day) => createCheckinDay(day),
        getNormalizedCheckInStatus: (status) => {
            if (status === true) return 'success';
            if (status === false) return 'warning';
            return status;
        },
        createEmptyDayRecord: () => createCheckinDay(),
        getTodayString: () => '2026-04-20',
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

    loadScript(context, 'assets/js/runtime/storage.js');

    assert.deepEqual(context.safeParseStoredJson('{"ok":true}', {}), { ok: true });
    assert.deepEqual(context.safeParseStoredJson('{broken', { fallback: true }), { fallback: true });

    context.initData();

    assert.equal(context.localStorage.getItem('hmclss_storage_schema_version'), '1');
    assert.equal(context.currentTask, null);
    assert.equal(context.quickNotesData['2026-04-19'][0].text, 'legacy note');
    assert.equal(context.quickNotesData['2026-04-19'][1].tag, 'todo');
    assert.equal(context.phoneResistData.records['2026-04-19'].count, 1);
    assert.equal(context.taskData['2026-04-19'][0].duration, 45);
    assert.equal(context.achievements.length, 1);
    assert.equal(context.ambientPreferences.enabled, false);
    assert.equal(context.checkinData['2026-04-20'].leave, false);
    assert.equal(autoSyncCalls, 0);

    context.saveData();
    assert.equal(context.localStorage.getItem('hmclss_storage_schema_version'), '1');
    assert.ok(refreshStatisticsCalls > 0);
    assert.ok(refreshExportCalls > 0);
    assert.ok(ambientCalls > 0);
    assert.equal(autoSyncCalls, 1);
});
