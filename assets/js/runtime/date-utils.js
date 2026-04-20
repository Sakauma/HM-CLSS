/**
 * 运行时时间工具。
 * 负责日期键、展示日期和当前时间的统一计算。
 */

/**
 * 将 Date 对象格式化为 YYYY-MM-DD，作为各模块统一的日期键。
 * @param {Date} date
 * @returns {string}
 */
function formatLocalDate(date) {
    return date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0');
}

/**
 * 把 YYYY-MM-DD 解析成本地 Date 对象，避免直接 new Date 产生时区歧义。
 * @param {string} dateStr
 * @returns {Date}
 */
function parseLocalDate(dateStr) {
    const [year, month, day] = String(dateStr).split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
}

/**
 * 获取今天的本地日期字符串。
 * @returns {string}
 */
function getTodayString() {
    return formatLocalDate(new Date());
}

/**
 * 计算两个日期键之间相差的自然日数。
 * 正数表示 targetDate 在 compareDate 之前。
 * @param {string} targetDate
 * @param {string} compareDate
 * @returns {number}
 */
function getDateDiffInDays(targetDate, compareDate = getTodayString()) {
    const target = parseLocalDate(targetDate);
    const compare = parseLocalDate(compareDate);
    return Math.round((compare.getTime() - target.getTime()) / 86400000);
}

/**
 * 将 YYYY-MM-DD 格式化为更易读的本地展示文案。
 * @param {string} dateStr
 * @returns {string}
 */
function formatDisplayDate(dateStr) {
    return parseLocalDate(dateStr).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        weekday: 'short'
    });
}

/**
 * 获取当前本地时间，格式为 HH:MM。
 * @returns {string}
 */
function getCurrentTimeString() {
    return new Date().toTimeString().slice(0, 5);
}

/**
 * 以结构化对象返回当前小时和分钟，便于做时间比较。
 * @returns {{ hour: number, minute: number }}
 */
function getCurrentTime() {
    const now = new Date();
    return { hour: now.getHours(), minute: now.getMinutes() };
}
