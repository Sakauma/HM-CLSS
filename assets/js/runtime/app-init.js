/**
 * 应用启动编排。
 * 负责在 DOM 就绪后按依赖顺序初始化各模块与全局交互。
 */

function updateDateTime() {
    const now = new Date();
    const options = { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' };
    document.getElementById('current-date-time').textContent = now.toLocaleDateString('zh-CN', options);
    updateCheckinButtons();
    if (typeof updateVoyageAmbientPresentation === 'function') {
        updateVoyageAmbientPresentation();
    }
}

function bindSummaryModalControls() {
    document.getElementById('close-daily-modal')?.addEventListener('click', () => {
        document.getElementById('daily-summary-modal')?.classList.add('hidden');
    });
    document.getElementById('close-weekly-modal')?.addEventListener('click', () => {
        document.getElementById('weekly-summary-modal')?.classList.add('hidden');
    });
}

registerAppModule({
    id: 'runtime-clock',
    order: 10,
    init() {
        updateDateTime();
        setInterval(updateDateTime, 1000);
    }
});

registerAppModule({
    id: 'dashboard-home',
    order: 100,
    init() {
        updateTodayStatus();
        updateQuickNotesList();
    }
});

registerAppModule({
    id: 'cloud-startup',
    order: 110,
    init() {
        autoPullOnStartup();
    }
});

registerAppModule({
    id: 'summary-modals',
    order: 120,
    init: bindSummaryModalControls
});

function initApp() {
    initData();
    initializeAppModules();
}

document.addEventListener('DOMContentLoaded', initApp);
