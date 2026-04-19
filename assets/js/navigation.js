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
            badge: 'TODAY OPS',
            title: '舰桥值班与今日状态',
            desc: '先判断当前属于哪个班次，再直接完成连线或登出，记录表留给核对时再看。',
            tip: '主按钮已经前置到首屏，先处理当前班次，再回看下方表格确认异常。',
            primaryAction: { href: '#shift-ops-grid', icon: 'target', label: '进入班次控制' },
            secondaryAction: { href: '#today-checkin-log', icon: 'list-checks', label: '查看今日记录' }
        },
        {
            btnId: 'nav-phone',
            sectionId: 'phone-section',
            badge: 'FOCUS SHIELD',
            title: '认知干扰拦截',
            desc: '累计数字和主按钮都在首屏，每次成功挡下干扰后就立即记一笔。',
            tip: '先记录拦截，再去看今日时间戳和成就进度，不要把主动作埋到下面。',
            primaryAction: { href: '#add-phone-resist', icon: 'shield-check', label: '记录一次拦截' },
            secondaryAction: { href: '#today-phone-resist-times', icon: 'clock-3', label: '查看今日时间戳' }
        },
        {
            btnId: 'nav-tasks',
            sectionId: 'tasks-section',
            badge: 'DEEP WORK',
            title: '全舰任务管理',
            desc: '开始任务、进行中状态和速记入口都放到首屏，日志与时间映射退到下层复盘。',
            tip: '先启动任务计时，有新念头再丢进捕捉池；历史日志不用抢占第一眼视野。',
            primaryAction: { href: '#start-task', icon: 'play', label: '开始一个任务' },
            secondaryAction: { href: '#quick-notes-container', icon: 'lightbulb', label: '打开捕捉池' }
        },
        {
            btnId: 'nav-archive',
            sectionId: 'archive-section',
            badge: 'LOG ARCHIVE',
            title: '全舰日志归档',
            desc: '把历史灵感、日志与异常集中检索，避免信息沉到看不见的地方。',
            tip: '如果你记得的是关键词而不是日期，就从这里开始找。',
            primaryAction: { href: '#archive-search-input', icon: 'search', label: '检索历史记录' },
            secondaryAction: { href: '#archive-list-container', icon: 'book-open', label: '浏览全部归档' }
        },
        {
            btnId: 'nav-leave',
            sectionId: 'leave-section',
            badge: 'LEAVE CONTROL',
            title: '离舰活动审批',
            desc: '今天、预请假和补请假已经拆成三条流程，默认入口只处理当天，历史修正不会再混进来。',
            tip: '先选对流程，再提交记录。今天走今日离舰，未来走预请假，过去修正走补请假。',
            primaryAction: { href: '#leave-form-shell', icon: 'calendar-off', label: '打开离舰流程' },
            secondaryAction: { href: '#leave-records-table', icon: 'list', label: '查看历史记录' }
        },
        {
            btnId: 'nav-tavern',
            sectionId: 'tavern-section',
            badge: 'MOOD LAB',
            title: '深空特调吧台',
            desc: '先写一句当前状态，再决定是否开始调制和保存酒单，输入区保持首屏可用。',
            tip: '当你说不清自己为什么累时，先写样本，再让结果卡替你做更具体的翻译。',
            primaryAction: { href: '#mood-text-input', icon: 'sparkles', label: '写下当前状态' },
            secondaryAction: { href: '#view-tavern-container', icon: 'martini', label: '查看调制面板' }
        },
        {
            btnId: 'nav-stats',
            sectionId: 'stats-section',
            badge: 'SYSTEM INTEL',
            title: '维生统计分析',
            desc: '先切换统计周期，再看趋势图和总览指标，复盘信息不再和高频操作抢首屏。',
            tip: '这里适合做阶段复盘，不适合做即时操作，所以先看周期和趋势再决定要不要深挖。',
            primaryAction: { href: '#stats-period-controls', icon: 'bar-chart-2', label: '切换统计周期' },
            secondaryAction: { href: '#checkin-rate-chart', icon: 'chart-line', label: '查看趋势图' }
        },
        {
            btnId: 'nav-settings',
            sectionId: 'settings-section',
            badge: 'SYNC LINK',
            title: '深空通讯设置',
            desc: '同步凭据、拉取和推送操作都放在同一区域里，先确认风险再执行上传覆盖。',
            tip: '最危险的是上传覆盖，先确认本地版本正确，再把它推到云端。',
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
