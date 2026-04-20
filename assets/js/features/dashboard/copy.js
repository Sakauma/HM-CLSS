/**
 * 状态概览文案层。
 * 负责状态徽章样式、班次标签和首页概览文案派生。
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
    const activeTask = runtimeSelectors.currentTask();
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
            copy: activeTask
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
 * 根据今天的值班、任务和离舰状态，生成首页概览卡需要的文案。
 * @param {object} dayData
 * @returns {object}
 */
function getTodayOverview(dayData) {
    const now = getCurrentTime();
    const currentMins = now.hour * 60 + now.minute;
    const periods = ['morning', 'afternoon', 'evening'];
    const activeTask = runtimeSelectors.currentTask();
    let hasIssues = false;
    let hasWarnings = false;

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
            chipLevel: activeTask ? 'info' : 'success',
            chipText: activeTask ? '科研中' : '待命中',
            overallStatus: activeTask ? '科研推进中' : '等待下一班次',
            overallHint: activeTask ? '当前有任务在推进。' : `${getPeriodLabel(unfinishedPeriod)} 是下一段重点。`,
            nextAction: activeTask ? '继续当前任务。' : '这段空档适合任务或速记。',
            nextActionHint: activeTask ? '注意力留给主线。' : '把空档用在主线上。',
            commandTitle: activeTask ? '继续主线' : '缓冲窗口',
            commandMessage: activeTask
                ? '当前窗口平稳，继续推进。'
                : '现在适合任务或捕捉。'
        };
    }

    return {
        chipLevel: 'success',
        chipText: '今日闭环',
        overallStatus: '今天的班次已闭环',
        overallHint: '三个班次都已闭环。',
        nextAction: activeTask ? '继续当前任务。' : '继续任务，或去统计面板。',
        nextActionHint: '现在适合沉淀。',
        commandTitle: '今日闭环',
        commandMessage: '值班记录已完整落地。'
    };
}
