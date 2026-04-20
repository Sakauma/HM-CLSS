/**
 * 值班打卡控制器模块。
 * 负责实时打卡、补打卡提交以及初始化监听。
 */

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
 * 提交补打卡流程，并在必要时做覆盖确认。
 */
async function submitRetroCheckin() {
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
        showToast('补打卡还缺补录说明。', 'warning');
        return;
    }

    const dayData = ensureCheckinDay(date);
    if (dayData.leave) {
        showToast('这一天当前按全天离舰处理，回离舰流程调整后再补打卡。', 'warning');
        updateRetroCheckinPanel();
        return;
    }

    const evaluation = evaluateShiftRecord(date, period, checkInTime, checkOutTime);
    if (!evaluation.valid) {
        showToast(evaluation.reason || '这次补录还没通过预判，检查一下时间。', 'warning');
        updateRetroCheckinPanel();
        return;
    }

    const existing = dayData[period];
    if (existing.checkIn || existing.checkOut) {
        const confirmed = await showConfirmDialog({
            title: '覆盖这条班次记录？',
            message: `当前已有 ${existing.checkIn || '--:--'} / ${existing.checkOut || '--:--'}，确认后会改成这次补录内容。`,
            badge: 'RETRO OVERRIDE',
            confirmLabel: '确认覆盖',
            cancelLabel: '返回检查',
            tone: 'warning'
        });
        if (!confirmed) return;
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

registerAppModule({
    id: 'checkin',
    order: 30,
    init: initCheckin
});
