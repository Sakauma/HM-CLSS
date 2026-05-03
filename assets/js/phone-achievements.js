/**
 * 抗干扰与成就模块。
 * 负责记录手机干扰拦截次数、刷新成就面板并计算累计里程碑。
 */

/**
 * 初始化抗干扰计数区和成就展示区。
 */
function initPhoneResist() {
    document.getElementById('phone-resist-count').textContent = phoneResistData.totalCount;
    document.getElementById('today-phone-resist-count').textContent = phoneResistData.records[getTodayString()].count;
    updateTodayPhoneResistTimes();
    updateAchievementsList();
    document.getElementById('add-phone-resist').addEventListener('click', addPhoneResist);
}

/**
 * 新增一次抗干扰记录，并同步刷新当天和全局统计。
 */
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

/**
 * 把今天的抗干扰时间戳串成可读文本。
 */
function updateTodayPhoneResistTimes() {
    const times = phoneResistData.records[getTodayString()].times;
    document.getElementById('today-phone-resist-times').textContent = times.length === 0 ? '暂无记录' : '记录时间: ' + times.join(', ');
}

/**
 * 根据当前成就解锁状态重绘成就列表。
 */
function updateAchievementsList() {
    const list = document.getElementById('achievements-list');
    list.innerHTML = achievementList.map((achievement) => {
        if (achievement.type && achievement.type !== 'phone') return '';

        const isAchieved = achievements.includes(achievement.id);
        const bgClass = isAchieved
            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-500';
        const icon = isAchieved ? 'check' : 'lock';
        const textClass = isAchieved ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500';

        return `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center shrink-0">
                    <i data-lucide="${icon}" class="w-5 h-5"></i>
                </div>
                <div>
                    <div class="font-bold text-sm ${textClass}">${escapeHtml(achievement.name)}</div>
                    <div class="text-xs text-slate-500">${escapeHtml(achievement.description)}</div>
                </div>
            </div>
        `;
    }).filter(Boolean).join('');

    lucide.createIcons();
}

/**
 * 弹出单个成就的解锁提示。
 * @param {object} achievement
 */
function showAchievementPopup(achievement) {
    const popup = document.getElementById('achievement-popup');
    document.getElementById('popup-achievement-title').textContent = achievement.name;
    document.getElementById('popup-achievement-desc').textContent = achievement.description;
    popup.classList.remove('hidden');
    setTimeout(() => popup.classList.add('hidden'), 5000);
}

/**
 * 遍历全部成就条件，判断是否有新的里程碑被满足。
 */
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

/**
 * 计算当前连续打卡天数。
 * 规则以“昨天开始向前连续”回溯，避免把未来或缺失日期算入 streak。
 * @returns {number}
 */
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

/**
 * 汇总所有已完成任务的累计小时数。
 * @returns {number}
 */
function calculateTotalTaskHours() {
    let mins = 0;
    Object.values(taskData).forEach((day) => day.forEach((task) => {
        if (task.duration) mins += task.duration;
    }));
    return Math.floor(mins / 60);
}
