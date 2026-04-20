/**
 * 根据 currentTask 的状态刷新任务首屏卡片和进度条展示。
 */
function renderCurrentTaskState() {
    const activeTask = runtimeSelectors.currentTask();
    const container = document.getElementById('current-task-container');
    const readyPanel = document.getElementById('task-ready-panel');
    const readyStatusEl = document.getElementById('task-ready-status');
    const readyHintEl = document.getElementById('task-ready-hint');
    const nameEl = document.getElementById('current-task-name');
    const timeEl = document.getElementById('current-task-time');
    const progressBar = document.getElementById('task-progress-bar');

    if (!activeTask) {
        container.classList.add('hidden');
        readyPanel?.classList.remove('hidden');
        if (readyStatusEl) readyStatusEl.textContent = '待命';
        if (readyHintEl) readyHintEl.textContent = '先给今天的主线起个名字，再开计时。';
        nameEl.textContent = '-';
        timeEl.textContent = '已进行: 00:00:00';
        progressBar.style.width = '0%';
        return;
    }

    const elapsed = Math.max(0, Date.now() - activeTask.startTimestamp);
    const h = Math.floor(elapsed / 3600000);
    const m = Math.floor((elapsed % 3600000) / 60000);
    const s = Math.floor((elapsed % 60000) / 1000);

    setElementBadgeLabel(nameEl, tagMap[activeTask.tag] || tagMap.other, activeTask.name, {
        badgeClass: 'text-xs bg-primary/20 text-primary px-2 py-1 rounded-md mr-2'
    });
    timeEl.textContent = `已进行: ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    progressBar.style.width = `${Math.min((elapsed / 36000000) * 100, 100)}%`;
    readyPanel?.classList.add('hidden');
    if (readyStatusEl) readyStatusEl.textContent = '进行中';
    if (readyHintEl) readyHintEl.textContent = '主线已经跑起来了，临时念头丢进右侧捕捉池就行。';
    container.classList.remove('hidden');
}

function initTaskHero() {
    return subscribeRuntimeValue('currentTask', () => {
        renderCurrentTaskState();
    }, { immediate: true });
}

registerAppModule({
    id: 'task-hero',
    order: 49,
    init: initTaskHero
});
