/**
 * 值班渲染聚合层。
 * 负责把按钮、表格、补录面板和首页摘要刷新收口到统一入口。
 */

function refreshCheckinViews(options = {}) {
    const {
        includeStatus = true,
        includeRetro = true
    } = options;

    updateCheckinButtons();
    updateTodayCheckinTable();

    if (includeRetro) {
        updateRetroCheckinPanel();
    }

    if (includeStatus && typeof updateTodayStatus === 'function') {
        updateTodayStatus();
    }
}
