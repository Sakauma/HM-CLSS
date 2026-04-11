function initStatistics() {
    document.querySelectorAll('.stats-period-btn').forEach((btn) => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.stats-period-btn').forEach((button) => {
                button.className = 'stats-period-btn text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-1.5 px-5 rounded-lg font-medium text-sm transition-all';
            });
            this.className = 'stats-period-btn bg-white dark:bg-slate-700 text-slate-900 dark:text-white py-1.5 px-5 rounded-lg font-medium shadow-sm text-sm transition-all';
            updateStatisticsCharts(this.getAttribute('data-period'));
        });
    });
    updateSummaryStatistics();
}

function updateStatisticsCharts(period) {
    const isDark = document.documentElement.classList.contains('dark');
    Chart.defaults.color = isDark ? '#94a3b8' : '#64748b';
    Chart.defaults.borderColor = isDark ? '#334155' : '#e2e8f0';

    const { startDate, endDate, labels } = getDateRange(period);

    try { updateCheckinRateChart(labels, prepareCheckinRateData(startDate, endDate, labels)); } catch (error) { console.error(error); }
    try { updateCheckinPeriodChart(prepareCheckinPeriodData(startDate, endDate)); } catch (error) { console.error(error); }
    try { updateTaskDurationChart(labels, prepareTaskDurationData(startDate, endDate, labels)); } catch (error) { console.error(error); }
    try { updatePhoneResistChart(labels, preparePhoneResistData(startDate, endDate, labels)); } catch (error) { console.error(error); }
    try { updateTagChart(prepareTagData(startDate, endDate)); } catch (error) { console.error(error); }
}

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

function calculateCheckinRateForRange(start, end) {
    let total = 0;
    let qualified = 0;
    const current = new Date(start);

    while (current <= end) {
        const day = checkinData[formatLocalDate(current)];
        if (day && !day.leave) {
            ['morning', 'afternoon', 'evening'].forEach((period) => {
                if (day[period].checkIn !== null) {
                    total++;
                    if (day[period].status.checkIn === true || day[period].status.checkIn === 'success') qualified++;
                }
                if (day[period].checkOut !== null) {
                    total++;
                    if (
                        day[period].status.checkOut === true ||
                        day[period].status.checkOut === 'success' ||
                        day[period].status.checkOut === 'warning'
                    ) {
                        qualified++;
                    }
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

        const date = new Date(start);
        if (labels.length === 7) {
            date.setDate(start.getDate() + i);
        } else if (labels.length === 10) {
            date.setDate(start.getDate() + i * 3);
        }

        const ds = formatLocalDate(date);
        const day = checkinData[ds];
        if (!day || day.leave) {
            data.push(null);
        } else {
            let total = 0;
            let qualified = 0;
            ['morning', 'afternoon', 'evening'].forEach((period) => {
                if (day[period].checkIn !== null) {
                    total++;
                    if (day[period].status.checkIn === true || day[period].status.checkIn === 'success') qualified++;
                }
                if (day[period].checkOut !== null) {
                    total++;
                    if (
                        day[period].status.checkOut === true ||
                        day[period].status.checkOut === 'success' ||
                        day[period].status.checkOut === 'warning'
                    ) {
                        qualified++;
                    }
                }
            });
            data.push(total > 0 ? (qualified / total) * 100 : 0);
        }
    }
    return data;
}

function prepareCheckinPeriodData(start, end) {
    const result = { m: { i: 0, q: 0 }, a: { i: 0, q: 0 }, e: { i: 0, q: 0 } };
    const current = new Date(start);
    while (current <= end) {
        const day = checkinData[formatLocalDate(current)];
        if (day && !day.leave) {
            if (day.morning.checkIn) { result.m.i++; if (day.morning.status.checkIn) result.m.q++; }
            if (day.afternoon.checkIn) { result.a.i++; if (day.afternoon.status.checkIn) result.a.q++; }
            if (day.evening.checkIn) { result.e.i++; if (day.evening.status.checkIn) result.e.q++; }
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

        const date = new Date(start);
        if (labels.length === 7) {
            date.setDate(start.getDate() + i);
        } else if (labels.length === 10) {
            date.setDate(start.getDate() + i * 3);
        }
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

        const date = new Date(start);
        if (labels.length === 7) {
            date.setDate(start.getDate() + i);
        } else if (labels.length === 10) {
            date.setDate(start.getDate() + i * 3);
        }
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
    return [tagCounts.paper, tagCounts.code, tagCounts.experiment, tagCounts.write, tagCounts.other].map((minutes) => Number((minutes / 60).toFixed(2)));
}

function updateCheckinRateChart(labels, data) {
    const canvas = document.getElementById('checkin-rate-chart');
    if (!canvas) return;
    if (window.checkinRateChart) window.checkinRateChart.destroy();
    window.checkinRateChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: '打卡合规率(%)',
                data,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
    });
}

function updateCheckinPeriodChart(data) {
    const canvas = document.getElementById('checkin-period-chart');
    if (!canvas) return;
    if (window.checkinPeriodChart) window.checkinPeriodChart.destroy();
    window.checkinPeriodChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['上午', '下午', '晚上'],
            datasets: [
                { label: '总打卡次数', data: [data.m.i, data.a.i, data.e.i], backgroundColor: 'rgba(99, 102, 241, 0.8)' },
                { label: '合格次数', data: [data.m.q, data.a.q, data.e.q], backgroundColor: 'rgba(16, 185, 129, 0.8)' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function updateTaskDurationChart(labels, data) {
    const canvas = document.getElementById('task-duration-chart');
    if (!canvas) return;
    if (window.taskDurationChart) window.taskDurationChart.destroy();
    window.taskDurationChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: '任务时长(小时)', data, backgroundColor: '#6366f1', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function updatePhoneResistChart(labels, data) {
    const canvas = document.getElementById('phone-resist-chart');
    if (!canvas) return;
    if (window.phoneResistChart) window.phoneResistChart.destroy();
    window.phoneResistChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: '克制次数',
                data,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function updateTagChart(data) {
    const canvas = document.getElementById('task-tag-chart');
    if (!canvas) return;
    if (window.taskTagChart) window.taskTagChart.destroy();

    const hasData = data.some((value) => value > 0);
    window.taskTagChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: hasData ? ['文献阅读', '代码构建', '实验跑数', '文档撰写', '杂项'] : ['暂无数据'],
            datasets: [{
                data: hasData ? data : [1],
                backgroundColor: hasData ? ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] : ['#e2e8f0'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12 } },
                tooltip: { enabled: hasData }
            },
            cutout: '75%'
        }
    });
}

function updateSummaryStatistics() {
    document.getElementById('total-checkin-days').textContent = Object.values(checkinData).filter((day) => !day.leave && (day.morning.checkIn || day.afternoon.checkIn || day.evening.checkIn)).length;

    const totalHours = calculateTotalTaskHours();
    document.getElementById('total-task-hours').textContent = totalHours;

    const sols = (totalHours * 1.5).toFixed(1);
    const eggElement = document.getElementById('space-survival-egg');
    if (eggElement) {
        eggElement.innerHTML = `🛸 折合飞船 <b>${sols} Sols</b> 维生能源`;
    }

    document.getElementById('total-phone-resist').textContent = phoneResistData.totalCount;
    document.getElementById('achievement-count').textContent = achievements.length;
}
