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
        refreshDashboardHome();
    }
});

registerAppModule({
    id: 'summary-modals',
    order: 110,
    init: bindSummaryModalControls
});

function initApp() {
    initData();
    try {
        initializeAppModules();
        window.__hmClssInitError = null;
    } catch (error) {
        window.__hmClssInitError = {
            name: error?.name || 'Error',
            message: error?.message || String(error)
        };
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', initApp);
