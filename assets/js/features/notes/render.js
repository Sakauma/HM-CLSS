/**
 * 速记渲染层。
 * 负责今日捕捉池、历史归档和删除交互。
 */

function createLucideIconNode(icon, className) {
    return createDomElement('i', {
        className,
        attrs: { 'data-lucide': icon }
    });
}

function createMarkdownNoteNode(noteText, className) {
    return createDomElement('div', {
        className,
        html: DOMPurify.sanitize(marked.parse(noteText))
    });
}

function createArchiveEmptyState(filterText) {
    return appendDomChildren(createDomElement('div', {
        className: 'bg-cardLight dark:bg-cardDark rounded-2xl p-10 shadow-soft border border-slate-100 dark:border-slate-800 text-center flex flex-col items-center justify-center text-slate-400'
    }), [
        createLucideIconNode('inbox', 'w-12 h-12 mb-3 opacity-50'),
        createDomElement('p', {
            text: filterText ? '没有找到这条线索' : '归档区暂时还没有记录'
        })
    ]);
}

function createQuickNotesEmptyState() {
    return appendDomChildren(createDomElement('div', {
        className: 'rounded-[1.4rem] border border-dashed border-slate-200/80 bg-slate-50/70 px-6 py-8 text-center dark:border-slate-700/70 dark:bg-slate-900/40'
    }), [
        createDomElement('div', {
            className: 'module-eyebrow mb-3',
            text: 'EMPTY CAPTURE POOL'
        }),
        createDomElement('h4', {
            className: 'tavern-display text-2xl font-semibold text-slate-950 dark:text-slate-50',
            text: '今天的捕捉池还很安静'
        }),
        createDomElement('p', {
            className: 'mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400',
            text: '丢下一条灵感、异常或待办就够了，捕捉台会先替你记住。'
        }),
        appendDomChildren(createDomElement('button', {
            className: 'open-quick-capture-btn quick-capture-ghost mt-5'
        }), [
            createLucideIconNode('square-pen', 'w-4 h-4'),
            document.createTextNode(' 现在记录一条')
        ])
    ]);
}

function createArchiveNoteCard(note, date, index) {
    const noteText = getNoteText(note);
    const tagKey = note.tag || 'idea';
    const tagCfg = noteTagConfig[tagKey] || noteTagConfig.idea;

    const tagChip = appendDomChildren(createDomElement('span', {
        className: `text-[10px] flex items-center justify-center gap-1 border px-1.5 py-0.5 rounded w-full ${tagCfg.color}`
    }), [
        createLucideIconNode(tagCfg.icon, 'w-3 h-3'),
        document.createTextNode(` ${tagCfg.label}`)
    ]);

    return appendDomChildren(createDomElement('div', {
        className: 'flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-primary/30 transition-colors relative group'
    }), [
        appendDomChildren(createDomElement('div', {
            className: 'flex flex-col gap-2 mt-1 shrink-0 w-16 items-center'
        }), [
            createDomElement('span', {
                className: 'text-sm font-mono text-slate-400 bg-slate-200/50 dark:bg-slate-800/50 px-2 py-0.5 rounded w-full text-center',
                text: getNoteTime(note)
            }),
            tagChip
        ]),
        createMarkdownNoteNode(noteText, 'text-sm text-slate-700 dark:text-slate-300 md-content w-full overflow-hidden break-words pr-8'),
        appendDomChildren(createDomElement('button', {
            className: 'delete-note-btn absolute top-4 right-4 text-slate-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity',
            attrs: {
                'data-date': date,
                'data-index': index,
                title: '删除记录'
            }
        }), [
            createLucideIconNode('trash-2', 'w-4 h-4')
        ])
    ]);
}

function createArchiveSection(date, noteCards) {
    const noteList = createDomElement('div', { className: 'space-y-4' });
    noteCards.forEach((card) => noteList.appendChild(card));

    return appendDomChildren(createDomElement('div', {
        className: 'bg-cardLight dark:bg-cardDark rounded-2xl p-6 shadow-soft border border-slate-100 dark:border-slate-800'
    }), [
        appendDomChildren(createDomElement('h3', {
            className: 'text-lg font-bold mb-4 text-primary flex items-center gap-2'
        }), [
            createLucideIconNode('calendar', 'w-5 h-5'),
            document.createTextNode(` ${date}`)
        ]),
        noteList
    ]);
}

function createTodayNoteCard(note, index, date) {
    const noteText = getNoteText(note);
    const tagKey = note.tag || 'idea';
    const tagCfg = noteTagConfig[tagKey] || noteTagConfig.idea;

    return appendDomChildren(createDomElement('div', {
        className: 'flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors relative group hover:border-primary/30 dark:border-slate-700/50 dark:bg-slate-900/50'
    }), [
        appendDomChildren(createDomElement('div', {
            className: 'flex flex-col gap-1.5 mt-1 shrink-0 w-12 items-center'
        }), [
            createDomElement('span', {
                className: 'text-xs font-mono text-slate-400',
                text: getNoteTime(note)
            }),
            createDomElement('span', {
                className: `text-[9px] border px-1 rounded w-full text-center ${tagCfg.color}`,
                text: tagCfg.label
            })
        ]),
        createMarkdownNoteNode(noteText, 'text-sm text-slate-700 dark:text-slate-300 md-content w-full overflow-hidden break-words pr-6'),
        appendDomChildren(createDomElement('button', {
            className: 'delete-note-btn absolute top-3 right-3 text-slate-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity p-1',
            attrs: {
                'data-date': date,
                'data-index': index,
                title: '删除记录'
            }
        }), [
            createLucideIconNode('trash-2', 'w-3 h-3')
        ])
    ]);
}

function renderArchive(filterText = '') {
    const container = document.getElementById('archive-list-container');
    const dates = Object.keys(quickNotesData).sort((a, b) => new Date(b) - new Date(a));

    const fragment = document.createDocumentFragment();
    let hasResults = false;
    const searchText = filterText.toLowerCase();

    dates.forEach((date) => {
        const notes = quickNotesData[date];
        if (!notes || !notes.length) return;
        const sectionCards = [];
        notes.forEach((note, originalIndex) => {
            const noteText = getNoteText(note);
            if (!noteText.toLowerCase().includes(searchText)) return;

            hasResults = true;
            sectionCards.push(createArchiveNoteCard(note, date, originalIndex));
        });

        if (!sectionCards.length) return;
        fragment.appendChild(createArchiveSection(date, sectionCards));
    });

    if (!hasResults) {
        container.replaceChildren(createArchiveEmptyState(filterText));
    } else {
        container.replaceChildren(fragment);
    }

    lucide.createIcons();
}

function updateQuickNotesList() {
    const container = document.getElementById('quick-notes-container');
    const notes = getDailyEntries(quickNotesData, getTodayString());
    if (!notes.length) {
        container.replaceChildren(createQuickNotesEmptyState());
        lucide.createIcons();
        return;
    }

    const fragment = document.createDocumentFragment();
    const today = getTodayString();
    notes.forEach((note, index) => {
        fragment.appendChild(createTodayNoteCard(note, index, today));
    });

    container.replaceChildren(fragment);
    lucide.createIcons();
}

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
    document.getElementById('archive-search-input')?.addEventListener('input', (event) => {
        renderArchive(event.target.value.trim());
    });
    document.getElementById('archive-list-container')?.addEventListener('click', handleNoteDeletion);
    document.getElementById('quick-notes-container')?.addEventListener('click', handleNoteDeletion);
}
