/**
 * 本地数据导出数据层。
 * 负责导出配置、工作区快照、月度快照和导出预览口径。
 */

function buildWorkspaceExportSnapshot() {
    return {
        meta: {
            app: 'HM-CLSS',
            scope: 'workspace',
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'
        },
        state: buildWorkspaceStateSnapshot(),
        datasets: buildWorkspaceDatasetSnapshot()
    };
}

function buildWorkspaceExportOverview() {
    const checkinDays = countCheckinDays();
    const noteCount = countQuickNoteEntries();
    const monthKey = getCurrentMonthKey();

    return {
        title: '全量工作区摘要',
        copy: `这次会打包整个工作区快照，覆盖值班、任务、速记、离舰和酒单历史。当前累计出勤 ${checkinDays} 天，深度工作 ${calculateTotalTaskHours()} h。`,
        metrics: {
            checkinDays,
            taskHours: calculateTotalTaskHours(),
            resistCount: phoneResistData.totalCount || 0,
            noteCount
        },
        note: `同步凭据不会被写进导出文件。月度深挖建议继续使用 ${formatMonthLabel(monthKey)} 的 JSON / CSV / Markdown 导出。`
    };
}
