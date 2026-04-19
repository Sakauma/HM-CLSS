/**
 * 离舰规则模块。
 * 负责工作流状态、日期校验与离舰状态重建。
 */

let activeLeaveWorkflow = 'today';

/**
 * 根据 leaveData 中的现存记录，重建指定日期的离舰联动状态。
 * @param {string} date
 */
function rebuildLeaveStateForDate(date) {
    const dayData = ensureCheckinDay(date);
    const sameDayLeaves = leaveData
        .filter((leave) => leave.date === date)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const fullLeave = sameDayLeaves.find((leave) => leave.type === 'full') || null;
    const partialLeaves = sameDayLeaves
        .filter((leave) => leave.type === 'partial')
        .map((leave) => normalizeLeaveRecord(leave, true));

    dayData.partialLeaves = partialLeaves;
    if (fullLeave) {
        dayData.leave = true;
        dayData.leaveReason = fullLeave.reason;
        dayData.leaveMeta = {
            requestMode: fullLeave.requestMode || 'normal',
            createdAt: fullLeave.createdAt || null,
            correctionNote: fullLeave.correctionNote || ''
        };
    } else {
        dayData.leave = false;
        dayData.leaveReason = '';
        dayData.leaveMeta = null;
    }
}

/**
 * 校验当前工作流对应的目标日期是否合理。
 * @param {'today'|'planned'|'retro'} workflow
 * @param {string} date
 * @returns {{ valid: boolean, reason: string }}
 */
function validateLeaveTargetDate(workflow, date) {
    const today = getTodayString();
    if (!date) return { valid: false, reason: '先选一个离舰日期。' };

    const diff = getDateDiffInDays(date, today);
    if (workflow === 'today' && date !== today) {
        return { valid: false, reason: '今日离舰这条流程只接受今天。' };
    }
    if (workflow === 'planned' && diff >= 0) {
        return { valid: false, reason: '预请假只收未来日期。' };
    }
    if (workflow === 'retro' && diff <= 0) {
        return { valid: false, reason: '补请假只收过去日期。' };
    }

    return { valid: true, reason: '' };
}
