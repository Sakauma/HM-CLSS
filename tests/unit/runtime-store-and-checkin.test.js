const assert = require('node:assert/strict');
const test = require('node:test');

const {
    loadScript,
    createBaseContext,
    createCheckinDay
} = require('./helpers');

test('runtime store subscriptions receive updates and can unsubscribe', () => {
    const context = createBaseContext();
    loadScript(context, 'assets/js/runtime/store.js');

    const seen = [];
    const unsubscribe = context.subscribeRuntimeValue('currentTask', (value, previousValue, key) => {
        seen.push({ value, previousValue, key });
    }, { immediate: true });

    context.runtimeActions.setCurrentTask({ id: 'task_1' });
    unsubscribe();
    context.runtimeActions.setCurrentTask({ id: 'task_2' });

    assert.equal(seen.length, 2);
    assert.equal(seen[0].key, 'currentTask');
    assert.equal(seen[0].value, null);
    assert.equal(seen[1].previousValue, null);
    assert.equal(seen[1].value.id, 'task_1');
    assert.equal(context.getRuntimeValue('currentTask').id, 'task_2');
    assert.equal(context.runtimeSelectors.currentTask().id, 'task_2');
    assert.equal(context.runtimeSelectors.slice((state) => state.currentTask.id), 'task_2');
});

test('runtime store object entry helpers update checkin days and daily records safely', () => {
    const context = createBaseContext();
    loadScript(context, 'assets/js/runtime/store.js');

    context.runtimeActions.updateCheckinDay('2026-04-20', () => ({
        morning: { checkIn: '08:30', checkOut: null, status: { checkIn: 'success', checkOut: null } }
    }));
    context.runtimeActions.updatePhoneResistRecord('2026-04-20', (record) => ({
        ...record,
        count: (record.count || 0) + 1,
        times: [...(record.times || []), '09:00']
    }));

    assert.equal(context.runtimeSelectors.checkinData()['2026-04-20'].morning.checkIn, '08:30');
    assert.equal(context.runtimeSelectors.phoneResistData().records['2026-04-20'].count, 1);
    assert.deepEqual(context.runtimeSelectors.phoneResistData().records['2026-04-20'].times, ['09:00']);
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

    loadScript(context, 'assets/js/runtime/store.js');
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
    loadScript(context, 'assets/js/features/dashboard/labels.js');
    loadScript(context, 'assets/js/features/dashboard/overview.js');
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

test('dom disposables remove registered listeners during cleanup', () => {
    const target = {
        listeners: new Map(),
        addEventListener(type, listener) {
            this.listeners.set(type, listener);
        },
        removeEventListener(type, listener) {
            if (this.listeners.get(type) === listener) {
                this.listeners.delete(type);
            }
        }
    };
    const context = createBaseContext({
        document: {
            createElement() {
                return {
                    innerHTML: '',
                    content: {
                        cloneNode() {
                            return {};
                        }
                    }
                };
            }
        }
    });

    loadScript(context, 'assets/js/runtime/dom-utils.js');

    const disposables = context.createDisposables();
    const handler = () => {};
    disposables.listen(target, 'click', handler);
    assert.equal(typeof target.listeners.get('click'), 'function');

    disposables.dispose();
    assert.equal(target.listeners.has('click'), false);
});

test('trusted html helpers only accept wrapped content', () => {
    const context = createBaseContext({
        document: {
            createElement() {
                const template = {
                    innerHTML: '',
                    content: {
                        cloneNode() {
                            return { trusted: true };
                        }
                    }
                };
                return template;
            }
        }
    });

    loadScript(context, 'assets/js/runtime/dom-utils.js');

    assert.throws(() => context.createTrustedHtmlFragment('<b>unsafe</b>'), /createTrustedHtml/);
    const trustedHtml = context.createTrustedHtml('<b>safe</b>');
    const fragment = context.createTrustedHtmlFragment(trustedHtml);
    assert.equal(fragment.trusted, true);
});

test('leave current-time shortcut falls back to the final valid slot near midnight', () => {
    const elements = {
        'leave-start-time': { value: '' },
        'leave-end-time': { value: '' }
    };
    const toasts = [];
    const MockDate = class extends Date {
        constructor(...args) {
            super(...(args.length ? args : ['2026-04-21T23:47:00']));
        }
        static now() {
            return new Date('2026-04-21T23:47:00').getTime();
        }
    };
    const context = createBaseContext({
        Date: MockDate,
        document: {
            getElementById(id) {
                return elements[id] || null;
            }
        },
        showToast(message, tone) {
            toasts.push({ message, tone });
        },
        updateLeaveFormState() {},
        registerAppModule() {}
    });

    loadScript(context, 'assets/js/features/leave/index.js');

    context.fillLeaveStartFromCurrentTime({ preventDefault() {} });

    assert.equal(elements['leave-start-time'].value, '23:00');
    assert.equal(elements['leave-end-time'].value, '23:30');
    assert.deepEqual(toasts.at(-1), {
        message: '已接近今日结束，已回退到最后一段可选时间，请手动确认。',
        tone: 'info'
    });
});
