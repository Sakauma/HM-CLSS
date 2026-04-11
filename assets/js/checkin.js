function initNavigation() {
    const sections = ['checkin-section', 'phone-section', 'tasks-section', 'archive-section', 'leave-section', 'tavern-section', 'stats-section', 'settings-section'];
    const navButtons = ['nav-checkin', 'nav-phone', 'nav-tasks', 'nav-archive', 'nav-leave', 'nav-tavern', 'nav-stats', 'nav-settings'];

    navButtons.forEach((btnId, index) => {
        document.getElementById(btnId).addEventListener('click', function() {
            sections.forEach((sectionId) => document.getElementById(sectionId).classList.add('hidden'));
            document.getElementById(sections[index]).classList.remove('hidden');

            navButtons.forEach((id) => {
                const btn = document.getElementById(id);
                btn.className = 'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all';
            });

            const currentBtn = document.getElementById(btnId);
            currentBtn.className = 'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all bg-primary/10 text-primary dark:bg-primary/20';

            if (sections[index] === 'stats-section') {
                const activePeriod = document.querySelector('.stats-period-btn.bg-white, .stats-period-btn.bg-slate-700').getAttribute('data-period');
                updateStatisticsCharts(activePeriod);
            }

            if (sections[index] === 'archive-section') {
                renderArchive();
            }

            if (sections[index] === 'tavern-section') {
                const inputEl = document.getElementById('mood-text-input');
                const countEl = document.getElementById('mood-char-count');
                const analyzeBtn = document.getElementById('btn-start-analyze');

                ['state-input', 'state-analyzing', 'state-result', 'state-history'].forEach((id) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    if (id === 'state-input') {
                        el.style.zIndex = '10';
                        el.classList.remove('opacity-0');
                        el.classList.add('opacity-100');
                    } else {
                        el.style.zIndex = '0';
                        el.classList.remove('opacity-100');
                        el.classList.add('opacity-0');
                    }
                });

                if (inputEl) inputEl.value = '';
                if (countEl) countEl.textContent = '0';
                if (analyzeBtn) analyzeBtn.disabled = true;
            }
        });
    });
}

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

function initPhoneResist() {
    document.getElementById('phone-resist-count').textContent = phoneResistData.totalCount;
    document.getElementById('today-phone-resist-count').textContent = phoneResistData.records[getTodayString()].count;
    updateTodayPhoneResistTimes();
    updateAchievementsList();
    document.getElementById('add-phone-resist').addEventListener('click', addPhoneResist);
}

function addPhoneResist() {
    const today = getTodayString();
    phoneResistData.totalCount++;
    if (!phoneResistData.records[today]) phoneResistData.records[today] = { count: 0, times: [] };
    phoneResistData.records[today].count++;
    phoneResistData.records[today].times.push(getCurrentTimeString());
    saveData();

    document.getElementById('phone-resist-count').textContent = phoneResistData.totalCount;
    document.getElementById('today-phone-resist-count').textContent = phoneResistData.records[today].count;
    updateTodayPhoneResistTimes();
    updateAchievementsList();
    checkAchievements();
    updateTodayStatus();
}

function updateTodayPhoneResistTimes() {
    const times = phoneResistData.records[getTodayString()].times;
    document.getElementById('today-phone-resist-times').textContent = times.length === 0 ? '暂无记录' : '记录时间: ' + times.join(', ');
}

function updateAchievementsList() {
    const list = document.getElementById('achievements-list');
    list.innerHTML = '';

    achievementList.forEach((achievement) => {
        if (achievement.type && achievement.type !== 'phone') return;

        const isAchieved = achievements.includes(achievement.id);
        const bgClass = isAchieved
            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-500';
        const icon = isAchieved ? 'check' : 'lock';
        const textClass = isAchieved ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500';

        list.innerHTML += `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center shrink-0">
                    <i data-lucide="${icon}" class="w-5 h-5"></i>
                </div>
                <div>
                    <div class="font-bold text-sm ${textClass}">${achievement.name}</div>
                    <div class="text-xs text-slate-500">${achievement.description}</div>
                </div>
            </div>
        `;
    });

    lucide.createIcons();
}

function showAchievementPopup(achievement) {
    const popup = document.getElementById('achievement-popup');
    document.getElementById('popup-achievement-title').textContent = achievement.name;
    document.getElementById('popup-achievement-desc').textContent = achievement.description;
    popup.classList.remove('hidden');
    setTimeout(() => popup.classList.add('hidden'), 5000);
}

function checkAchievements() {
    let hasNew = false;

    achievementList.forEach((achievement) => {
        if (achievements.includes(achievement.id)) return;

        let achieved = false;
        if (achievement.type === 'phone' || !achievement.type) {
            achieved = phoneResistData.totalCount >= achievement.requirement;
        } else if (achievement.type === 'checkin') {
            achieved = Object.values(checkinData).filter((day) => day.morning.checkIn || day.afternoon.checkIn || day.evening.checkIn).length >= achievement.requirement;
        } else if (achievement.type === 'streak') {
            achieved = calculateCheckinStreak() >= achievement.requirement;
        } else if (achievement.type === 'task') {
            achieved = Object.values(taskData).reduce((total, day) => total + day.length, 0) >= achievement.requirement;
        } else if (achievement.type === 'task_hour') {
            achieved = calculateTotalTaskHours() >= achievement.requirement;
        } else if (achievement.type === 'notes') {
            achieved = Object.values(quickNotesData).reduce((sum, notes) => sum + notes.length, 0) >= achievement.requirement;
        }

        if (achieved) {
            achievements.push(achievement.id);
            showAchievementPopup(achievement);
            hasNew = true;
        }
    });

    if (hasNew) {
        saveData();
        updateAchievementsList();
        updateTodayStatus();
    }
}

function calculateCheckinStreak() {
    const todayStr = getTodayString();
    const dates = Object.keys(checkinData)
        .filter((date) => date <= todayStr)
        .sort()
        .reverse();

    if (!dates.length) return 0;

    let streak = 0;
    const expectedDate = new Date();
    const todayData = checkinData[todayStr];
    const checkedInToday = todayData && (todayData.morning.checkIn || todayData.afternoon.checkIn || todayData.evening.checkIn);

    if (checkedInToday) {
        streak = 1;
        expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
        expectedDate.setDate(expectedDate.getDate() - 1);
    }

    for (let i = 0; i < dates.length; i++) {
        const dateStr = dates[i];
        if (dateStr >= todayStr) continue;

        const expectedStr = formatLocalDate(expectedDate);
        if (dateStr === expectedStr) {
            const day = checkinData[dateStr];
            if (day.morning.checkIn || day.afternoon.checkIn || day.evening.checkIn) {
                streak++;
                expectedDate.setDate(expectedDate.getDate() - 1);
            } else {
                break;
            }
        } else {
            break;
        }
    }

    return streak;
}

function calculateTotalTaskHours() {
    let mins = 0;
    Object.values(taskData).forEach((day) => day.forEach((task) => {
        if (task.duration) mins += task.duration;
    }));
    return Math.floor(mins / 60);
}
