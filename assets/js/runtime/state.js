/**
 * 运行时共享状态与静态配置。
 * 负责承载跨模块共用的内存态、存储键名、任务标签与判定配置。
 */

const CURRENT_TASK_STORAGE_KEY = 'currentTask';
const AMBIENT_PREFS_STORAGE_KEY = 'hmclss_ambient_preferences';

const tagMap = {
    paper: '文献阅读',
    code: '代码构建',
    experiment: '实验跑数',
    write: '文档撰写',
    other: '杂项事务'
};

const CONFIG = {
    schedule: {
        morning: { startHour: 6, endHour: 12, okCheckInBefore: 8, okCheckOutBefore: 12 },
        afternoon: { startHour: 12, endHour: 17, okCheckInBefore: 14, okCheckOutBefore: 18 },
        evening: { startHour: 17, endHour: 22, okCheckInBefore: 19, okCheckOutBefore: 22 }
    },
    task: {
        minDurationMins: 30
    },
    retro: {
        maxDaysPast: 30,
        last7DayQuota: 2,
        monthlyQuota: 6
    }
};

const noteTagConfig = {
    idea: { icon: 'lightbulb', label: '灵感', color: 'semantic-tag semantic-tag-warning' },
    bug: { icon: 'bug', label: '异常', color: 'semantic-tag semantic-tag-danger' },
    todo: { icon: 'check-square', label: '待办', color: 'semantic-tag semantic-tag-success' },
    log: { icon: 'book', label: '日志', color: 'semantic-tag semantic-tag-primary' }
};

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
