function initTaskManagement() {
    document.getElementById('start-task').addEventListener('click', startTask);
    document.getElementById('end-task').addEventListener('click', endTask);
    updateTodayTasksList();
    updateSchedule();
    renderCurrentTaskState();
    if (currentTask) startTaskTimer();
}

const quickModal = document.getElementById('quick-capture-modal');
const quickInput = document.getElementById('quick-capture-input');

document.addEventListener('keydown', (event) => {
    if (!quickModal || !quickInput) return;

    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        if (quickModal.classList.contains('hidden')) {
            quickModal.classList.remove('hidden');
            setTimeout(() => quickInput.focus(), 50);
        } else {
            quickModal.classList.add('hidden');
        }
    }

    if (event.key === 'Escape' && !quickModal.classList.contains('hidden')) {
        quickModal.classList.add('hidden');
    }
});

quickInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        const text = quickInput.value.trim();
        const tag = document.getElementById('quick-capture-tag').value;

        if (text) {
            const today = getTodayString();
            if (!quickNotesData[today]) quickNotesData[today] = [];
            quickNotesData[today].unshift({ time: getCurrentTimeString(), text, tag });
            saveData();
            quickInput.value = '';
            quickModal?.classList.add('hidden');
            updateQuickNotesList();

            if (typeof renderArchive === 'function' && !document.getElementById('archive-section').classList.contains('hidden')) {
                renderArchive(document.getElementById('archive-search-input').value.trim());
            }

            checkAchievements();
            lucide.createIcons();
        }
    }
});

function renderArchive(filterText = '') {
    const container = document.getElementById('archive-list-container');
    const dates = Object.keys(quickNotesData).sort((a, b) => new Date(b) - new Date(a));

    let html = '';
    let hasResults = false;
    const searchText = filterText.toLowerCase();

    dates.forEach((date) => {
        const notes = quickNotesData[date];
        if (!notes || !notes.length) return;
        const safeDate = escapeHtml(date);

        let sectionHtml = '';
        notes.forEach((note, originalIndex) => {
            const noteText = getNoteText(note);
            if (!noteText.toLowerCase().includes(searchText)) return;

            hasResults = true;
            const tagKey = note.tag || 'idea';
            const tagCfg = noteTagConfig[tagKey] || noteTagConfig.idea;
            sectionHtml += `
                <div class="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-primary/30 transition-colors relative group">
                    <div class="flex flex-col gap-2 mt-1 shrink-0 w-16 items-center">
                        <span class="text-sm font-mono text-slate-400 bg-slate-200/50 dark:bg-slate-800/50 px-2 py-0.5 rounded w-full text-center">${escapeHtml(getNoteTime(note))}</span>
                        <span class="text-[10px] flex items-center justify-center gap-1 border px-1.5 py-0.5 rounded w-full ${tagCfg.color}">
                            <i data-lucide="${tagCfg.icon}" class="w-3 h-3"></i> ${tagCfg.label}
                        </span>
                    </div>
                    <div class="text-sm text-slate-700 dark:text-slate-300 md-content w-full overflow-hidden break-words pr-8">
                        ${DOMPurify.sanitize(marked.parse(noteText))}
                    </div>
                    <button class="delete-note-btn absolute top-4 right-4 text-slate-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity" data-date="${safeDate}" data-index="${originalIndex}" title="删除记录">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
        });

        if (!sectionHtml) return;

        html += `
            <div class="bg-cardLight dark:bg-cardDark rounded-2xl p-6 shadow-soft border border-slate-100 dark:border-slate-800">
                <h3 class="text-lg font-bold mb-4 text-primary flex items-center gap-2">
                    <i data-lucide="calendar" class="w-5 h-5"></i> ${safeDate}
                </h3>
                <div class="space-y-4">
                    ${sectionHtml}
                </div>
            </div>
        `;
    });

    if (!hasResults) {
        container.innerHTML = `
            <div class="bg-cardLight dark:bg-cardDark rounded-2xl p-10 shadow-soft border border-slate-100 dark:border-slate-800 text-center flex flex-col items-center justify-center text-slate-400">
                <i data-lucide="inbox" class="w-12 h-12 mb-3 opacity-50"></i>
                <p>${filterText ? '没有找到包含该关键词的记录' : '你的噬星体捕捉池目前空空如也'}</p>
            </div>
        `;
    } else {
        container.innerHTML = html;
    }

    lucide.createIcons();
}

document.getElementById('archive-search-input')?.addEventListener('input', (event) => {
    renderArchive(event.target.value.trim());
});

function updateQuickNotesList() {
    const container = document.getElementById('quick-notes-container');
    const notes = quickNotesData[getTodayString()] || [];
    if (!notes.length) {
        container.innerHTML = '<div class="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">今天还没有任何火花... 按 Ctrl+K 记录。</div>';
        return;
    }

    container.innerHTML = notes.map((note, index) => {
        const noteText = getNoteText(note);
        const tagKey = note.tag || 'idea';
        const tagCfg = noteTagConfig[tagKey] || noteTagConfig.idea;
        return `
            <div class="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/50 group hover:border-primary/30 transition-colors relative">
                <div class="flex flex-col gap-1.5 mt-1 shrink-0 w-12 items-center">
                    <span class="text-xs font-mono text-slate-400">${escapeHtml(getNoteTime(note))}</span>
                    <span class="text-[9px] border px-1 rounded w-full text-center ${tagCfg.color}">${tagCfg.label}</span>
                </div>
                <div class="text-sm text-slate-700 dark:text-slate-300 md-content w-full overflow-hidden break-words pr-6">
                    ${DOMPurify.sanitize(marked.parse(noteText))}
                </div>
                <button class="delete-note-btn absolute top-3 right-3 text-slate-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity p-1" data-date="${getTodayString()}" data-index="${index}">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function handleNoteDeletion(event) {
    const btn = event.target.closest('.delete-note-btn');
    if (!btn) return;

    if (confirm('警告：确定要将这条记录从存储核心中永久抹除吗？')) {
        const date = btn.getAttribute('data-date');
        const index = parseInt(btn.getAttribute('data-index'), 10);

        if (quickNotesData[date]) {
            quickNotesData[date].splice(index, 1);

            if (quickNotesData[date].length === 0) {
                delete quickNotesData[date];
            }

            saveData();
            showToast('记录已抹除', 'success');
            updateQuickNotesList();

            if (typeof renderArchive === 'function' && !document.getElementById('archive-section').classList.contains('hidden')) {
                renderArchive(document.getElementById('archive-search-input').value.trim());
            }
        }
    }
}

document.getElementById('archive-list-container')?.addEventListener('click', handleNoteDeletion);
document.getElementById('quick-notes-container')?.addEventListener('click', handleNoteDeletion);

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
