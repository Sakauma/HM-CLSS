/**
 * 值班打卡规则模块。
 * 负责时间判定、状态归一化、补录评估与记录写入。
 */

const CHECKIN_PERIODS = ['morning', 'afternoon', 'evening'];

function getCheckinPreferenceSnapshot() {
    if (typeof normalizeCheckinPreferences === 'function') {
        return normalizeCheckinPreferences(runtimeSelectors?.checkinPreferences?.());
    }

    return {
        lateGraceMins: 30,
        earlyGraceMins: 30
    };
}

/**
 * 兼容旧版本使用布尔值表示打卡状态的情况，统一转换成字符串枚举。
 * @param {boolean|string|null} status
 * @returns {string|null}
 */
function getNormalizedCheckInStatus(status) {
    if (status === true) return 'success';
    if (status === false) return 'warning';
    return status;
}

/**
 * 确保指定日期存在完整的日记录结构。
 * @param {string} date
 * @returns {object}
 */
function ensureCheckinDay(date) {
    runtimeActions.updateCheckinDay(date, (dayData) => {
        if (!dayData || typeof dayData !== 'object') {
            return createEmptyDayRecord();
        }
        return ensureDayRecord(dayData);
    }, createEmptyDayRecord);
    return runtimeSelectors.checkinData()[date];
}

/**
 * 以只读方式读取指定日期的值班结构，不在预览阶段制造空记录。
 * @param {string} date
 * @returns {object}
 */
function getCheckinDaySnapshot(date) {
    return checkinData[date] ? ensureDayRecord(checkinData[date]) : createEmptyDayRecord();
}

/**
 * 把 HH:MM 转成分钟数，便于统一做时间区间比较。
 * @param {string} timeStr
 * @returns {number}
 */
function timeStrToMins(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/**
 * 评估给定连线时间的状态。
 * @param {object} dayData
 * @param {'morning'|'afternoon'|'evening'} period
 * @param {number} currentMins
 * @returns {'success'|'warning'|'excused'}
 */
function getCheckInStatusForTime(dayData, period, currentMins) {
    const cfg = CONFIG.schedule[period];
    const preferences = getCheckinPreferenceSnapshot();
    const thresholdMins = (cfg.okCheckInBefore * 60) + preferences.lateGraceMins;
    let inStatus = currentMins <= thresholdMins ? 'success' : 'warning';

    if (inStatus === 'warning' && Array.isArray(dayData.partialLeaves)) {
        for (const leave of dayData.partialLeaves) {
            const leaveStartMins = timeStrToMins(leave.startTime);
            const leaveEndMins = timeStrToMins(leave.endTime);

            if (
                (leaveStartMins <= thresholdMins && currentMins <= leaveEndMins + 30) ||
                (currentMins >= leaveStartMins && currentMins <= leaveEndMins)
            ) {
                inStatus = 'excused';
                break;
            }
        }
    }

    return inStatus;
}

/**
 * 评估给定登出时间的状态。
 * @param {object} dayData
 * @param {'morning'|'afternoon'|'evening'} period
 * @param {number} inMins
 * @param {number} outMins
 * @returns {'success'|'warning'|'danger'|'excused'}
 */
function getCheckOutStatusForTimes(dayData, period, inMins, outMins) {
    const cfg = CONFIG.schedule[period];
    const preferences = getCheckinPreferenceSnapshot();
    const thresholdMins = cfg.okCheckOutBefore * 60;
    const earlyThresholdMins = Math.max(0, thresholdMins - preferences.earlyGraceMins);
    const durationMins = outMins - inMins;

    let isExcusedEarlyLeave = false;
    if (Array.isArray(dayData.partialLeaves)) {
        for (const leave of dayData.partialLeaves) {
            const leaveStartMins = timeStrToMins(leave.startTime);
            const leaveEndMins = timeStrToMins(leave.endTime);

            if (leaveStartMins <= outMins + 30 && leaveEndMins >= thresholdMins) {
                isExcusedEarlyLeave = true;
                break;
            }
        }
    }

    if (isExcusedEarlyLeave) return 'excused';
    if (durationMins < CONFIG.task.minDurationMins) return 'danger';
    if (outMins < earlyThresholdMins) return 'warning';
    return outMins <= thresholdMins ? 'success' : 'warning';
}

/**
 * 统一评估一个完整班次记录的结果，用于补打卡预判和实际写入。
 * @param {string} date
 * @param {'morning'|'afternoon'|'evening'} period
 * @param {string} checkInTime
 * @param {string} checkOutTime
 * @returns {{ valid: boolean, reason?: string, inStatus?: string, outStatus?: string }}
 */
function evaluateShiftRecord(date, period, checkInTime, checkOutTime) {
    if (!checkInTime || !checkOutTime) {
        return { valid: false, reason: '开始和结束时间都需要填写。' };
    }

    const inMins = timeStrToMins(checkInTime);
    const outMins = timeStrToMins(checkOutTime);
    if (outMins <= inMins) {
        return { valid: false, reason: '结束时间需要晚于开始时间。' };
    }

    const dayData = getCheckinDaySnapshot(date);
    return {
        valid: true,
        inStatus: getCheckInStatusForTime(dayData, period, inMins),
        outStatus: getCheckOutStatusForTimes(dayData, period, inMins, outMins)
    };
}

/**
 * 将状态枚举映射成更适合界面展示的文案和视觉级别。
 * @param {string} inStatus
 * @param {string} outStatus
 * @returns {{ text: string, tone: 'success'|'warning'|'danger'|'info', detail: string }}
 */
function summarizeShiftStatuses(inStatus, outStatus) {
    if (inStatus === 'danger' || outStatus === 'danger') {
        return { text: '异常', tone: 'danger', detail: '时长不足或存在明显异常，提交后会被系统标红。' };
    }

    if (inStatus === 'warning' || outStatus === 'warning') {
        return { text: '警告', tone: 'warning', detail: '会保留记录，但会按警告计入今日与统计口径。超出弹性窗口的迟到、早退或晚退都会落到这里。' };
    }

    if (inStatus === 'excused' || outStatus === 'excused') {
        return { text: '离舰豁免', tone: 'info', detail: '补录会沿用分段离舰覆盖逻辑，结果将标记为豁免。' };
    }

    return { text: '合规', tone: 'success', detail: '这条补录会被系统视作正常有效记录。' };
}

/**
 * 把完整班次结果写入指定日期。
 * @param {string} date
 * @param {'morning'|'afternoon'|'evening'} period
 * @param {{ checkIn?: string|null, checkOut?: string|null, inStatus?: string|null, outStatus?: string|null, entrySource?: 'live'|'retro', correctionReason?: string }} payload
 */
function applyShiftRecord(date, period, payload) {
    const nowIso = new Date().toISOString();
    runtimeActions.updateCheckinDay(date, (existingDayData) => {
        const dayData = ensureDayRecord(existingDayData);
        const record = {
            ...dayData[period],
            status: { ...dayData[period].status }
        };

        if (typeof payload.checkIn === 'string') record.checkIn = payload.checkIn;
        if (typeof payload.checkOut === 'string') record.checkOut = payload.checkOut;
        if (typeof payload.inStatus === 'string') record.status.checkIn = payload.inStatus;
        if (typeof payload.outStatus === 'string') record.status.checkOut = payload.outStatus;

        record.entrySource = payload.entrySource || record.entrySource || 'live';
        record.updatedAt = nowIso;
        record.correctionReason = payload.entrySource === 'retro'
            ? payload.correctionReason || ''
            : '';

        return {
            ...dayData,
            [period]: record
        };
    }, createEmptyDayRecord);
}

/**
 * 判断最近一周是否每天都有至少一次打卡，用于周总结彩蛋。
 * @returns {boolean}
 */
function isThisWeekPerfect() {
    const todayDate = new Date();
    for (let i = 0; i < 7; i++) {
        const checkDate = new Date(todayDate);
        checkDate.setDate(todayDate.getDate() - i);
        const dayData = checkinData[formatLocalDate(checkDate)];

        if (!dayData) return false;
        if (dayData.leave) continue;

        const checkedIn = dayData.morning.checkIn || dayData.afternoon.checkIn || dayData.evening.checkIn;
        if (!checkedIn) return false;
    }
    return true;
}
