/**
 * 统计控制器模块。
 * 负责连接周期按钮、顶部摘要和图表渲染入口。
 */

const STATS_PERIOD_BUTTON_ACTIVE_CLASS = 'stats-period-btn stats-period-btn-active';
const STATS_PERIOD_BUTTON_IDLE_CLASS = 'stats-period-btn stats-period-btn-idle';

function setActiveStatsPeriodButton(activeBtn) {
    document.querySelectorAll('.stats-period-btn').forEach((button) => {
        button.className = button === activeBtn ? STATS_PERIOD_BUTTON_ACTIVE_CLASS : STATS_PERIOD_BUTTON_IDLE_CLASS;
    });
}

function getActiveStatsPeriod() {
    const activePeriodBtn = document.querySelector('.stats-period-btn-active');
    return activePeriodBtn?.getAttribute('data-period') || 'week';
}

/**
 * 绑定统计周期按钮，并初始化顶部摘要数据。
 */
function initStatistics() {
    const disposables = createDisposables();
    document.querySelectorAll('.stats-period-btn').forEach((btn) => {
        disposables.listen(btn, 'click', () => {
            setActiveStatsPeriodButton(btn);
            updateStatisticsCharts(btn.getAttribute('data-period'));
        });
    });

    updateSummaryStatistics();
    return () => {
        disposables.dispose();
    };
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
        eggElement.replaceChildren(
            document.createTextNode('🛸 折合飞船 '),
            createDomElement('b', { text: `${summary.sols} Sols` }),
            document.createTextNode(' 维生能源')
        );
    }

    document.getElementById('total-phone-resist').textContent = summary.phoneResistCount;
    document.getElementById('achievement-count').textContent = summary.achievementCount;
}

registerAppModule({
    id: 'statistics',
    order: 70,
    init: initStatistics
});
