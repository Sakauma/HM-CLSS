/**
 * 首页提示层。
 * 负责统一 toast 的创建、图标和退场动画。
 */

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');

    const colors = {
        success: 'bg-white dark:bg-slate-800 border-l-4 border-success text-slate-700 dark:text-slate-200',
        error: 'bg-white dark:bg-slate-800 border-l-4 border-danger text-slate-700 dark:text-slate-200',
        warning: 'bg-white dark:bg-slate-800 border-l-4 border-warning text-slate-700 dark:text-slate-200',
        info: 'bg-white dark:bg-slate-800 border-l-4 border-primary text-slate-700 dark:text-slate-200'
    };

    const icons = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle',
        info: 'info'
    };

    const tone = colors[type] ? type : 'success';
    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 pointer-events-auto animate-toast-in ${colors[tone]}`;
    toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
    toast.setAttribute('aria-atomic', 'true');
    toast.replaceChildren(...appendDomChildren(document.createDocumentFragment(), [
        createLucideIconElement(icons[tone], `w-5 h-5 ${tone === 'success' ? 'text-success' : tone === 'error' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-primary'} shrink-0`),
        createDomElement('span', {
            className: 'text-sm font-medium',
            text: message
        })
    ]).childNodes);

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.classList.remove('animate-toast-in');
        toast.classList.add('animate-toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
