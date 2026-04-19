/**
 * 任务模块。
 * 负责当前任务计时、当日任务列表和时间轴映射的维护与渲染。
 */

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

    currentTask = {
        id: 'task_' + Date.now(),
        name,
        tag: tagValue,
        startTime: getCurrentTimeString(),
        startTimestamp: Date.now()
    };

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
    taskTimer = setInterval(() => {
        if (!currentTask) return;
        renderCurrentTaskState();
    }, 1000);
}

/**
 * 结束当前任务并写入当日任务日志。
 */
function endTask() {
    if (!currentTask) return;

    clearInterval(taskTimer);
    taskTimer = null;
    const duration = Math.floor((Date.now() - currentTask.startTimestamp) / 60000);
    appendDailyEntry(taskData, getTodayString(), {
        ...currentTask,
        endTime: getCurrentTimeString(),
        duration,
        completed: true
    });
    currentTask = null;
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
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 px-4 text-center text-slate-400">暂无任务记录</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    tasks.forEach((task) => {
        const durationMins = Number.isFinite(task.duration) ? task.duration : 0;
        const tagName = tagMap[task.tag || 'other'];
        const startTime = typeof task.startTime === 'string' ? task.startTime : '-';
        const endTime = typeof task.endTime === 'string' ? task.endTime : '-';

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                <td class="py-3 px-4 font-medium flex items-center">
                    <span class="text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded mr-2 border border-slate-200 dark:border-slate-600 whitespace-nowrap">
                        ${escapeHtml(tagName)}
                    </span>
                    <span class="truncate max-w-[200px]">${escapeHtml(task.name)}</span>
                </td>
                <td class="py-3 px-4 text-slate-500 font-mono">${escapeHtml(startTime)}</td>
                <td class="py-3 px-4 text-slate-500 font-mono">${escapeHtml(endTime)}</td>
                <td class="py-3 px-4 text-slate-500">${formatDurationLabel(durationMins)}</td>
                <td class="py-3 px-4"><span class="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md text-xs font-bold">已完成</span></td>
            </tr>
        `;
    });
}

/**
 * 将今日任务按开始/结束时间映射到时间轴，用于快速回看节奏分布。
 */
function updateSchedule() {
    const tasks = getDailyEntries(taskData, getTodayString());
    const container = document.getElementById('schedule-content');

    if (!tasks.length) {
        container.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">今日暂无数据留存</div>';
        return;
    }

    container.innerHTML = '';
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

        container.innerHTML += `
            <div class="absolute left-4 right-4 bg-primary/90 text-white p-2 rounded-xl shadow-sm hover:bg-primary transition-all overflow-hidden border border-white/20" style="top: ${top}px; height: ${Math.max(height, 30)}px;">
                <div class="font-bold text-xs truncate">${escapeHtml(task.name)}</div>
                <div class="text-[10px] opacity-90 font-mono mt-0.5">${task.startTime} - ${task.endTime}</div>
            </div>
        `;
    });
}
