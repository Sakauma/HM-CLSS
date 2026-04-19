/**
 * 状态概览与提示界面层。
 * 负责刷新首页总览、航行情绪和全局 toast 提示。
 */

/**
 * 根据当前派生状态刷新全站航行情绪层展示。
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

/**
 * 刷新首页总览、今日摘要和行动提示。
 */
function updateTodayStatus() {
    const today = getTodayString();
    const dayData = ensureCheckinDay(today);

    ['morning', 'afternoon', 'evening'].forEach((period) => {
        const el = document.getElementById(`today-${period}-status`);
        if (!el) return;

        if (dayData.leave) {
            el.textContent = '全天脱产';
            el.className = 'font-medium text-slate-400';
        } else if (dayData[period].checkIn && dayData[period].checkOut) {
            const inVal = getNormalizedCheckInStatus(dayData[period].status.checkIn);
            const outVal = dayData[period].status.checkOut;

            if (inVal === 'excused' || outVal === 'excused') {
                el.textContent = '已离舰';
                el.className = 'font-bold text-blue-500 dark:text-blue-400';
            } else if (inVal === 'danger' || outVal === false || outVal === 'danger') {
                el.textContent = '异常';
                el.className = 'font-medium text-danger';
            } else if (inVal === 'warning' || outVal === 'warning') {
                el.textContent = '警告';
                el.className = 'font-medium text-warning';
            } else {
                el.textContent = '合规';
                el.className = 'font-medium text-success';
            }
        } else if (dayData[period].checkIn) {
            el.textContent = '工作中';
            el.className = 'font-medium text-primary';
        } else {
            el.textContent = '-';
            el.className = 'font-medium text-slate-400';
        }
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

/**
 * 显示顶部 toast 提示，并在动画结束后自动移除。
 * @param {string} message
 * @param {'success'|'error'|'warning'} type
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const colors = {
        success: 'bg-white dark:bg-slate-800 border-l-4 border-success text-slate-700 dark:text-slate-200',
        error: 'bg-white dark:bg-slate-800 border-l-4 border-danger text-slate-700 dark:text-slate-200',
        warning: 'bg-white dark:bg-slate-800 border-l-4 border-warning text-slate-700 dark:text-slate-200'
    };

    const icons = {
        success: '<i data-lucide="check-circle" class="w-5 h-5 text-success shrink-0"></i>',
        error: '<i data-lucide="x-circle" class="w-5 h-5 text-danger shrink-0"></i>',
        warning: '<i data-lucide="alert-triangle" class="w-5 h-5 text-warning shrink-0"></i>'
    };

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 pointer-events-auto animate-toast-in ${colors[type]}`;
    toast.innerHTML = `
        ${icons[type]}
        <span class="text-sm font-medium">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.classList.remove('animate-toast-in');
        toast.classList.add('animate-toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
