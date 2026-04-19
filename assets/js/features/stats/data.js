/**
 * 统计数据聚合模块。
 * 负责按时间范围汇总值班、任务和抗干扰数据，不直接触碰 DOM 或图表实例。
 */

function isQualifiedCheckinStatus(status) {
    const normalized = getNormalizedCheckInStatus(status);
    return normalized === 'success' || normalized === 'warning' || normalized === 'excused';
}

function isQualifiedCheckoutStatus(status) {
    return status === true || status === 'success' || status === 'warning';
}

/**
 * 根据统计周期生成起止日期和横轴标签。
 * @param {'week'|'month'|'year'} period
 * @returns {{ startDate: Date, endDate: Date, labels: string[] }}
 */
function getDateRange(period) {
    const end = new Date();
    const start = new Date();
    const labels = [];

    if (period === 'week') {
        start.setDate(end.getDate() - 6);
        for (let i = 0; i < 7; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            labels.push(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
        }
    } else if (period === 'month') {
        start.setDate(end.getDate() - 29);
        for (let i = 0; i < 30; i += 3) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            labels.push(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
        }
    } else if (period === 'year') {
        start.setDate(1);
        start.setMonth(end.getMonth() - 11);
        for (let i = 0; i < 12; i++) {
            const date = new Date(start);
            date.setMonth(start.getMonth() + i);
            labels.push(date.toLocaleDateString('zh-CN', { month: 'short' }));
        }
    }

    return { startDate: start, endDate: end, labels };
}

/**
 * 生成某个月的完整日期范围，供年度统计按月聚合时复用。
 * @param {Date} baseDate
 * @param {number} offset
 * @returns {{ start: Date, end: Date }}
 */
function getMonthRange(baseDate, offset = 0) {
    const start = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
    const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset + 1, 0);
    return { start, end };
}

function getStatisticsBucketDate(start, labels, index) {
    const date = new Date(start);

    if (labels.length === 7) {
        date.setDate(start.getDate() + index);
    } else if (labels.length === 10) {
        date.setDate(start.getDate() + index * 3);
    }

    return date;
}

/**
 * 计算指定时间范围内的打卡合规率。
 * @param {Date} start
 * @param {Date} end
 * @returns {number}
 */
function calculateCheckinRateForRange(start, end) {
    let total = 0;
    let qualified = 0;
    const current = new Date(start);

    while (current <= end) {
        const day = checkinData[formatLocalDate(current)];
        if (day && !day.leave) {
            ['morning', 'afternoon', 'evening'].forEach((period) => {
                const record = day[period];

                if (record.checkIn !== null) {
                    total++;
                    if (isQualifiedCheckinStatus(record.status.checkIn)) qualified++;
                }

                if (record.checkOut !== null) {
                    total++;
                    if (isQualifiedCheckoutStatus(record.status.checkOut)) qualified++;
                }
            });
        }
        current.setDate(current.getDate() + 1);
    }

    return total > 0 ? (qualified / total) * 100 : 0;
}

/**
 * 统计指定范围内的任务总时长（小时）。
 * @param {Date} start
 * @param {Date} end
 * @returns {number}
 */
function calculateTaskHoursForRange(start, end) {
    const current = new Date(start);
    let totalMinutes = 0;

    while (current <= end) {
        const dayTasks = taskData[formatLocalDate(current)] || [];
        totalMinutes += dayTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
        current.setDate(current.getDate() + 1);
    }

    return totalMinutes / 60;
}

/**
 * 统计指定范围内的抗干扰总次数。
 * @param {Date} start
 * @param {Date} end
 * @returns {number}
 */
function calculatePhoneResistForRange(start, end) {
    const current = new Date(start);
    let totalCount = 0;

    while (current <= end) {
        const dayRecord = phoneResistData.records[formatLocalDate(current)];
        totalCount += dayRecord ? dayRecord.count : 0;
        current.setDate(current.getDate() + 1);
    }

    return totalCount;
}

/**
 * 准备打卡合规率趋势图数据。
 * 周/月视图按日或三天采样，年视图按月聚合。
 * @param {Date} start
 * @param {Date} end
 * @param {string[]} labels
 * @returns {(number|null)[]}
 */
function prepareCheckinRateData(start, end, labels) {
    const data = [];

    for (let i = 0; i < labels.length; i++) {
        if (labels.length === 12) {
            const { start: monthStart, end: monthEnd } = getMonthRange(start, i);
            data.push(calculateCheckinRateForRange(monthStart, monthEnd));
            continue;
        }

        const date = getStatisticsBucketDate(start, labels, i);
        const day = checkinData[formatLocalDate(date)];
        if (!day || day.leave) {
            data.push(null);
            continue;
        }

        let total = 0;
        let qualified = 0;
        ['morning', 'afternoon', 'evening'].forEach((period) => {
            const record = day[period];

            if (record.checkIn !== null) {
                total++;
                if (isQualifiedCheckinStatus(record.status.checkIn)) qualified++;
            }

            if (record.checkOut !== null) {
                total++;
                if (isQualifiedCheckoutStatus(record.status.checkOut)) qualified++;
            }
        });

        data.push(total > 0 ? (qualified / total) * 100 : 0);
    }

    return data;
}

/**
 * 统计不同班次的打卡总次数与合格次数。
 * @param {Date} start
 * @param {Date} end
 * @returns {{ m: { i: number, q: number }, a: { i: number, q: number }, e: { i: number, q: number } }}
 */
function prepareCheckinPeriodData(start, end) {
    const result = { m: { i: 0, q: 0 }, a: { i: 0, q: 0 }, e: { i: 0, q: 0 } };
    const current = new Date(start);

    while (current <= end) {
        const day = checkinData[formatLocalDate(current)];
        if (day && !day.leave) {
            if (day.morning.checkIn) {
                result.m.i++;
                if (isQualifiedCheckinStatus(day.morning.status.checkIn)) result.m.q++;
            }
            if (day.afternoon.checkIn) {
                result.a.i++;
                if (isQualifiedCheckinStatus(day.afternoon.status.checkIn)) result.a.q++;
            }
            if (day.evening.checkIn) {
                result.e.i++;
                if (isQualifiedCheckinStatus(day.evening.status.checkIn)) result.e.q++;
            }
        }
        current.setDate(current.getDate() + 1);
    }

    return result;
}

/**
 * 准备任务时长图数据。
 * @param {Date} start
 * @param {Date} end
 * @param {string[]} labels
 * @returns {number[]}
 */
function prepareTaskDurationData(start, end, labels) {
    const data = [];

    for (let i = 0; i < labels.length; i++) {
        if (labels.length === 12) {
            const { start: monthStart, end: monthEnd } = getMonthRange(start, i);
            data.push(Number(calculateTaskHoursForRange(monthStart, monthEnd).toFixed(2)));
            continue;
        }

        const date = getStatisticsBucketDate(start, labels, i);
        const ds = formatLocalDate(date);
        data.push((taskData[ds] || []).reduce((sum, task) => sum + task.duration, 0) / 60);
    }

    return data;
}

/**
 * 准备抗干扰次数趋势图数据。
 * @param {Date} start
 * @param {Date} end
 * @param {string[]} labels
 * @returns {number[]}
 */
function preparePhoneResistData(start, end, labels) {
    const data = [];

    for (let i = 0; i < labels.length; i++) {
        if (labels.length === 12) {
            const { start: monthStart, end: monthEnd } = getMonthRange(start, i);
            data.push(calculatePhoneResistForRange(monthStart, monthEnd));
            continue;
        }

        const date = getStatisticsBucketDate(start, labels, i);
        const ds = formatLocalDate(date);
        data.push(phoneResistData.records[ds] ? phoneResistData.records[ds].count : 0);
    }

    return data;
}

/**
 * 按任务标签汇总时长，供甜甜圈图展示。
 * @param {Date} start
 * @param {Date} end
 * @returns {number[]}
 */
function prepareTagData(start, end) {
    const tagCounts = { paper: 0, code: 0, experiment: 0, write: 0, other: 0 };
    const current = new Date(start);

    while (current <= end) {
        const dayTasks = taskData[formatLocalDate(current)] || [];
        dayTasks.forEach((task) => {
            if (task.duration) tagCounts[task.tag || 'other'] += task.duration;
        });
        current.setDate(current.getDate() + 1);
    }

    return [tagCounts.paper, tagCounts.code, tagCounts.experiment, tagCounts.write, tagCounts.other]
        .map((minutes) => Number((minutes / 60).toFixed(2)));
}

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
