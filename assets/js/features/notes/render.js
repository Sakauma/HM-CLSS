async function handleNoteDeletion(event) {
    const btn = event.target.closest('.delete-note-btn');
    if (!btn) return;

    const confirmed = await showConfirmDialog({
        title: '删除这条捕捉记录？',
        message: '这条速记会从本地记录中永久移除，删除后不会自动恢复。',
        badge: 'DELETE NOTE',
        confirmLabel: '确认删除',
        cancelLabel: '先保留',
        tone: 'danger'
    });
    if (!confirmed) return;

    const date = btn.getAttribute('data-date');
    const index = parseInt(btn.getAttribute('data-index'), 10);
    if (removeDailyEntry(quickNotesData, date, index)) {
        saveData();
        showToast('记录已抹除', 'success');
        updateQuickNotesList();
        rerenderVisiblePanel('archive-section', () => {
            renderArchive(document.getElementById('archive-search-input').value.trim());
        });
    }
}

function initNotesRendering() {
    const disposables = createDisposables();
    disposables.listen(document.getElementById('archive-search-input'), 'input', (event) => {
        renderArchive(event.target.value.trim());
    });
    disposables.listen(document.getElementById('archive-list-container'), 'click', handleNoteDeletion);
    disposables.listen(document.getElementById('quick-notes-container'), 'click', handleNoteDeletion);
    return () => {
        disposables.dispose();
    };
}
