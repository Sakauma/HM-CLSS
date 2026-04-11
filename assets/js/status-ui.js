function getStatusChipClass(level) {
    const levelMap = {
        success: 'status-chip status-chip-success',
        warning: 'status-chip status-chip-warning',
        danger: 'status-chip status-chip-danger',
        info: 'status-chip status-chip-info'
    };

    return levelMap[level] || levelMap.info;
}

function getPeriodLabel(period) {
    const labelMap = {
        morning: 'Alpha 班次',
        afternoon: 'Beta 班次',
        evening: 'Gamma 班次'
    };

    return labelMap[period] || period;
}

function getTodayOverview(dayData) {
    const now = getCurrentTime();
    const currentMins = now.hour * 60 + now.minute;
    const periods = ['morning', 'afternoon', 'evening'];
    let hasIssues = false;

    for (const period of periods) {
        const status = dayData[period].status;
        if (
            status.checkIn === false ||
            status.checkIn === 'danger' ||
            status.checkOut === false ||
            status.checkOut === 'danger' ||
            status.checkOut === 'warning'
        ) {
            hasIssues = true;
            break;
        }
    }

    if (dayData.leave) {
        return {
            chipLevel: 'warning',
            chipText: '离舰中',
            overallStatus: '今天已离舰',
            overallHint: '系统会将相关班次按离舰逻辑处理。',
            nextAction: '如已返舰，请先去审批模块修正记录。',
            nextActionHint: '先修正离舰状态，再回值班日志确认今天的班次结果。',
            commandTitle: '今天以离舰记录为准',
            commandMessage: '如果安排变化，请先到离舰审批里更新状态，避免值班判定继续沿用旧记录。'
        };
    }

    for (const period of periods) {
        const periodData = dayData[period];
        if (periodData.checkIn && !periodData.checkOut) {
            return {
                chipLevel: hasIssues ? 'danger' : 'info',
                chipText: hasIssues ? '需收尾' : '值班中',
                overallStatus: `${getPeriodLabel(period)}进行中`,
                overallHint: '已经连线，但还没有完成登出记录。',
                nextAction: `结束前记得完成${getPeriodLabel(period)}登出。`,
                nextActionHint: '如果今天还有其他任务，可以继续推进，但别忘了在离开前回来收尾。',
                commandTitle: '当前班次尚未结束',
                commandMessage: `你已经进入 ${getPeriodLabel(period)}。结束这一段后，记得回到这里完成登出，避免只留下半程记录。`
            };
        }
    }

    for (const period of periods) {
        const cfg = CONFIG.schedule[period];
        const startMins = cfg.startHour * 60;
        const endMins = cfg.endHour * 60;
        const periodData = dayData[period];

        if (!periodData.checkIn && currentMins >= startMins && currentMins < endMins) {
            return {
                chipLevel: hasIssues ? 'warning' : 'info',
                chipText: hasIssues ? '先修正' : '待连线',
                overallStatus: `${getPeriodLabel(period)}待启动`,
                overallHint: '当前班次窗口已开启，但系统还没有记录到开始时间。',
                nextAction: `优先完成 ${getPeriodLabel(period)} 连线。`,
                nextActionHint: '先做今天最紧迫的一步，再返回处理次要事项。',
                commandTitle: '当前班次最优先',
                commandMessage: `现在优先处理 ${getPeriodLabel(period)}。先让系统记录开始时间，再决定是否切去做别的事情。`
            };
        }
    }

    if (hasIssues) {
        return {
            chipLevel: 'danger',
            chipText: '需要复盘',
            overallStatus: '今天存在异常记录',
            overallHint: '至少有一个时段超时或判定异常。',
            nextAction: '先查看今日值班记录表，确认问题落在哪个时段。',
            nextActionHint: '比起继续堆新数据，先把异常定位清楚更重要。',
            commandTitle: '先看异常时段',
            commandMessage: '今天已经出现异常或超时记录。先在记录表里确认具体问题，再决定后续动作。'
        };
    }

    const unfinishedPeriod = periods.find((period) => !dayData[period].checkIn || !dayData[period].checkOut);
    if (unfinishedPeriod) {
        return {
            chipLevel: currentTask ? 'info' : 'success',
            chipText: currentTask ? '科研中' : '待命中',
            overallStatus: currentTask ? '科研推进中' : '等待下一班次',
            overallHint: currentTask ? '当前有进行中的科研任务。' : `下一优先会转向 ${getPeriodLabel(unfinishedPeriod)}。`,
            nextAction: currentTask ? '继续当前任务，切记在下一班次窗口开启后及时处理。' : `在下一班次开启前，可以先处理任务或速记。`,
            nextActionHint: currentTask ? '当下没有更紧迫的值班动作，可以专注推进眼前任务。' : '利用空档做需要连续注意力的事情，比被动等待更划算。',
            commandTitle: currentTask ? '先保持专注推进' : '现在是缓冲窗口',
            commandMessage: currentTask
                ? '当前没有正在流失的班次窗口。继续推进正在进行的科研任务，等下一班次开启后再回来处理。'
                : `当前没有立刻要打的卡。可以先去任务管理或速记面板，把缓冲时间用在真正重要的事情上。`
        };
    }

    return {
        chipLevel: 'success',
        chipText: '今日闭环',
        overallStatus: '今天的班次已闭环',
        overallHint: '三个班次都已完成，记录链路完整。',
        nextAction: currentTask ? '继续推进当前任务，或去统计面板做复盘。' : '可继续做任务，或直接进入统计面板回看趋势。',
        nextActionHint: '这时适合沉淀而不是补救。',
        commandTitle: '今日值班已闭环',
        commandMessage: '今天的值班记录已经完整落地。接下来更适合推进任务、记录心情，或者去统计面板做一次复盘。'
    };
}

function updateTodayStatus() {
    const today = getTodayString();
    const dayData = checkinData[today];

    ['morning', 'afternoon', 'evening'].forEach((period) => {
        const el = document.getElementById(`today-${period}-status`);
        if (!el) return;

        if (dayData.leave) {
            el.textContent = '全天脱产';
            el.className = 'font-medium text-slate-400';
        } else if (dayData[period].checkIn && dayData[period].checkOut) {
            const inVal = dayData[period].status.checkIn;
            const outVal = dayData[period].status.checkOut;

            if (inVal === 'excused' || outVal === 'excused') {
                el.textContent = '已离舰';
                el.className = 'font-bold text-blue-500 dark:text-blue-400';
            } else if (!inVal || outVal === false || outVal === 'danger') {
                el.textContent = '异常';
                el.className = 'font-medium text-danger';
            } else if (outVal === 'warning') {
                el.textContent = '超时警告';
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
}

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
