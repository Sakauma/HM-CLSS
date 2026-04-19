/**
 * 统计控制器模块。
 * 负责连接周期按钮、顶部摘要和图表渲染入口。
 */

const STATS_PERIOD_BUTTON_ACTIVE_CLASS = 'stats-period-btn bg-white dark:bg-slate-700 text-slate-900 dark:text-white py-1.5 px-5 rounded-lg font-medium shadow-sm text-sm transition-all';
const STATS_PERIOD_BUTTON_IDLE_CLASS = 'stats-period-btn text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-1.5 px-5 rounded-lg font-medium text-sm transition-all';

function setActiveStatsPeriodButton(activeBtn) {
    document.querySelectorAll('.stats-period-btn').forEach((button) => {
        button.className = button === activeBtn ? STATS_PERIOD_BUTTON_ACTIVE_CLASS : STATS_PERIOD_BUTTON_IDLE_CLASS;
    });
}

function getActiveStatsPeriod() {
    const activePeriodBtn = document.querySelector('.stats-period-btn.bg-white, .stats-period-btn.bg-slate-700');
    return activePeriodBtn?.getAttribute('data-period') || 'week';
}

/**
 * 绑定统计周期按钮，并初始化顶部摘要数据。
 */
function initStatistics() {
    document.querySelectorAll('.stats-period-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            setActiveStatsPeriodButton(btn);
            updateStatisticsCharts(btn.getAttribute('data-period'));
        });
    });

    updateSummaryStatistics();
}

/**
 * 在统计面板可见时刷新当前图表，否则只刷新顶部摘要数字。
 */
function refreshStatisticsView() {
    updateSummaryStatistics();

    const statsSection = document.getElementById('stats-section');
    if (!statsSection || statsSection.classList.contains('hidden')) return;

    updateStatisticsCharts(getActiveStatsPeriod());
}

/**
 * 对外暴露的统计图刷新入口。
 * @param {'week'|'month'|'year'} period
 */
function updateStatisticsCharts(period) {
    renderStatisticsCharts(period);
}

/**
 * 刷新统计面板顶部的总览数字。
 */
function updateSummaryStatistics() {
    const summary = buildSummaryStatisticsSnapshot();

    document.getElementById('total-checkin-days').textContent = summary.checkinDays;
    document.getElementById('total-task-hours').textContent = summary.taskHours;

    const eggElement = document.getElementById('space-survival-egg');
    if (eggElement) {
        eggElement.innerHTML = `🛸 折合飞船 <b>${summary.sols} Sols</b> 维生能源`;
    }

    document.getElementById('total-phone-resist').textContent = summary.phoneResistCount;
    document.getElementById('achievement-count').textContent = summary.achievementCount;
}
