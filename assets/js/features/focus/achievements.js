/**
 * 抗干扰与成就模块。
 * 负责记录手机干扰拦截次数、刷新成就面板并计算累计里程碑。
 */

/**
 * 初始化抗干扰计数区和成就展示区。
 */
function initPhoneResist() {
    const disposables = createDisposables();
    const phoneResistState = runtimeSelectors.phoneResistData();
    document.getElementById('phone-resist-count').textContent = phoneResistState.totalCount;
    document.getElementById('today-phone-resist-count').textContent = phoneResistState.records[getTodayString()].count;
    updateTodayPhoneResistTimes();
    updateAchievementsList();
    disposables.listen(document.getElementById('add-phone-resist'), 'click', addPhoneResist);
    return () => {
        disposables.dispose();
    };
}

/**
 * 新增一次抗干扰记录，并同步刷新当天和全局统计。
 */
function addPhoneResist() {
    const today = getTodayString();
    runtimeActions.update('phoneResistData', (currentValue) => {
        const phoneResistState = currentValue && typeof currentValue === 'object'
            ? currentValue
            : { totalCount: 0, records: {} };
        const records = phoneResistState.records && typeof phoneResistState.records === 'object'
            ? phoneResistState.records
            : {};
        const todayRecord = records[today] || { count: 0, times: [] };

        return {
            ...phoneResistState,
            totalCount: (phoneResistState.totalCount || 0) + 1,
            records: {
                ...records,
                [today]: {
                    count: (todayRecord.count || 0) + 1,
                    times: [...(todayRecord.times || []), getCurrentTimeString()]
                }
            }
        };
    });
    saveData();

    const phoneResistState = runtimeSelectors.phoneResistData();
    document.getElementById('phone-resist-count').textContent = phoneResistState.totalCount;
    document.getElementById('today-phone-resist-count').textContent = phoneResistState.records[today].count;
    updateTodayPhoneResistTimes();
    updateAchievementsList();
    checkAchievements();
    updateTodayStatus();
}

/**
 * 把今天的抗干扰时间戳串成可读文本。
 */
function updateTodayPhoneResistTimes() {
    const times = runtimeSelectors.phoneResistData().records[getTodayString()].times;
    document.getElementById('today-phone-resist-times').textContent = times.length === 0 ? '暂无记录' : '记录时间: ' + times.join(', ');
}

/**
 * 根据当前成就解锁状态重绘成就列表。
 */
function updateAchievementsList() {
    const list = document.getElementById('achievements-list');
    const fragment = document.createDocumentFragment();

    achievementList.forEach((achievement) => {
        if (achievement.type && achievement.type !== 'phone') return;

        const isAchieved = achievements.includes(achievement.id);
        const bgClass = isAchieved
            ? 'bg-success/12 text-success dark:bg-success/18 dark:text-green-300'
            : 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500';
        const icon = isAchieved ? 'check' : 'lock';
        const textClass = isAchieved ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500';

        fragment.appendChild(appendDomChildren(createDomElement('div', {
            className: 'flex items-center gap-3'
        }), [
            appendDomChildren(createDomElement('div', {
                className: `w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center shrink-0`
            }), [
                createLucideIconElement(icon, 'w-5 h-5')
            ]),
            appendDomChildren(createDomElement('div'), [
                createDomElement('div', {
                    className: `font-bold text-sm ${textClass}`,
                    text: achievement.name
                }),
                createDomElement('div', {
                    className: 'text-xs text-slate-500',
                    text: achievement.description
                })
            ])
        ]));
    });

    list.replaceChildren(fragment);
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
            achieved = runtimeSelectors.phoneResistData().totalCount >= achievement.requirement;
        } else if (achievement.type === 'checkin') {
            achieved = countCheckinDays() >= achievement.requirement;
        } else if (achievement.type === 'streak') {
            achieved = calculateCheckinStreak() >= achievement.requirement;
        } else if (achievement.type === 'task') {
            achieved = countTotalTaskEntries() >= achievement.requirement;
        } else if (achievement.type === 'task_hour') {
            achieved = calculateTotalTaskHours() >= achievement.requirement;
        } else if (achievement.type === 'notes') {
            achieved = countQuickNoteEntries() >= achievement.requirement;
        }

        if (achieved) {
            appendRuntimeItem('achievements', achievement.id);
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

registerAppModule({
    id: 'focus-achievements',
    order: 40,
    init: initPhoneResist
});
