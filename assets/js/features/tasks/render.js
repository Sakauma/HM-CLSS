/**
 * 任务渲染层。
 * 负责今日任务表格和时间轴视图。
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
        className: 'surface-table-row'
    });
    const nameCell = createDomElement('td', { className: 'py-3 px-4 font-medium flex items-center' });
    const tagChip = createDomElement('span', {
        className: 'semantic-tag semantic-tag-neutral semantic-tag-tight mr-2 whitespace-nowrap',
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
                className: 'semantic-tag semantic-tag-success semantic-tag-tight',
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

function updateSchedule() {
    const tasks = getDailyEntries(taskData, getTodayString());
    const container = document.getElementById('schedule-content');

    if (!tasks.length) {
        container.replaceChildren(createScheduleEmptyState());
        return;
    }

    const fragment = document.createDocumentFragment();
    const hourHeight = 384 / 18;
    let renderedBlockCount = 0;

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

        fragment.appendChild(createScheduleBlock(task, top, height));
        renderedBlockCount += 1;
    });

    if (renderedBlockCount === 0) {
        container.replaceChildren(createScheduleEmptyState());
        return;
    }

    container.replaceChildren(fragment);
}
