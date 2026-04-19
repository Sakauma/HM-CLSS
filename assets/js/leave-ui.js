/**
 * 离舰渲染模块。
 * 负责流程切换、表单动态提示与历史列表展示。
 */

/**
 * 切换离舰流程，并同步更新表单文案、可见字段和提交意图。
 * @param {'today'|'planned'|'retro'} workflow
 */
function setLeaveWorkflow(workflow) {
    activeLeaveWorkflow = workflow;

    const buttonClassMap = {
        active: 'workflow-tab workflow-tab-active',
        idle: 'workflow-tab'
    };

    const mappings = {
        today: {
            title: '今日离舰',
            copy: '默认入口，只处理今天这条记录。',
            submitLabel: '提交今日离舰',
            submitHint: '提交后会同步今天的值班状态。',
            note: '适合临时离开或今天全天离舰。',
            lockDate: true
        },
        planned: {
            title: '预请假',
            copy: '登记未来离舰安排。',
            submitLabel: '归档预请假',
            submitHint: '今天不受影响，到日自动生效。',
            note: '只接受未来日期。',
            lockDate: false
        },
        retro: {
            title: '补请假',
            copy: '单独处理历史修正。',
            submitLabel: '补录历史离舰',
            submitHint: '补录说明需要一起留下。',
            note: '只接受过去日期；有旧记录会要求确认。',
            lockDate: false
        }
    };

    const config = mappings[workflow];
    document.getElementById('leave-workflow-today').className = workflow === 'today' ? buttonClassMap.active : buttonClassMap.idle;
    document.getElementById('leave-workflow-planned').className = workflow === 'planned' ? buttonClassMap.active : buttonClassMap.idle;
    document.getElementById('leave-workflow-retro').className = workflow === 'retro' ? buttonClassMap.active : buttonClassMap.idle;

    document.getElementById('leave-form-title').textContent = config.title;
    document.getElementById('leave-form-copy').textContent = config.copy;
    document.getElementById('leave-submit-label').textContent = config.submitLabel;
    document.getElementById('leave-submit-note').textContent = config.submitHint;
    document.getElementById('leave-form-note').textContent = config.note;

    if (workflow === 'today') {
        document.getElementById('leave-date').value = getTodayString();
    }

    document.getElementById('leave-date').disabled = config.lockDate;
    updateLeaveFormState();
}

/**
 * 根据当前工作流和表单内容，刷新动态字段与风险提示。
 */
function updateLeaveFormState() {
    const workflow = activeLeaveWorkflow;
    const type = document.getElementById('leave-type').value;
    const timeContainer = document.getElementById('leave-time-container');
    const dateGroup = document.getElementById('leave-date-group');
    const correctionGroup = document.getElementById('leave-correction-group');
    const alertEl = document.getElementById('leave-form-alert');
    const submitBtn = document.getElementById('add-leave');
    const targetDate = workflow === 'today' ? getTodayString() : document.getElementById('leave-date').value;

    if (type === 'partial') {
        timeContainer.classList.remove('hidden');
    } else {
        timeContainer.classList.add('hidden');
    }

    if (workflow === 'today') {
        dateGroup.classList.add('hidden');
    } else {
        dateGroup.classList.remove('hidden');
    }

    if (workflow === 'retro') {
        correctionGroup.classList.remove('hidden');
    } else {
        correctionGroup.classList.add('hidden');
    }

    const validation = validateLeaveTargetDate(workflow, targetDate);
    const dayData = targetDate ? getCheckinDaySnapshot(targetDate) : null;
    const hasExistingLeave = leaveData.some((leave) => leave.date === targetDate);
    const hasExistingCheckins = hasAnyCheckinRecord(dayData);

    if (!validation.valid) {
        alertEl.className = 'rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm leading-6 text-warning';
        alertEl.textContent = validation.reason;
        submitBtn.disabled = true;
        submitBtn.className = CHECKIN_DISABLED_BUTTON_CLASS;
        return;
    }

    if (workflow === 'retro' && (hasExistingLeave || hasExistingCheckins)) {
        alertEl.className = 'rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm leading-6 text-warning';
        alertEl.textContent = '该日期已有旧记录，提交时会再确认一次。';
        submitBtn.disabled = false;
        submitBtn.className = CHECKIN_ACTIVE_BUTTON_CLASS;
        return;
    }

    if (workflow === 'planned') {
        alertEl.className = 'rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm leading-6 text-primary';
        alertEl.textContent = targetDate
            ? `生效日：${formatDisplayDate(targetDate)}`
            : '选择未来日期后显示生效日。';
    } else if (workflow === 'retro') {
        alertEl.className = 'rounded-2xl border border-slate-200/80 bg-white/60 px-4 py-3 text-sm leading-6 text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/40 dark:text-slate-400';
        alertEl.textContent = '会刷新历史统计，不会改动今天的实时状态。';
    } else {
        alertEl.className = 'rounded-2xl border border-success/20 bg-success/10 px-4 py-3 text-sm leading-6 text-success';
        alertEl.textContent = '提交后会同步今天的值班按钮和首页状态。';
    }

    submitBtn.disabled = false;
    submitBtn.className = CHECKIN_ACTIVE_BUTTON_CLASS;
}

/**
 * 重新渲染离舰历史列表，按日期倒序展示。
 */
function updateLeaveRecordsList() {
    const tbody = document.getElementById('leave-records-table');
    if (!leaveData.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="py-4 px-4 text-center text-slate-400">暂无历史归档</td></tr>';
        return;
    }

    const modeLabelMap = {
        normal: { text: '正常', style: 'bg-success/10 text-success border-success/20' },
        planned: { text: '预请假', style: 'bg-primary/10 text-primary border-primary/20' },
        retro: { text: '补请假', style: 'bg-warning/10 text-warning border-warning/20' }
    };

    tbody.innerHTML = '';

    [...leaveData].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach((leave) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors align-top';
        const safeDate = escapeHtml(leave.date);
        const modeMeta = modeLabelMap[leave.requestMode] || modeLabelMap.normal;

        const timeDisplay = leave.type === 'full'
            ? '<span class="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded ml-2 border border-primary/20">全天</span>'
            : `<span class="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded ml-2 border border-warning/20">${escapeHtml(leave.startTime)} - ${escapeHtml(leave.endTime)}</span>`;

        const correctionLine = leave.correctionNote
            ? `<div class="mt-1 text-[11px] leading-5 text-slate-400">补录说明：${escapeHtml(leave.correctionNote)}</div>`
            : '';

        tr.innerHTML = `
            <td class="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                <div class="flex flex-wrap items-center gap-2">
                    <span>${escapeHtml(formatDisplayDate(safeDate))}</span>
                    <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${modeMeta.style}">${modeMeta.text}</span>
                    ${timeDisplay}
                </div>
            </td>
            <td class="py-3 px-4">
                <div class="font-medium">${escapeHtml(leave.reason)}</div>
                ${correctionLine}
            </td>
            <td class="py-3 px-4">
                <button class="delete-leave px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg text-xs font-bold transition-all" data-id="${escapeHtml(leave.id)}">撤销</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
