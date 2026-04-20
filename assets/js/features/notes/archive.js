/**
 * 速记归档视图层。
 * 负责历史归档筛选与按日期分组渲染。
 */

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
