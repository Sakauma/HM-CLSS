/**
 * 月度导出数据构建层。
 * 负责把单月的值班、任务、速记、离舰和酒单汇总成稳定快照。
 */

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
