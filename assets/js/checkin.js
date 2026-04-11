function initCheckin() {
    ['morning', 'afternoon', 'evening'].forEach((period) => {
        document.getElementById(`${period}-checkin`).addEventListener('click', () => checkIn(period));
        document.getElementById(`${period}-checkout`).addEventListener('click', () => checkOut(period));
    });
    updateCheckinButtons();
    updateTodayCheckinTable();
}

function updateCheckinButtons() {
    const today = getTodayString();
    if (!checkinData[today]) {
        checkinData[today] = {
            morning: { checkIn: null, checkOut: null, status: { checkIn: null, checkOut: null } },
            afternoon: { checkIn: null, checkOut: null, status: { checkIn: null, checkOut: null } },
            evening: { checkIn: null, checkOut: null, status: { checkIn: null, checkOut: null } },
            leave: false,
            leaveReason: ''
        };
        saveData();
    }

    const now = getCurrentTime();
    const currentHour = now.hour;
    const currentMins = now.hour * 60 + now.minute;
    const isLeave = checkinData[today] && checkinData[today].leave;

    let isCurrentlyOnPartialLeave = false;
    if (checkinData[today] && checkinData[today].partialLeaves) {
        for (const leave of checkinData[today].partialLeaves) {
            const leaveStartMins = timeStrToMins(leave.startTime);
            const leaveEndMins = timeStrToMins(leave.endTime);

            if (currentMins >= leaveStartMins && currentMins < leaveEndMins) {
                isCurrentlyOnPartialLeave = true;
                break;
            }
        }
    }

    const btnTexts = {
        morning: { in: '早班连线', out: '早班登出' },
        afternoon: { in: '午班连线', out: '午班登出' },
        evening: { in: '晚班连线', out: '晚班登出' }
    };

    if (isLeave || isCurrentlyOnPartialLeave) {
        ['morning', 'afternoon', 'evening'].forEach((period) => {
            const checkinBtn = document.getElementById(`${period}-checkin`);
            const checkoutBtn = document.getElementById(`${period}-checkout`);

            checkinBtn.disabled = true;
            checkoutBtn.disabled = true;

            const text = isLeave ? '全天离舰' : '🕒 离舰中...';
            checkinBtn.textContent = text;
            checkoutBtn.textContent = text;
            checkinBtn.className = checkoutBtn.className = 'w-full bg-slate-100 dark:bg-slate-900 text-slate-400 py-3 rounded-xl font-medium transition-all duration-200 cursor-not-allowed';
        });
        updateCheckinTimeDisplay();
        return;
    }

    ['morning', 'afternoon', 'evening'].forEach((period) => {
        document.getElementById(`${period}-checkin`).textContent = btnTexts[period].in;
        document.getElementById(`${period}-checkout`).textContent = btnTexts[period].out;
    });

    const m = checkinData[today].morning;
    const a = checkinData[today].afternoon;
    const e = checkinData[today].evening;

    const mCfg = CONFIG.schedule.morning;
    const aCfg = CONFIG.schedule.afternoon;
    const eCfg = CONFIG.schedule.evening;

    document.getElementById('morning-checkin').disabled = m.checkIn !== null || currentHour < mCfg.startHour || currentHour >= mCfg.endHour;
    document.getElementById('afternoon-checkin').disabled = a.checkIn !== null || currentHour < aCfg.startHour || currentHour >= aCfg.endHour;
    document.getElementById('evening-checkin').disabled = e.checkIn !== null || currentHour < eCfg.startHour || currentHour >= eCfg.endHour;

    document.getElementById('morning-checkout').disabled = m.checkOut !== null || m.checkIn === null || currentHour >= aCfg.startHour;
    document.getElementById('afternoon-checkout').disabled = a.checkOut !== null || a.checkIn === null || currentHour >= eCfg.startHour + 3;
    document.getElementById('evening-checkout').disabled = e.checkOut !== null || e.checkIn === null;

    ['morning', 'afternoon', 'evening'].forEach((period) => {
        const cIn = document.getElementById(`${period}-checkin`);
        const cOut = document.getElementById(`${period}-checkout`);

        cIn.className = cIn.disabled
            ? 'w-full bg-slate-100 dark:bg-slate-900 text-slate-400 py-3 rounded-xl font-medium transition-all duration-200 cursor-not-allowed'
            : 'w-full bg-primary hover:bg-primaryHover text-white py-3 rounded-xl font-medium transition-all duration-200 shadow-md';

        cOut.className = cOut.disabled
            ? 'w-full bg-slate-100 dark:bg-slate-900 text-slate-400 py-3 rounded-xl font-medium transition-all duration-200 cursor-not-allowed'
            : 'w-full bg-primary hover:bg-primaryHover text-white py-3 rounded-xl font-medium transition-all duration-200 shadow-md';
    });

    updateCheckinTimeDisplay();
}

function triggerEndOfDayEasterEgg() {
    const today = getTodayString();
    const todayTasks = taskData[today] || [];
    const todayMins = todayTasks.reduce((sum, task) => sum + task.duration, 0);
    const todayHours = (todayMins / 60).toFixed(1);
    const todayResist = (phoneResistData.records[today] || { count: 0 }).count;

    document.getElementById('daily-stat-hours').textContent = todayHours + 'h';
    document.getElementById('daily-stat-resist').textContent = todayResist + '次';

    const now = new Date();
    if (now.getDay() === 0 && isThisWeekPerfect()) {
        let weekMins = 0;
        let weekResist = 0;
        for (let i = 0; i < 7; i++) {
            const checkDate = new Date();
            checkDate.setDate(checkDate.getDate() - i);
            const ds = formatLocalDate(checkDate);
            const dayTasks = taskData[ds] || [];
            weekMins += dayTasks.reduce((sum, task) => sum + task.duration, 0);
            weekResist += (phoneResistData.records[ds] || { count: 0 }).count;
        }

        document.getElementById('weekly-stat-hours').textContent = (weekMins / 60).toFixed(1) + 'h';
        document.getElementById('weekly-stat-resist').textContent = weekResist + '次';
        document.getElementById('weekly-summary-modal').classList.remove('hidden');
    } else {
        document.getElementById('daily-summary-modal').classList.remove('hidden');
    }
}

function isThisWeekPerfect() {
    const todayDate = new Date();
    for (let i = 0; i < 7; i++) {
        const checkDate = new Date(todayDate);
        checkDate.setDate(todayDate.getDate() - i);
        const dayData = checkinData[formatLocalDate(checkDate)];

        if (!dayData) return false;
        if (dayData.leave) continue;

        const checkedIn = dayData.morning.checkIn || dayData.afternoon.checkIn || dayData.evening.checkIn;
        if (!checkedIn) return false;
    }
    return true;
}

function timeStrToMins(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function checkIn(period) {
    const today = getTodayString();
    const now = getCurrentTime();
    const currentMins = now.hour * 60 + now.minute;
    checkinData[today][period].checkIn = getCurrentTimeString();

    const cfg = CONFIG.schedule[period];
    const thresholdMins = cfg.okCheckInBefore * 60;
    let inStatus = currentMins <= thresholdMins;

    if (!inStatus && checkinData[today].partialLeaves) {
        for (const leave of checkinData[today].partialLeaves) {
            const leaveStartMins = timeStrToMins(leave.startTime);
            const leaveEndMins = timeStrToMins(leave.endTime);

            if (
                (leaveStartMins <= thresholdMins && currentMins <= leaveEndMins + 30) ||
                (currentMins >= leaveStartMins && currentMins <= leaveEndMins)
            ) {
                inStatus = 'excused';
                break;
            }
        }
    }

    checkinData[today][period].status.checkIn = inStatus;
    saveData();
    updateCheckinButtons();
    updateTodayCheckinTable();
    updateTodayStatus();
    checkAchievements();
}

function checkOut(period) {
    const today = getTodayString();
    const now = getCurrentTime();
    const currentMins = now.hour * 60 + now.minute;
    checkinData[today][period].checkOut = getCurrentTimeString();

    const inMins = timeStrToMins(checkinData[today][period].checkIn);
    const durationMins = currentMins - inMins;

    let outStatus = 'danger';
    const cfg = CONFIG.schedule[period];
    const thresholdMins = cfg.okCheckOutBefore * 60;

    let isExcusedEarlyLeave = false;
    if (checkinData[today].partialLeaves) {
        for (const leave of checkinData[today].partialLeaves) {
            const leaveStartMins = timeStrToMins(leave.startTime);
            const leaveEndMins = timeStrToMins(leave.endTime);

            if (leaveStartMins <= currentMins + 30 && leaveEndMins >= thresholdMins) {
                isExcusedEarlyLeave = true;
                break;
            }
        }
    }

    if (isExcusedEarlyLeave) {
        outStatus = 'excused';
    } else if (durationMins < CONFIG.task.minDurationMins) {
        outStatus = 'danger';
    } else {
        const isWithinRecommended = currentMins <= thresholdMins;
        outStatus = isWithinRecommended ? 'success' : 'warning';
    }

    checkinData[today][period].status.checkOut = outStatus;
    saveData();
    updateCheckinButtons();
    updateTodayCheckinTable();
    updateTodayStatus();
    checkAchievements();

    if (period === 'evening') {
        setTimeout(() => triggerEndOfDayEasterEgg(), 500);
    }
}

function updateCheckinTimeDisplay() {
    const today = getTodayString();
    ['morning', 'afternoon', 'evening'].forEach((period) => {
        document.getElementById(`${period}-checkin-time`).textContent = `开始: ${checkinData[today][period].checkIn || '-'}`;
        document.getElementById(`${period}-checkout-time`).textContent = `结束: ${checkinData[today][period].checkOut || '-'}`;
    });
}

function updateTodayCheckinTable() {
    const today = getTodayString();
    ['morning', 'afternoon', 'evening'].forEach((period) => {
        document.getElementById(`table-${period}-checkin`).textContent = checkinData[today][period].checkIn || '-';
        document.getElementById(`table-${period}-checkout`).textContent = checkinData[today][period].checkOut || '-';

        const cInStatus = document.getElementById(`table-${period}-checkin-status`);
        const inVal = checkinData[today][period].status.checkIn;
        if (checkinData[today][period].checkIn === null) {
            cInStatus.textContent = '-';
            cInStatus.className = 'py-3 px-4';
        } else if (inVal === 'excused') {
            cInStatus.textContent = '离舰豁免';
            cInStatus.className = 'py-3 px-4 font-bold text-blue-500 dark:text-blue-400';
        } else {
            cInStatus.textContent = (inVal === true || inVal === 'success') ? '合格' : '不合格';
            cInStatus.className = `py-3 px-4 font-medium ${(inVal === true || inVal === 'success') ? 'text-success' : 'text-danger'}`;
        }

        const cOutStatus = document.getElementById(`table-${period}-checkout-status`);
        const outVal = checkinData[today][period].status.checkOut;
        if (checkinData[today][period].checkOut === null) {
            cOutStatus.textContent = '-';
            cOutStatus.className = 'py-3 px-4';
        } else if (outVal === 'excused') {
            cOutStatus.textContent = '离舰豁免';
            cOutStatus.className = 'py-3 px-4 font-bold text-blue-500 dark:text-blue-400';
        } else if (outVal === true || outVal === 'success') {
            cOutStatus.textContent = '合格';
            cOutStatus.className = 'py-3 px-4 font-medium text-success';
        } else if (outVal === 'warning') {
            cOutStatus.textContent = '警告';
            cOutStatus.className = 'py-3 px-4 font-medium text-warning';
        } else {
            cOutStatus.textContent = '时长过短';
            cOutStatus.className = 'py-3 px-4 font-medium text-danger';
        }
    });
}
