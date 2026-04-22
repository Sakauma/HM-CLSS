/**
 * 值班状态渲染层。
 * 负责主按钮状态、时间文案和今日值班表。
 */

const CHECKIN_ACTIVE_BUTTON_CLASS = 'action-btn action-btn-primary';
const CHECKOUT_ACTIVE_BUTTON_CLASS = 'action-btn action-btn-secondary';
const CHECKIN_DISABLED_BUTTON_CLASS = 'action-btn action-btn-disabled';

function getCheckinStatusPresentation(status, hasRecord) {
    if (!hasRecord) {
        return { text: '-', className: 'py-3 px-4' };
    }

    const normalized = getNormalizedCheckInStatus(status);
    if (normalized === 'excused') {
        return { text: '离舰豁免', className: 'py-3 px-4 font-bold text-blue-500 dark:text-blue-400' };
    }
    if (normalized === 'warning') {
        return { text: '警告', className: 'py-3 px-4 font-medium text-warning' };
    }
    if (normalized === 'danger') {
        return { text: '异常', className: 'py-3 px-4 font-medium text-danger' };
    }

    return { text: '合格', className: 'py-3 px-4 font-medium text-success' };
}

function getCheckoutStatusPresentation(status, hasRecord) {
    if (!hasRecord) {
        return { text: '-', className: 'py-3 px-4' };
    }

    if (status === 'excused') {
        return { text: '离舰豁免', className: 'py-3 px-4 font-bold text-blue-500 dark:text-blue-400' };
    }
    if (status === 'success' || status === true) {
        return { text: '合格', className: 'py-3 px-4 font-medium text-success' };
    }
    if (status === 'warning') {
        return { text: '警告', className: 'py-3 px-4 font-medium text-warning' };
    }

    return { text: '异常', className: 'py-3 px-4 font-medium text-danger' };
}

function setCheckinActionState(button, options = {}) {
    if (!button) return;

    const {
        disabled = false,
        label = '',
        className = disabled ? CHECKIN_DISABLED_BUTTON_CLASS : CHECKIN_ACTIVE_BUTTON_CLASS
    } = options;

    button.disabled = disabled;
    button.textContent = label;
    button.className = className;
}

/**
 * 根据当前时间、离舰状态和已有记录动态更新打卡按钮状态。
 */
function updateCheckinButtons() {
    const today = getTodayString();
    const dayData = ensureCheckinDay(today);
    const now = getCurrentTime();
    const currentHour = now.hour;
    const currentMins = now.hour * 60 + now.minute;
    const isLeave = Boolean(dayData.leave);

    let isCurrentlyOnPartialLeave = false;
    if (Array.isArray(dayData.partialLeaves)) {
        for (const leave of dayData.partialLeaves) {
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
        CHECKIN_PERIODS.forEach((period) => {
            const checkinBtn = document.getElementById(`${period}-checkin`);
            const checkoutBtn = document.getElementById(`${period}-checkout`);
            const text = isLeave ? '全天离舰' : '离舰中...';

            setCheckinActionState(checkinBtn, {
                disabled: true,
                label: text,
                className: CHECKIN_DISABLED_BUTTON_CLASS
            });
            setCheckinActionState(checkoutBtn, {
                disabled: true,
                label: text,
                className: CHECKIN_DISABLED_BUTTON_CLASS
            });
        });
        updateCheckinTimeDisplay();
        return;
    }

    const mCfg = CONFIG.schedule.morning;
    const aCfg = CONFIG.schedule.afternoon;
    const eCfg = CONFIG.schedule.evening;

    CHECKIN_PERIODS.forEach((period) => {
        const checkinBtn = document.getElementById(`${period}-checkin`);
        const checkoutBtn = document.getElementById(`${period}-checkout`);
        const isCheckinDisabled = period === 'morning'
            ? dayData.morning.checkIn !== null || currentHour < mCfg.startHour || currentHour >= mCfg.endHour
            : period === 'afternoon'
                ? dayData.afternoon.checkIn !== null || currentHour < aCfg.startHour || currentHour >= aCfg.endHour
                : dayData.evening.checkIn !== null || currentHour < eCfg.startHour || currentHour >= eCfg.endHour;
        const isCheckoutDisabled = period === 'morning'
            ? dayData.morning.checkOut !== null || dayData.morning.checkIn === null || currentHour >= aCfg.startHour
            : period === 'afternoon'
                ? dayData.afternoon.checkOut !== null || dayData.afternoon.checkIn === null || currentHour >= eCfg.startHour + 3
                : dayData.evening.checkOut !== null || dayData.evening.checkIn === null;

        setCheckinActionState(checkinBtn, {
            disabled: isCheckinDisabled,
            label: btnTexts[period].in,
            className: isCheckinDisabled ? CHECKIN_DISABLED_BUTTON_CLASS : CHECKIN_ACTIVE_BUTTON_CLASS
        });
        setCheckinActionState(checkoutBtn, {
            disabled: isCheckoutDisabled,
            label: btnTexts[period].out,
            className: isCheckoutDisabled ? CHECKIN_DISABLED_BUTTON_CLASS : CHECKOUT_ACTIVE_BUTTON_CLASS
        });
    });

    updateCheckinTimeDisplay();
}

/**
 * 刷新主按钮下方的开始/结束时间文案。
 */
function updateCheckinTimeDisplay() {
    const today = getTodayString();
    const dayData = ensureCheckinDay(today);
    CHECKIN_PERIODS.forEach((period) => {
        document.getElementById(`${period}-checkin-time`).textContent = `开始: ${dayData[period].checkIn || '-'}`;
        document.getElementById(`${period}-checkout-time`).textContent = `结束: ${dayData[period].checkOut || '-'}`;
    });
}

/**
 * 刷新今日打卡明细表，并把内部状态映射成用户可读文案。
 */
function updateTodayCheckinTable() {
    const today = getTodayString();
    const dayData = ensureCheckinDay(today);

    CHECKIN_PERIODS.forEach((period) => {
        document.getElementById(`table-${period}-checkin`).textContent = dayData[period].checkIn || '-';
        document.getElementById(`table-${period}-checkout`).textContent = dayData[period].checkOut || '-';

        const checkinPresentation = getCheckinStatusPresentation(dayData[period].status.checkIn, dayData[period].checkIn !== null);
        const checkoutPresentation = getCheckoutStatusPresentation(dayData[period].status.checkOut, dayData[period].checkOut !== null);
        const checkinStatusEl = document.getElementById(`table-${period}-checkin-status`);
        const checkoutStatusEl = document.getElementById(`table-${period}-checkout-status`);

        if (checkinStatusEl) {
            checkinStatusEl.textContent = checkinPresentation.text;
            checkinStatusEl.className = checkinPresentation.className;
        }

        if (checkoutStatusEl) {
            checkoutStatusEl.textContent = checkoutPresentation.text;
            checkoutStatusEl.className = checkoutPresentation.className;
        }
    });
}
