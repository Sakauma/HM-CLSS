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
