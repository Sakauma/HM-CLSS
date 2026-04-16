/**
 * 核心运行时模块。
 * 负责维护全局共享状态、初始化本地存储、提供日期/转义等基础工具，
 * 并在页面启动时串起各业务模块的初始化顺序。
 */

// 由各业务模块共享的内存态，统一在这里定义以避免脚本加载顺序带来的歧义。
let checkinData = {};
let phoneResistData = { totalCount: 0, records: {} };
let taskData = {};
let leaveData = [];
let achievements = [];
let currentTask = null;
let taskTimer = null;
let taskStartTime = null;
let quickNotesData = {};
let tavernData = [];
let currentDrinkInfo = null;

const CURRENT_TASK_STORAGE_KEY = 'currentTask';

// 任务标签和界面展示名称之间的映射表。
const tagMap = {
    paper: '文献阅读',
    code: '代码构建',
    experiment: '实验跑数',
    write: '文档撰写',
    other: '杂项事务'
};

// 与班次和任务时长判断相关的全局配置。
const CONFIG = {
    schedule: {
        morning: { startHour: 6, endHour: 12, okCheckInBefore: 8, okCheckOutBefore: 12 },
        afternoon: { startHour: 12, endHour: 17, okCheckInBefore: 14, okCheckOutBefore: 18 },
        evening: { startHour: 17, endHour: 22, okCheckInBefore: 19, okCheckOutBefore: 22 }
    },
    task: {
        minDurationMins: 30
    }
};

// 速记标签的图标、文案和视觉风格配置。
const noteTagConfig = {
    idea: { icon: 'lightbulb', label: '灵感', color: 'text-warning bg-warning/10 border-warning/20' },
    bug: { icon: 'bug', label: '异常', color: 'text-danger bg-danger/10 border-danger/20' },
    todo: { icon: 'check-square', label: '待办', color: 'text-success bg-success/10 border-success/20' },
    log: { icon: 'book', label: '日志', color: 'text-primary bg-primary/10 border-primary/20' }
};

// 成就系统的静态配置清单。
const achievementList = [
    { id: 'first_resist', name: '初次戒断', description: '第一次成功阻断认知(手机)干扰', requirement: 1 },
    { id: 'small_achievement', name: '初步适应', description: '成功阻断干扰10次，你开始适应孤独', requirement: 10 },
    { id: 'strong_will', name: '意志装甲', description: '成功阻断干扰50次，注意力护盾已建立', requirement: 50 },
    { id: 'phone_killer', name: '模因粉碎机', description: '成功阻断干扰100次，碎片化信息无法再触及你', requirement: 100 },
    { id: 'focus_master', name: '绝对静默', description: '成功阻断干扰365次，你的精神处于绝对真空状态', requirement: 365 },
    { id: 'deep_space_meditation', name: '超凡入圣', description: '累计阻断干扰500次，你的思维已与宇宙同频', requirement: 500 },
    { id: 'first_checkin', name: '系统激活', description: '第一次成功唤醒维生系统', requirement: 1, type: 'checkin' },
    { id: 'week_streak', name: '平稳巡航', description: '连续维持系统运转7个地球日', requirement: 7, type: 'streak' },
    { id: 'month_streak', name: '深空漂流', description: '连续维持系统运转30个地球日', requirement: 30, type: 'streak' },
    { id: 'hail_mary_hero', name: '还回来吃饭吗', description: '连续维持维生系统运转100天，现在你再也不用吃流食了！', requirement: 100, type: 'streak' },
    { id: 'first_blood_task', name: '首次点火', description: '完成第一个科研任务，迈出第一步', requirement: 1, type: 'task' },
    { id: 'task_master', name: '核心工程师', description: '累计完成100个科研阵列任务', requirement: 100, type: 'task' },
    { id: 'astrophage_overload', name: '引擎超载', description: '累计完成500个科研任务，反应堆能量溢出！', requirement: 500, type: 'task' },
    { id: 'time_master', name: '相对论时间膨胀', description: '科研供能达到1000小时，时间在你身上变慢了', requirement: 1000, type: 'task_hour' },
    { id: 'hacker_mind', name: '捕虫大师', description: '捕捉50个噬星体碎片，离探查这种星际生命的起源又近了一步', requirement: 50, type: 'notes' },
    { id: 'eridani_contact', name: '水基就是一切', description: '捕捉100个噬星体碎片，现在你知道这种小玩意是怎么运动、繁殖的了，当然最关键的是，它们依然是水基的', requirement: 100, type: 'notes' }
];

// 情绪字典会与酒馆分析模块共享，用于输入文本的情绪加权。
const emotionDictionary = [
    { id: 'emo_1', label: '焦躁', efi: -0.8, eii: 0.9, style: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-900/50' },
    { id: 'emo_2', label: '平静', efi: 0.5, eii: 0.2, style: 'text-teal-600 bg-teal-50 border-teal-200 dark:text-teal-400 dark:bg-teal-900/20 dark:border-teal-900/50' },
    { id: 'emo_3', label: '疲惫', efi: -0.4, eii: 0.3, style: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700' },
    { id: 'emo_4', label: '雀跃', efi: 0.9, eii: 0.8, style: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-900/50' },
    { id: 'emo_5', label: '紧绷', efi: -0.6, eii: 0.7, style: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-900/50' },
    { id: 'emo_6', label: '灵感迸发', efi: 0.8, eii: 0.7, style: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-900/20 dark:border-indigo-900/50' },
    { id: 'emo_7', label: '孤独', efi: -0.5, eii: 0.4, style: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-900/50' },
    { id: 'emo_8', label: '充满希望', efi: 0.7, eii: 0.5, style: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-900/50' },
    { id: 'emo_9', label: '迷茫', efi: -0.3, eii: 0.5, style: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-900/20 dark:border-purple-900/50' },
    { id: 'emo_10', label: '专注', efi: 0.6, eii: 0.6, style: 'text-cyan-600 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-900/20 dark:border-cyan-900/50' },
    { id: 'emo_11', label: '压抑', efi: -0.7, eii: 0.6, style: 'text-stone-600 bg-stone-50 border-stone-200 dark:text-stone-400 dark:bg-stone-900/20 dark:border-stone-900/50' },
    { id: 'emo_12', label: '成就感', efi: 0.9, eii: 0.6, style: 'text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/20 dark:border-rose-900/50' }
];

let selectedEmotions = [];

// 页面入口：先恢复数据，再依次挂载各个业务面板。
document.addEventListener('DOMContentLoaded', function() {
    initData();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    initNavigation();
    initCheckin();
    initPhoneResist();
    initTaskManagement();
    initLeaveManagement();
    initStatistics();
    updateTodayStatus();
    updateQuickNotesList();
    autoPullOnStartup();

    document.getElementById('close-daily-modal').addEventListener('click', () => document.getElementById('daily-summary-modal').classList.add('hidden'));
    document.getElementById('close-weekly-modal').addEventListener('click', () => document.getElementById('weekly-summary-modal').classList.add('hidden'));
});

/**
 * 从本地存储恢复所有模块数据，并补齐当天需要的默认结构。
 * 同时校验“当前任务”这类可能因旧版本残留而损坏的字段。
 */
function initData() {
    const savedCheckinData = localStorage.getItem('checkinData');
    const savedPhoneResistData = localStorage.getItem('phoneResistData');
    const savedTaskData = localStorage.getItem('taskData');
    const savedLeaveData = localStorage.getItem('leaveData');
    const savedAchievements = localStorage.getItem('achievements');
    const savedNotes = localStorage.getItem('quickNotesData');
    const savedTavernData = localStorage.getItem('tavernData');
    const savedCurrentTask = localStorage.getItem(CURRENT_TASK_STORAGE_KEY);

    try {
        quickNotesData = savedNotes ? JSON.parse(savedNotes) : {};
        checkinData = savedCheckinData ? JSON.parse(savedCheckinData) : {};
        phoneResistData = savedPhoneResistData ? JSON.parse(savedPhoneResistData) : { totalCount: 0, records: {} };
        taskData = savedTaskData ? JSON.parse(savedTaskData) : {};
        leaveData = savedLeaveData ? JSON.parse(savedLeaveData) : [];
        achievements = savedAchievements ? JSON.parse(savedAchievements) : [];
        tavernData = savedTavernData ? JSON.parse(savedTavernData) : [];
    } catch (error) {
        quickNotesData = {};
        checkinData = {};
        phoneResistData = { totalCount: 0, records: {} };
        taskData = {};
        leaveData = [];
        achievements = [];
        tavernData = [];
    }

    try {
        currentTask = savedCurrentTask ? JSON.parse(savedCurrentTask) : null;
    } catch (error) {
        currentTask = null;
    }

    if (
        !currentTask ||
        typeof currentTask !== 'object' ||
        typeof currentTask.name !== 'string' ||
        typeof currentTask.startTimestamp !== 'number' ||
        typeof currentTask.startTime !== 'string'
    ) {
        currentTask = null;
        localStorage.removeItem(CURRENT_TASK_STORAGE_KEY);
    }

    if (!phoneResistData.records) phoneResistData.records = {};

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

    saveData(true);
}

/**
 * 将当前内存态统一落盘到 localStorage。
 * @param {boolean} preventAutoSync 为 true 时仅保存本地，不触发自动云同步。
 */
function saveData(preventAutoSync = false) {
    localStorage.setItem('checkinData', JSON.stringify(checkinData));
    localStorage.setItem('phoneResistData', JSON.stringify(phoneResistData));
    localStorage.setItem('taskData', JSON.stringify(taskData));
    localStorage.setItem('leaveData', JSON.stringify(leaveData));
    localStorage.setItem('achievements', JSON.stringify(achievements));
    localStorage.setItem('quickNotesData', JSON.stringify(quickNotesData));
    localStorage.setItem('tavernData', JSON.stringify(tavernData));

    if (typeof updateSummaryStatistics === 'function') {
        updateSummaryStatistics();
    }

    if (!preventAutoSync && typeof triggerAutoSync === 'function') {
        triggerAutoSync();
    }
}

/**
 * 单独持久化当前进行中的任务，避免任务计时状态丢失。
 */
function persistCurrentTask() {
    if (currentTask) {
        localStorage.setItem(CURRENT_TASK_STORAGE_KEY, JSON.stringify(currentTask));
    } else {
        localStorage.removeItem(CURRENT_TASK_STORAGE_KEY);
    }
}

/**
 * 根据 currentTask 的状态刷新任务首屏卡片和进度条展示。
 */
function renderCurrentTaskState() {
    const container = document.getElementById('current-task-container');
    const readyPanel = document.getElementById('task-ready-panel');
    const readyStatusEl = document.getElementById('task-ready-status');
    const readyHintEl = document.getElementById('task-ready-hint');
    const nameEl = document.getElementById('current-task-name');
    const timeEl = document.getElementById('current-task-time');
    const progressBar = document.getElementById('task-progress-bar');

    if (!currentTask) {
        container.classList.add('hidden');
        readyPanel?.classList.remove('hidden');
        if (readyStatusEl) readyStatusEl.textContent = '待命';
        if (readyHintEl) readyHintEl.textContent = '先定义任务，再开始计时，让今天的主线先稳定下来。';
        nameEl.textContent = '-';
        timeEl.textContent = '已进行: 00:00:00';
        progressBar.style.width = '0%';
        return;
    }

    const elapsed = Math.max(0, Date.now() - currentTask.startTimestamp);
    const h = Math.floor(elapsed / 3600000);
    const m = Math.floor((elapsed % 3600000) / 60000);
    const s = Math.floor((elapsed % 60000) / 1000);

    nameEl.innerHTML = `<span class="text-xs bg-primary/20 text-primary px-2 py-1 rounded-md mr-2">${escapeHtml(tagMap[currentTask.tag] || tagMap.other)}</span>${escapeHtml(currentTask.name)}`;
    timeEl.textContent = `已进行: ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    progressBar.style.width = `${Math.min((elapsed / 36000000) * 100, 100)}%`;
    readyPanel?.classList.add('hidden');
    if (readyStatusEl) readyStatusEl.textContent = '进行中';
    if (readyHintEl) readyHintEl.textContent = '当前主任务已经启动，新的想法请直接丢进右侧捕捉池。';
    container.classList.remove('hidden');
}

/**
 * 每秒刷新当前时间，并顺带更新打卡按钮的可用状态。
 */
function updateDateTime() {
    const now = new Date();
    const options = { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' };
    document.getElementById('current-date-time').textContent = now.toLocaleDateString('zh-CN', options);
    updateCheckinButtons();
}

/**
 * 将 Date 对象格式化为 YYYY-MM-DD，作为各模块统一的日期键。
 * @param {Date} date
 * @returns {string}
 */
function formatLocalDate(date) {
    return date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0');
}

/**
 * 获取今天的本地日期字符串。
 * @returns {string}
 */
function getTodayString() {
    return formatLocalDate(new Date());
}

/**
 * 获取当前本地时间，格式为 HH:MM。
 * @returns {string}
 */
function getCurrentTimeString() {
    return new Date().toTimeString().slice(0, 5);
}

/**
 * 以结构化对象返回当前小时和分钟，便于做时间比较。
 * @returns {{ hour: number, minute: number }}
 */
function getCurrentTime() {
    const now = new Date();
    return { hour: now.getHours(), minute: now.getMinutes() };
}

/**
 * 对动态插入到 HTML 中的文本做最小转义，避免渲染层注入风险。
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
    const normalized = value == null ? '' : String(value);
    return normalized.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

/**
 * 兼容旧结构的速记记录，稳定地读取文本内容。
 * @param {object} note
 * @returns {string}
 */
function getNoteText(note) {
    return note && typeof note.text === 'string' ? note.text : '';
}

/**
 * 兼容旧结构的速记记录，稳定地读取时间字段。
 * @param {object} note
 * @returns {string}
 */
function getNoteTime(note) {
    return note && typeof note.time === 'string' ? note.time : '--:--';
}
