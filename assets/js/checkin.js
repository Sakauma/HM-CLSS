/**
 * 值班打卡模块。
 * 负责实时班次打卡、补打卡表单、状态判定以及今日记录的刷新。
 */

const CHECKIN_ACTIVE_BUTTON_CLASS = 'action-btn action-btn-primary';
const CHECKOUT_ACTIVE_BUTTON_CLASS = 'action-btn action-btn-secondary';
const CHECKIN_DISABLED_BUTTON_CLASS = 'action-btn action-btn-disabled';
const CHECKIN_PERIODS = ['morning', 'afternoon', 'evening'];

/**
 * 兼容旧版本使用布尔值表示打卡状态的情况，统一转换成字符串枚举。
 * @param {boolean|string|null} status
 * @returns {string|null}
 */
function getNormalizedCheckInStatus(status) {
    if (status === true) return 'success';
    if (status === false) return 'warning';
    return status;
}

/**
 * 初始化三段班次的按钮监听、今日表格和补打卡面板。
 */
function initCheckin() {
    CHECKIN_PERIODS.forEach((period) => {
        document.getElementById(`${period}-checkin`).addEventListener('click', () => checkIn(period));
        document.getElementById(`${period}-checkout`).addEventListener('click', () => checkOut(period));
    });

    document.getElementById('retro-checkin-date')?.addEventListener('input', updateRetroCheckinPanel);
    document.getElementById('retro-checkin-period')?.addEventListener('change', updateRetroCheckinPanel);
    document.getElementById('retro-checkin-start')?.addEventListener('input', updateRetroCheckinPanel);
    document.getElementById('retro-checkin-end')?.addEventListener('input', updateRetroCheckinPanel);
    document.getElementById('retro-checkin-reason')?.addEventListener('input', updateRetroCheckinPanel);
    document.getElementById('retro-checkin-submit')?.addEventListener('click', submitRetroCheckin);

    updateCheckinButtons();
    updateTodayCheckinTable();
    updateRetroCheckinPanel();
}

/**
 * 确保指定日期存在完整的日记录结构。
 * @param {string} date
 * @returns {object}
 */
function ensureCheckinDay(date) {
    if (!checkinData[date]) {
        checkinData[date] = createEmptyDayRecord();
    } else {
        checkinData[date] = ensureDayRecord(checkinData[date]);
    }
    return checkinData[date];
}

/**
 * 以只读方式读取指定日期的值班结构，不在预览阶段制造空记录。
 * @param {string} date
 * @returns {object}
 */
function getCheckinDaySnapshot(date) {
    return checkinData[date] ? ensureDayRecord(checkinData[date]) : createEmptyDayRecord();
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

    document.getElementById('daily-stat-hours').textContent = todayHours + 'h';
    document.getElementById('daily-stat-resist').textContent = todayResist + '次';

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

        document.getElementById('weekly-stat-hours').textContent = (weekMins / 60).toFixed(1) + 'h';
        document.getElementById('weekly-stat-resist').textContent = weekResist + '次';
        document.getElementById('weekly-summary-modal').classList.remove('hidden');
    } else {
        document.getElementById('daily-summary-modal').classList.remove('hidden');
    }
}

/**
 * 判断最近一周是否每天都有至少一次打卡，用于周总结彩蛋。
 * @returns {boolean}
 */
function isThisWeekPerfect() {
    const todayDate = new Date();
    for (let i = 0; i < 7; i++) {
        const checkDate = new Date(todayDate);
        checkDate.setDate(todayDate.getDate() - i);
        const dayData = checkinData[formatLocalDate(checkDate)];

        if (!dayData) return false;
        if (dayData.leave) continue;

        const checkedIn = dayData.morning.checkIn || dayData.afternoon.checkIn || dayData.evening.checkIn;
        if (!checkedIn) return false;
    }
    return true;
}

/**
 * 把 HH:MM 转成分钟数，便于统一做时间区间比较。
 * @param {string} timeStr
 * @returns {number}
 */
function timeStrToMins(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/**
 * 评估给定连线时间的状态。
 * @param {object} dayData
 * @param {'morning'|'afternoon'|'evening'} period
 * @param {number} currentMins
 * @returns {'success'|'warning'|'excused'}
 */
function getCheckInStatusForTime(dayData, period, currentMins) {
    const cfg = CONFIG.schedule[period];
    const thresholdMins = cfg.okCheckInBefore * 60;
    let inStatus = currentMins <= thresholdMins ? 'success' : 'warning';

    if (inStatus === 'warning' && Array.isArray(dayData.partialLeaves)) {
        for (const leave of dayData.partialLeaves) {
            const leaveStartMins = timeStrToMins(leave.startTime);
            const leaveEndMins = timeStrToMins(leave.endTime);

            if (
                (leaveStartMins <= thresholdMins && currentMins <= leaveEndMins + 30) ||
                (currentMins >= leaveStartMins && currentMins <= leaveEndMins)
            ) {
                inStatus = 'excused';
                break;
            }
        }
    }

    return inStatus;
}

/**
 * 评估给定登出时间的状态。
 * @param {object} dayData
 * @param {'morning'|'afternoon'|'evening'} period
 * @param {number} inMins
 * @param {number} outMins
 * @returns {'success'|'warning'|'danger'|'excused'}
 */
function getCheckOutStatusForTimes(dayData, period, inMins, outMins) {
    const cfg = CONFIG.schedule[period];
    const thresholdMins = cfg.okCheckOutBefore * 60;
    const durationMins = outMins - inMins;

    let isExcusedEarlyLeave = false;
    if (Array.isArray(dayData.partialLeaves)) {
        for (const leave of dayData.partialLeaves) {
            const leaveStartMins = timeStrToMins(leave.startTime);
            const leaveEndMins = timeStrToMins(leave.endTime);

            if (leaveStartMins <= outMins + 30 && leaveEndMins >= thresholdMins) {
                isExcusedEarlyLeave = true;
                break;
            }
        }
    }

    if (isExcusedEarlyLeave) return 'excused';
    if (durationMins < CONFIG.task.minDurationMins) return 'danger';
    return outMins <= thresholdMins ? 'success' : 'warning';
}

/**
 * 统一评估一个完整班次记录的结果，用于补打卡预判和实际写入。
 * @param {string} date
 * @param {'morning'|'afternoon'|'evening'} period
 * @param {string} checkInTime
 * @param {string} checkOutTime
 * @returns {{ valid: boolean, reason?: string, inStatus?: string, outStatus?: string }}
 */
function evaluateShiftRecord(date, period, checkInTime, checkOutTime) {
    if (!checkInTime || !checkOutTime) {
        return { valid: false, reason: '开始和结束时间都需要填写。' };
    }

    const inMins = timeStrToMins(checkInTime);
    const outMins = timeStrToMins(checkOutTime);
    if (outMins <= inMins) {
        return { valid: false, reason: '结束时间必须晚于开始时间。' };
    }

    const dayData = getCheckinDaySnapshot(date);
    return {
        valid: true,
        inStatus: getCheckInStatusForTime(dayData, period, inMins),
        outStatus: getCheckOutStatusForTimes(dayData, period, inMins, outMins)
    };
}

/**
 * 将状态枚举映射成更适合界面展示的文案和视觉级别。
 * @param {string} inStatus
 * @param {string} outStatus
 * @returns {{ text: string, tone: 'success'|'warning'|'danger'|'info', detail: string }}
 */
function summarizeShiftStatuses(inStatus, outStatus) {
    if (inStatus === 'danger' || outStatus === 'danger') {
        return { text: '异常', tone: 'danger', detail: '时长不足或存在明显异常，提交后会被系统标红。' };
    }

    if (inStatus === 'warning' || outStatus === 'warning') {
        return { text: '警告', tone: 'warning', detail: '会保留记录，但会按警告计入今日与统计口径。' };
    }

    if (inStatus === 'excused' || outStatus === 'excused') {
        return { text: '离舰豁免', tone: 'info', detail: '补录会沿用分段离舰覆盖逻辑，结果将标记为豁免。' };
    }

    return { text: '合规', tone: 'success', detail: '这条补录会被系统视作正常有效记录。' };
}

/**
 * 把完整班次结果写入指定日期。
 * @param {string} date
 * @param {'morning'|'afternoon'|'evening'} period
 * @param {{ checkIn?: string|null, checkOut?: string|null, inStatus?: string|null, outStatus?: string|null, entrySource?: 'live'|'retro', correctionReason?: string }} payload
 */
function applyShiftRecord(date, period, payload) {
    const dayData = ensureCheckinDay(date);
    const record = dayData[period];
    const nowIso = new Date().toISOString();

    if (typeof payload.checkIn === 'string') record.checkIn = payload.checkIn;
    if (typeof payload.checkOut === 'string') record.checkOut = payload.checkOut;
    if (typeof payload.inStatus === 'string') record.status.checkIn = payload.inStatus;
    if (typeof payload.outStatus === 'string') record.status.checkOut = payload.outStatus;

    record.entrySource = payload.entrySource || record.entrySource || 'live';
    record.updatedAt = nowIso;
    record.correctionReason = payload.entrySource === 'retro'
        ? payload.correctionReason || ''
        : '';
}

/**
 * 记录指定班次的连线时间，并根据推荐时限和离舰记录判定状态。
 * @param {'morning'|'afternoon'|'evening'} period
 */
function checkIn(period) {
    const today = getTodayString();
    const time = getCurrentTimeString();
    const mins = timeStrToMins(time);
    const dayData = ensureCheckinDay(today);
    const inStatus = getCheckInStatusForTime(dayData, period, mins);

    applyShiftRecord(today, period, {
        checkIn: time,
        inStatus,
        entrySource: 'live'
    });

    saveData();
    updateCheckinButtons();
    updateTodayCheckinTable();
    updateTodayStatus();
    checkAchievements();
}

/**
 * 记录指定班次的登出时间，并综合时长与离舰信息给出结果。
 * @param {'morning'|'afternoon'|'evening'} period
 */
function checkOut(period) {
    const today = getTodayString();
    const dayData = ensureCheckinDay(today);
    const time = getCurrentTimeString();
    const currentMins = timeStrToMins(time);
    const inMins = timeStrToMins(dayData[period].checkIn);
    const outStatus = getCheckOutStatusForTimes(dayData, period, inMins, currentMins);

    applyShiftRecord(today, period, {
        checkOut: time,
        outStatus,
        entrySource: 'live'
    });

    saveData();
    updateCheckinButtons();
    updateTodayCheckinTable();
    updateTodayStatus();
    checkAchievements();

    if (period === 'evening') {
        setTimeout(() => triggerEndOfDayEasterEgg(), 500);
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
        container.innerHTML = '<div class="rounded-2xl border border-dashed border-slate-200/80 bg-white/50 px-4 py-4 text-sm text-slate-500 dark:border-slate-700/80 dark:bg-slate-900/40 dark:text-slate-400">暂无补录记录。</div>';
        return;
    }

    container.innerHTML = entries.map((entry) => {
        const toneClassMap = {
            success: 'bg-success/10 text-success border-success/20',
            warning: 'bg-warning/10 text-warning border-warning/20',
            danger: 'bg-danger/10 text-danger border-danger/20',
            info: 'bg-primary/10 text-primary border-primary/20'
        };

        return `
            <div class="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-slate-700/70 dark:bg-slate-900/40">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <div class="text-xs font-mono text-slate-400">${escapeHtml(formatDisplayDate(entry.date))}</div>
                        <div class="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(getPeriodLabel(entry.period))}</div>
                    </div>
                    <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClassMap[entry.tone] || toneClassMap.info}">
                        补录 · ${escapeHtml(entry.statusText)}
                    </span>
                </div>
                <div class="mt-2 text-xs font-mono text-slate-500 dark:text-slate-400">${escapeHtml(entry.checkIn)} → ${escapeHtml(entry.checkOut)}</div>
                <div class="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">${escapeHtml(entry.correctionReason || '无说明')}</div>
            </div>
        `;
    }).join('');
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
        chipEl.textContent = '先修正离舰';
        copyEl.textContent = '该日为全天离舰。先修正离舰记录，再补打卡。';
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
        copyEl.textContent = '补打卡必须填写说明。';
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

/**
 * 提交补打卡流程，并在必要时做覆盖确认。
 */
function submitRetroCheckin() {
    const date = document.getElementById('retro-checkin-date')?.value || '';
    const period = document.getElementById('retro-checkin-period')?.value || 'morning';
    const checkInTime = document.getElementById('retro-checkin-start')?.value || '';
    const checkOutTime = document.getElementById('retro-checkin-end')?.value || '';
    const reason = document.getElementById('retro-checkin-reason')?.value.trim() || '';

    const availability = getRetroCheckinAvailability(date);
    if (!availability.allowed) {
        showToast(availability.reason, 'warning');
        updateRetroCheckinPanel();
        return;
    }

    if (!reason) {
        showToast('补打卡需要填写补录说明。', 'warning');
        return;
    }

    const dayData = ensureCheckinDay(date);
    if (dayData.leave) {
        showToast('目标日期当前是全天离舰，请先修正离舰记录。', 'warning');
        updateRetroCheckinPanel();
        return;
    }

    const evaluation = evaluateShiftRecord(date, period, checkInTime, checkOutTime);
    if (!evaluation.valid) {
        showToast(evaluation.reason || '补打卡预判失败，请检查输入。', 'warning');
        updateRetroCheckinPanel();
        return;
    }

    const existing = dayData[period];
    if ((existing.checkIn || existing.checkOut) && !confirm(`该班次已存在记录（${existing.checkIn || '--:--'} / ${existing.checkOut || '--:--'}），确认覆盖为补录内容吗？`)) {
        return;
    }

    applyShiftRecord(date, period, {
        checkIn: checkInTime,
        checkOut: checkOutTime,
        inStatus: evaluation.inStatus,
        outStatus: evaluation.outStatus,
        entrySource: 'retro',
        correctionReason: reason
    });

    saveData();
    checkAchievements();
    updateTodayCheckinTable();
    updateTodayStatus();
    updateRetroCheckinPanel();

    showToast(`已补录 ${formatDisplayDate(date)} 的 ${getPeriodLabel(period)}`, 'success');
}
