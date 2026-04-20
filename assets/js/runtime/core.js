/**
 * 核心共享工具模块。
 * 负责任务首屏状态、时间处理、环境态派生与通用转义函数。
 */

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
        if (readyHintEl) readyHintEl.textContent = '先给今天的主线起个名字，再开计时。';
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
    if (readyHintEl) readyHintEl.textContent = '主线已经跑起来了，临时念头丢进右侧捕捉池就行。';
    container.classList.remove('hidden');
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
 * 把 YYYY-MM-DD 解析成本地 Date 对象，避免直接 new Date 产生时区歧义。
 * @param {string} dateStr
 * @returns {Date}
 */
function parseLocalDate(dateStr) {
    const [year, month, day] = String(dateStr).split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
}

/**
 * 获取今天的本地日期字符串。
 * @returns {string}
 */
function getTodayString() {
    return formatLocalDate(new Date());
}

/**
 * 计算两个日期键之间相差的自然日数。
 * 正数表示 targetDate 在 compareDate 之前。
 * @param {string} targetDate
 * @param {string} compareDate
 * @returns {number}
 */
function getDateDiffInDays(targetDate, compareDate = getTodayString()) {
    const target = parseLocalDate(targetDate);
    const compare = parseLocalDate(compareDate);
    return Math.round((compare.getTime() - target.getTime()) / 86400000);
}

/**
 * 将 YYYY-MM-DD 格式化为更易读的本地展示文案。
 * @param {string} dateStr
 * @returns {string}
 */
function formatDisplayDate(dateStr) {
    return parseLocalDate(dateStr).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        weekday: 'short'
    });
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
 * 获取指定日期中是否已有任何班次记录。
 * @param {object|null} dayData
 * @returns {boolean}
 */
function hasAnyCheckinRecord(dayData) {
    if (!dayData) return false;
    return ['morning', 'afternoon', 'evening'].some((period) => dayData[period]?.checkIn || dayData[period]?.checkOut);
}

/**
 * 汇总补打卡配额使用情况。
 * @param {string} targetDate
 * @returns {{ weekUsed: number, monthUsed: number, weekDates: Set<string>, monthDates: Set<string> }}
 */
function getRetroCheckinUsage(targetDate = getTodayString()) {
    const weekDates = new Set();
    const monthDates = new Set();
    const targetMonth = String(targetDate).slice(0, 7);

    Object.entries(checkinData).forEach(([date, day]) => {
        const hasRetro = ['morning', 'afternoon', 'evening'].some((period) => day?.[period]?.entrySource === 'retro');
        if (!hasRetro) return;

        const diff = getDateDiffInDays(date);
        if (diff >= 1 && diff <= 7) weekDates.add(date);
        if (String(date).slice(0, 7) === targetMonth) monthDates.add(date);
    });

    return {
        weekUsed: weekDates.size,
        monthUsed: monthDates.size,
        weekDates,
        monthDates
    };
}

/**
 * 判断某个日期是否允许补打卡，并返回失败原因与当前配额占用。
 * @param {string} targetDate
 * @returns {{ allowed: boolean, reason: string, usage: { weekUsed: number, monthUsed: number, weekDates: Set<string>, monthDates: Set<string> } }}
 */
function getRetroCheckinAvailability(targetDate) {
    const usage = getRetroCheckinUsage(targetDate || getTodayString());
    const today = getTodayString();
    const date = String(targetDate || '');

    if (!date) {
        return { allowed: false, reason: '先选一个要补录的日期。', usage };
    }

    const diff = getDateDiffInDays(date, today);
    if (diff <= 0) {
        return { allowed: false, reason: '补打卡只处理过去日期，今天和未来日期不走这条流程。', usage };
    }

    if (diff > CONFIG.retro.maxDaysPast) {
        return { allowed: false, reason: `这里只保留最近 ${CONFIG.retro.maxDaysPast} 天的补录窗口。`, usage };
    }

    const sameDayAlreadyCounted = usage.weekDates.has(date) || usage.monthDates.has(date);
    if (diff <= 7 && !sameDayAlreadyCounted && usage.weekUsed >= CONFIG.retro.last7DayQuota) {
        return { allowed: false, reason: `最近 7 天的补录额度已经用满（${CONFIG.retro.last7DayQuota} / ${CONFIG.retro.last7DayQuota}）。`, usage };
    }

    if (!sameDayAlreadyCounted && usage.monthUsed >= CONFIG.retro.monthlyQuota) {
        return { allowed: false, reason: `本月补录额度已经用满（${CONFIG.retro.monthlyQuota} / ${CONFIG.retro.monthlyQuota}）。`, usage };
    }

    return { allowed: true, reason: '', usage };
}

/**
 * 提取当前可用的情绪倾向信号，优先使用酒馆当前结果，其次回退到最近一杯历史。
 * @returns {{ valence: number, intensity: number }}
 */
function getCurrentTavernSignal() {
    if (currentDrinkInfo && typeof currentDrinkInfo.valence === 'number') {
        return {
            valence: currentDrinkInfo.valence,
            intensity: typeof currentDrinkInfo.intensity === 'number' ? currentDrinkInfo.intensity : 0.25
        };
    }

    const latestDrink = Array.isArray(tavernData) ? tavernData[0] : null;
    return {
        valence: typeof latestDrink?.valence === 'number' ? latestDrink.valence : 0,
        intensity: typeof latestDrink?.intensity === 'number' ? latestDrink.intensity : 0
    };
}

/**
 * 基于当前时间、值班状态、任务推进和情绪倾向派生航行环境态。
 * @returns {{ state: 'steady'|'alert'|'recovery'|'nightwatch', warnings: boolean, issues: boolean }}
 */
function getVoyageAmbientState() {
    const now = new Date();
    const hour = now.getHours();
    const today = getTodayString();
    const dayData = checkinData[today] ? ensureDayRecord(checkinData[today]) : createEmptyDayRecord();
    const tavernSignal = getCurrentTavernSignal();
    const todayTasks = taskData[today] || [];

    let issues = false;
    let warnings = false;
    ['morning', 'afternoon', 'evening'].forEach((period) => {
        const inStatus = getNormalizedCheckInStatus(dayData[period].status.checkIn);
        const outStatus = dayData[period].status.checkOut;
        if (inStatus === 'danger' || outStatus === 'danger' || outStatus === false) issues = true;
        if (inStatus === 'warning' || outStatus === 'warning') warnings = true;
    });

    if (hour >= 22 || hour < 6) {
        return { state: 'nightwatch', warnings, issues };
    }

    if (issues || warnings || (tavernSignal.valence < -0.2 && tavernSignal.intensity > 0.4)) {
        return { state: 'alert', warnings, issues };
    }

    if (currentTask || todayTasks.length > 0 || dayData.leave || tavernSignal.valence > 0.18) {
        return { state: 'recovery', warnings, issues };
    }

    return { state: 'steady', warnings, issues };
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
 * 创建轻量 DOM 节点，便于列表和卡片渲染摆脱大段字符串拼接。
 * @param {string} tagName
 * @param {{ className?: string, text?: string, html?: string, attrs?: Record<string, unknown> }} [options]
 * @returns {HTMLElement}
 */
function createDomElement(tagName, options = {}) {
    const { className = '', text, html, attrs = {} } = options;
    const element = document.createElement(tagName);

    if (className) {
        element.className = className;
    }

    if (text != null) {
        element.textContent = String(text);
    } else if (html != null) {
        element.innerHTML = html;
    }

    Object.entries(attrs).forEach(([key, value]) => {
        if (value == null) return;
        element.setAttribute(key, String(value));
    });

    return element;
}

/**
 * 向父节点按顺序挂载一组子节点，并自动跳过空值。
 * @param {HTMLElement | DocumentFragment} parent
 * @param {Array<Node | null | undefined | false>} children
 * @returns {HTMLElement | DocumentFragment}
 */
function appendDomChildren(parent, children) {
    children.forEach((child) => {
        if (child) {
            parent.appendChild(child);
        }
    });
    return parent;
}

function createLucideIconElement(icon, className = '') {
    return createDomElement('i', {
        className,
        attrs: { 'data-lucide': icon }
    });
}

function setElementIconLabel(element, icon, label, options = {}) {
    if (!element) return;

    const {
        iconClass = 'w-4 h-4',
        labelClass = ''
    } = options;

    const fragment = document.createDocumentFragment();
    fragment.appendChild(createLucideIconElement(icon, iconClass));
    fragment.appendChild(createDomElement('span', {
        className: labelClass,
        text: label
    }));
    element.replaceChildren(fragment);
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
