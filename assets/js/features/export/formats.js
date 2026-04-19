/**
 * 本地数据导出格式层。
 * 负责把导出快照转换成 Markdown / CSV，并生成文件描述。
 */

function buildMonthlyMarkdown(snapshot) {
    const { summary, meta } = snapshot;
    const topTaskTag = summary.topTaskTag ? `${summary.topTaskTag.label}（${summary.topTaskTag.hours}h）` : '暂无';
    const deepestWorkDay = summary.deepestWorkDay ? `${summary.deepestWorkDay.displayDate}（${summary.deepestWorkDay.hours}h）` : '暂无';
    const strongestResistDay = summary.strongestResistDay ? `${summary.strongestResistDay.displayDate}（${summary.strongestResistDay.count} 次）` : '暂无';
    const topDrinkFamily = summary.topDrinkFamily ? `${summary.topDrinkFamily.family}（${summary.topDrinkFamily.count} 杯）` : '暂无';

    return [
        `# HM-CLSS 月度复盘｜${meta.monthLabel}`,
        '',
        `- 导出时间：${new Date(meta.exportedAt).toLocaleString('zh-CN')}`,
        `- 导出范围：${meta.month}`,
        '',
        '## 总览',
        `- 出勤天数：${summary.activeCheckinDays} / ${summary.daysInMonth}`,
        `- 考勤合规率：${summary.checkinRate}%`,
        `- 深度工作：${summary.totalTasks} 项 / ${summary.taskHoursTotal} h`,
        `- 抗干扰次数：${summary.phoneResistTotal}`,
        `- 速记条目：${summary.quickNoteCount}`,
        `- 离舰记录：${summary.leaveCount} 条`,
        `- 酒单封存：${summary.tavernCount} 杯`,
        '',
        '## 值班与调整',
        `- 连线次数：${summary.shiftCheckins}`,
        `- 登出次数：${summary.shiftCheckouts}`,
        `- 补打卡天数：${summary.retroCheckinDays}`,
        `- 全天离舰天数：${summary.fullLeaveDays}`,
        `- 分段离舰条目：${summary.partialLeaveCount}`,
        `- 预请假 / 补请假：${summary.plannedLeaveCount} / ${summary.retroLeaveCount}`,
        '',
        '## 工作沉淀',
        `- 主导标签：${topTaskTag}`,
        `- 最深工作日：${deepestWorkDay}`,
        `- 已解锁成就快照：${summary.achievementsSnapshot}`,
        '',
        '## 捕捉与情绪',
        `- 最高抗干扰日：${strongestResistDay}`,
        `- 本月高频酒系：${topDrinkFamily}`,
        `- 彩蛋酒款数：${summary.secretDrinkCount}`,
        '',
        '## 说明',
        '- 这份 Markdown 只保留月度摘要，适合直接贴进复盘文档。',
        '- 如果后续还要做二次分析，请同时导出本月 JSON 或 CSV。'
    ].join('\n');
}

function escapeCsvValue(value) {
    const normalized = value == null ? '' : String(value);
    return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function buildMonthlyCsv(snapshot) {
    const rows = [
        ['category', 'date', 'display_date', 'time_start', 'time_end', 'label', 'status', 'metric', 'source', 'notes']
    ];

    snapshot.details.checkins.forEach((entry) => {
        rows.push([
            'checkin',
            entry.date,
            entry.displayDate,
            entry.checkIn || '',
            entry.checkOut || '',
            entry.periodLabel,
            entry.summary,
            '',
            entry.entrySource || '',
            entry.correctionReason || ''
        ]);
    });

    snapshot.details.tasks.forEach((entry) => {
        rows.push([
            'task',
            entry.date,
            entry.displayDate,
            entry.startTime || '',
            entry.endTime || '',
            entry.name,
            entry.tagLabel,
            String(entry.durationMins),
            'task-log',
            ''
        ]);
    });

    snapshot.details.quickNotes.forEach((entry) => {
        rows.push([
            'quick_note',
            entry.date,
            entry.displayDate,
            entry.time || '',
            '',
            entry.tagLabel,
            '',
            '',
            'capture-pool',
            entry.text
        ]);
    });

    snapshot.details.phoneResist.forEach((entry) => {
        rows.push([
            'phone_resist',
            entry.date,
            entry.displayDate,
            '',
            '',
            '认知干扰拦截',
            '',
            String(entry.count),
            'focus-shield',
            Array.isArray(entry.times) ? entry.times.join(' | ') : ''
        ]);
    });

    snapshot.details.leaves.forEach((entry) => {
        rows.push([
            'leave',
            entry.date,
            formatDisplayDate(entry.date),
            entry.startTime || '',
            entry.endTime || '',
            entry.type === 'full' ? '全天离舰' : '暂时离舰',
            entry.requestMode || 'normal',
            '',
            'leave-control',
            [entry.reason || '', entry.correctionNote || ''].filter(Boolean).join(' / ')
        ]);
    });

    snapshot.details.tavern.forEach((entry) => {
        rows.push([
            'tavern',
            entry.date || '',
            entry.date ? formatDisplayDate(entry.date) : '',
            entry.time || '',
            '',
            entry.name,
            entry.style,
            entry.abv || '',
            entry.family || '',
            entry.reason || ''
        ]);
    });

    return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n');
}

function buildExportFileDescriptor(profile, monthKey) {
    if (profile.id === 'workspace_json') {
        return {
            filename: `hm-clss-workspace-${getDownloadTimestamp()}.json`,
            content: JSON.stringify(buildWorkspaceExportSnapshot(), null, 2),
            mimeType: 'application/json',
            actionMessage: '全量 JSON 已开始下载',
            toastMessage: '全量 JSON 已开始下载'
        };
    }

    if (profile.id === 'month_json') {
        return {
            filename: `hm-clss-month-${monthKey}-${getDownloadTimestamp()}.json`,
            content: JSON.stringify(buildMonthlyExportSnapshot(monthKey), null, 2),
            mimeType: 'application/json',
            actionMessage: `${formatMonthLabel(monthKey)} JSON 已开始下载`,
            toastMessage: `${formatMonthLabel(monthKey)} JSON 已开始下载`
        };
    }

    if (profile.id === 'month_markdown') {
        const snapshot = buildMonthlyExportSnapshot(monthKey);
        return {
            filename: `hm-clss-month-${monthKey}-${getDownloadTimestamp()}.md`,
            content: buildMonthlyMarkdown(snapshot),
            mimeType: 'text/markdown',
            actionMessage: `${formatMonthLabel(monthKey)} Markdown 已开始下载`,
            toastMessage: `${formatMonthLabel(monthKey)} Markdown 已开始下载`
        };
    }

    const snapshot = buildMonthlyExportSnapshot(monthKey);
    return {
        filename: `hm-clss-month-${monthKey}-${getDownloadTimestamp()}.csv`,
        content: buildMonthlyCsv(snapshot),
        mimeType: 'text/csv',
        actionMessage: `${formatMonthLabel(monthKey)} CSV 已开始下载`,
        toastMessage: `${formatMonthLabel(monthKey)} CSV 已开始下载`
    };
}
