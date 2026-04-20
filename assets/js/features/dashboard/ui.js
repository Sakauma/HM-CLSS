/**
 * 首页界面聚合层。
 * 负责把首页状态和速记列表刷新收口到统一入口。
 */

function refreshDashboardHome() {
    updateTodayStatus();
    if (typeof updateQuickNotesList === 'function') {
        updateQuickNotesList();
    }
}
