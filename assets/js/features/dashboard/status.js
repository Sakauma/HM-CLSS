/**
 * 首页状态层。
 * 负责首页总览、今日摘要和航行情绪提示。
 */

function updateVoyageAmbientPresentation() {
    const preferences = normalizeAmbientPreferences(ambientPreferences);
    const root = document.documentElement;
    const pillEl = document.getElementById('voyage-ambient-pill');
    const copyEl = document.getElementById('voyage-ambient-copy');
    const shellEl = document.getElementById('voyage-ambient-shell');

    if (!preferences.enabled) {
        delete root.dataset.ambient;
        if (shellEl) shellEl.classList.add('hidden');
        return;
    }

    const ambient = getVoyageAmbientState();
    const presentation = getVoyageAmbientPresentation(ambient);
    root.dataset.ambient = ambient.state;

    if (shellEl) shellEl.classList.remove('hidden');
    if (pillEl) {
        pillEl.textContent = presentation.pillText;
        pillEl.className = `${getStatusChipClass(presentation.chipLevel)} shrink-0`;
    }
    if (copyEl) copyEl.textContent = presentation.copy;
}

function getTodayPeriodStatusPresentation(dayData, period) {
    if (dayData.leave) {
        return { text: '全天脱产', className: 'font-medium text-slate-400' };
    }

    if (dayData[period].checkIn && dayData[period].checkOut) {
        const inVal = getNormalizedCheckInStatus(dayData[period].status.checkIn);
        const outVal = dayData[period].status.checkOut;

        if (inVal === 'excused' || outVal === 'excused') {
            return { text: '已离舰', className: 'font-bold text-blue-500 dark:text-blue-400' };
        }
        if (inVal === 'danger' || outVal === false || outVal === 'danger') {
            return { text: '异常', className: 'font-medium text-danger' };
        }
        if (inVal === 'warning' || outVal === 'warning') {
            return { text: '警告', className: 'font-medium text-warning' };
        }

        return { text: '合规', className: 'font-medium text-success' };
    }

    if (dayData[period].checkIn) {
        return { text: '工作中', className: 'font-medium text-primary' };
    }

    return { text: '-', className: 'font-medium text-slate-400' };
}

function updateTodayStatus() {
    const today = getTodayString();
    const dayData = ensureCheckinDay(today);

    ['morning', 'afternoon', 'evening'].forEach((period) => {
        const el = document.getElementById(`today-${period}-status`);
        if (!el) return;

        const presentation = getTodayPeriodStatusPresentation(dayData, period);
        el.textContent = presentation.text;
        el.className = presentation.className;
    });

    const todayPhoneCount = `${phoneResistData.records[today].count} 次`;
    const todayPhoneCountEl = document.getElementById('today-phone-count');
    if (todayPhoneCountEl) {
        todayPhoneCountEl.textContent = todayPhoneCount;
    }

    const activeTaskEl = document.getElementById('today-active-task');
    if (currentTask) {
        activeTaskEl.textContent = currentTask.name;
        activeTaskEl.className = 'font-medium text-primary truncate max-w-[10rem]';
    } else {
        activeTaskEl.textContent = '空闲';
        activeTaskEl.className = 'font-medium text-slate-400';
    }

    const overview = getTodayOverview(dayData);
    const heroOverallPillEl = document.getElementById('hero-overall-pill');
    const heroOverallStatusEl = document.getElementById('hero-overall-status');
    const heroOverallHintEl = document.getElementById('hero-overall-hint');
    const heroPhoneCountEl = document.getElementById('hero-phone-count-display');
    const heroPhoneHintEl = document.getElementById('hero-phone-count-hint');
    const heroActiveTaskDisplayEl = document.getElementById('hero-active-task-display');
    const heroActiveTaskHintEl = document.getElementById('hero-active-task-hint');
    const heroNextActionEl = document.getElementById('hero-next-action');
    const heroNextActionHintEl = document.getElementById('hero-next-action-hint');
    const commandTitleEl = document.getElementById('today-command-title');
    const commandMessageEl = document.getElementById('today-command-message');
    const commandIndicatorEl = document.getElementById('today-command-indicator');

    if (heroOverallPillEl) {
        heroOverallPillEl.textContent = overview.chipText;
        heroOverallPillEl.className = `${getStatusChipClass(overview.chipLevel)} shrink-0`;
    }

    if (heroOverallStatusEl) heroOverallStatusEl.textContent = overview.overallStatus;
    if (heroOverallHintEl) heroOverallHintEl.textContent = overview.overallHint;

    if (heroPhoneCountEl) heroPhoneCountEl.textContent = todayPhoneCount;
    if (heroPhoneHintEl) {
        heroPhoneHintEl.textContent = phoneResistData.records[today].count > 0
            ? '今天已经留下了明确的抗干扰记录。'
            : '今天还没有记录任何抗干扰动作。';
    }

    if (heroActiveTaskDisplayEl) {
        heroActiveTaskDisplayEl.textContent = currentTask ? currentTask.name : '空闲';
    }

    if (heroActiveTaskHintEl) {
        heroActiveTaskHintEl.textContent = currentTask
            ? `${tagMap[currentTask.tag] || tagMap.other} · ${currentTask.startTime} 开始`
            : '当前没有进行中的科研任务。';
    }

    if (heroNextActionEl) heroNextActionEl.textContent = overview.nextAction;
    if (heroNextActionHintEl) heroNextActionHintEl.textContent = overview.nextActionHint;
    if (commandTitleEl) commandTitleEl.textContent = overview.commandTitle;
    if (commandMessageEl) commandMessageEl.textContent = overview.commandMessage;

    if (commandIndicatorEl) {
        const indicatorClassMap = {
            success: 'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-success',
            warning: 'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-warning',
            danger: 'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-danger',
            info: 'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary'
        };

        commandIndicatorEl.className = indicatorClassMap[overview.chipLevel] || indicatorClassMap.info;
    }

    updateVoyageAmbientPresentation();
}
