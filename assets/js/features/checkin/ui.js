/**
 * 值班打卡渲染模块。
 * 负责按钮状态、今日记录表、补打卡面板与彩蛋总结弹窗。
 */

const CHECKIN_ACTIVE_BUTTON_CLASS = 'action-btn action-btn-primary';
const CHECKOUT_ACTIVE_BUTTON_CLASS = 'action-btn action-btn-secondary';
const CHECKIN_DISABLED_BUTTON_CLASS = 'action-btn action-btn-disabled';

function createRetroEmptyState() {
    return createDomElement('div', {
        className: 'rounded-2xl border border-dashed border-slate-200/80 bg-white/50 px-4 py-4 text-sm text-slate-500 dark:border-slate-700/80 dark:bg-slate-900/40 dark:text-slate-400',
        text: '暂无补录记录。'
    });
}

function createRetroEntryCard(entry) {
    const toneClassMap = {
        success: 'bg-success/10 text-success border-success/20',
        warning: 'bg-warning/10 text-warning border-warning/20',
        danger: 'bg-danger/10 text-danger border-danger/20',
        info: 'bg-primary/10 text-primary border-primary/20'
    };

    return appendDomChildren(createDomElement('div', {
        className: 'rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-slate-700/70 dark:bg-slate-900/40'
    }), [
        appendDomChildren(createDomElement('div', {
            className: 'flex items-start justify-between gap-3'
        }), [
            appendDomChildren(createDomElement('div'), [
                createDomElement('div', {
                    className: 'text-xs font-mono text-slate-400',
                    text: formatDisplayDate(entry.date)
                }),
                createDomElement('div', {
                    className: 'mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100',
                    text: getPeriodLabel(entry.period)
                })
            ]),
            createDomElement('span', {
                className: `inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClassMap[entry.tone] || toneClassMap.info}`,
                text: `补录 · ${entry.statusText}`
            })
        ]),
        createDomElement('div', {
            className: 'mt-2 text-xs font-mono text-slate-500 dark:text-slate-400',
            text: `${entry.checkIn} → ${entry.checkOut}`
        }),
        createDomElement('div', {
            className: 'mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400',
            text: entry.correctionReason || '无说明'
        })
    ]);
}

/**
 * 根据当前时间、离舰状态和已有记录动态更新打卡按钮状态。
 */
function updateCheckinButtons() {
    const today = getTodayString();
    const dayData = ensureCheckinDay(today);
    const now = getCurrentTime();
    const currentHour = now.hour;
    const currentMins = now.hour * 60 + now.minute;
    const isLeave = Boolean(dayData.leave);

    let isCurrentlyOnPartialLeave = false;
    if (Array.isArray(dayData.partialLeaves)) {
        for (const leave of dayData.partialLeaves) {
            const leaveStartMins = timeStrToMins(leave.startTime);
            const leaveEndMins = timeStrToMins(leave.endTime);

            if (currentMins >= leaveStartMins && currentMins < leaveEndMins) {
                isCurrentlyOnPartialLeave = true;
                break;
            }
        }
    }

    const btnTexts = {
        morning: { in: '早班连线', out: '早班登出' },
        afternoon: { in: '午班连线', out: '午班登出' },
        evening: { in: '晚班连线', out: '晚班登出' }
    };

    if (isLeave || isCurrentlyOnPartialLeave) {
        CHECKIN_PERIODS.forEach((period) => {
            const checkinBtn = document.getElementById(`${period}-checkin`);
            const checkoutBtn = document.getElementById(`${period}-checkout`);

            checkinBtn.disabled = true;
            checkoutBtn.disabled = true;

            const text = isLeave ? '全天离舰' : '离舰中...';
            checkinBtn.textContent = text;
            checkoutBtn.textContent = text;
            checkinBtn.className = CHECKIN_DISABLED_BUTTON_CLASS;
            checkoutBtn.className = CHECKIN_DISABLED_BUTTON_CLASS;
        });
        updateCheckinTimeDisplay();
        return;
    }

    CHECKIN_PERIODS.forEach((period) => {
        document.getElementById(`${period}-checkin`).textContent = btnTexts[period].in;
        document.getElementById(`${period}-checkout`).textContent = btnTexts[period].out;
    });

    const mCfg = CONFIG.schedule.morning;
    const aCfg = CONFIG.schedule.afternoon;
    const eCfg = CONFIG.schedule.evening;

    document.getElementById('morning-checkin').disabled = dayData.morning.checkIn !== null || currentHour < mCfg.startHour || currentHour >= mCfg.endHour;
    document.getElementById('afternoon-checkin').disabled = dayData.afternoon.checkIn !== null || currentHour < aCfg.startHour || currentHour >= aCfg.endHour;
    document.getElementById('evening-checkin').disabled = dayData.evening.checkIn !== null || currentHour < eCfg.startHour || currentHour >= eCfg.endHour;

    document.getElementById('morning-checkout').disabled = dayData.morning.checkOut !== null || dayData.morning.checkIn === null || currentHour >= aCfg.startHour;
    document.getElementById('afternoon-checkout').disabled = dayData.afternoon.checkOut !== null || dayData.afternoon.checkIn === null || currentHour >= eCfg.startHour + 3;
    document.getElementById('evening-checkout').disabled = dayData.evening.checkOut !== null || dayData.evening.checkIn === null;

    CHECKIN_PERIODS.forEach((period) => {
        const cIn = document.getElementById(`${period}-checkin`);
        const cOut = document.getElementById(`${period}-checkout`);
        cIn.className = cIn.disabled ? CHECKIN_DISABLED_BUTTON_CLASS : CHECKIN_ACTIVE_BUTTON_CLASS;
        cOut.className = cOut.disabled ? CHECKIN_DISABLED_BUTTON_CLASS : CHECKOUT_ACTIVE_BUTTON_CLASS;
    });

    updateCheckinTimeDisplay();
}

/**
 * 晚班结束后触发每日/每周彩蛋总结弹窗。
 */
function triggerEndOfDayEasterEgg() {
    const today = getTodayString();
    const todayTasks = taskData[today] || [];
    const todayMins = todayTasks.reduce((sum, task) => sum + task.duration, 0);
    const todayHours = (todayMins / 60).toFixed(1);
    const todayResist = (phoneResistData.records[today] || { count: 0 }).count;

    document.getElementById('daily-stat-hours').textContent = `${todayHours}h`;
    document.getElementById('daily-stat-resist').textContent = `${todayResist}次`;

    const now = new Date();
    if (now.getDay() === 0 && isThisWeekPerfect()) {
        let weekMins = 0;
        let weekResist = 0;
        for (let i = 0; i < 7; i++) {
            const checkDate = new Date();
            checkDate.setDate(checkDate.getDate() - i);
            const ds = formatLocalDate(checkDate);
            const dayTasks = taskData[ds] || [];
            weekMins += dayTasks.reduce((sum, task) => sum + task.duration, 0);
            weekResist += (phoneResistData.records[ds] || { count: 0 }).count;
        }

        document.getElementById('weekly-stat-hours').textContent = `${(weekMins / 60).toFixed(1)}h`;
        document.getElementById('weekly-stat-resist').textContent = `${weekResist}次`;
        document.getElementById('weekly-summary-modal').classList.remove('hidden');
    } else {
        document.getElementById('daily-summary-modal').classList.remove('hidden');
    }
}

/**
 * 刷新主按钮下方的开始/结束时间文案。
 */
function updateCheckinTimeDisplay() {
    const today = getTodayString();
    const dayData = ensureCheckinDay(today);
    CHECKIN_PERIODS.forEach((period) => {
        document.getElementById(`${period}-checkin-time`).textContent = `开始: ${dayData[period].checkIn || '-'}`;
        document.getElementById(`${period}-checkout-time`).textContent = `结束: ${dayData[period].checkOut || '-'}`;
    });
}

/**
 * 刷新今日打卡明细表，并把内部状态映射成用户可读文案。
 */
function updateTodayCheckinTable() {
    const today = getTodayString();
    const dayData = ensureCheckinDay(today);

    CHECKIN_PERIODS.forEach((period) => {
        document.getElementById(`table-${period}-checkin`).textContent = dayData[period].checkIn || '-';
        document.getElementById(`table-${period}-checkout`).textContent = dayData[period].checkOut || '-';

        const cInStatus = document.getElementById(`table-${period}-checkin-status`);
        const inVal = getNormalizedCheckInStatus(dayData[period].status.checkIn);
        if (dayData[period].checkIn === null) {
            cInStatus.textContent = '-';
            cInStatus.className = 'py-3 px-4';
        } else if (inVal === 'excused') {
            cInStatus.textContent = '离舰豁免';
            cInStatus.className = 'py-3 px-4 font-bold text-blue-500 dark:text-blue-400';
        } else if (inVal === 'warning') {
            cInStatus.textContent = '警告';
            cInStatus.className = 'py-3 px-4 font-medium text-warning';
        } else if (inVal === 'danger') {
            cInStatus.textContent = '异常';
            cInStatus.className = 'py-3 px-4 font-medium text-danger';
        } else {
            cInStatus.textContent = '合格';
            cInStatus.className = 'py-3 px-4 font-medium text-success';
        }

        const cOutStatus = document.getElementById(`table-${period}-checkout-status`);
        const outVal = dayData[period].status.checkOut;
        if (dayData[period].checkOut === null) {
            cOutStatus.textContent = '-';
            cOutStatus.className = 'py-3 px-4';
        } else if (outVal === 'excused') {
            cOutStatus.textContent = '离舰豁免';
            cOutStatus.className = 'py-3 px-4 font-bold text-blue-500 dark:text-blue-400';
        } else if (outVal === 'success' || outVal === true) {
            cOutStatus.textContent = '合格';
            cOutStatus.className = 'py-3 px-4 font-medium text-success';
        } else if (outVal === 'warning') {
            cOutStatus.textContent = '超时';
            cOutStatus.className = 'py-3 px-4 font-medium text-warning';
        } else {
            cOutStatus.textContent = '异常';
            cOutStatus.className = 'py-3 px-4 font-medium text-danger';
        }
    });
}

/**
 * 汇总最近的补打卡记录，用于在补录面板中展示留痕。
 * @returns {Array<{ date: string, period: string, checkIn: string, checkOut: string, correctionReason: string, statusText: string, tone: string }>}
 */
function getRecentRetroEntries() {
    const entries = [];

    Object.entries(checkinData).forEach(([date, day]) => {
        CHECKIN_PERIODS.forEach((period) => {
            const record = day?.[period];
            if (!record || record.entrySource !== 'retro') return;

            const summary = summarizeShiftStatuses(
                getNormalizedCheckInStatus(record.status.checkIn),
                record.status.checkOut
            );

            entries.push({
                date,
                period,
                checkIn: record.checkIn || '--:--',
                checkOut: record.checkOut || '--:--',
                correctionReason: record.correctionReason || '',
                statusText: summary.text,
                tone: summary.tone
            });
        });
    });

    return entries.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
}

/**
 * 将补打卡留痕渲染到侧栏列表。
 */
function renderRetroRecentEntries() {
    const container = document.getElementById('retro-recent-log');
    if (!container) return;

    const entries = getRecentRetroEntries();
    if (!entries.length) {
        container.replaceChildren(createRetroEmptyState());
        return;
    }

    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => {
        fragment.appendChild(createRetroEntryCard(entry));
    });

    container.replaceChildren(fragment);
}

/**
 * 根据当前表单内容刷新补打卡预判、配额占用和最近补录留痕。
 */
function updateRetroCheckinPanel() {
    const dateEl = document.getElementById('retro-checkin-date');
    const periodEl = document.getElementById('retro-checkin-period');
    const startEl = document.getElementById('retro-checkin-start');
    const endEl = document.getElementById('retro-checkin-end');
    const reasonEl = document.getElementById('retro-checkin-reason');
    const chipEl = document.getElementById('retro-preview-chip');
    const copyEl = document.getElementById('retro-preview-copy');
    const submitEl = document.getElementById('retro-checkin-submit');
    const weekUsageEl = document.getElementById('retro-week-usage');
    const monthUsageEl = document.getElementById('retro-month-usage');
    const weekCaptionEl = document.getElementById('retro-week-caption');
    const monthCaptionEl = document.getElementById('retro-month-caption');

    if (!dateEl || !periodEl || !startEl || !endEl || !chipEl || !copyEl || !submitEl) return;

    const targetDate = dateEl.value;
    const usage = getRetroCheckinUsage(targetDate || getTodayString());
    if (weekUsageEl) weekUsageEl.textContent = `${usage.weekUsed}/${CONFIG.retro.last7DayQuota}`;
    if (monthUsageEl) monthUsageEl.textContent = `${usage.monthUsed}/${CONFIG.retro.monthlyQuota}`;
    if (weekCaptionEl) weekCaptionEl.textContent = '7日额度';
    if (monthCaptionEl) monthCaptionEl.textContent = `${(targetDate || getTodayString()).slice(0, 7)} 月额度`;

    renderRetroRecentEntries();

    const availability = getRetroCheckinAvailability(targetDate);
    const dayData = targetDate ? getCheckinDaySnapshot(targetDate) : null;
    const hasReason = reasonEl.value.trim().length > 0;

    if (!availability.allowed) {
        chipEl.className = 'status-chip status-chip-warning';
        chipEl.textContent = '补录受限';
        copyEl.textContent = availability.reason;
        submitEl.disabled = true;
        submitEl.className = CHECKIN_DISABLED_BUTTON_CLASS;
        return;
    }

    if (dayData?.leave) {
        chipEl.className = 'status-chip status-chip-danger';
        chipEl.textContent = '离舰占用中';
        copyEl.textContent = '该日当前按全天离舰处理，如需补打卡，先回离舰流程调整。';
        submitEl.disabled = true;
        submitEl.className = CHECKIN_DISABLED_BUTTON_CLASS;
        return;
    }

    const evaluation = evaluateShiftRecord(targetDate, periodEl.value, startEl.value, endEl.value);
    if (!evaluation.valid) {
        chipEl.className = 'status-chip status-chip-info';
        chipEl.textContent = '等待预判';
        copyEl.textContent = evaluation.reason;
        submitEl.disabled = true;
        submitEl.className = CHECKIN_DISABLED_BUTTON_CLASS;
        return;
    }

    if (!hasReason) {
        chipEl.className = 'status-chip status-chip-info';
        chipEl.textContent = '等待说明';
        copyEl.textContent = '补录说明还没填。';
        submitEl.disabled = true;
        submitEl.className = CHECKIN_DISABLED_BUTTON_CLASS;
        return;
    }

    const summary = summarizeShiftStatuses(evaluation.inStatus, evaluation.outStatus);
    chipEl.className = `status-chip status-chip-${summary.tone === 'info' ? 'info' : summary.tone}`;
    chipEl.textContent = summary.text;

    const currentRecord = dayData[periodEl.value];
    const overwriteNote = currentRecord.checkIn || currentRecord.checkOut
        ? `已有 ${currentRecord.checkIn || '--:--'} / ${currentRecord.checkOut || '--:--'}，提交前会确认覆盖。`
        : '当前没有旧记录。';
    copyEl.textContent = `${summary.detail} ${overwriteNote}`;

    submitEl.disabled = false;
    submitEl.className = CHECKIN_ACTIVE_BUTTON_CLASS;
}
