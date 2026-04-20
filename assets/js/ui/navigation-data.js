/**
 * 导航数据层。
 * 负责定义导航入口和面板说明区的静态文案。
 */

const NAVIGATION_ITEMS = [
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
