/**
 * 值班补录渲染层。
 * 负责补打卡面板预判、额度展示与最近补录留痕。
 */

function createRetroEmptyState() {
    return createDomElement('div', {
        className: 'surface-inline-note border-dashed px-4 py-4 text-sm text-slate-500 dark:text-slate-400',
        text: '暂无补录记录。'
    });
}

function createRetroEntryCard(entry) {
    const toneClassMap = {
        success: 'semantic-tag semantic-tag-success semantic-tag-tight',
        warning: 'semantic-tag semantic-tag-warning semantic-tag-tight',
        danger: 'semantic-tag semantic-tag-danger semantic-tag-tight',
        info: 'semantic-tag semantic-tag-primary semantic-tag-tight'
    };

    return appendDomChildren(createDomElement('div', {
        className: 'surface-inline-card px-4 py-3'
    }), [
        appendDomChildren(createDomElement('div', {
            className: 'flex items-start justify-between gap-3'
        }), [
            appendDomChildren(createDomElement('div'), [
                createDomElement('div', {
                    className: 'text-xs font-mono text-slate-400',
                    text: formatDisplayDate(entry.date)
                }),
                createDomElement('div', {
                    className: 'mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100',
                    text: getPeriodLabel(entry.period)
                })
            ]),
            createDomElement('span', {
                className: toneClassMap[entry.tone] || toneClassMap.info,
                text: `补录 · ${entry.statusText}`
            })
        ]),
        createDomElement('div', {
            className: 'mt-2 text-xs font-mono text-slate-500 dark:text-slate-400',
            text: `${entry.checkIn} → ${entry.checkOut}`
        }),
        createDomElement('div', {
            className: 'mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400',
            text: entry.correctionReason || '无说明'
        })
    ]);
}

/**
 * 汇总最近的补打卡记录，用于在补录面板中展示留痕。
 * @returns {Array<{ date: string, period: string, checkIn: string, checkOut: string, correctionReason: string, statusText: string, tone: string }>}
 */
function getRecentRetroEntries() {
    const entries = [];

    Object.entries(checkinData).forEach(([date, day]) => {
        CHECKIN_PERIODS.forEach((period) => {
            const record = day?.[period];
            if (!record || record.entrySource !== 'retro') return;

            const summary = summarizeShiftStatuses(
                getNormalizedCheckInStatus(record.status.checkIn),
                record.status.checkOut
            );

            entries.push({
                date,
                period,
                checkIn: record.checkIn || '--:--',
                checkOut: record.checkOut || '--:--',
                correctionReason: record.correctionReason || '',
                statusText: summary.text,
                tone: summary.tone
            });
        });
    });

    return entries.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
}

/**
 * 将补打卡留痕渲染到侧栏列表。
 */
function renderRetroRecentEntries() {
    const container = document.getElementById('retro-recent-log');
    if (!container) return;

    const entries = getRecentRetroEntries();
    if (!entries.length) {
        container.replaceChildren(createRetroEmptyState());
        return;
    }

    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => {
        fragment.appendChild(createRetroEntryCard(entry));
    });

    container.replaceChildren(fragment);
}

/**
 * 根据当前表单内容刷新补打卡预判、配额占用和最近补录留痕。
 */
function updateRetroCheckinPanel() {
    const dateEl = document.getElementById('retro-checkin-date');
    const periodEl = document.getElementById('retro-checkin-period');
    const startEl = document.getElementById('retro-checkin-start');
    const endEl = document.getElementById('retro-checkin-end');
    const reasonEl = document.getElementById('retro-checkin-reason');
    const chipEl = document.getElementById('retro-preview-chip');
    const copyEl = document.getElementById('retro-preview-copy');
    const submitEl = document.getElementById('retro-checkin-submit');
    const weekUsageEl = document.getElementById('retro-week-usage');
    const monthUsageEl = document.getElementById('retro-month-usage');
    const weekCaptionEl = document.getElementById('retro-week-caption');
    const monthCaptionEl = document.getElementById('retro-month-caption');

    if (!dateEl || !periodEl || !startEl || !endEl || !chipEl || !copyEl || !submitEl) return;

    const targetDate = dateEl.value;
    const usage = getRetroCheckinUsage(targetDate || getTodayString());
    if (weekUsageEl) weekUsageEl.textContent = `${usage.weekUsed}/${CONFIG.retro.last7DayQuota}`;
    if (monthUsageEl) monthUsageEl.textContent = `${usage.monthUsed}/${CONFIG.retro.monthlyQuota}`;
    if (weekCaptionEl) weekCaptionEl.textContent = '7日额度';
    if (monthCaptionEl) monthCaptionEl.textContent = `${(targetDate || getTodayString()).slice(0, 7)} 月额度`;

    renderRetroRecentEntries();

    const availability = getRetroCheckinAvailability(targetDate);
    const dayData = targetDate ? getCheckinDaySnapshot(targetDate) : null;
    const hasReason = reasonEl.value.trim().length > 0;

    if (!availability.allowed) {
        chipEl.className = 'status-chip status-chip-warning';
        chipEl.textContent = '补录受限';
        copyEl.textContent = availability.reason;
        submitEl.disabled = true;
        submitEl.className = CHECKIN_DISABLED_BUTTON_CLASS;
        return;
    }

    if (dayData?.leave) {
        chipEl.className = 'status-chip status-chip-danger';
        chipEl.textContent = '离舰占用中';
        copyEl.textContent = '该日当前按全天离舰处理，如需补打卡，先回离舰流程调整。';
        submitEl.disabled = true;
        submitEl.className = CHECKIN_DISABLED_BUTTON_CLASS;
        return;
    }

    const evaluation = evaluateShiftRecord(targetDate, periodEl.value, startEl.value, endEl.value);
    if (!evaluation.valid) {
        chipEl.className = 'status-chip status-chip-info';
        chipEl.textContent = '等待预判';
        copyEl.textContent = evaluation.reason;
        submitEl.disabled = true;
        submitEl.className = CHECKIN_DISABLED_BUTTON_CLASS;
        return;
    }

    if (!hasReason) {
        chipEl.className = 'status-chip status-chip-info';
        chipEl.textContent = '等待说明';
        copyEl.textContent = '补录说明还没填。';
        submitEl.disabled = true;
        submitEl.className = CHECKIN_DISABLED_BUTTON_CLASS;
        return;
    }

    const summary = summarizeShiftStatuses(evaluation.inStatus, evaluation.outStatus);
    chipEl.className = `status-chip status-chip-${summary.tone === 'info' ? 'info' : summary.tone}`;
    chipEl.textContent = summary.text;

    const currentRecord = dayData[periodEl.value];
    const overwriteNote = currentRecord.checkIn || currentRecord.checkOut
        ? `已有 ${currentRecord.checkIn || '--:--'} / ${currentRecord.checkOut || '--:--'}，提交前会确认覆盖。`
        : '当前没有旧记录。';
    copyEl.textContent = `${summary.detail} ${overwriteNote}`;

    submitEl.disabled = false;
    submitEl.className = CHECKIN_ACTIVE_BUTTON_CLASS;
}
