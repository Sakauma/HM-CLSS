const quickModal = document.getElementById('quick-capture-modal');
const quickInput = document.getElementById('quick-capture-input');

document.addEventListener('keydown', (event) => {
    if (!quickModal || !quickInput) return;

    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        if (quickModal.classList.contains('hidden')) {
            quickModal.classList.remove('hidden');
            setTimeout(() => quickInput.focus(), 50);
        } else {
            quickModal.classList.add('hidden');
        }
    }

    if (event.key === 'Escape' && !quickModal.classList.contains('hidden')) {
        quickModal.classList.add('hidden');
    }
});

quickInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        const text = quickInput.value.trim();
        const tag = document.getElementById('quick-capture-tag').value;

        if (text) {
            const today = getTodayString();
            if (!quickNotesData[today]) quickNotesData[today] = [];
            quickNotesData[today].unshift({ time: getCurrentTimeString(), text, tag });
            saveData();
            quickInput.value = '';
            quickModal?.classList.add('hidden');
            updateQuickNotesList();

            if (typeof renderArchive === 'function' && !document.getElementById('archive-section').classList.contains('hidden')) {
                renderArchive(document.getElementById('archive-search-input').value.trim());
            }

            checkAchievements();
            lucide.createIcons();
        }
    }
});

function renderArchive(filterText = '') {
    const container = document.getElementById('archive-list-container');
    const dates = Object.keys(quickNotesData).sort((a, b) => new Date(b) - new Date(a));

    let html = '';
    let hasResults = false;
    const searchText = filterText.toLowerCase();

    dates.forEach((date) => {
        const notes = quickNotesData[date];
        if (!notes || !notes.length) return;
        const safeDate = escapeHtml(date);

        let sectionHtml = '';
        notes.forEach((note, originalIndex) => {
            const noteText = getNoteText(note);
            if (!noteText.toLowerCase().includes(searchText)) return;

            hasResults = true;
            const tagKey = note.tag || 'idea';
            const tagCfg = noteTagConfig[tagKey] || noteTagConfig.idea;
            sectionHtml += `
                <div class="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-primary/30 transition-colors relative group">
                    <div class="flex flex-col gap-2 mt-1 shrink-0 w-16 items-center">
                        <span class="text-sm font-mono text-slate-400 bg-slate-200/50 dark:bg-slate-800/50 px-2 py-0.5 rounded w-full text-center">${escapeHtml(getNoteTime(note))}</span>
                        <span class="text-[10px] flex items-center justify-center gap-1 border px-1.5 py-0.5 rounded w-full ${tagCfg.color}">
                            <i data-lucide="${tagCfg.icon}" class="w-3 h-3"></i> ${tagCfg.label}
                        </span>
                    </div>
                    <div class="text-sm text-slate-700 dark:text-slate-300 md-content w-full overflow-hidden break-words pr-8">
                        ${DOMPurify.sanitize(marked.parse(noteText))}
                    </div>
                    <button class="delete-note-btn absolute top-4 right-4 text-slate-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity" data-date="${safeDate}" data-index="${originalIndex}" title="删除记录">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
        });

        if (!sectionHtml) return;

        html += `
            <div class="bg-cardLight dark:bg-cardDark rounded-2xl p-6 shadow-soft border border-slate-100 dark:border-slate-800">
                <h3 class="text-lg font-bold mb-4 text-primary flex items-center gap-2">
                    <i data-lucide="calendar" class="w-5 h-5"></i> ${safeDate}
                </h3>
                <div class="space-y-4">
                    ${sectionHtml}
                </div>
            </div>
        `;
    });

    if (!hasResults) {
        container.innerHTML = `
            <div class="bg-cardLight dark:bg-cardDark rounded-2xl p-10 shadow-soft border border-slate-100 dark:border-slate-800 text-center flex flex-col items-center justify-center text-slate-400">
                <i data-lucide="inbox" class="w-12 h-12 mb-3 opacity-50"></i>
                <p>${filterText ? '没有找到包含该关键词的记录' : '你的噬星体捕捉池目前空空如也'}</p>
            </div>
        `;
    } else {
        container.innerHTML = html;
    }

    lucide.createIcons();
}

document.getElementById('archive-search-input')?.addEventListener('input', (event) => {
    renderArchive(event.target.value.trim());
});

function updateQuickNotesList() {
    const container = document.getElementById('quick-notes-container');
    const notes = quickNotesData[getTodayString()] || [];
    if (!notes.length) {
        container.innerHTML = '<div class="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">今天还没有任何火花... 按 Ctrl+K 记录。</div>';
        return;
    }

    container.innerHTML = notes.map((note, index) => {
        const noteText = getNoteText(note);
        const tagKey = note.tag || 'idea';
        const tagCfg = noteTagConfig[tagKey] || noteTagConfig.idea;
        return `
            <div class="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/50 group hover:border-primary/30 transition-colors relative">
                <div class="flex flex-col gap-1.5 mt-1 shrink-0 w-12 items-center">
                    <span class="text-xs font-mono text-slate-400">${escapeHtml(getNoteTime(note))}</span>
                    <span class="text-[9px] border px-1 rounded w-full text-center ${tagCfg.color}">${tagCfg.label}</span>
                </div>
                <div class="text-sm text-slate-700 dark:text-slate-300 md-content w-full overflow-hidden break-words pr-6">
                    ${DOMPurify.sanitize(marked.parse(noteText))}
                </div>
                <button class="delete-note-btn absolute top-3 right-3 text-slate-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity p-1" data-date="${getTodayString()}" data-index="${index}">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function handleNoteDeletion(event) {
    const btn = event.target.closest('.delete-note-btn');
    if (!btn) return;

    if (confirm('警告：确定要将这条记录从存储核心中永久抹除吗？')) {
        const date = btn.getAttribute('data-date');
        const index = parseInt(btn.getAttribute('data-index'), 10);

        if (quickNotesData[date]) {
            quickNotesData[date].splice(index, 1);

            if (quickNotesData[date].length === 0) {
                delete quickNotesData[date];
            }

            saveData();
            showToast('记录已抹除', 'success');
            updateQuickNotesList();

            if (typeof renderArchive === 'function' && !document.getElementById('archive-section').classList.contains('hidden')) {
                renderArchive(document.getElementById('archive-search-input').value.trim());
            }
        }
    }
}

document.getElementById('archive-list-container')?.addEventListener('click', handleNoteDeletion);
document.getElementById('quick-notes-container')?.addEventListener('click', handleNoteDeletion);
