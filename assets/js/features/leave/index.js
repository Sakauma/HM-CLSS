/**
 * 离舰控制器模块。
 * 负责初始化监听、时间选项和离舰提交/撤销。
 */

function populateLeaveTimeDropdowns() {
    const startSelect = document.getElementById('leave-start-time');
    const endSelect = document.getElementById('leave-end-time');
    let optionsHtml = '';

    for (let h = 0; h < 24; h++) {
        const hour = h.toString().padStart(2, '0');
        optionsHtml += `<option value="${hour}:00">${hour}:00</option>`;
        optionsHtml += `<option value="${hour}:30">${hour}:30</option>`;
    }

    if (startSelect && endSelect) {
        startSelect.innerHTML = optionsHtml;
        endSelect.innerHTML = optionsHtml;
    }
}

function handleLeaveRecordDeletion(event) {
    const btn = event.target.closest('.delete-leave');
    if (!btn) return;

    if (!confirm('确定撤销该记录吗？')) return;

    const id = btn.getAttribute('data-id');
    const leaveObj = leaveData.find((leave) => leave.id === id);
    leaveData = leaveData.filter((leave) => leave.id !== id);

    if (!leaveObj) return;

    const date = leaveObj.date;
    rebuildLeaveStateForDate(date);
    saveData();
    updateLeaveRecordsList();
    updateLeaveFormState();
    if (date === getTodayString()) {
        updateCheckinButtons();
        updateTodayStatus();
    }
}

function fillLeaveStartFromCurrentTime(event) {
    event.preventDefault();
    const now = new Date();
    const h = now.getHours();
    let m = now.getMinutes();

    m = m >= 30 ? 30 : 0;

    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    document.getElementById('leave-start-time').value = timeStr;

    let endH = h + 2;
    if (endH > 23) endH = 23;
    document.getElementById('leave-end-time').value = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    updateLeaveFormState();
}

/**
 * 初始化离舰表单、时间选项和历史记录交互。
 */
function initLeaveManagement() {
    document.getElementById('leave-date').value = getTodayString();
    document.getElementById('add-leave').addEventListener('click', addLeave);

    populateLeaveTimeDropdowns();

    document.getElementById('leave-workflow-today')?.addEventListener('click', () => setLeaveWorkflow('today'));
    document.getElementById('leave-workflow-planned')?.addEventListener('click', () => setLeaveWorkflow('planned'));
    document.getElementById('leave-workflow-retro')?.addEventListener('click', () => setLeaveWorkflow('retro'));

    document.getElementById('leave-type').addEventListener('change', updateLeaveFormState);
    document.getElementById('leave-date').addEventListener('input', updateLeaveFormState);
    document.getElementById('leave-reason').addEventListener('input', updateLeaveFormState);
    document.getElementById('leave-correction-note').addEventListener('input', updateLeaveFormState);
    document.getElementById('btn-current-time').addEventListener('click', fillLeaveStartFromCurrentTime);
    document.getElementById('leave-records-table').addEventListener('click', handleLeaveRecordDeletion);

    setLeaveWorkflow('today');
    updateLeaveRecordsList();
}

/**
 * 新增一条离舰记录，并把结果同步到目标日期的打卡结构中。
 */
function addLeave() {
    const workflow = activeLeaveWorkflow;
    const date = workflow === 'today' ? getTodayString() : document.getElementById('leave-date').value;
    const reason = document.getElementById('leave-reason').value.trim();
    const type = document.getElementById('leave-type').value;
    const correctionNote = document.getElementById('leave-correction-note').value.trim();
    const requestMode = workflow === 'today' ? 'normal' : workflow;

    const dateValidation = validateLeaveTargetDate(workflow, date);
    if (!dateValidation.valid) return showToast(dateValidation.reason, 'warning');
    if (!reason) return showToast('离舰缘由还没填完整。', 'warning');
    if (workflow === 'retro' && !correctionNote) return showToast('补请假还缺补录说明。', 'warning');

    let startTime = null;
    let endTime = null;
    if (type === 'partial') {
        startTime = document.getElementById('leave-start-time').value;
        endTime = document.getElementById('leave-end-time').value;
        if (startTime >= endTime) {
            return showToast('结束时间需要晚于开始时间。', 'warning');
        }
    }

    const dayData = ensureCheckinDay(date);
    const hasExistingLeave = leaveData.some((leave) => leave.date === date);
    const hasExistingCheckins = hasAnyCheckinRecord(dayData);
    if (workflow === 'retro' && (hasExistingLeave || hasExistingCheckins)) {
        const confirmed = confirm('该日期已有离舰或打卡记录，确认继续补录这条历史修正吗？');
        if (!confirmed) return;
    }

    const nowIso = new Date().toISOString();
    const leavePayload = normalizeLeaveRecord({
        id: `leave_${Date.now()}`,
        date,
        reason,
        type,
        startTime,
        endTime,
        requestMode,
        createdAt: nowIso,
        correctionNote
    });

    if (type === 'full') {
        const existingFullLeave = leaveData.find((leave) => leave.date === date && leave.type === 'full');
        if (existingFullLeave && !confirm('该日期已经有一条全天离舰记录，确认用这次内容覆盖吗？')) {
            return;
        }

        if (existingFullLeave) {
            leaveData = leaveData.map((leave) => leave.id === existingFullLeave.id ? { ...leavePayload, id: existingFullLeave.id } : leave);
        } else {
            leaveData.push(leavePayload);
        }
    } else {
        leaveData.push(leavePayload);
    }

    rebuildLeaveStateForDate(date);
    saveData();
    document.getElementById('leave-reason').value = '';
    document.getElementById('leave-correction-note').value = '';
    updateLeaveRecordsList();
    updateLeaveFormState();

    if (date === getTodayString()) {
        updateCheckinButtons();
        updateTodayStatus();
    }

    const successMessageMap = {
        today: '今日离舰已归档',
        planned: `预请假已归档到 ${formatDisplayDate(date)}`,
        retro: `已补录 ${formatDisplayDate(date)} 的离舰记录`
    };
    showToast(successMessageMap[workflow] || '离舰记录已归档', 'success');
}

registerAppModule({
    id: 'leave',
    order: 60,
    init: initLeaveManagement
});
