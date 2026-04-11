function initTaskManagement() {
    document.getElementById('start-task').addEventListener('click', startTask);
    document.getElementById('end-task').addEventListener('click', endTask);
    updateTodayTasksList();
    updateSchedule();
    renderCurrentTaskState();
    if (currentTask) startTaskTimer();
}

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

function startTaskTimer() {
    if (taskTimer) clearInterval(taskTimer);
    renderCurrentTaskState();
    taskTimer = setInterval(() => {
        if (!currentTask) return;
        renderCurrentTaskState();
    }, 1000);
}

function endTask() {
    if (!currentTask) return;

    clearInterval(taskTimer);
    taskTimer = null;
    const duration = Math.floor((Date.now() - currentTask.startTimestamp) / 60000);
    if (!taskData[getTodayString()]) taskData[getTodayString()] = [];
    taskData[getTodayString()].push({ ...currentTask, endTime: getCurrentTimeString(), duration, completed: true });
    currentTask = null;
    persistCurrentTask();
    saveData(true);
    renderCurrentTaskState();
    updateTodayTasksList();
    updateSchedule();
    updateTodayStatus();
    checkAchievements();
}

function updateTodayTasksList() {
    const tasks = taskData[getTodayString()] || [];
    const tbody = document.getElementById('today-tasks-table');
    if (!tasks.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 px-4 text-center text-slate-400">暂无任务记录</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    tasks.forEach((task) => {
        const durationMins = Number.isFinite(task.duration) ? task.duration : 0;
        const h = Math.floor(durationMins / 60);
        const m = durationMins % 60;
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
                <td class="py-3 px-4 text-slate-500">${h > 0 ? `${h}h ${m}m` : `${m}m`}</td>
                <td class="py-3 px-4"><span class="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md text-xs font-bold">已完成</span></td>
            </tr>
        `;
    });
}

function updateSchedule() {
    const tasks = taskData[getTodayString()] || [];
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
