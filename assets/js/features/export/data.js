/**
 * 本地数据导出数据层。
 * 负责导出配置、工作区快照、月度快照和导出预览口径。
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

function buildMonthlyExportSnapshot(monthKey) {
    const { start, end } = getMonthDateRangeByKey(monthKey);
    const daysInMonth = end.getDate();
    const checkinEntries = [];
    const taskEntries = [];
    const noteEntries = [];
    const phoneEntries = [];
    const leaveEntries = leaveData
        .filter((leave) => String(leave.date || '').startsWith(monthKey))
        .sort((a, b) => new Date(`${b.date}T${b.startTime || '00:00'}`) - new Date(`${a.date}T${a.startTime || '00:00'}`))
        .map((leave) => cloneWorkspaceValue(leave));
    const drinkEntries = tavernData
        .map((drink) => normalizeDrinkRecord(drink))
        .filter((drink) => String(drink.date || '').startsWith(monthKey))
        .map((drink) => cloneWorkspaceValue(drink));

    const taskTagMinutes = { paper: 0, code: 0, experiment: 0, write: 0, other: 0 };
    const tavernFamilyCounts = {};
    const taskMinutesByDate = {};
    const resistByDate = {};
    const retroDates = new Set();
    let activeCheckinDays = 0;
    let fullLeaveDays = 0;
    let partialLeaveCount = 0;
    let shiftCheckins = 0;
    let shiftCheckouts = 0;
    let taskMinutesTotal = 0;
    let phoneResistTotal = 0;
    let quickNoteCount = 0;

    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
        const dateKey = formatLocalDate(cursor);
        const dayData = checkinData[dateKey] ? ensureDayRecord(checkinData[dateKey]) : null;
        let hasShiftRecord = false;

        if (dayData) {
            if (dayData.leave) fullLeaveDays++;
            partialLeaveCount += Array.isArray(dayData.partialLeaves) ? dayData.partialLeaves.length : 0;

            ['morning', 'afternoon', 'evening'].forEach((period) => {
                const record = dayData[period];
                if (!record || (!record.checkIn && !record.checkOut)) return;

                hasShiftRecord = true;
                const inStatus = getNormalizedCheckInStatus(record.status.checkIn);
                const outStatus = record.status.checkOut || null;
                const summary = summarizeShiftStatuses(inStatus, outStatus);
                if (record.entrySource === 'retro') retroDates.add(dateKey);

                if (record.checkIn) shiftCheckins++;
                if (record.checkOut) shiftCheckouts++;

                checkinEntries.push({
                    date: dateKey,
                    displayDate: formatDisplayDate(dateKey),
                    period,
                    periodLabel: getPeriodLabel(period),
                    checkIn: record.checkIn || null,
                    checkOut: record.checkOut || null,
                    inStatus,
                    outStatus,
                    summary: summary.text,
                    entrySource: record.entrySource || 'live',
                    correctionReason: record.correctionReason || ''
                });
            });
        }

        if (!dayData?.leave && hasShiftRecord) activeCheckinDays++;

        const dayTasks = taskData[dateKey] || [];
        if (dayTasks.length) {
            taskMinutesByDate[dateKey] = 0;
        }
        dayTasks.forEach((task) => {
            const duration = Number(task.duration) || 0;
            taskMinutesTotal += duration;
            taskMinutesByDate[dateKey] = (taskMinutesByDate[dateKey] || 0) + duration;
            taskTagMinutes[task.tag || 'other'] = (taskTagMinutes[task.tag || 'other'] || 0) + duration;

            taskEntries.push({
                date: dateKey,
                displayDate: formatDisplayDate(dateKey),
                id: task.id || null,
                name: task.name,
                tag: task.tag || 'other',
                tagLabel: getTaskTagLabel(task.tag || 'other'),
                startTime: task.startTime || null,
                endTime: task.endTime || null,
                durationMins: duration
            });
        });

        const dayNotes = quickNotesData[dateKey] || [];
        quickNoteCount += dayNotes.length;
        dayNotes.forEach((note) => {
            noteEntries.push({
                date: dateKey,
                displayDate: formatDisplayDate(dateKey),
                time: note.time || null,
                tag: note.tag || 'idea',
                tagLabel: (noteTagConfig[note.tag || 'idea'] || noteTagConfig.idea).label,
                text: getNoteText(note)
            });
        });

        const resistRecord = phoneResistData.records[dateKey];
        if (resistRecord) {
            const count = resistRecord.count || 0;
            phoneResistTotal += count;
            resistByDate[dateKey] = count;
            phoneEntries.push({
                date: dateKey,
                displayDate: formatDisplayDate(dateKey),
                count,
                times: cloneWorkspaceValue(resistRecord.times || [])
            });
        }
    }

    drinkEntries.forEach((drink) => {
        tavernFamilyCounts[drink.family] = (tavernFamilyCounts[drink.family] || 0) + 1;
    });

    const totalCheckinRate = Number(calculateCheckinRateForRange(start, end).toFixed(2));
    const topTaskTag = getTopMetricEntry(taskTagMinutes);
    const topTaskDay = getTopMetricEntry(taskMinutesByDate);
    const topResistDay = getTopMetricEntry(resistByDate);
    const topDrinkFamily = getTopMetricEntry(tavernFamilyCounts);

    return {
        meta: {
            app: 'HM-CLSS',
            scope: 'month',
            schemaVersion: 1,
            month: monthKey,
            monthLabel: formatMonthLabel(monthKey),
            exportedAt: new Date().toISOString()
        },
        summary: {
            daysInMonth,
            activeCheckinDays,
            fullLeaveDays,
            partialLeaveCount,
            retroCheckinDays: retroDates.size,
            shiftCheckins,
            shiftCheckouts,
            checkinRate: totalCheckinRate,
            totalTasks: taskEntries.length,
            taskMinutesTotal,
            taskHoursTotal: Number((taskMinutesTotal / 60).toFixed(2)),
            phoneResistTotal,
            quickNoteCount,
            leaveCount: leaveEntries.length,
            fullLeaveCount: leaveEntries.filter((leave) => leave.type === 'full').length,
            partialLeaveEntryCount: leaveEntries.filter((leave) => leave.type === 'partial').length,
            plannedLeaveCount: leaveEntries.filter((leave) => leave.requestMode === 'planned').length,
            retroLeaveCount: leaveEntries.filter((leave) => leave.requestMode === 'retro').length,
            tavernCount: drinkEntries.length,
            secretDrinkCount: drinkEntries.filter((drink) => drink.secret).length,
            topTaskTag: topTaskTag ? {
                key: topTaskTag[0],
                label: getTaskTagLabel(topTaskTag[0]),
                minutes: topTaskTag[1],
                hours: Number((topTaskTag[1] / 60).toFixed(2))
            } : null,
            deepestWorkDay: topTaskDay ? {
                date: topTaskDay[0],
                displayDate: formatDisplayDate(topTaskDay[0]),
                minutes: topTaskDay[1],
                hours: Number((topTaskDay[1] / 60).toFixed(2))
            } : null,
            strongestResistDay: topResistDay ? {
                date: topResistDay[0],
                displayDate: formatDisplayDate(topResistDay[0]),
                count: topResistDay[1]
            } : null,
            topDrinkFamily: topDrinkFamily ? {
                family: topDrinkFamily[0],
                count: topDrinkFamily[1]
            } : null,
            achievementsSnapshot: achievements.length
        },
        details: {
            checkins: checkinEntries,
            tasks: taskEntries,
            quickNotes: noteEntries,
            phoneResist: phoneEntries,
            leaves: leaveEntries,
            tavern: drinkEntries
        }
    };
}
