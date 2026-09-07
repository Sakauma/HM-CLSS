/**
 * 工作区条目共用工具。
 * 负责按日期维护任务/速记这类日粒度集合，并提供轻量刷新辅助。
 */

function getDailyEntries(store, dateKey) {
    return store[dateKey] || [];
}

function formatDurationLabel(durationMins) {
    const safeDuration = Number.isFinite(durationMins) ? durationMins : 0;
    const hours = Math.floor(safeDuration / 60);
    const minutes = safeDuration % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function rerenderVisiblePanel(sectionId, renderFn) {
    const section = document.getElementById(sectionId);
    if (!section || section.classList.contains('hidden') || typeof renderFn !== 'function') {
        return;
    }

    renderFn();
}
