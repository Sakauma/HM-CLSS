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

class FixedDate extends Date {
    constructor(...args) {
        if (args.length === 0) {
            super('2026-04-20T12:00:00.000Z');
            return;
        }

        super(...args);
    }

    static now() {
        return new Date('2026-04-20T12:00:00.000Z').valueOf();
    }
}

test('statistics data prepares stable fixture aggregates', () => {
    const context = createBaseContext({
        Date: FixedDate,
        formatLocalDate: (date) => date.toISOString().slice(0, 10),
        getNormalizedCheckInStatus: (status) => status,
        checkinData: {
            '2026-04-14': createCheckinDay({
                morning: {
                    checkIn: '08:55',
                    checkOut: '12:00',
                    status: { checkIn: 'success', checkOut: 'success' }
                }
            }),
            '2026-04-15': createCheckinDay({
                morning: {
                    checkIn: '09:05',
                    checkOut: null,
                    status: { checkIn: 'warning', checkOut: null }
                }
            }),
            '2026-04-16': createCheckinDay({
                morning: {
                    checkIn: '09:30',
                    checkOut: '12:10',
                    status: { checkIn: 'danger', checkOut: 'success' }
                }
            })
        },
        taskData: {
            '2026-04-14': [{ duration: 60, tag: 'paper' }],
            '2026-04-15': [{ duration: 120, tag: 'code' }],
            '2026-04-16': [{ duration: 30, tag: 'other' }]
        },
        phoneResistData: {
            totalCount: 3,
            records: {
                '2026-04-14': { count: 1 },
                '2026-04-16': { count: 2 }
            }
        },
        achievements: ['a1', 'a2'],
        countCheckinDays: () => 3,
        calculateTotalTaskHours: () => 3.5
    });

    loadScript(context, 'assets/js/features/stats/data.js');

    const { startDate, endDate, labels } = context.getDateRange('week');
    assert.equal(labels.length, 7);
    assert.equal(startDate.toISOString().slice(0, 10), '2026-04-14');
    assert.equal(endDate.toISOString().slice(0, 10), '2026-04-20');

    assert.equal(Number(context.calculateCheckinRateForRange(startDate, endDate).toFixed(2)), 80);
    assert.equal(Number(context.calculateTaskHoursForRange(startDate, endDate).toFixed(2)), 3.5);
    assert.equal(context.calculatePhoneResistForRange(startDate, endDate), 3);

    assert.deepEqual(Array.from(context.prepareCheckinRateData(startDate, endDate, labels)), [100, 100, 50, null, null, null, null]);
    assert.deepEqual(JSON.parse(JSON.stringify(context.prepareCheckinPeriodData(startDate, endDate))), {
        m: { i: 3, q: 2 },
        a: { i: 0, q: 0 },
        e: { i: 0, q: 0 }
    });
    assert.deepEqual(Array.from(context.prepareTaskDurationData(startDate, endDate, labels)), [1, 2, 0.5, 0, 0, 0, 0]);
    assert.deepEqual(Array.from(context.preparePhoneResistData(startDate, endDate, labels)), [1, 0, 2, 0, 0, 0, 0]);
    assert.deepEqual(Array.from(context.prepareTagData(startDate, endDate)), [1, 2, 0, 0, 0.5]);
    assert.deepEqual(JSON.parse(JSON.stringify(context.buildSummaryStatisticsSnapshot())), {
        checkinDays: 3,
        taskHours: 3.5,
        sols: '5.3',
        phoneResistCount: 3,
        achievementCount: 2
    });
});

test('export data keeps empty monthly fixtures stable', () => {
    const context = createBaseContext({
        getTodayString: () => '2026-04-20',
        tagMap: { paper: '论文', code: '代码', experiment: '实验', write: '写作', other: '其他' },
        noteTagConfig: {
            idea: { label: '灵感' }
        },
        buildWorkspaceStateSnapshot: () => ({ currentTask: null, ambientPreferences: { enabled: true }, lastSyncTime: null }),
        buildWorkspaceDatasetSnapshot: () => ({ snapshot: true }),
        countCheckinDays: () => 0,
        countQuickNoteEntries: () => 0,
        calculateTotalTaskHours: () => 0,
        calculateCheckinRateForRange: () => 0,
        cloneWorkspaceValue: (value) => JSON.parse(JSON.stringify(value)),
        ensureDayRecord: (day) => createCheckinDay(day),
        createEmptyDayRecord: () => createCheckinDay(),
        formatLocalDate: (date) => date.toISOString().slice(0, 10),
        formatDisplayDate: (date) => `D:${date}`,
        normalizeDrinkRecord: (drink) => ({ ...drink }),
        getNormalizedCheckInStatus: (status) => status,
        summarizeShiftStatuses: () => ({ text: '空白', tone: 'info', detail: '' }),
        getPeriodLabel: (period) => period,
        getNoteText: (note) => note.text || '',
        phoneResistData: { totalCount: 0, records: {} },
        checkinData: {},
        taskData: {},
        quickNotesData: {},
        leaveData: [],
        tavernData: [],
        achievements: []
    });

    loadScript(context, 'assets/js/features/export/data.js');

    const overview = context.buildWorkspaceExportOverview();
    assert.equal(overview.metrics.checkinDays, 0);
    assert.equal(overview.metrics.taskHours, 0);
    assert.match(overview.copy, /当前累计出勤 0 天/);

    const snapshot = context.buildMonthlyExportSnapshot('2026-02');
    assert.equal(snapshot.meta.monthLabel, '2026年2月');
    assert.equal(snapshot.summary.activeCheckinDays, 0);
    assert.equal(snapshot.summary.taskHoursTotal, 0);
    assert.equal(snapshot.summary.topTaskTag, null);
    assert.equal(snapshot.summary.topDrinkFamily, null);
    assert.deepEqual(Array.from(snapshot.details.checkins), []);
    assert.deepEqual(Array.from(snapshot.details.tasks), []);
    assert.deepEqual(Array.from(snapshot.details.quickNotes), []);
    assert.deepEqual(Array.from(snapshot.details.phoneResist), []);
    assert.deepEqual(Array.from(snapshot.details.leaves), []);
    assert.deepEqual(Array.from(snapshot.details.tavern), []);
});
