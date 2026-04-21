/**
 * 首页确认弹窗层。
 * 负责统一确认弹窗的展示、焦点恢复和键盘关闭。
 */

let confirmDialogResolver = null;
let confirmDialogLastTrigger = null;
let confirmDialogBindingsReady = false;
let confirmDialogCleanup = null;
let confirmDialogScrollLockToken = null;

function getConfirmDialogElements() {
    return {
        modal: document.getElementById('confirm-dialog-modal'),
        panel: document.getElementById('confirm-dialog-panel'),
        badge: document.getElementById('confirm-dialog-badge'),
        title: document.getElementById('confirm-dialog-title'),
        message: document.getElementById('confirm-dialog-message'),
        confirmBtn: document.getElementById('confirm-dialog-confirm'),
        cancelBtn: document.getElementById('confirm-dialog-cancel')
    };
}

function closeConfirmDialog(result) {
    const elements = getConfirmDialogElements();
    if (!elements.modal) return;

    elements.modal.classList.add('hidden');
    elements.modal.classList.remove('flex');
    elements.modal.setAttribute('aria-hidden', 'true');
    releaseBodyScrollLock(confirmDialogScrollLockToken);
    confirmDialogScrollLockToken = null;

    if (confirmDialogLastTrigger && typeof confirmDialogLastTrigger.focus === 'function') {
        confirmDialogLastTrigger.focus();
    }

    const resolver = confirmDialogResolver;
    confirmDialogResolver = null;
    confirmDialogLastTrigger = null;
    if (resolver) {
        resolver(Boolean(result));
    }
}

function ensureConfirmDialogBindings() {
    if (confirmDialogBindingsReady) return;

    const { modal, panel, confirmBtn, cancelBtn } = getConfirmDialogElements();
    if (!modal || !panel || !confirmBtn || !cancelBtn) return;

    const disposables = createDisposables();
    confirmDialogBindingsReady = true;
    disposables.listen(confirmBtn, 'click', () => closeConfirmDialog(true));
    disposables.listen(cancelBtn, 'click', () => closeConfirmDialog(false));
    disposables.listen(modal, 'click', (event) => {
        if (event.target === modal) {
            closeConfirmDialog(false);
        }
    });
    disposables.listen(panel, 'click', (event) => event.stopPropagation());
    disposables.listen(document, 'keydown', (event) => {
        if (event.key === 'Escape' && confirmDialogResolver) {
            closeConfirmDialog(false);
        }
    });

    confirmDialogCleanup = () => {
        if (confirmDialogResolver) {
            closeConfirmDialog(false);
        }
        confirmDialogBindingsReady = false;
        disposables.dispose();
        confirmDialogCleanup = null;
    };
}

function showConfirmDialog(options = {}) {
    ensureConfirmDialogBindings();
    const elements = getConfirmDialogElements();
    if (!elements.modal || !elements.title || !elements.message || !elements.confirmBtn || !elements.cancelBtn || !elements.badge) {
        return Promise.resolve(false);
    }

    if (confirmDialogResolver) {
        closeConfirmDialog(false);
    }

    const {
        title = '确认继续',
        message = '确认执行当前操作吗？',
        badge = 'CONFIRM',
        confirmLabel = '确认',
        cancelLabel = '取消',
        tone = 'warning'
    } = options;

    const toneClassMap = {
        danger: {
            badge: 'status-chip status-chip-danger shrink-0',
            confirm: 'w-full rounded-xl bg-danger px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-600'
        },
        warning: {
            badge: 'status-chip status-chip-warning shrink-0',
            confirm: 'w-full rounded-xl bg-warning px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-yellow-500'
        },
        info: {
            badge: 'status-chip status-chip-info shrink-0',
            confirm: 'w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primaryHover'
        },
        success: {
            badge: 'status-chip status-chip-success shrink-0',
            confirm: 'w-full rounded-xl bg-success px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400'
        }
    };
    const toneClasses = toneClassMap[tone] || toneClassMap.warning;

    confirmDialogLastTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    elements.badge.textContent = badge;
    elements.badge.className = toneClasses.badge;
    elements.title.textContent = title;
    elements.message.textContent = message;
    elements.confirmBtn.className = toneClasses.confirm;
    elements.confirmBtn.textContent = confirmLabel;
    elements.cancelBtn.textContent = cancelLabel;

    elements.modal.classList.remove('hidden');
    elements.modal.classList.add('flex');
    elements.modal.setAttribute('aria-hidden', 'false');
    if (!confirmDialogScrollLockToken) {
        confirmDialogScrollLockToken = acquireBodyScrollLock(Symbol('confirm-dialog'));
    }

    return new Promise((resolve) => {
        confirmDialogResolver = resolve;
        requestAnimationFrame(() => elements.confirmBtn.focus());
    });
}

registerAppModule({
    id: 'confirm-dialog',
    order: 112,
    init() {
        ensureConfirmDialogBindings();
        return () => {
            if (typeof confirmDialogCleanup === 'function') {
                confirmDialogCleanup();
            }
        };
    }
});
