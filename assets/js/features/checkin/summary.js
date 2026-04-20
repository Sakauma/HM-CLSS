/**
 * 值班日终总结层。
 * 负责晚班收尾后的每日 / 每周总结弹窗。
 */

function triggerEndOfDayEasterEgg() {
    const today = getTodayString();
    const todayTasks = taskData[today] || [];
    const todayMins = todayTasks.reduce((sum, task) => sum + task.duration, 0);
    const todayHours = (todayMins / 60).toFixed(1);
    const todayResist = (phoneResistData.records[today] || { count: 0 }).count;

    document.getElementById('daily-stat-hours').textContent = `${todayHours}h`;
    document.getElementById('daily-stat-resist').textContent = `${todayResist}次`;

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

        document.getElementById('weekly-stat-hours').textContent = `${(weekMins / 60).toFixed(1)}h`;
        document.getElementById('weekly-stat-resist').textContent = `${weekResist}次`;
        document.getElementById('weekly-summary-modal').classList.remove('hidden');
    } else {
        document.getElementById('daily-summary-modal').classList.remove('hidden');
    }
}
