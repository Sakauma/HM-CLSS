/**
 * 导航模块。
 * 负责左侧导航、右侧面板元信息以及各主视图间的切换体验。
 */

/**
 * 初始化导航按钮，并把“面板说明区”的内容和当前激活模块保持同步。
 */
function initNavigation() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // 每个导航项既定义跳转目标，也定义右侧说明区的文案和快捷操作。
    const navigationItems = [
        {
            btnId: 'nav-checkin',
            sectionId: 'checkin-section',
            hotkey: 'Alt+1',
            badge: 'TODAY OPS',
            title: '舰桥值班与今日状态',
            desc: '主动作在首屏。',
            tip: '当前班次优先。',
            primaryAction: { href: '#shift-ops-grid', icon: 'target', label: '进入班次控制' },
            secondaryAction: { href: '#today-checkin-log', icon: 'list-checks', label: '查看今日记录' }
        },
        {
            btnId: 'nav-phone',
            sectionId: 'phone-section',
            hotkey: 'Alt+2',
            badge: 'FOCUS SHIELD',
            title: '认知干扰拦截',
            desc: '挡下一次，记一笔。',
            tip: '先记当下。',
            primaryAction: { href: '#add-phone-resist', icon: 'shield-check', label: '记录一次拦截' },
            secondaryAction: { href: '#today-phone-resist-times', icon: 'clock-3', label: '查看今日时间戳' }
        },
        {
            btnId: 'nav-tasks',
            sectionId: 'tasks-section',
            hotkey: 'Alt+3',
            badge: 'DEEP WORK',
            title: '全舰任务管理',
            desc: '主线与捕捉都在首屏。',
            tip: '先开主线。',
            primaryAction: { href: '#start-task', icon: 'play', label: '开始一个任务' },
            secondaryAction: { href: '#quick-notes-container', icon: 'lightbulb', label: '打开捕捉池' }
        },
        {
            btnId: 'nav-archive',
            sectionId: 'archive-section',
            hotkey: 'Alt+4',
            badge: 'LOG ARCHIVE',
            title: '全舰日志归档',
            desc: '所有历史，都从这里回看。',
            tip: '关键词优先。',
            primaryAction: { href: '#archive-search-input', icon: 'search', label: '检索历史记录' },
            secondaryAction: { href: '#archive-list-container', icon: 'book-open', label: '浏览全部归档' }
        },
        {
            btnId: 'nav-leave',
            sectionId: 'leave-section',
            hotkey: 'Alt+5',
            badge: 'LEAVE CONTROL',
            title: '离舰活动审批',
            desc: '今天、未来、补录，分线处理。',
            tip: '选对流程就行。',
            primaryAction: { href: '#leave-form-shell', icon: 'calendar-off', label: '打开离舰流程' },
            secondaryAction: { href: '#leave-records-table', icon: 'list', label: '查看历史记录' }
        },
        {
            btnId: 'nav-tavern',
            sectionId: 'tavern-section',
            hotkey: 'Alt+6',
            badge: 'MOOD LAB',
            title: '深空特调吧台',
            desc: '一句情绪，换一杯配方。',
            tip: '给吧台一句样本。',
            primaryAction: { href: '#mood-text-input', icon: 'sparkles', label: '写下当前状态' },
            secondaryAction: { href: '#view-tavern-container', icon: 'martini', label: '查看调制面板' }
        },
        {
            btnId: 'nav-stats',
            sectionId: 'stats-section',
            hotkey: 'Alt+7',
            badge: 'SYSTEM INTEL',
            title: '维生统计分析',
            desc: '看周期，也看趋势。',
            tip: '适合回看。',
            primaryAction: { href: '#stats-period-controls', icon: 'bar-chart-2', label: '切换统计周期' },
            secondaryAction: { href: '#checkin-rate-chart', icon: 'chart-line', label: '查看趋势图' }
        },
        {
            btnId: 'nav-settings',
            sectionId: 'settings-section',
            hotkey: 'Alt+8',
            badge: 'SYNC LINK',
            title: '深空通讯设置',
            desc: '同步入口集中在这里。',
            tip: '上传前，确认本地版本。',
            primaryAction: { href: '#github-token-input', icon: 'key', label: '配置同步凭据' },
            secondaryAction: { href: '#pull-cloud-btn', icon: 'cloud-download', label: '拉取云端数据' }
        }
    ];

    // 切换面板后统一把视口拉回顶部，避免保留上一个面板的滚动位置。
    const scrollCurrentPanelIntoView = () => {
        const scrollingEl = document.scrollingElement || document.documentElement;
        const behavior = prefersReducedMotion.matches ? 'auto' : 'smooth';

        if (scrollingEl && typeof scrollingEl.scrollTo === 'function') {
            scrollingEl.scrollTo({ top: 0, behavior });
            return;
        }

        window.scrollTo(0, 0);
    };

    // 统一处理导航按钮的样式与无障碍状态。
    const setNavButtonState = (button, isActive) => {
        if (!button) return;
        button.className = isActive ? 'nav-rail-button nav-rail-button-active' : 'nav-rail-button';
        button.setAttribute('aria-current', isActive ? 'page' : 'false');
    };

    // 用当前导航项的数据刷新右侧的标题、提示和快捷入口。
    const updatePanelMeta = (item) => {
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
            primaryActionEl.innerHTML = `<i data-lucide="${item.primaryAction.icon}" class="w-4 h-4"></i>${escapeHtml(item.primaryAction.label)}`;
        }

        if (secondaryActionEl) {
            secondaryActionEl.setAttribute('href', item.secondaryAction.href);
            secondaryActionEl.innerHTML = `<i data-lucide="${item.secondaryAction.icon}" class="w-4 h-4"></i>${escapeHtml(item.secondaryAction.label)}`;
        }

        lucide.createIcons();
    };

    // 绑定每个导航按钮的显示/隐藏行为，并在切换时按需刷新对应模块的数据。
    navigationItems.forEach((item) => {
        const button = document.getElementById(item.btnId);
        const section = document.getElementById(item.sectionId);
        if (!button || !section) return;

        if (item.hotkey) {
            button.setAttribute('title', `${item.title} · ${item.hotkey}`);
        }

        button.addEventListener('click', function() {
            navigationItems.forEach((navItem) => {
                const targetSection = document.getElementById(navItem.sectionId);
                const targetButton = document.getElementById(navItem.btnId);

                targetSection?.classList.add('hidden');
                setNavButtonState(targetButton, false);
            });

            section.classList.remove('hidden');
            setNavButtonState(button, true);
            updatePanelMeta(item);
            requestAnimationFrame(scrollCurrentPanelIntoView);

            if (item.sectionId === 'stats-section') {
                const activePeriodBtn = document.querySelector('.stats-period-btn.bg-white, .stats-period-btn.bg-slate-700');
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
}
