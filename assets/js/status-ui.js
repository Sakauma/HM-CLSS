/**
 * 状态概览与提示模块。
 * 负责把原始业务数据翻译成首页总览、建议动作和全局 toast 提示。
 */

/**
 * 将抽象状态级别映射为统一的徽章样式类。
 * @param {'success'|'warning'|'danger'|'info'} level
 * @returns {string}
 */
function getStatusChipClass(level) {
    const levelMap = {
        success: 'status-chip status-chip-success',
        warning: 'status-chip status-chip-warning',
        danger: 'status-chip status-chip-danger',
        info: 'status-chip status-chip-info'
    };

    return levelMap[level] || levelMap.info;
}

/**
 * 将内部班次键转换为对用户展示的班次名称。
 * @param {'morning'|'afternoon'|'evening'} period
 * @returns {string}
 */
function getPeriodLabel(period) {
    const labelMap = {
        morning: 'Alpha 班次',
        afternoon: 'Beta 班次',
        evening: 'Gamma 班次'
    };

    return labelMap[period] || period;
}

/**
 * 将航行情绪层状态映射成对应的视觉与文案资源。
 * @param {{ state: 'steady'|'alert'|'recovery'|'nightwatch', warnings: boolean, issues: boolean }} ambient
 * @returns {{ pillText: string, chipLevel: 'success'|'warning'|'danger'|'info', copy: string }}
 */
function getVoyageAmbientPresentation(ambient) {
    const map = {
        steady: {
            pillText: '稳态巡航',
            chipLevel: 'success',
            copy: '环境平稳，可直接推进。'
        },
        alert: {
            pillText: '异常预警',
            chipLevel: ambient.issues ? 'danger' : 'warning',
            copy: ambient.issues
                ? '有异常，先收口。'
                : '有波动，先处理。'
        },
        recovery: {
            pillText: '恢复推进',
            chipLevel: 'info',
            copy: currentTask
                ? '继续当前任务。'
                : '适合推进主线。'
        },
        nightwatch: {
            pillText: '夜航值守',
            chipLevel: 'info',
            copy: '夜航时段，适合收尾。'
        }
    };

    return map[ambient.state] || map.steady;
}

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
 * 根据今天的值班、任务和离舰状态，生成首页概览卡需要的文案。
 * @param {object} dayData
 * @returns {object}
 */
function getTodayOverview(dayData) {
    const now = getCurrentTime();
    const currentMins = now.hour * 60 + now.minute;
    const periods = ['morning', 'afternoon', 'evening'];
    let hasIssues = false;
    let hasWarnings = false;

    // 先找最严重的问题：异常比警告和提示优先级更高。
    for (const period of periods) {
        const status = dayData[period].status;
        const inStatus = getNormalizedCheckInStatus(status.checkIn);
        if (
            inStatus === 'danger' ||
            status.checkOut === false ||
            status.checkOut === 'danger'
        ) {
            hasIssues = true;
            break;
        }

        if (inStatus === 'warning' || status.checkOut === 'warning') {
            hasWarnings = true;
        }
    }

    if (dayData.leave) {
        const leaveMode = dayData.leaveMeta?.requestMode;
        const leaveStatus = leaveMode === 'planned' ? '今天按预请假执行' : '今天已离舰';
        const leaveHint = leaveMode === 'planned'
            ? '今天沿用预请假记录。'
            : '今天按离舰状态处理。';
        return {
            chipLevel: 'warning',
            chipText: '离舰中',
            overallStatus: leaveStatus,
            overallHint: leaveHint,
            nextAction: '返舰后更新状态。',
            nextActionHint: '状态改回，值班会一起恢复。',
            commandTitle: '离舰优先',
            commandMessage: '安排有变，就去离舰流程更新。'
        };
    }

    // 其次判断是否存在已开始但尚未收尾的班次。
    for (const period of periods) {
        const periodData = dayData[period];
        if (periodData.checkIn && !periodData.checkOut) {
            return {
                chipLevel: hasIssues ? 'danger' : 'info',
                chipText: hasIssues ? '需收尾' : '值班中',
                overallStatus: `${getPeriodLabel(period)}进行中`,
                overallHint: '登出还没落记录。',
                nextAction: `离开前补上 ${getPeriodLabel(period)} 登出。`,
                nextActionHint: '结束时回来收尾。',
                commandTitle: '值班进行中',
                commandMessage: '结束时回来补上登出。'
            };
        }
    }

    // 再判断是否正处于某个应当优先打卡的班次窗口内。
    for (const period of periods) {
        const cfg = CONFIG.schedule[period];
        const startMins = cfg.startHour * 60;
        const endMins = cfg.endHour * 60;
        const periodData = dayData[period];

        if (!periodData.checkIn && currentMins >= startMins && currentMins < endMins) {
            return {
                chipLevel: hasIssues ? 'warning' : 'info',
                chipText: hasIssues ? '待修正' : '待连线',
                overallStatus: `${getPeriodLabel(period)}待启动`,
                overallHint: '开始时间还没落记录。',
                nextAction: `把 ${getPeriodLabel(period)} 连线补上。`,
                nextActionHint: '先记开始时间。',
                commandTitle: '当前窗口已开启',
                commandMessage: '先记开始时间。'
            };
        }
    }

    if (hasIssues) {
        return {
            chipLevel: 'danger',
            chipText: '需要复盘',
            overallStatus: '今天有异常记录',
            overallHint: '至少有一个时段异常。',
            nextAction: '打开今日记录表。',
            nextActionHint: '先看落点。',
            commandTitle: '异常待确认',
            commandMessage: '先看今日记录表。'
        };
    }

    if (hasWarnings) {
        return {
            chipLevel: 'warning',
            chipText: '存在警告',
            overallStatus: '今天有需要留意的记录',
            overallHint: '有班次超出推荐时段。',
            nextAction: '打开今日记录表。',
            nextActionHint: '看一眼就够。',
            commandTitle: '警告待确认',
            commandMessage: '回看一下记录表。'
        };
    }

    const unfinishedPeriod = periods.find((period) => !dayData[period].checkIn || !dayData[period].checkOut);
    if (unfinishedPeriod) {
        return {
            chipLevel: currentTask ? 'info' : 'success',
            chipText: currentTask ? '科研中' : '待命中',
            overallStatus: currentTask ? '科研推进中' : '等待下一班次',
            overallHint: currentTask ? '当前有任务在推进。' : `${getPeriodLabel(unfinishedPeriod)} 是下一段重点。`,
            nextAction: currentTask ? '继续当前任务。' : '这段空档适合任务或速记。',
            nextActionHint: currentTask ? '注意力留给主线。' : '把空档用在主线上。',
            commandTitle: currentTask ? '继续主线' : '缓冲窗口',
            commandMessage: currentTask
                ? '当前窗口平稳，继续推进。'
                : '现在适合任务或捕捉。'
        };
    }

    return {
        chipLevel: 'success',
        chipText: '今日闭环',
        overallStatus: '今天的班次已闭环',
        overallHint: '三个班次都已闭环。',
        nextAction: currentTask ? '继续当前任务。' : '继续任务，或去统计面板。',
        nextActionHint: '现在适合沉淀。',
        commandTitle: '今日闭环',
        commandMessage: '值班记录已完整落地。'
    };
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
