/**
 * 任务模块。
 * 负责当前任务计时、当日任务列表和时间轴映射的维护与渲染。
 */

function createTaskEmptyRow() {
    const row = document.createElement('tr');
    const cell = createDomElement('td', {
        className: 'py-4 px-4 text-center text-slate-400',
        text: '暂无任务记录',
        attrs: { colspan: '5' }
    });
    row.appendChild(cell);
    return row;
}

function createTaskRow(task) {
    const durationMins = Number.isFinite(task.duration) ? task.duration : 0;
    const tagName = tagMap[task.tag || 'other'];
    const startTime = typeof task.startTime === 'string' ? task.startTime : '-';
    const endTime = typeof task.endTime === 'string' ? task.endTime : '-';

    const row = createDomElement('tr', {
        className: 'hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors'
    });
    const nameCell = createDomElement('td', { className: 'py-3 px-4 font-medium flex items-center' });
    const tagChip = createDomElement('span', {
        className: 'text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded mr-2 border border-slate-200 dark:border-slate-600 whitespace-nowrap',
        text: tagName
    });
    const nameText = createDomElement('span', {
        className: 'truncate max-w-[200px]',
        text: task.name
    });

    appendDomChildren(nameCell, [tagChip, nameText]);
    appendDomChildren(row, [
        nameCell,
        createDomElement('td', {
            className: 'py-3 px-4 text-slate-500 font-mono',
            text: startTime
        }),
        createDomElement('td', {
            className: 'py-3 px-4 text-slate-500 font-mono',
            text: endTime
        }),
        createDomElement('td', {
            className: 'py-3 px-4 text-slate-500',
            text: formatDurationLabel(durationMins)
        }),
        appendDomChildren(createDomElement('td', { className: 'py-3 px-4' }), [
            createDomElement('span', {
                className: 'px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md text-xs font-bold',
                text: '已完成'
            })
        ])
    ]);

    return row;
}

function createScheduleEmptyState() {
    return createDomElement('div', {
        className: 'absolute inset-0 flex items-center justify-center text-slate-400 text-sm',
        text: '今日暂无数据留存'
    });
}

function createScheduleBlock(task, top, height) {
    return appendDomChildren(createDomElement('div', {
        className: 'absolute left-4 right-4 bg-primary/90 text-white p-2 rounded-xl shadow-sm hover:bg-primary transition-all overflow-hidden border border-white/20',
        attrs: { style: `top: ${top}px; height: ${Math.max(height, 30)}px;` }
    }), [
        createDomElement('div', {
            className: 'font-bold text-xs truncate',
            text: task.name
        }),
        createDomElement('div', {
            className: 'text-[10px] opacity-90 font-mono mt-0.5',
            text: `${task.startTime} - ${task.endTime}`
        })
    ]);
}

/**
 * 挂载任务相关按钮，并恢复页面首次渲染所需的任务状态。
 */
function initTaskManagement() {
    document.getElementById('start-task').addEventListener('click', startTask);
    document.getElementById('end-task').addEventListener('click', endTask);
    updateTodayTasksList();
    updateSchedule();
    renderCurrentTaskState();
    if (currentTask) startTaskTimer();
}

/**
 * 启动一个新的主任务。
 * 若已有任务在运行，则先自动结束旧任务，保证同一时刻只有一条主线。
 */
function startTask() {
    const name = document.getElementById('task-name').value.trim();
    const tagValue = document.getElementById('task-tag').value;
    if (!name) return showToast('请输入任务名称', 'warning');
    if (currentTask) endTask();

    setRuntimeValue('currentTask', {
        id: 'task_' + Date.now(),
        name,
        tag: tagValue,
        startTime: getCurrentTimeString(),
        startTimestamp: Date.now()
    });

    persistCurrentTask();
    renderCurrentTaskState();
    document.getElementById('task-name').value = '';

    startTaskTimer();
    updateTodayStatus();
}

/**
 * 启动当前任务的秒级刷新计时器，仅用于更新展示层的耗时和进度。
 */
function startTaskTimer() {
    if (taskTimer) clearInterval(taskTimer);
    renderCurrentTaskState();
    setRuntimeValue('taskTimer', setInterval(() => {
        if (!currentTask) return;
        renderCurrentTaskState();
    }, 1000));
}

/**
 * 结束当前任务并写入当日任务日志。
 */
function endTask() {
    if (!currentTask) return;

    clearInterval(taskTimer);
    setRuntimeValue('taskTimer', null);
    const duration = Math.floor((Date.now() - currentTask.startTimestamp) / 60000);
    appendDailyEntry(taskData, getTodayString(), {
        ...currentTask,
        endTime: getCurrentTimeString(),
        duration,
        completed: true
    });
    setRuntimeValue('currentTask', null);
    persistCurrentTask();
    saveData(true);
    renderCurrentTaskState();
    updateTodayTasksList();
    updateSchedule();
    updateTodayStatus();
    checkAchievements();
}

/**
 * 刷新“今日任务”表格，并展示已完成任务数量。
 */
function updateTodayTasksList() {
    const tasks = getDailyEntries(taskData, getTodayString());
    const tbody = document.getElementById('today-tasks-table');
    const taskReadyCountEl = document.getElementById('task-ready-count');

    if (taskReadyCountEl) {
        taskReadyCountEl.textContent = `${tasks.length} 项`;
    }

    if (!tasks.length) {
        tbody.replaceChildren(createTaskEmptyRow());
        return;
    }

    const fragment = document.createDocumentFragment();

    tasks.forEach((task) => {
        fragment.appendChild(createTaskRow(task));
    });

    tbody.replaceChildren(fragment);
}

/**
 * 将今日任务按开始/结束时间映射到时间轴，用于快速回看节奏分布。
 */
function updateSchedule() {
    const tasks = getDailyEntries(taskData, getTodayString());
    const container = document.getElementById('schedule-content');

    if (!tasks.length) {
        container.replaceChildren(createScheduleEmptyState());
        return;
    }

    const fragment = document.createDocumentFragment();
    const hourHeight = 384 / 18;

    tasks.forEach((task) => {
        if (typeof task.startTime !== 'string' || typeof task.endTime !== 'string') return;

        const [sh, sm] = task.startTime.split(':').map(Number);
        const [eh, em] = task.endTime.split(':').map(Number);

        let startHour = sh + (sm / 60);
        let endHour = eh + (em / 60);
        if (endHour <= 6) return;
        if (startHour < 6) startHour = 6;
        if (endHour > 24) endHour = 24;

        // 以 06:00 作为时间轴起点，将实际时间换算为像素位置。
        const top = (startHour - 6) * hourHeight;
        const height = (endHour - startHour) * hourHeight;

        fragment.appendChild(createScheduleBlock(task, top, height));
    });

    container.replaceChildren(fragment);
}

registerAppModule({
    id: 'tasks',
    order: 50,
    init: initTaskManagement
});
