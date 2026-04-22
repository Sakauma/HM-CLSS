/**
 * 值班打卡控制器模块。
 * 负责实时打卡、补打卡提交以及初始化监听。
 */

/**
 * 初始化三段班次的按钮监听、今日表格和补打卡面板。
 */
function getCheckinPreferenceFormElements() {
    return {
        lateInput: document.getElementById('checkin-late-grace-input'),
        earlyInput: document.getElementById('checkin-early-grace-input'),
        badge: document.getElementById('checkin-flex-badge'),
        pill: document.getElementById('checkin-flex-policy-pill'),
        copy: document.getElementById('checkin-flex-policy-copy')
    };
}

function readDraftCheckinPreferences() {
    const { lateInput, earlyInput } = getCheckinPreferenceFormElements();
    return normalizeCheckinPreferences({
        lateGraceMins: lateInput?.value,
        earlyGraceMins: earlyInput?.value
    });
}

function renderCheckinPreferenceSummary(preferences) {
    const { badge, pill, copy } = getCheckinPreferenceFormElements();
    if (badge) {
        badge.textContent = `${preferences.lateGraceMins} / ${preferences.earlyGraceMins}`;
    }
    if (pill) {
        pill.textContent = preferences.lateGraceMins === 0 && preferences.earlyGraceMins === 0
            ? '严格判定'
            : '弹性已启用';
        pill.className = preferences.lateGraceMins === 0 && preferences.earlyGraceMins === 0
            ? 'semantic-tag semantic-tag-neutral semantic-tag-tight'
            : 'semantic-tag semantic-tag-primary semantic-tag-tight';
    }
    if (copy) {
        copy.textContent = `当前按上班延后 ${preferences.lateGraceMins} 分钟、下班提前 ${preferences.earlyGraceMins} 分钟的弹性窗口判定。`;
    }
}

function renderCheckinPreferenceForm(preferences = normalizeCheckinPreferences(runtimeSelectors.checkinPreferences())) {
    const { lateInput, earlyInput } = getCheckinPreferenceFormElements();
    if (lateInput) lateInput.value = String(preferences.lateGraceMins);
    if (earlyInput) earlyInput.value = String(preferences.earlyGraceMins);
    renderCheckinPreferenceSummary(preferences);
}

function updateCheckinPreferenceDraftPreview() {
    const { lateInput, earlyInput } = getCheckinPreferenceFormElements();
    if (!lateInput || !earlyInput) return;
    renderCheckinPreferenceSummary(readDraftCheckinPreferences());
}

function saveCheckinPreferences() {
    const preferences = readDraftCheckinPreferences();
    runtimeActions.setCheckinPreferences(preferences);
    renderCheckinPreferenceForm(preferences);
    saveData(true);
    updateRetroCheckinPanel();
    showToast(`弹性打卡已更新：上班 +${preferences.lateGraceMins} 分钟，下班 -${preferences.earlyGraceMins} 分钟`, 'success');
}

function resetCheckinPreferences() {
    const defaults = normalizeCheckinPreferences(
        typeof DEFAULT_CHECKIN_PREFERENCES === 'object' ? DEFAULT_CHECKIN_PREFERENCES : null
    );
    runtimeActions.setCheckinPreferences(defaults);
    renderCheckinPreferenceForm(defaults);
    saveData(true);
    updateRetroCheckinPanel();
    showToast('已恢复默认弹性窗口。', 'info');
}

function initCheckin() {
    const disposables = createDisposables();
    CHECKIN_PERIODS.forEach((period) => {
        disposables.listen(document.getElementById(`${period}-checkin`), 'click', () => checkIn(period));
        disposables.listen(document.getElementById(`${period}-checkout`), 'click', () => checkOut(period));
    });

    disposables.listen(document.getElementById('retro-checkin-date'), 'input', updateRetroCheckinPanel);
    disposables.listen(document.getElementById('retro-checkin-period'), 'change', updateRetroCheckinPanel);
    disposables.listen(document.getElementById('retro-checkin-start'), 'input', updateRetroCheckinPanel);
    disposables.listen(document.getElementById('retro-checkin-end'), 'input', updateRetroCheckinPanel);
    disposables.listen(document.getElementById('retro-checkin-reason'), 'input', updateRetroCheckinPanel);
    disposables.listen(document.getElementById('retro-checkin-submit'), 'click', submitRetroCheckin);
    disposables.listen(document.getElementById('checkin-late-grace-input'), 'input', updateCheckinPreferenceDraftPreview);
    disposables.listen(document.getElementById('checkin-early-grace-input'), 'input', updateCheckinPreferenceDraftPreview);
    disposables.listen(document.getElementById('checkin-flex-save-btn'), 'click', saveCheckinPreferences);
    disposables.listen(document.getElementById('checkin-flex-reset-btn'), 'click', resetCheckinPreferences);

    refreshCheckinViews();
    renderCheckinPreferenceForm();
    return () => {
        disposables.dispose();
    };
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
    refreshCheckinViews({ includeRetro: false });
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
    refreshCheckinViews({ includeRetro: false });
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
        refreshCheckinViews({ includeStatus: false });
        return;
    }

    if (!reason) {
        showToast('补打卡还缺补录说明。', 'warning');
        return;
    }

    const dayData = ensureCheckinDay(date);
    if (dayData.leave) {
        showToast('这一天当前按全天离舰处理，回离舰流程调整后再补打卡。', 'warning');
        refreshCheckinViews({ includeStatus: false });
        return;
    }

    const evaluation = evaluateShiftRecord(date, period, checkInTime, checkOutTime);
    if (!evaluation.valid) {
        showToast(evaluation.reason || '这次补录还没通过预判，检查一下时间。', 'warning');
        refreshCheckinViews({ includeStatus: false });
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
    refreshCheckinViews();

    showToast(`已补录 ${formatDisplayDate(date)} 的 ${getPeriodLabel(period)}`, 'success');
}

registerAppModule({
    id: 'checkin',
    order: 30,
    init: initCheckin
});
