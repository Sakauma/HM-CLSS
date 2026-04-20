/**
 * 统计时间范围工具。
 * 负责统计周期、月度范围和横轴采样点计算。
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
