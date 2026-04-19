/**
 * 工作区条目共用工具。
 * 负责按日期维护任务/速记这类日粒度集合，并提供轻量刷新辅助。
 */

function getDailyEntries(store, dateKey) {
    return store[dateKey] || [];
}

function ensureDailyEntries(store, dateKey) {
    if (!Array.isArray(store[dateKey])) {
        store[dateKey] = [];
    }
    return store[dateKey];
}

function appendDailyEntry(store, dateKey, entry) {
    const entries = ensureDailyEntries(store, dateKey);
    entries.push(entry);
    return entry;
}

function prependDailyEntry(store, dateKey, entry) {
    const entries = ensureDailyEntries(store, dateKey);
    entries.unshift(entry);
    return entry;
}

function removeDailyEntry(store, dateKey, index) {
    const entries = store[dateKey];
    if (!Array.isArray(entries) || index < 0 || index >= entries.length) {
        return null;
    }

    const [removed] = entries.splice(index, 1);
    if (!entries.length) {
        delete store[dateKey];
    }

    return removed || null;
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
