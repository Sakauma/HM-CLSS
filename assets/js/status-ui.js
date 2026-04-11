function updateTodayStatus() {
    const today = getTodayString();
    const dayData = checkinData[today];
    ['morning', 'afternoon', 'evening'].forEach((period) => {
        const el = document.getElementById(`today-${period}-status`);

        if (dayData.leave) {
            el.textContent = '全天脱产';
            el.className = 'font-medium text-slate-400';
        } else if (dayData[period].checkIn && dayData[period].checkOut) {
            const inVal = dayData[period].status.checkIn;
            const outVal = dayData[period].status.checkOut;

            if (inVal === 'excused' || outVal === 'excused') {
                el.textContent = '已离舰';
                el.className = 'font-bold text-blue-500 dark:text-blue-400';
            } else if (!inVal || outVal === false || outVal === 'danger') {
                el.textContent = '异常';
                el.className = 'font-medium text-danger';
            } else if (outVal === 'warning') {
                el.textContent = '超时警告';
                el.className = 'font-medium text-warning';
            } else {
                el.textContent = '合规';
                el.className = 'font-medium text-success';
            }
        } else if (dayData[period].checkIn) {
            el.textContent = '工作中';
            el.className = 'font-medium text-primary';
        } else {
            el.textContent = '-';
            el.className = 'font-medium text-slate-400';
        }
    });

    document.getElementById('today-phone-count').textContent = `${phoneResistData.records[today].count} 次`;
    const activeTaskEl = document.getElementById('today-active-task');
    if (currentTask) {
        activeTaskEl.textContent = currentTask.name;
        activeTaskEl.className = 'font-medium text-primary truncate max-w-[120px]';
    } else {
        activeTaskEl.textContent = '空闲';
        activeTaskEl.className = 'font-medium text-slate-400';
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const colors = {
        success: 'bg-white dark:bg-slate-800 border-l-4 border-success text-slate-700 dark:text-slate-200',
        error: 'bg-white dark:bg-slate-800 border-l-4 border-danger text-slate-700 dark:text-slate-200',
        warning: 'bg-white dark:bg-slate-800 border-l-4 border-warning text-slate-700 dark:text-slate-200'
    };

    const icons = {
        success: '<i data-lucide="check-circle" class="w-5 h-5 text-success shrink-0"></i>',
        error: '<i data-lucide="x-circle" class="w-5 h-5 text-danger shrink-0"></i>',
        warning: '<i data-lucide="alert-triangle" class="w-5 h-5 text-warning shrink-0"></i>'
    };

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 pointer-events-auto animate-toast-in ${colors[type]}`;
    toast.innerHTML = `
        ${icons[type]}
        <span class="text-sm font-medium">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.classList.remove('animate-toast-in');
        toast.classList.add('animate-toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
