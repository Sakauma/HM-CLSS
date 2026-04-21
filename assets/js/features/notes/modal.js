/**
 * 速记弹窗与快捷键层。
 * 负责弹窗开关、焦点约束和全局捕捉快捷键。
 */

const quickModal = document.getElementById('quick-capture-modal');
const quickContent = document.getElementById('quick-capture-content');
const quickInput = document.getElementById('quick-capture-input');
const quickTagSelect = document.getElementById('quick-capture-tag');
const quickCount = document.getElementById('quick-capture-count');
const quickSaveBtn = document.getElementById('quick-capture-save');
let lastQuickCaptureTrigger = null;
let quickCaptureScrollLockToken = null;

function getQuickCaptureFocusables() {
    if (!quickModal) return [];

    return Array.from(
        quickModal.querySelectorAll(
            'button:not([disabled]), textarea:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
    ).filter((element) => !element.closest('.hidden'));
}

function updateQuickCaptureCount() {
    if (!quickInput || !quickCount || !quickSaveBtn) return;

    const trimmedLength = quickInput.value.trim().length;
    quickCount.textContent = String(trimmedLength);
    quickSaveBtn.disabled = trimmedLength === 0;
    quickSaveBtn.classList.toggle('opacity-60', trimmedLength === 0);
    quickSaveBtn.classList.toggle('cursor-not-allowed', trimmedLength === 0);
}

function openQuickCaptureModal(triggerSource = document.activeElement) {
    if (!quickModal || !quickInput) return;

    lastQuickCaptureTrigger = triggerSource instanceof HTMLElement ? triggerSource : null;
    quickModal.classList.remove('hidden');
    quickModal.setAttribute('aria-hidden', 'false');
    quickContent?.classList.remove('scale-95');
    quickContent?.classList.add('scale-100');
    if (!quickCaptureScrollLockToken) {
        quickCaptureScrollLockToken = acquireBodyScrollLock(Symbol('quick-capture'));
    }
    updateQuickCaptureCount();
    setTimeout(() => quickInput.focus(), 50);
    lucide.createIcons();
}

function closeQuickCaptureModal(options = {}) {
    if (!quickModal) return;
    const { restoreFocus = true } = options;

    quickContent?.classList.remove('scale-100');
    quickContent?.classList.add('scale-95');
    quickModal.classList.add('hidden');
    quickModal.setAttribute('aria-hidden', 'true');
    releaseBodyScrollLock(quickCaptureScrollLockToken);
    quickCaptureScrollLockToken = null;
    if (restoreFocus && lastQuickCaptureTrigger && typeof lastQuickCaptureTrigger.focus === 'function') {
        lastQuickCaptureTrigger.focus();
    }
    if (!restoreFocus) {
        lastQuickCaptureTrigger = null;
    }
}

function handleQuickCaptureKeyboard(event) {
    if (!quickModal || !quickInput) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (quickModal.classList.contains('hidden')) {
            openQuickCaptureModal(document.activeElement);
        } else {
            closeQuickCaptureModal();
        }
        return;
    }

    if (event.key === 'Tab' && !quickModal.classList.contains('hidden')) {
        const focusables = getQuickCaptureFocusables();
        if (!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    if (event.key === 'Escape' && !quickModal.classList.contains('hidden')) {
        closeQuickCaptureModal();
    }
}

function handleQuickCaptureClick(event) {
    const openBtn = event.target.closest('.open-quick-capture-btn');
    if (openBtn) {
        event.preventDefault();
        openQuickCaptureModal(openBtn);
        return;
    }

    if (event.target === quickModal) {
        closeQuickCaptureModal();
    }
}

function initQuickCaptureModal() {
    const disposables = createDisposables();
    const stopContentClick = (event) => {
        event.stopPropagation();
    };
    const handleQuickInputKeydown = (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            saveQuickCapture();
        }
    };

    disposables.listen(document, 'keydown', handleQuickCaptureKeyboard);
    disposables.listen(document, 'click', handleQuickCaptureClick);
    disposables.listen(quickContent, 'click', stopContentClick);
    disposables.listen(quickInput, 'input', updateQuickCaptureCount);
    disposables.listen(quickInput, 'keydown', handleQuickInputKeydown);
    disposables.listen(document.getElementById('quick-capture-close'), 'click', closeQuickCaptureModal);
    disposables.listen(document.getElementById('quick-capture-cancel'), 'click', closeQuickCaptureModal);
    disposables.listen(quickSaveBtn, 'click', saveQuickCapture);
    updateQuickCaptureCount();
    return () => {
        closeQuickCaptureModal({ restoreFocus: false });
        disposables.dispose();
    };
}
