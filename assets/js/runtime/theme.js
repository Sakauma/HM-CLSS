/**
 * 主题模块。
 * 负责在系统偏好、本地显式选择和统计图重绘之间保持一致。
 */

lucide.createIcons();

const themeToggleBtn = document.getElementById('theme-toggle');
const htmlElement = document.documentElement;
const systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

function refreshThemeDependentCharts() {
    if (!window.checkinRateChart) return;
    const activePeriodBtn = document.querySelector('.stats-period-btn-active');
    if (activePeriodBtn) {
        updateStatisticsCharts(activePeriodBtn.getAttribute('data-period'));
    }
}

/**
 * 根据当前主题切换页头图标显隐状态。
 */
function updateThemeIcon() {
    const iconDark = document.getElementById('theme-icon-dark');
    const iconLight = document.getElementById('theme-icon-light');

    if (htmlElement.classList.contains('dark')) {
        if (iconLight) iconLight.classList.add('hidden');
        if (iconDark) iconDark.classList.remove('hidden');
    } else {
        if (iconDark) iconDark.classList.add('hidden');
        if (iconLight) iconLight.classList.remove('hidden');
    }
}

function syncThemeToggleAccessibility() {
    if (!themeToggleBtn) return;

    const isDark = htmlElement.classList.contains('dark');
    const label = isDark ? '切换到浅色模式' : '切换到深色模式';
    themeToggleBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    themeToggleBtn.setAttribute('aria-label', label);
    themeToggleBtn.setAttribute('title', label);
}

// 首次进入页面时优先恢复用户显式选择，否则退回系统主题偏好。
if (localStorage.theme === 'dark' || (!('theme' in localStorage) && systemThemeMediaQuery.matches)) {
    htmlElement.classList.add('dark');
} else {
    htmlElement.classList.remove('dark');
}

updateThemeIcon();
syncThemeToggleAccessibility();

function handleThemeToggleClick() {
    htmlElement.classList.toggle('dark');
    localStorage.theme = htmlElement.classList.contains('dark') ? 'dark' : 'light';
    updateThemeIcon();
    syncThemeToggleAccessibility();
    refreshThemeDependentCharts();
}

function handleSystemThemeChange(event) {
    if (!('theme' in localStorage)) {
        if (event.matches) {
            htmlElement.classList.add('dark');
        } else {
            htmlElement.classList.remove('dark');
        }

        updateThemeIcon();
        syncThemeToggleAccessibility();
        refreshThemeDependentCharts();
    }
}

function initThemeModule() {
    const disposables = createDisposables();
    disposables.listen(themeToggleBtn, 'click', handleThemeToggleClick);
    disposables.listen(systemThemeMediaQuery, 'change', handleSystemThemeChange);
    return () => {
        disposables.dispose();
    };
}

function registerThemeModule() {
    registerAppModule({
        id: 'runtime-theme',
        order: 15,
        init: initThemeModule
    });
}

if (typeof registerAppModule === 'function') {
    registerThemeModule();
} else {
    if (!Array.isArray(window.__hmClssDeferredModuleRegistrars)) {
        window.__hmClssDeferredModuleRegistrars = [];
    }
    window.__hmClssDeferredModuleRegistrars.push(registerThemeModule);
}
