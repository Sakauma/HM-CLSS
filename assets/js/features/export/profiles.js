/**
 * 导出配置与基础元数据。
 * 负责导出档位定义、月份范围和文件名辅助函数。
 */

const EXPORT_PROFILES = {
    workspace_json: {
        id: 'workspace_json',
        label: '全量工作区 JSON',
        scope: 'workspace',
        format: 'json',
        requiresMonth: false,
        icon: 'database-backup',
        buttonLabel: '下载全量 JSON',
        hint: '完整快照，适合离线备份或迁移。',
        badge: 'JSON SNAPSHOT'
    },
    month_json: {
        id: 'month_json',
        label: '本月结构化 JSON',
        scope: 'month',
        format: 'json',
        requiresMonth: true,
        icon: 'file-json-2',
        buttonLabel: '下载本月 JSON',
        hint: '带摘要和明细，适合后续二次分析。',
        badge: 'MONTH JSON'
    },
    month_markdown: {
        id: 'month_markdown',
        label: '本月复盘 Markdown',
        scope: 'month',
        format: 'markdown',
        requiresMonth: true,
        icon: 'scroll-text',
        buttonLabel: '下载本月 Markdown',
        hint: '只保留适合复盘的月度摘要。',
        badge: 'MONTH MD'
    },
    month_csv: {
        id: 'month_csv',
        label: '本月明细 CSV',
        scope: 'month',
        format: 'csv',
        requiresMonth: true,
        icon: 'sheet',
        buttonLabel: '下载本月 CSV',
        hint: '按流水展开本月明细，适合表格软件继续筛选。',
        badge: 'MONTH CSV'
    }
};

function getCurrentMonthKey() {
    return getTodayString().slice(0, 7);
}

function getMonthDateRangeByKey(monthKey) {
    const [year, month] = String(monthKey).split('-').map(Number);
    const start = new Date(year, (month || 1) - 1, 1);
    const end = new Date(year, month || 1, 0);
    return { start, end };
}

function formatMonthLabel(monthKey) {
    const [year, month] = String(monthKey).split('-').map(Number);
    return `${year}年${month}月`;
}

function getDownloadTimestamp() {
    const now = new Date();
    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0')
    ].join('');
}

function getTaskTagLabel(tag) {
    return tagMap[tag] || tagMap.other;
}

function getTopMetricEntry(metricMap) {
    const entries = Object.entries(metricMap);
    if (!entries.length) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][1] > 0 ? entries[0] : null;
}

function getExportProfile(profileId) {
    return EXPORT_PROFILES[profileId] || EXPORT_PROFILES.month_json;
}
