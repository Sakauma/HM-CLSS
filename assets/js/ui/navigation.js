/**
 * 导航模块。
 * 负责左侧导航、右侧面板元信息以及各主视图间的切换体验。
 */

/**
 * 初始化导航按钮，并把“面板说明区”的内容和当前激活模块保持同步。
 */
function initNavigation() {
    const disposables = createDisposables();
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const navigationItems = NAVIGATION_ITEMS;
    const scrollCurrentPanelIntoView = createNavigationScroller(prefersReducedMotion);

    // 绑定每个导航按钮的显示/隐藏行为，并在切换时按需刷新对应模块的数据。
    navigationItems.forEach((item) => {
        const button = document.getElementById(item.btnId);
        const section = document.getElementById(item.sectionId);
        if (!button || !section) return;

        if (item.hotkey) {
            button.setAttribute('title', `${item.title} · ${item.hotkey}`);
        }
        button.setAttribute('aria-controls', item.sectionId);
        button.setAttribute('aria-label', item.hotkey ? `${item.title}，快捷键 ${item.hotkey}` : item.title);
        section.setAttribute('aria-hidden', button.id === navigationItems[0].btnId ? 'false' : 'true');

        disposables.listen(button, 'click', function() {
            navigationItems.forEach((navItem) => {
                const targetSection = document.getElementById(navItem.sectionId);
                const targetButton = document.getElementById(navItem.btnId);

                targetSection?.classList.add('hidden');
                targetSection?.setAttribute('aria-hidden', 'true');
                setNavButtonState(targetButton, false);
            });

            section.classList.remove('hidden');
            section.setAttribute('aria-hidden', 'false');
            setNavButtonState(button, true);
            updatePanelMeta(item);
            requestAnimationFrame(scrollCurrentPanelIntoView);

            if (item.sectionId === 'stats-section') {
                const activePeriodBtn = document.querySelector('.stats-period-btn-active');
                if (activePeriodBtn) {
                    updateStatisticsCharts(activePeriodBtn.getAttribute('data-period'));
                }
            }

            if (item.sectionId === 'archive-section') {
                renderArchive();
            }

            if (item.sectionId === 'tavern-section') {
                const inputEl = document.getElementById('mood-text-input');
                const countEl = document.getElementById('mood-char-count');
                const analyzeBtn = document.getElementById('btn-start-analyze');

                if (typeof switchTavernState === 'function') {
                    switchTavernState('state-input');
                }

                if (countEl && inputEl) countEl.textContent = String(inputEl.value.length);
                if (analyzeBtn && inputEl) analyzeBtn.disabled = inputEl.value.trim().length === 0;
            }
        });
    });

    // 首次加载时默认展示第一个面板，并初始化对应说明。
    updatePanelMeta(navigationItems[0]);
    setNavButtonState(document.getElementById(navigationItems[0].btnId), true);

    return () => {
        disposables.dispose();
    };
}

registerAppModule({
    id: 'navigation',
    order: 20,
    init: initNavigation
});
