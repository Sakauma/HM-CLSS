/**
 * 统计聚合核心。
 * 负责合规判定、范围汇总和图表数据准备。
 */

function isQualifiedCheckinStatus(status) {
    const normalized = getNormalizedCheckInStatus(status);
    return normalized === 'success' || normalized === 'warning' || normalized === 'excused';
}

function isQualifiedCheckoutStatus(status) {
    return status === true || status === 'success' || status === 'warning';
}

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
