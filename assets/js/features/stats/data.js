/**
 * 统计数据聚合模块。
 * 负责按时间范围汇总值班、任务和抗干扰数据，不直接触碰 DOM 或图表实例。
 */

/**
 * 生成顶部摘要所需的聚合快照。
 * @returns {{ checkinDays: number, taskHours: number, sols: string, phoneResistCount: number, achievementCount: number }}
 */
function buildSummaryStatisticsSnapshot() {
    const totalHours = calculateTotalTaskHours();
    return {
        checkinDays: countCheckinDays(),
        taskHours: totalHours,
        sols: (totalHours * 1.5).toFixed(1),
        phoneResistCount: phoneResistData.totalCount,
        achievementCount: achievements.length
    };
}
