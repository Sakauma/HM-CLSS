/**
 * 本地数据导出模块。
 * 负责将当前工作区快照或单月摘要导出为 JSON / Markdown / CSV 文件。
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

function cloneExportData(value) {
    return JSON.parse(JSON.stringify(value));
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

function triggerFileDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
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
        state: {
            currentTask: currentTask ? cloneExportData(currentTask) : null,
            ambientPreferences: cloneExportData(normalizeAmbientPreferences(ambientPreferences)),
            lastSyncTime: localLastSyncTime || null
        },
        datasets: {
            checkinData: cloneExportData(checkinData),
            phoneResistData: cloneExportData(phoneResistData),
            taskData: cloneExportData(taskData),
            leaveData: cloneExportData(leaveData),
            achievements: cloneExportData(achievements),
            quickNotesData: cloneExportData(quickNotesData),
            tavernData: cloneExportData(tavernData)
        }
    };
}

function buildWorkspaceExportOverview() {
    const checkinDays = Object.values(checkinData).filter((day) => {
        if (!day || typeof day !== 'object' || day.leave) return false;
        const normalizedDay = ensureDayRecord(day);
        return ['morning', 'afternoon', 'evening'].some((period) => normalizedDay[period].checkIn || normalizedDay[period].checkOut);
    }).length;

    const noteCount = Object.values(quickNotesData).reduce((sum, notes) => sum + ((Array.isArray(notes) && notes.length) ? notes.length : 0), 0);
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
        .map((leave) => cloneExportData(leave));
    const drinkEntries = tavernData
        .map((drink) => normalizeDrinkRecord(drink))
        .filter((drink) => String(drink.date || '').startsWith(monthKey))
        .map((drink) => cloneExportData(drink));

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
                times: cloneExportData(resistRecord.times || [])
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

function setExportActionMessage(message) {
    const messageEl = document.getElementById('export-last-action');
    if (messageEl) messageEl.textContent = message;
}

function updateExportActionUi(profile) {
    const monthField = document.getElementById('export-month-field');
    const monthInput = document.getElementById('export-month-input');
    const hintEl = document.getElementById('export-selection-hint');
    const badgeEl = document.getElementById('export-selection-badge');
    const triggerBtn = document.getElementById('export-trigger-btn');

    if (monthField) {
        monthField.classList.toggle('opacity-60', !profile.requiresMonth);
    }

    if (monthInput) {
        monthInput.disabled = !profile.requiresMonth;
    }

    if (hintEl) {
        hintEl.textContent = profile.hint;
    }

    if (badgeEl) {
        badgeEl.textContent = profile.badge;
    }

    if (triggerBtn) {
        triggerBtn.innerHTML = `<i data-lucide="${profile.icon}" class="w-4 h-4"></i> ${escapeHtml(profile.buttonLabel)}`;
        lucide.createIcons();
    }
}

function updateExportPreview() {
    const monthInput = document.getElementById('export-month-input');
    const profileSelect = document.getElementById('export-profile-select');
    const profile = getExportProfile(profileSelect?.value);
    const titleEl = document.getElementById('export-preview-title');
    const copyEl = document.getElementById('export-preview-copy');
    const checkinEl = document.getElementById('export-preview-checkin-days');
    const taskEl = document.getElementById('export-preview-task-hours');
    const resistEl = document.getElementById('export-preview-resist');
    const notesEl = document.getElementById('export-preview-notes');
    const noteEl = document.getElementById('export-preview-note');

    updateExportActionUi(profile);

    if (!titleEl || !copyEl || !checkinEl || !taskEl || !resistEl || !notesEl || !noteEl) return;

    if (profile.scope === 'workspace') {
        const overview = buildWorkspaceExportOverview();
        titleEl.textContent = overview.title;
        copyEl.textContent = overview.copy;
        checkinEl.textContent = String(overview.metrics.checkinDays);
        taskEl.textContent = `${overview.metrics.taskHours} h`;
        resistEl.textContent = String(overview.metrics.resistCount);
        notesEl.textContent = String(overview.metrics.noteCount);
        noteEl.textContent = overview.note;
        return;
    }

    const snapshot = buildMonthlyExportSnapshot(monthInput?.value || getCurrentMonthKey());
    titleEl.textContent = `${snapshot.meta.monthLabel} 摘要`;
    copyEl.textContent = `本月出勤 ${snapshot.summary.activeCheckinDays} 天，完成 ${snapshot.summary.totalTasks} 项任务，节奏和调整都已经收进这次导出。`;
    checkinEl.textContent = `${snapshot.summary.activeCheckinDays} / ${snapshot.summary.daysInMonth}`;
    taskEl.textContent = `${snapshot.summary.taskHoursTotal} h`;
    resistEl.textContent = String(snapshot.summary.phoneResistTotal);
    notesEl.textContent = String(snapshot.summary.quickNoteCount);

    const profileNotes = {
        json: 'JSON 会带完整结构和摘要口径，适合后续分析或迁移。',
        markdown: 'Markdown 只保留适合复盘的摘要文本，拿去写月报最省事。',
        csv: 'CSV 会把本月明细展开成流水表，适合放进表格软件继续筛选。'
    };
    const noteParts = [
        `补打卡 ${snapshot.summary.retroCheckinDays} 天`,
        `离舰 ${snapshot.summary.leaveCount} 条`,
        `酒单 ${snapshot.summary.tavernCount} 杯`
    ];
    noteEl.textContent = `${noteParts.join('，')}。${profileNotes[profile.format]}`;
}

function refreshExportPreview() {
    updateExportPreview();
}

function exportWorkspaceJson() {
    const filename = `hm-clss-workspace-${getDownloadTimestamp()}.json`;
    const payload = JSON.stringify(buildWorkspaceExportSnapshot(), null, 2);
    triggerFileDownload(filename, payload, 'application/json');
    setExportActionMessage(`已导出 ${filename}`);
    showToast('全量 JSON 已开始下载', 'success');
}

function exportMonthJson(monthKey) {
    const filename = `hm-clss-month-${monthKey}-${getDownloadTimestamp()}.json`;
    const payload = JSON.stringify(buildMonthlyExportSnapshot(monthKey), null, 2);
    triggerFileDownload(filename, payload, 'application/json');
    setExportActionMessage(`已导出 ${filename}`);
    showToast(`${formatMonthLabel(monthKey)} JSON 已开始下载`, 'success');
}

function exportMonthMarkdown(monthKey) {
    const snapshot = buildMonthlyExportSnapshot(monthKey);
    const filename = `hm-clss-month-${monthKey}-${getDownloadTimestamp()}.md`;
    const payload = buildMonthlyMarkdown(snapshot);
    triggerFileDownload(filename, payload, 'text/markdown');
    setExportActionMessage(`已导出 ${filename}`);
    showToast(`${formatMonthLabel(monthKey)} Markdown 已开始下载`, 'success');
}

function exportMonthCsv(monthKey) {
    const snapshot = buildMonthlyExportSnapshot(monthKey);
    const filename = `hm-clss-month-${monthKey}-${getDownloadTimestamp()}.csv`;
    const payload = buildMonthlyCsv(snapshot);
    triggerFileDownload(filename, payload, 'text/csv');
    setExportActionMessage(`已导出 ${filename}`);
    showToast(`${formatMonthLabel(monthKey)} CSV 已开始下载`, 'success');
}

function executeSelectedExport() {
    const monthInput = document.getElementById('export-month-input');
    const profileSelect = document.getElementById('export-profile-select');
    const profile = getExportProfile(profileSelect?.value);
    const monthKey = monthInput?.value || getCurrentMonthKey();

    if (profile.id === 'workspace_json') {
        exportWorkspaceJson();
        return;
    }

    if (profile.id === 'month_json') {
        exportMonthJson(monthKey);
        return;
    }

    if (profile.id === 'month_markdown') {
        exportMonthMarkdown(monthKey);
        return;
    }

    exportMonthCsv(monthKey);
}

function initExportTools() {
    const monthInput = document.getElementById('export-month-input');
    const profileSelect = document.getElementById('export-profile-select');
    const triggerBtn = document.getElementById('export-trigger-btn');

    if (!monthInput || !profileSelect || !triggerBtn) return;

    monthInput.value = getCurrentMonthKey();
    profileSelect.value = 'month_json';
    updateExportPreview();

    monthInput.addEventListener('input', updateExportPreview);
    profileSelect.addEventListener('change', updateExportPreview);
    triggerBtn.addEventListener('click', executeSelectedExport);
}
