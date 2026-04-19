/**
 * 统计图表渲染模块。
 * 负责把已聚合的数据交给 Chart.js，并维护图表实例的销毁与重建。
 */

function applyStatisticsChartTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    Chart.defaults.color = isDark ? '#94a3b8' : '#64748b';
    Chart.defaults.borderColor = isDark ? '#334155' : '#e2e8f0';
}

/**
 * 根据所选周期统一刷新所有统计图。
 * @param {'week'|'month'|'year'} period
 */
function renderStatisticsCharts(period) {
    applyStatisticsChartTheme();

    const { startDate, endDate, labels } = getDateRange(period);

    try { updateCheckinRateChart(labels, prepareCheckinRateData(startDate, endDate, labels)); } catch (error) { console.error(error); }
    try { updateCheckinPeriodChart(prepareCheckinPeriodData(startDate, endDate)); } catch (error) { console.error(error); }
    try { updateTaskDurationChart(labels, prepareTaskDurationData(startDate, endDate, labels)); } catch (error) { console.error(error); }
    try { updatePhoneResistChart(labels, preparePhoneResistData(startDate, endDate, labels)); } catch (error) { console.error(error); }
    try { updateTagChart(prepareTagData(startDate, endDate)); } catch (error) { console.error(error); }
}

/**
 * 渲染打卡合规率折线图。
 * @param {string[]} labels
 * @param {(number|null)[]} data
 */
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

/**
 * 渲染不同班次的打卡数量对比图。
 * @param {{ m: { i: number, q: number }, a: { i: number, q: number }, e: { i: number, q: number } }} data
 */
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

/**
 * 渲染任务时长柱状图。
 * @param {string[]} labels
 * @param {number[]} data
 */
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

/**
 * 渲染抗干扰次数折线图。
 * @param {string[]} labels
 * @param {number[]} data
 */
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

/**
 * 渲染任务标签分布图。
 * 当没有数据时，使用占位分片保证图表结构稳定。
 * @param {number[]} data
 */
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
