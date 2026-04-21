/**
 * 挂载任务相关按钮，并恢复页面首次渲染所需的任务状态。
 */
function initTaskManagement() {
    const disposables = createDisposables();
    disposables.listen(document.getElementById('start-task'), 'click', startTask);
    disposables.listen(document.getElementById('end-task'), 'click', endTask);
    updateTodayTasksList();
    updateSchedule();
    if (runtimeSelectors.currentTask()) startTaskTimer();
    return () => {
        const timerHandle = runtimeSelectors.taskTimer();
        if (timerHandle) {
            clearInterval(timerHandle);
            runtimeActions.setTaskTimer(null);
        }
        disposables.dispose();
    };
}

/**
 * 启动一个新的主任务。
 * 若已有任务在运行，则先自动结束旧任务，保证同一时刻只有一条主线。
 */
function startTask() {
    const name = document.getElementById('task-name').value.trim();
    const tagValue = document.getElementById('task-tag').value;
    if (!name) return showToast('请输入任务名称', 'warning');
    if (runtimeSelectors.currentTask()) endTask();

    runtimeActions.setCurrentTask({
        id: 'task_' + Date.now(),
        name,
        tag: tagValue,
        startTime: getCurrentTimeString(),
        startTimestamp: Date.now()
    });

    persistCurrentTask();
    document.getElementById('task-name').value = '';

    startTaskTimer();
    updateTodayStatus();
}

/**
 * 启动当前任务的秒级刷新计时器，仅用于更新展示层的耗时和进度。
 */
function startTaskTimer() {
    const timerHandle = runtimeSelectors.taskTimer();
    if (timerHandle) clearInterval(timerHandle);
    renderCurrentTaskState();
    runtimeActions.setTaskTimer(setInterval(() => {
        if (!runtimeSelectors.currentTask()) return;
        renderCurrentTaskState();
    }, 1000));
}

/**
 * 结束当前任务并写入当日任务日志。
 */
function endTask() {
    const activeTask = runtimeSelectors.currentTask();
    if (!activeTask) return;

    clearInterval(runtimeSelectors.taskTimer());
    runtimeActions.setTaskTimer(null);
    const duration = Math.floor((Date.now() - activeTask.startTimestamp) / 60000);
    appendDailyEntry(taskData, getTodayString(), {
        ...activeTask,
        endTime: getCurrentTimeString(),
        duration,
        completed: true
    });
    runtimeActions.clearCurrentTask();
    persistCurrentTask();
    saveData(true);
    updateTodayTasksList();
    updateSchedule();
    updateTodayStatus();
    checkAchievements();
}

registerAppModule({
    id: 'tasks',
    order: 50,
    init: initTaskManagement
});
