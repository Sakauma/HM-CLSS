/**
 * 导航界面层。
 * 负责导航按钮状态和右侧说明区刷新。
 */

function createNavigationScroller(prefersReducedMotion) {
    return () => {
        const scrollingEl = document.scrollingElement || document.documentElement;
        const behavior = prefersReducedMotion.matches ? 'auto' : 'smooth';

        if (scrollingEl && typeof scrollingEl.scrollTo === 'function') {
            scrollingEl.scrollTo({ top: 0, behavior });
            return;
        }

        window.scrollTo(0, 0);
    };
}

function setNavButtonState(button, isActive) {
    if (!button) return;
    button.className = isActive ? 'nav-rail-button nav-rail-button-active' : 'nav-rail-button';
    button.setAttribute('aria-current', isActive ? 'page' : 'false');
    button.setAttribute('aria-expanded', isActive ? 'true' : 'false');
}

function updatePanelMeta(item) {
    const badgeEl = document.getElementById('panel-meta-badge');
    const titleEl = document.getElementById('panel-meta-title');
    const descEl = document.getElementById('panel-meta-desc');
    const tipEl = document.getElementById('panel-meta-tip');
    const primaryActionEl = document.getElementById('panel-primary-action');
    const secondaryActionEl = document.getElementById('panel-secondary-action');

    if (badgeEl) badgeEl.textContent = item.badge;
    if (titleEl) titleEl.textContent = item.title;
    if (descEl) descEl.textContent = item.desc;
    if (tipEl) tipEl.textContent = item.tip;

    if (primaryActionEl) {
        primaryActionEl.setAttribute('href', item.primaryAction.href);
        setElementIconLabel(primaryActionEl, item.primaryAction.icon, item.primaryAction.label);
    }

    if (secondaryActionEl) {
        secondaryActionEl.setAttribute('href', item.secondaryAction.href);
        setElementIconLabel(secondaryActionEl, item.secondaryAction.icon, item.secondaryAction.label);
    }

    lucide.createIcons();
}
