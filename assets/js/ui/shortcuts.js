/**
 * 全局快捷键层。
 * 负责在不打断文本输入的前提下，提供舱段切换、循环浏览与值班快捷操作。
 */

const NAVIGATION_SHORTCUT_IDS = [
    'nav-checkin',
    'nav-phone',
    'nav-tasks',
    'nav-archive',
    'nav-leave',
    'nav-tavern',
    'nav-stats',
    'nav-settings'
];

const NAVIGATION_SHORTCUT_KEYMAP = {
    Digit1: 0,
    Digit2: 1,
    Digit3: 2,
    Digit4: 3,
    Digit5: 4,
    Digit6: 5,
    Digit7: 6,
    Digit8: 7
};

const CHECKIN_SHORTCUT_KEYMAP = {
    Digit1: 'morning',
    Digit2: 'afternoon',
    Digit3: 'evening'
};

let keyboardShortcutsInitialized = false;

function isTypingTarget(target) {
    if (!target) return false;
    if (target.isContentEditable) return true;
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function getActiveNavigationIndex() {
    return NAVIGATION_SHORTCUT_IDS.findIndex((id) => document.getElementById(id)?.classList.contains('nav-rail-button-active'));
}

function triggerNavigationShortcut(index) {
    const buttonId = NAVIGATION_SHORTCUT_IDS[index];
    const button = buttonId ? document.getElementById(buttonId) : null;
    button?.click();
}

function cycleNavigationShortcut(step) {
    const currentIndex = getActiveNavigationIndex();
    const nextIndex = currentIndex >= 0
        ? (currentIndex + step + NAVIGATION_SHORTCUT_IDS.length) % NAVIGATION_SHORTCUT_IDS.length
        : 0;
    triggerNavigationShortcut(nextIndex);
}

function triggerShiftShortcut(period) {
    const navCheckinBtn = document.getElementById('nav-checkin');
    const checkinBtn = document.getElementById(`${period}-checkin`);
    const checkoutBtn = document.getElementById(`${period}-checkout`);

    if (document.getElementById('checkin-section')?.classList.contains('hidden')) {
        navCheckinBtn?.click();
    }

    if (checkinBtn && !checkinBtn.disabled) {
        checkinBtn.click();
        return;
    }

    if (checkoutBtn && !checkoutBtn.disabled) {
        checkoutBtn.click();
        return;
    }

    if (typeof showToast === 'function') {
        showToast(`${getPeriodLabel(period)} 当前没有可执行动作。`, 'info');
    }
}

function updateKeyboardShortcutHint() {
    const hintEl = document.getElementById('keyboard-shortcut-hint');
    if (!hintEl) return;
    hintEl.textContent = 'Alt+1-8 切舱 · Alt+Shift+1-3 值班 · Ctrl+K 捕捉';
}

function handleKeyboardShortcuts(event) {
    if (event.defaultPrevented || isTypingTarget(event.target)) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') return;
    if (event.metaKey || event.ctrlKey) return;

    if (event.altKey && !event.shiftKey && Object.hasOwn(NAVIGATION_SHORTCUT_KEYMAP, event.code)) {
        event.preventDefault();
        triggerNavigationShortcut(NAVIGATION_SHORTCUT_KEYMAP[event.code]);
        return;
    }

    if (event.altKey && event.shiftKey && Object.hasOwn(CHECKIN_SHORTCUT_KEYMAP, event.code)) {
        event.preventDefault();
        triggerShiftShortcut(CHECKIN_SHORTCUT_KEYMAP[event.code]);
        return;
    }

    if (event.altKey && !event.shiftKey && event.code === 'BracketLeft') {
        event.preventDefault();
        cycleNavigationShortcut(-1);
        return;
    }

    if (event.altKey && !event.shiftKey && event.code === 'BracketRight') {
        event.preventDefault();
        cycleNavigationShortcut(1);
    }
}

function initKeyboardShortcuts() {
    if (keyboardShortcutsInitialized) return;
    const disposables = createDisposables();
    keyboardShortcutsInitialized = true;
    disposables.listen(document, 'keydown', handleKeyboardShortcuts);
    updateKeyboardShortcutHint();
    return () => {
        keyboardShortcutsInitialized = false;
        disposables.dispose();
    };
}

registerAppModule({
    id: 'keyboard-shortcuts',
    order: 90,
    init: initKeyboardShortcuts
});
