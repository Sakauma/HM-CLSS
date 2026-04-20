/**
 * 运行时环境态工具。
 * 负责值班留痕判断、补录配额和全局航行情绪派生。
 */

/**
 * 获取指定日期中是否已有任何班次记录。
 * @param {object|null} dayData
 * @returns {boolean}
 */
function hasAnyCheckinRecord(dayData) {
    if (!dayData) return false;
    return ['morning', 'afternoon', 'evening'].some((period) => dayData[period]?.checkIn || dayData[period]?.checkOut);
}

/**
 * 汇总补打卡配额使用情况。
 * @param {string} targetDate
 * @returns {{ weekUsed: number, monthUsed: number, weekDates: Set<string>, monthDates: Set<string> }}
 */
function getRetroCheckinUsage(targetDate = getTodayString()) {
    const weekDates = new Set();
    const monthDates = new Set();
    const targetMonth = String(targetDate).slice(0, 7);

    Object.entries(checkinData).forEach(([date, day]) => {
        const hasRetro = ['morning', 'afternoon', 'evening'].some((period) => day?.[period]?.entrySource === 'retro');
        if (!hasRetro) return;

        const diff = getDateDiffInDays(date);
        if (diff >= 1 && diff <= 7) weekDates.add(date);
        if (String(date).slice(0, 7) === targetMonth) monthDates.add(date);
    });

    return {
        weekUsed: weekDates.size,
        monthUsed: monthDates.size,
        weekDates,
        monthDates
    };
}

/**
 * 判断某个日期是否允许补打卡，并返回失败原因与当前配额占用。
 * @param {string} targetDate
 * @returns {{ allowed: boolean, reason: string, usage: { weekUsed: number, monthUsed: number, weekDates: Set<string>, monthDates: Set<string> } }}
 */
function getRetroCheckinAvailability(targetDate) {
    const usage = getRetroCheckinUsage(targetDate || getTodayString());
    const today = getTodayString();
    const date = String(targetDate || '');

    if (!date) {
        return { allowed: false, reason: '先选一个要补录的日期。', usage };
    }

    const diff = getDateDiffInDays(date, today);
    if (diff <= 0) {
        return { allowed: false, reason: '补打卡只处理过去日期，今天和未来日期不走这条流程。', usage };
    }

    if (diff > CONFIG.retro.maxDaysPast) {
        return { allowed: false, reason: `这里只保留最近 ${CONFIG.retro.maxDaysPast} 天的补录窗口。`, usage };
    }

    const sameDayAlreadyCounted = usage.weekDates.has(date) || usage.monthDates.has(date);
    if (diff <= 7 && !sameDayAlreadyCounted && usage.weekUsed >= CONFIG.retro.last7DayQuota) {
        return { allowed: false, reason: `最近 7 天的补录额度已经用满（${CONFIG.retro.last7DayQuota} / ${CONFIG.retro.last7DayQuota}）。`, usage };
    }

    if (!sameDayAlreadyCounted && usage.monthUsed >= CONFIG.retro.monthlyQuota) {
        return { allowed: false, reason: `本月补录额度已经用满（${CONFIG.retro.monthlyQuota} / ${CONFIG.retro.monthlyQuota}）。`, usage };
    }

    return { allowed: true, reason: '', usage };
}

/**
 * 提取当前可用的情绪倾向信号，优先使用酒馆当前结果，其次回退到最近一杯历史。
 * @returns {{ valence: number, intensity: number }}
 */
function getCurrentTavernSignal() {
    if (currentDrinkInfo && typeof currentDrinkInfo.valence === 'number') {
        return {
            valence: currentDrinkInfo.valence,
            intensity: typeof currentDrinkInfo.intensity === 'number' ? currentDrinkInfo.intensity : 0.25
        };
    }

    const latestDrink = Array.isArray(tavernData) ? tavernData[0] : null;
    return {
        valence: typeof latestDrink?.valence === 'number' ? latestDrink.valence : 0,
        intensity: typeof latestDrink?.intensity === 'number' ? latestDrink.intensity : 0
    };
}

/**
 * 基于当前时间、值班状态、任务推进和情绪倾向派生航行环境态。
 * @returns {{ state: 'steady'|'alert'|'recovery'|'nightwatch', warnings: boolean, issues: boolean }}
 */
function getVoyageAmbientState() {
    const now = new Date();
    const hour = now.getHours();
    const today = getTodayString();
    const dayData = checkinData[today] ? ensureDayRecord(checkinData[today]) : createEmptyDayRecord();
    const tavernSignal = getCurrentTavernSignal();
    const todayTasks = taskData[today] || [];

    let issues = false;
    let warnings = false;
    ['morning', 'afternoon', 'evening'].forEach((period) => {
        const inStatus = getNormalizedCheckInStatus(dayData[period].status.checkIn);
        const outStatus = dayData[period].status.checkOut;
        if (inStatus === 'danger' || outStatus === 'danger' || outStatus === false) issues = true;
        if (inStatus === 'warning' || outStatus === 'warning') warnings = true;
    });

    if (hour >= 22 || hour < 6) {
        return { state: 'nightwatch', warnings, issues };
    }

    if (issues || warnings || (tavernSignal.valence < -0.2 && tavernSignal.intensity > 0.4)) {
        return { state: 'alert', warnings, issues };
    }

    if (currentTask || todayTasks.length > 0 || dayData.leave || tavernSignal.valence > 0.18) {
        return { state: 'recovery', warnings, issues };
    }

    return { state: 'steady', warnings, issues };
}
