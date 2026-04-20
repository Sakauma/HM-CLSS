/**
 * 速记今日视图层。
 * 负责今日捕捉池的空状态和卡片渲染。
 */

function createLucideIconNode(icon, className) {
    return createDomElement('i', {
        className,
        attrs: { 'data-lucide': icon }
    });
}

function createMarkdownNoteNode(noteText, className) {
    return replaceElementChildrenWithHtml(
        createDomElement('div', {
            className
        }),
        DOMPurify.sanitize(marked.parse(noteText))
    );
}

function createQuickNotesEmptyState() {
    return appendDomChildren(createDomElement('div', {
        className: 'surface-inline-note border-dashed px-6 py-8 text-center'
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

function createTodayNoteCard(note, index, date) {
    const noteText = getNoteText(note);
    const tagKey = note.tag || 'idea';
    const tagCfg = noteTagConfig[tagKey] || noteTagConfig.idea;

    return appendDomChildren(createDomElement('div', {
        className: 'surface-inline-card flex items-start gap-3 p-3 transition-colors relative group hover:border-primary/30'
    }), [
        appendDomChildren(createDomElement('div', {
            className: 'flex flex-col gap-1.5 mt-1 shrink-0 w-12 items-center'
        }), [
            createDomElement('span', {
                className: 'text-xs font-mono text-slate-400',
                text: getNoteTime(note)
            }),
            createDomElement('span', {
                className: `${tagCfg.color} semantic-tag-full semantic-tag-tight`,
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
