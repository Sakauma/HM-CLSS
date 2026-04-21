function saveQuickCapture() {
    if (!quickInput || !quickTagSelect) return;

    const text = quickInput.value.trim();
    const tag = quickTagSelect.value;

    if (!text) {
        showToast('先留下一句，再继续。', 'warning');
        updateQuickCaptureCount();
        return;
    }

    const today = getTodayString();
    prependDailyEntry(quickNotesData, today, {
        time: getCurrentTimeString(),
        text,
        tag
    });

    saveData();
    quickInput.value = '';
    updateQuickCaptureCount();
    closeQuickCaptureModal();
    updateQuickNotesList();
    rerenderVisiblePanel('archive-section', () => {
        renderArchive(document.getElementById('archive-search-input').value.trim());
    });

    checkAchievements();
    lucide.createIcons();
    showToast('记录已收入捕捉池', 'success');
}

function initNotesModule() {
    const disposables = createDisposables();
    disposables.add(initQuickCaptureModal());
    disposables.add(initNotesRendering());
    updateQuickNotesList();
    return () => {
        disposables.dispose();
    };
}

registerAppModule({
    id: 'notes',
    order: 55,
    init: initNotesModule
});
