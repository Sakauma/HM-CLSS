/**
 * 工作区通用指标模块。
 * 负责给成就、统计、导出和同步提供共享的计数与累计口径。
 */

function countCheckinDays(source = checkinData) {
    return Object.values(source).filter((day) => {
        if (!day || typeof day !== 'object') return false;
        const normalizedDay = ensureDayRecord(day);
        return !normalizedDay.leave && hasAnyCheckinRecord(normalizedDay);
    }).length;
}

function countTotalTaskEntries(source = taskData) {
    return Object.values(source).reduce((total, day) => total + (Array.isArray(day) ? day.length : 0), 0);
}

function countQuickNoteEntries(source = quickNotesData) {
    return Object.values(source).reduce((total, notes) => total + (Array.isArray(notes) ? notes.length : 0), 0);
}

/**
 * 汇总所有已完成任务的累计小时数。
 * @param {object} source
 * @returns {number}
 */
function calculateTotalTaskHours(source = taskData) {
    let mins = 0;
    Object.values(source).forEach((day) => {
        if (!Array.isArray(day)) return;
        day.forEach((task) => {
            if (task.duration) mins += task.duration;
        });
    });
    return Math.floor(mins / 60);
}

/**
 * 计算当前连续打卡天数。
 * 规则以“昨天开始向前连续”回溯，避免把未来或缺失日期算入 streak。
 * @param {object} source
 * @returns {number}
 */
function calculateCheckinStreak(source = checkinData) {
    const todayStr = getTodayString();
    const dates = Object.keys(source)
        .filter((date) => date <= todayStr)
        .sort()
        .reverse();

    if (!dates.length) return 0;

    let streak = 0;
    const expectedDate = new Date();
    const todayData = source[todayStr] ? ensureDayRecord(source[todayStr]) : null;
    const checkedInToday = todayData && (todayData.morning.checkIn || todayData.afternoon.checkIn || todayData.evening.checkIn);

    expectedDate.setDate(expectedDate.getDate() - 1);
    if (checkedInToday) streak = 1;

    for (let i = 0; i < dates.length; i++) {
        const dateStr = dates[i];
        if (dateStr >= todayStr) continue;

        const expectedStr = formatLocalDate(expectedDate);
        if (dateStr !== expectedStr) break;

        const day = ensureDayRecord(source[dateStr]);
        if (day.morning.checkIn || day.afternoon.checkIn || day.evening.checkIn) {
            streak++;
            expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
}
