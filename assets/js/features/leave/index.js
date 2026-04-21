/**
 * 离舰控制器模块。
 * 负责初始化监听、时间选项和离舰提交/撤销。
 */

function populateLeaveTimeDropdowns() {
    const startSelect = document.getElementById('leave-start-time');
    const endSelect = document.getElementById('leave-end-time');
    const fragment = document.createDocumentFragment();

    for (let h = 0; h < 24; h++) {
        const hour = h.toString().padStart(2, '0');
        fragment.appendChild(createDomElement('option', {
            text: `${hour}:00`,
            attrs: { value: `${hour}:00` }
        }));
        fragment.appendChild(createDomElement('option', {
            text: `${hour}:30`,
            attrs: { value: `${hour}:30` }
        }));
    }

    if (startSelect && endSelect) {
        startSelect.replaceChildren(fragment.cloneNode(true));
        endSelect.replaceChildren(fragment);
    }
}

async function handleLeaveRecordDeletion(event) {
    const btn = event.target.closest('.delete-leave');
    if (!btn) return;

    const confirmed = await showConfirmDialog({
        title: '撤销这条离舰记录？',
        message: '撤销后会同步刷新该日期的离舰状态和相关值班口径。',
        badge: 'LEAVE DELETE',
        confirmLabel: '确认撤销',
        cancelLabel: '先保留',
        tone: 'danger'
    });
    if (!confirmed) return;

    const id = btn.getAttribute('data-id');
    const leaveObj = leaveData.find((leave) => leave.id === id);
    filterRuntimeItems('leaveData', (leave) => leave.id !== id);

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

function formatLeaveTimeValue(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const minutes = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function fillLeaveStartFromCurrentTime(event) {
    event.preventDefault();
    const now = new Date();
    const roundedMinutes = now.getMinutes() >= 30 ? 30 : 0;
    const latestEndMinutes = 23 * 60 + 30;
    let startMinutes = now.getHours() * 60 + roundedMinutes;
    let endMinutes = Math.min(startMinutes + 120, latestEndMinutes);
    let usedFallbackWindow = false;

    if (endMinutes <= startMinutes) {
        startMinutes = latestEndMinutes - 30;
        endMinutes = latestEndMinutes;
        usedFallbackWindow = true;
    }

    document.getElementById('leave-start-time').value = formatLeaveTimeValue(startMinutes);
    document.getElementById('leave-end-time').value = formatLeaveTimeValue(endMinutes);
    updateLeaveFormState();

    if (usedFallbackWindow) {
        showToast('已接近今日结束，已回退到最后一段可选时间，请手动确认。', 'info');
    }
}

/**
 * 初始化离舰表单、时间选项和历史记录交互。
 */
function initLeaveManagement() {
    const disposables = createDisposables();
    document.getElementById('leave-date').value = getTodayString();
    disposables.listen(document.getElementById('add-leave'), 'click', addLeave);

    populateLeaveTimeDropdowns();

    disposables.listen(document.getElementById('leave-workflow-today'), 'click', () => setLeaveWorkflow('today'));
    disposables.listen(document.getElementById('leave-workflow-planned'), 'click', () => setLeaveWorkflow('planned'));
    disposables.listen(document.getElementById('leave-workflow-retro'), 'click', () => setLeaveWorkflow('retro'));

    disposables.listen(document.getElementById('leave-type'), 'change', updateLeaveFormState);
    disposables.listen(document.getElementById('leave-date'), 'input', updateLeaveFormState);
    disposables.listen(document.getElementById('leave-reason'), 'input', updateLeaveFormState);
    disposables.listen(document.getElementById('leave-correction-note'), 'input', updateLeaveFormState);
    disposables.listen(document.getElementById('btn-current-time'), 'click', fillLeaveStartFromCurrentTime);
    disposables.listen(document.getElementById('leave-records-table'), 'click', handleLeaveRecordDeletion);

    setLeaveWorkflow('today');
    updateLeaveRecordsList();
    return () => {
        disposables.dispose();
    };
}

/**
 * 新增一条离舰记录，并把结果同步到目标日期的打卡结构中。
 */
async function addLeave() {
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
        const confirmed = await showConfirmDialog({
            title: '继续补录这条历史修正？',
            message: '该日期已经有离舰或值班记录，确认后会以这次补录为准刷新历史结果。',
            badge: 'RETRO LEAVE',
            confirmLabel: '继续补录',
            cancelLabel: '返回检查',
            tone: 'warning'
        });
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
        if (existingFullLeave) {
            const confirmed = await showConfirmDialog({
                title: '覆盖这条全天离舰记录？',
                message: '同一天已经存在一条全天离舰记录，确认后会改成这次内容。',
                badge: 'FULL LEAVE',
                confirmLabel: '确认覆盖',
                cancelLabel: '先保留',
                tone: 'warning'
            });
            if (!confirmed) return;
        }

        if (existingFullLeave) {
            mapRuntimeItems('leaveData', (leave) => leave.id === existingFullLeave.id ? { ...leavePayload, id: existingFullLeave.id } : leave);
        } else {
            appendRuntimeItem('leaveData', leavePayload);
        }
    } else {
        appendRuntimeItem('leaveData', leavePayload);
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
