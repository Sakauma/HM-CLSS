function initLeaveManagement() {
    document.getElementById('leave-date').value = getTodayString();
    document.getElementById('add-leave').addEventListener('click', addLeave);

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

    document.getElementById('leave-type').addEventListener('change', (event) => {
        const timeContainer = document.getElementById('leave-time-container');
        if (event.target.value === 'partial') {
            timeContainer.classList.remove('hidden');
        } else {
            timeContainer.classList.add('hidden');
        }
    });

    document.getElementById('btn-current-time').addEventListener('click', (event) => {
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
    });

    document.getElementById('leave-records-table').addEventListener('click', function(event) {
        const btn = event.target.closest('.delete-leave');
        if (!btn) return;

        if (confirm('确定撤销该记录吗？')) {
            const id = btn.getAttribute('data-id');
            const dateFallback = btn.getAttribute('data-date');

            let leaveObj;
            if (id) {
                leaveObj = leaveData.find((leave) => leave.id === id);
                leaveData = leaveData.filter((leave) => leave.id !== id);
            } else {
                leaveObj = leaveData.find((leave) => leave.date === dateFallback);
                leaveData = leaveData.filter((leave) => leave.date !== dateFallback);
            }

            if (leaveObj) {
                const date = leaveObj.date;
                if (checkinData[date]) {
                    if (!leaveObj.type || leaveObj.type === 'full') {
                        checkinData[date].leave = false;
                        checkinData[date].leaveReason = '';
                    } else if (checkinData[date].partialLeaves) {
                        checkinData[date].partialLeaves = checkinData[date].partialLeaves.filter((leave) => leave.id !== id);
                    }
                }
                saveData();
                updateLeaveRecordsList();
                if (date === getTodayString()) {
                    updateCheckinButtons();
                    updateTodayStatus();
                }
            }
        }
    });

    updateLeaveRecordsList();
}

function addLeave() {
    const date = document.getElementById('leave-date').value;
    const reason = document.getElementById('leave-reason').value.trim();
    const type = document.getElementById('leave-type').value;

    let startTime = null;
    let endTime = null;
    if (type === 'partial') {
        startTime = document.getElementById('leave-start-time').value;
        endTime = document.getElementById('leave-end-time').value;
        if (startTime >= endTime) {
            return showToast('结束时间必须晚于开始时间，请调整', 'warning');
        }
    }

    if (!date || !reason) return showToast('请完整填写离舰信息', 'warning');

    const newLeaveId = 'leave_' + Date.now();
    leaveData.push({ id: newLeaveId, date, reason, type, startTime, endTime });

    if (!checkinData[date]) {
        checkinData[date] = {
            morning: { checkIn: null, checkOut: null, status: { checkIn: null, checkOut: null } },
            afternoon: { checkIn: null, checkOut: null, status: { checkIn: null, checkOut: null } },
            evening: { checkIn: null, checkOut: null, status: { checkIn: null, checkOut: null } },
            leave: false,
            leaveReason: ''
        };
    }

    if (type === 'full') {
        checkinData[date].leave = true;
        checkinData[date].leaveReason = reason;
    } else {
        if (!checkinData[date].partialLeaves) checkinData[date].partialLeaves = [];
        checkinData[date].partialLeaves.push({ id: newLeaveId, reason, startTime, endTime });
    }

    saveData();
    document.getElementById('leave-reason').value = '';
    updateLeaveRecordsList();

    if (date === getTodayString()) {
        updateCheckinButtons();
        updateTodayStatus();
    }
    showToast('离舰报备归档成功', 'success');
}

function updateLeaveRecordsList() {
    const tbody = document.getElementById('leave-records-table');
    if (!leaveData.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="py-4 px-4 text-center text-slate-400">暂无历史归档</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    [...leaveData].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach((leave) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors';
        const safeDate = escapeHtml(leave.date);

        let timeDisplay = '';
        if (!leave.type || leave.type === 'full') {
            timeDisplay = '<span class="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded ml-2 border border-primary/20">全天</span>';
        } else {
            timeDisplay = `<span class="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded ml-2 border border-warning/20">${escapeHtml(leave.startTime)} - ${escapeHtml(leave.endTime)}</span>`;
        }

        const idAttr = leave.id ? `data-id="${escapeHtml(leave.id)}"` : `data-date="${safeDate}"`;

        tr.innerHTML = `
            <td class="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                ${safeDate} ${timeDisplay}
            </td>
            <td class="py-3 px-4 font-medium">${escapeHtml(leave.reason)}</td>
            <td class="py-3 px-4"><button class="delete-leave px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg text-xs font-bold transition-all" ${idAttr}>撤销</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function initStatistics() {
    document.querySelectorAll('.stats-period-btn').forEach((btn) => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.stats-period-btn').forEach((button) => {
                button.className = 'stats-period-btn text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-1.5 px-5 rounded-lg font-medium text-sm transition-all';
            });
            this.className = 'stats-period-btn bg-white dark:bg-slate-700 text-slate-900 dark:text-white py-1.5 px-5 rounded-lg font-medium shadow-sm text-sm transition-all';
            updateStatisticsCharts(this.getAttribute('data-period'));
        });
    });
    updateSummaryStatistics();
}

function updateStatisticsCharts(period) {
    const isDark = document.documentElement.classList.contains('dark');
    Chart.defaults.color = isDark ? '#94a3b8' : '#64748b';
    Chart.defaults.borderColor = isDark ? '#334155' : '#e2e8f0';

    const { startDate, endDate, labels } = getDateRange(period);

    try { updateCheckinRateChart(labels, prepareCheckinRateData(startDate, endDate, labels)); } catch (error) { console.error(error); }
    try { updateCheckinPeriodChart(prepareCheckinPeriodData(startDate, endDate)); } catch (error) { console.error(error); }
    try { updateTaskDurationChart(labels, prepareTaskDurationData(startDate, endDate, labels)); } catch (error) { console.error(error); }
    try { updatePhoneResistChart(labels, preparePhoneResistData(startDate, endDate, labels)); } catch (error) { console.error(error); }
    try { updateTagChart(prepareTagData(startDate, endDate)); } catch (error) { console.error(error); }
}

function getDateRange(period) {
    const end = new Date();
    const start = new Date();
    const labels = [];

    if (period === 'week') {
        start.setDate(end.getDate() - 6);
        for (let i = 0; i < 7; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            labels.push(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
        }
    } else if (period === 'month') {
        start.setDate(end.getDate() - 29);
        for (let i = 0; i < 30; i += 3) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            labels.push(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
        }
    } else if (period === 'year') {
        start.setDate(1);
        start.setMonth(end.getMonth() - 11);
        for (let i = 0; i < 12; i++) {
            const date = new Date(start);
            date.setMonth(start.getMonth() + i);
            labels.push(date.toLocaleDateString('zh-CN', { month: 'short' }));
        }
    }

    return { startDate: start, endDate: end, labels };
}

function getMonthRange(baseDate, offset = 0) {
    const start = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
    const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset + 1, 0);
    return { start, end };
}

function calculateCheckinRateForRange(start, end) {
    let total = 0;
    let qualified = 0;
    const current = new Date(start);

    while (current <= end) {
        const day = checkinData[formatLocalDate(current)];
        if (day && !day.leave) {
            ['morning', 'afternoon', 'evening'].forEach((period) => {
                if (day[period].checkIn !== null) {
                    total++;
                    if (day[period].status.checkIn === true || day[period].status.checkIn === 'success') qualified++;
                }
                if (day[period].checkOut !== null) {
                    total++;
                    if (
                        day[period].status.checkOut === true ||
                        day[period].status.checkOut === 'success' ||
                        day[period].status.checkOut === 'warning'
                    ) {
                        qualified++;
                    }
                }
            });
        }
        current.setDate(current.getDate() + 1);
    }

    return total > 0 ? (qualified / total) * 100 : 0;
}

function calculateTaskHoursForRange(start, end) {
    const current = new Date(start);
    let totalMinutes = 0;

    while (current <= end) {
        const dayTasks = taskData[formatLocalDate(current)] || [];
        totalMinutes += dayTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
        current.setDate(current.getDate() + 1);
    }

    return totalMinutes / 60;
}

function calculatePhoneResistForRange(start, end) {
    const current = new Date(start);
    let totalCount = 0;

    while (current <= end) {
        const dayRecord = phoneResistData.records[formatLocalDate(current)];
        totalCount += dayRecord ? dayRecord.count : 0;
        current.setDate(current.getDate() + 1);
    }

    return totalCount;
}

function prepareCheckinRateData(start, end, labels) {
    const data = [];
    for (let i = 0; i < labels.length; i++) {
        if (labels.length === 12) {
            const { start: monthStart, end: monthEnd } = getMonthRange(start, i);
            data.push(calculateCheckinRateForRange(monthStart, monthEnd));
            continue;
        }

        const date = new Date(start);
        if (labels.length === 7) {
            date.setDate(start.getDate() + i);
        } else if (labels.length === 10) {
            date.setDate(start.getDate() + i * 3);
        }

        const ds = formatLocalDate(date);
        const day = checkinData[ds];
        if (!day || day.leave) {
            data.push(null);
        } else {
            let total = 0;
            let qualified = 0;
            ['morning', 'afternoon', 'evening'].forEach((period) => {
                if (day[period].checkIn !== null) {
                    total++;
                    if (day[period].status.checkIn === true || day[period].status.checkIn === 'success') qualified++;
                }
                if (day[period].checkOut !== null) {
                    total++;
                    if (
                        day[period].status.checkOut === true ||
                        day[period].status.checkOut === 'success' ||
                        day[period].status.checkOut === 'warning'
                    ) {
                        qualified++;
                    }
                }
            });
            data.push(total > 0 ? (qualified / total) * 100 : 0);
        }
    }
    return data;
}

function prepareCheckinPeriodData(start, end) {
    const result = { m: { i: 0, q: 0 }, a: { i: 0, q: 0 }, e: { i: 0, q: 0 } };
    const current = new Date(start);
    while (current <= end) {
        const day = checkinData[formatLocalDate(current)];
        if (day && !day.leave) {
            if (day.morning.checkIn) { result.m.i++; if (day.morning.status.checkIn) result.m.q++; }
            if (day.afternoon.checkIn) { result.a.i++; if (day.afternoon.status.checkIn) result.a.q++; }
            if (day.evening.checkIn) { result.e.i++; if (day.evening.status.checkIn) result.e.q++; }
        }
        current.setDate(current.getDate() + 1);
    }
    return result;
}

function prepareTaskDurationData(start, end, labels) {
    const data = [];
    for (let i = 0; i < labels.length; i++) {
        if (labels.length === 12) {
            const { start: monthStart, end: monthEnd } = getMonthRange(start, i);
            data.push(Number(calculateTaskHoursForRange(monthStart, monthEnd).toFixed(2)));
            continue;
        }

        const date = new Date(start);
        if (labels.length === 7) {
            date.setDate(start.getDate() + i);
        } else if (labels.length === 10) {
            date.setDate(start.getDate() + i * 3);
        }
        const ds = formatLocalDate(date);
        data.push((taskData[ds] || []).reduce((sum, task) => sum + task.duration, 0) / 60);
    }
    return data;
}

function preparePhoneResistData(start, end, labels) {
    const data = [];
    for (let i = 0; i < labels.length; i++) {
        if (labels.length === 12) {
            const { start: monthStart, end: monthEnd } = getMonthRange(start, i);
            data.push(calculatePhoneResistForRange(monthStart, monthEnd));
            continue;
        }

        const date = new Date(start);
        if (labels.length === 7) {
            date.setDate(start.getDate() + i);
        } else if (labels.length === 10) {
            date.setDate(start.getDate() + i * 3);
        }
        const ds = formatLocalDate(date);
        data.push(phoneResistData.records[ds] ? phoneResistData.records[ds].count : 0);
    }
    return data;
}

function prepareTagData(start, end) {
    const tagCounts = { paper: 0, code: 0, experiment: 0, write: 0, other: 0 };
    const current = new Date(start);
    while (current <= end) {
        const dayTasks = taskData[formatLocalDate(current)] || [];
        dayTasks.forEach((task) => {
            if (task.duration) tagCounts[task.tag || 'other'] += task.duration;
        });
        current.setDate(current.getDate() + 1);
    }
    return [tagCounts.paper, tagCounts.code, tagCounts.experiment, tagCounts.write, tagCounts.other].map((minutes) => Number((minutes / 60).toFixed(2)));
}

function updateCheckinRateChart(labels, data) {
    const canvas = document.getElementById('checkin-rate-chart');
    if (!canvas) return;
    if (window.checkinRateChart) window.checkinRateChart.destroy();
    window.checkinRateChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: '打卡合规率(%)',
                data,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
    });
}

function updateCheckinPeriodChart(data) {
    const canvas = document.getElementById('checkin-period-chart');
    if (!canvas) return;
    if (window.checkinPeriodChart) window.checkinPeriodChart.destroy();
    window.checkinPeriodChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['上午', '下午', '晚上'],
            datasets: [
                { label: '总打卡次数', data: [data.m.i, data.a.i, data.e.i], backgroundColor: 'rgba(99, 102, 241, 0.8)' },
                { label: '合格次数', data: [data.m.q, data.a.q, data.e.q], backgroundColor: 'rgba(16, 185, 129, 0.8)' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function updateTaskDurationChart(labels, data) {
    const canvas = document.getElementById('task-duration-chart');
    if (!canvas) return;
    if (window.taskDurationChart) window.taskDurationChart.destroy();
    window.taskDurationChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: '任务时长(小时)', data, backgroundColor: '#6366f1', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function updatePhoneResistChart(labels, data) {
    const canvas = document.getElementById('phone-resist-chart');
    if (!canvas) return;
    if (window.phoneResistChart) window.phoneResistChart.destroy();
    window.phoneResistChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: '克制次数',
                data,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function updateTagChart(data) {
    const canvas = document.getElementById('task-tag-chart');
    if (!canvas) return;
    if (window.taskTagChart) window.taskTagChart.destroy();

    const hasData = data.some((value) => value > 0);
    window.taskTagChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: hasData ? ['文献阅读', '代码构建', '实验跑数', '文档撰写', '杂项'] : ['暂无数据'],
            datasets: [{
                data: hasData ? data : [1],
                backgroundColor: hasData ? ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] : ['#e2e8f0'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12 } },
                tooltip: { enabled: hasData }
            },
            cutout: '75%'
        }
    });
}

function updateSummaryStatistics() {
    document.getElementById('total-checkin-days').textContent = Object.values(checkinData).filter((day) => !day.leave && (day.morning.checkIn || day.afternoon.checkIn || day.evening.checkIn)).length;

    const totalHours = calculateTotalTaskHours();
    document.getElementById('total-task-hours').textContent = totalHours;

    const sols = (totalHours * 1.5).toFixed(1);
    const eggElement = document.getElementById('space-survival-egg');
    if (eggElement) {
        eggElement.innerHTML = `🛸 折合飞船 <b>${sols} Sols</b> 维生能源`;
    }

    document.getElementById('total-phone-resist').textContent = phoneResistData.totalCount;
    document.getElementById('achievement-count').textContent = achievements.length;
}

function updateTodayStatus() {
    const today = getTodayString();
    const dayData = checkinData[today];
    ['morning', 'afternoon', 'evening'].forEach((period) => {
        const el = document.getElementById(`today-${period}-status`);

        if (dayData.leave) {
            el.textContent = '全天脱产';
            el.className = 'font-medium text-slate-400';
        } else if (dayData[period].checkIn && dayData[period].checkOut) {
            const inVal = dayData[period].status.checkIn;
            const outVal = dayData[period].status.checkOut;

            if (inVal === 'excused' || outVal === 'excused') {
                el.textContent = '已离舰';
                el.className = 'font-bold text-blue-500 dark:text-blue-400';
            } else if (!inVal || outVal === false || outVal === 'danger') {
                el.textContent = '异常';
                el.className = 'font-medium text-danger';
            } else if (outVal === 'warning') {
                el.textContent = '超时警告';
                el.className = 'font-medium text-warning';
            } else {
                el.textContent = '合规';
                el.className = 'font-medium text-success';
            }
        } else if (dayData[period].checkIn) {
            el.textContent = '工作中';
            el.className = 'font-medium text-primary';
        } else {
            el.textContent = '-';
            el.className = 'font-medium text-slate-400';
        }
    });

    document.getElementById('today-phone-count').textContent = `${phoneResistData.records[today].count} 次`;
    const activeTaskEl = document.getElementById('today-active-task');
    if (currentTask) {
        activeTaskEl.textContent = currentTask.name;
        activeTaskEl.className = 'font-medium text-primary truncate max-w-[120px]';
    } else {
        activeTaskEl.textContent = '空闲';
        activeTaskEl.className = 'font-medium text-slate-400';
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const colors = {
        success: 'bg-white dark:bg-slate-800 border-l-4 border-success text-slate-700 dark:text-slate-200',
        error: 'bg-white dark:bg-slate-800 border-l-4 border-danger text-slate-700 dark:text-slate-200',
        warning: 'bg-white dark:bg-slate-800 border-l-4 border-warning text-slate-700 dark:text-slate-200'
    };

    const icons = {
        success: '<i data-lucide="check-circle" class="w-5 h-5 text-success shrink-0"></i>',
        error: '<i data-lucide="x-circle" class="w-5 h-5 text-danger shrink-0"></i>',
        warning: '<i data-lucide="alert-triangle" class="w-5 h-5 text-warning shrink-0"></i>'
    };

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 pointer-events-auto animate-toast-in ${colors[type]}`;
    toast.innerHTML = `
        ${icons[type]}
        <span class="text-sm font-medium">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.classList.remove('animate-toast-in');
        toast.classList.add('animate-toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

let githubToken = localStorage.getItem('githubToken') || '';
let gistId = localStorage.getItem('gistId') || '';
let localLastSyncTime = localStorage.getItem('localLastSyncTime') || '';
let autoSyncTimer = null;

function updateLocalSyncTime(timeStr) {
    localLastSyncTime = timeStr;
    localStorage.setItem('localLastSyncTime', timeStr);
}

function hasMeaningfulLocalData() {
    if (currentTask) return true;

    if (phoneResistData.totalCount > 0 || leaveData.length > 0 || achievements.length > 0 || tavernData.length > 0) {
        return true;
    }

    if (Object.values(taskData).some((day) => Array.isArray(day) && day.length > 0)) {
        return true;
    }

    if (Object.values(quickNotesData).some((notes) => Array.isArray(notes) && notes.length > 0)) {
        return true;
    }

    return Object.values(checkinData).some((day) => {
        if (!day || typeof day !== 'object') return false;
        if (day.leave) return true;
        if (Array.isArray(day.partialLeaves) && day.partialLeaves.length > 0) return true;
        return ['morning', 'afternoon', 'evening'].some((period) => {
            const periodData = day[period];
            return periodData && (periodData.checkIn || periodData.checkOut);
        });
    });
}

function applyImportedData(cloudData) {
    checkinData = cloudData.checkinData || {};
    phoneResistData = cloudData.phoneResistData || { totalCount: 0, records: {} };
    taskData = cloudData.taskData || {};
    leaveData = cloudData.leaveData || [];
    achievements = cloudData.achievements || [];
    tavernData = cloudData.tavernData || [];
    if (cloudData.quickNotesData) quickNotesData = cloudData.quickNotesData;

    const today = getTodayString();
    if (!checkinData[today]) {
        checkinData[today] = {
            morning: { checkIn: null, checkOut: null, status: { checkIn: null, checkOut: null } },
            afternoon: { checkIn: null, checkOut: null, status: { checkIn: null, checkOut: null } },
            evening: { checkIn: null, checkOut: null, status: { checkIn: null, checkOut: null } },
            leave: false,
            leaveReason: ''
        };
    }
    if (!phoneResistData.records[today]) phoneResistData.records[today] = { count: 0, times: [] };
    if (!taskData[today]) taskData[today] = [];
    if (!quickNotesData[today]) quickNotesData[today] = [];

    saveData(true);
    updateLocalSyncTime(cloudData.lastSyncTime || new Date().toISOString());

    updateCheckinButtons();
    updateTodayCheckinTable();
    document.getElementById('phone-resist-count').textContent = phoneResistData.totalCount;
    document.getElementById('today-phone-resist-count').textContent = phoneResistData.records[today].count;
    updateTodayPhoneResistTimes();
    updateAchievementsList();
    updateTodayTasksList();
    updateSchedule();
    updateLeaveRecordsList();
    updateSummaryStatistics();
    renderCurrentTaskState();
    updateTodayStatus();
    if (typeof updateQuickNotesList === 'function') updateQuickNotesList();
}

function shouldAutoApplyCloudData(cloudData) {
    if (!cloudData.lastSyncTime) return false;
    if (!localLastSyncTime) return !hasMeaningfulLocalData();
    return new Date(cloudData.lastSyncTime) > new Date(localLastSyncTime);
}

document.getElementById('github-token-input').value = githubToken;
document.getElementById('gist-id-input').value = gistId;

document.getElementById('save-config-btn').addEventListener('click', () => {
    githubToken = document.getElementById('github-token-input').value.trim();
    gistId = document.getElementById('gist-id-input').value.trim();
    localStorage.setItem('githubToken', githubToken);
    localStorage.setItem('gistId', gistId);
    showToast('⚙️ 配置已保存到本地！', 'success');
});

function buildExportData() {
    return {
        checkinData,
        phoneResistData,
        taskData,
        leaveData,
        achievements,
        quickNotesData,
        tavernData,
        lastSyncTime: new Date().toISOString()
    };
}

document.getElementById('push-cloud-btn').addEventListener('click', async () => {
    if (!githubToken || !gistId) return showToast('请先配置并保存 GitHub Token 和 Gist ID', 'error');

    const btn = document.getElementById('push-cloud-btn');
    const originalText = btn.innerHTML;

    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 检查冲突...';
    lucide.createIcons();

    try {
        const getRes = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { Authorization: `token ${githubToken}`, Accept: 'application/vnd.github.v3+json' }
        });

        if (getRes.ok) {
            const data = await getRes.json();
            const file = data.files['workspace_data.json'];
            if (file && file.content) {
                const cloudData = JSON.parse(file.content);
                if (cloudData.lastSyncTime) {
                    if (!localLastSyncTime || new Date(cloudData.lastSyncTime) > new Date(localLastSyncTime)) {
                        const confirmPush = confirm('⚠️ 严重警告：\n\n检测到云端存在比您本地更新的数据（可能来自您的另一台设备），或您的本地缺乏同步记录。\n如果您执意上传，云端的新数据将被彻底抹除！\n\n强烈建议点击"取消"，并先执行"拉取云端数据"。\n\n是否仍然要强制覆盖云端？');
                        if (!confirmPush) {
                            btn.innerHTML = originalText;
                            lucide.createIcons();
                            return showToast('已拦截上传操作，保护了云端数据', 'warning');
                        }
                    }
                }
            }
        }

        btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 上传中...';
        lucide.createIcons();

        const currentSyncTime = new Date().toISOString();
        const exportData = buildExportData();
        exportData.lastSyncTime = currentSyncTime;

        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                Authorization: `token ${githubToken}`,
                Accept: 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                files: {
                    'workspace_data.json': {
                        content: JSON.stringify(exportData, null, 2)
                    }
                }
            })
        });

        if (response.ok) {
            updateLocalSyncTime(currentSyncTime);
            showToast('✅ 成功同步至云端！', 'success');
        } else {
            showToast('❌ 上传失败，请检查配置信息。', 'error');
        }
    } catch (error) {
        showToast('🌐 网络请求失败：' + error.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        lucide.createIcons();
    }
});

document.getElementById('pull-cloud-btn').addEventListener('click', async () => {
    if (!githubToken || !gistId) return showToast('请先配置并保存 GitHub Token 和 Gist ID', 'error');
    if (!confirm('⚠️ 拉取云端数据将覆盖你当前的本地数据！确定要继续吗？')) return;

    const btn = document.getElementById('pull-cloud-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 拉取中...';
    lucide.createIcons();

    try {
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: {
                Authorization: `token ${githubToken}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const file = data.files['workspace_data.json'];
            if (file && file.content) {
                const cloudData = JSON.parse(file.content);
                applyImportedData(cloudData);
                showToast('✅ 成功从云端拉取并应用数据！', 'success');
            } else {
                showToast('❌ 未找到云端数据文件。', 'error');
            }
        } else {
            showToast('❌ 拉取失败，请检查配置。', 'error');
        }
    } catch (error) {
        showToast('🌐 网络请求失败：' + error.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        lucide.createIcons();
    }
});

function triggerAutoSync() {
    if (!githubToken || !gistId) return;
    if (autoSyncTimer) return;

    const syncInterval = 600000;

    console.log('☁️ 检测到数据变动，开始10分钟同步倒计时...');
    autoSyncTimer = setTimeout(async () => {
        try {
            const currentSyncTime = new Date().toISOString();
            const exportData = buildExportData();
            exportData.lastSyncTime = currentSyncTime;

            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: { Authorization: `token ${githubToken}`, Accept: 'application/vnd.github.v3+json' },
                body: JSON.stringify({
                    files: {
                        'workspace_data.json': {
                            content: JSON.stringify(exportData, null, 2)
                        }
                    }
                })
            });
            if (response.ok) {
                updateLocalSyncTime(currentSyncTime);
                console.log('☁️ 后台节流自动同步成功：', new Date().toLocaleTimeString());
            }
        } catch (error) {
            console.error('☁️ 后台同步失败:', error);
        } finally {
            autoSyncTimer = null;
        }
    }, syncInterval);
}

async function autoPullOnStartup() {
    if (!githubToken || !gistId) return;

    try {
        const getRes = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { Authorization: `token ${githubToken}`, Accept: 'application/vnd.github.v3+json' }
        });

        if (getRes.ok) {
            const data = await getRes.json();
            const file = data.files['workspace_data.json'];
            if (file && file.content) {
                const cloudData = JSON.parse(file.content);

                if (shouldAutoApplyCloudData(cloudData)) {
                    applyImportedData(cloudData);
                    showToast('已自动为您同步云端最新数据 ☁️', 'success');
                }
            }
        }
    } catch (error) {
        console.error('☁️ [Auto-Sync] 启动检查失败:', error);
    }
}
