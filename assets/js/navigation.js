function initNavigation() {
    const navigationItems = [
        {
            btnId: 'nav-checkin',
            sectionId: 'checkin-section',
            badge: 'TODAY OPS',
            title: '舰桥值班与今日状态',
            desc: '先看今天是否合规，再执行当前班次的唤醒与休眠。',
            tip: '建议先完成当前班次，再回看记录表确认今天是否合规。',
            primaryAction: { href: '#shift-ops-grid', icon: 'target', label: '进入班次控制' },
            secondaryAction: { href: '#today-checkin-log', icon: 'list-checks', label: '查看今日记录' }
        },
        {
            btnId: 'nav-phone',
            sectionId: 'phone-section',
            badge: 'FOCUS SHIELD',
            title: '认知干扰拦截',
            desc: '记录今天成功挡下了多少次碎片化诱惑，并追踪长期成就。',
            tip: '高频操作只有一个：每次成功克制后立刻记一笔，别等到回忆时补录。',
            primaryAction: { href: '#add-phone-resist', icon: 'shield-check', label: '记录一次拦截' },
            secondaryAction: { href: '#achievements-list', icon: 'award', label: '查看成就进度' }
        },
        {
            btnId: 'nav-tasks',
            sectionId: 'tasks-section',
            badge: 'DEEP WORK',
            title: '全舰任务管理',
            desc: '把当前任务、今日任务沉淀和速记入口放到同一条专注链路里。',
            tip: '先填任务并开始计时，过程中有新念头时直接用 Ctrl+K 扔进捕捉池。',
            primaryAction: { href: '#task-name', icon: 'play', label: '开始一个任务' },
            secondaryAction: { href: '#current-task-container', icon: 'timer', label: '查看进行中任务' }
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
            desc: '登记全天或临时离舰，明确哪些班次因此被豁免。',
            tip: '如果今天不在岗，先登记离舰，再返回值班日志查看系统如何判定。',
            primaryAction: { href: '#leave-date', icon: 'calendar-off', label: '登记离舰' },
            secondaryAction: { href: '#leave-records-table', icon: 'list', label: '查看历史记录' }
        },
        {
            btnId: 'nav-tavern',
            sectionId: 'tavern-section',
            badge: 'MOOD LAB',
            title: '深空特调吧台',
            desc: '把情绪和体感整理成更容易回看的配方，保留世界观但不牺牲理解。',
            tip: '当你不知道自己为什么累的时候，这里比一句“有点烦”更有信息量。',
            primaryAction: { href: '#mood-text-input', icon: 'sparkles', label: '写下当前状态' },
            secondaryAction: { href: '#view-tavern-container', icon: 'martini', label: '查看调制面板' }
        },
        {
            btnId: 'nav-stats',
            sectionId: 'stats-section',
            badge: 'SYSTEM INTEL',
            title: '维生统计分析',
            desc: '把出勤、专注和干扰拦截串成趋势，而不是只看单天波动。',
            tip: '如果你想做复盘而不是记流水账，这里才是答案真正聚合的地方。',
            primaryAction: { href: '#stats-period-controls', icon: 'bar-chart-2', label: '切换统计周期' },
            secondaryAction: { href: '#checkin-rate-chart', icon: 'chart-line', label: '查看趋势图' }
        },
        {
            btnId: 'nav-settings',
            sectionId: 'settings-section',
            badge: 'SYNC LINK',
            title: '深空通讯设置',
            desc: '配置 Gist 令牌与同步入口，让本地与云端之间的状态足够透明。',
            tip: '危险操作是上传覆盖，所以在推云前先确认本地数据就是你要保留的版本。',
            primaryAction: { href: '#github-token-input', icon: 'key', label: '配置同步凭据' },
            secondaryAction: { href: '#pull-cloud-btn', icon: 'cloud-download', label: '拉取云端数据' }
        }
    ];

    const setNavButtonState = (button, isActive) => {
        if (!button) return;
        button.className = isActive ? 'nav-rail-button nav-rail-button-active' : 'nav-rail-button';
        button.setAttribute('aria-current', isActive ? 'page' : 'false');
    };

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

                ['state-input', 'state-analyzing', 'state-result', 'state-history'].forEach((id) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    if (id === 'state-input') {
                        el.style.zIndex = '10';
                        el.style.pointerEvents = 'auto';
                        el.classList.remove('opacity-0');
                        el.classList.add('opacity-100');
                    } else {
                        el.style.zIndex = '0';
                        el.style.pointerEvents = 'none';
                        el.classList.remove('opacity-100');
                        el.classList.add('opacity-0');
                    }
                });

                if (countEl && inputEl) countEl.textContent = String(inputEl.value.length);
                if (analyzeBtn && inputEl) analyzeBtn.disabled = inputEl.value.trim().length === 0;
            }
        });
    });

    updatePanelMeta(navigationItems[0]);
    setNavButtonState(document.getElementById(navigationItems[0].btnId), true);
}
