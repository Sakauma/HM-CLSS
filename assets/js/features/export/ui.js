/**
 * 本地数据导出界面层。
 * 负责导出选择区的按钮、预览和交互绑定。
 */

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
        setElementIconLabel(triggerBtn, profile.icon, profile.buttonLabel);
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

registerAppModule({
    id: 'export-tools',
    order: 80,
    init: initExportTools
});
