/**
 * 深空酒馆历史层。
 * 负责酒柜列表渲染、删除和历史查看。
 */

function createTavernHistoryStatLine(label, value) {
    return appendDomChildren(createDomElement('div', {
        className: 'text-sm text-slate-600 dark:text-slate-400'
    }), [
        createDomElement('span', {
            className: 'text-slate-400',
            text: `${label}：`
        }),
        document.createTextNode(String(value))
    ]);
}

function createTavernHistoryEmptyState() {
    const startBtn = createDomElement('button', {
        className: 'tavern-action-primary mt-6',
        attrs: { id: 'btn-empty-start', type: 'button' }
    });
    setElementIconLabel(startBtn, 'glass-water', '去调第一杯');
    startBtn.addEventListener('click', () => switchTavernState('state-input'));

    return appendDomChildren(createDomElement('div', {
        className: 'tavern-panel col-span-full flex min-h-[360px] flex-col items-center justify-center p-8 text-center'
    }), [
        createDomElement('div', {
            className: 'module-eyebrow mb-4',
            text: 'EMPTY CELLAR'
        }),
        createDomElement('h4', {
            className: 'tavern-display text-2xl font-semibold text-slate-950 dark:text-slate-50',
            text: '酒柜还是空的'
        }),
        createDomElement('p', {
            className: 'mt-4 max-w-md text-sm leading-7 text-slate-500 dark:text-slate-400',
            text: '第一杯酒不需要完美。你只要留下一个当下样本，吧台就能开始记住你。'
        }),
        startBtn
    ]);
}

function createTavernHistoryCard(drink) {
    const [a, b, c] = drink.palette;
    const article = createDomElement('article', {
        className: 'tavern-history-card'
    });
    article.style.setProperty('--tavern-a', a);
    article.style.setProperty('--tavern-b', b);
    article.style.setProperty('--tavern-c', c);

    const deleteBtn = appendDomChildren(createDomElement('button', {
        className: 'delete-drink-btn rounded-xl p-2 text-slate-400 transition-colors hover:text-danger',
        attrs: {
            type: 'button',
            'data-id': drink.id,
            title: '删除这杯酒'
        }
    }), [
        createLucideIconElement('trash-2', 'w-4 h-4')
    ]);

    deleteBtn.addEventListener('click', async () => {
        const confirmed = await showConfirmDialog({
            title: '从酒柜移除这杯特调？',
            message: '移除后这杯酒会离开当前酒柜历史，但不会影响其他记录。',
            badge: 'REMOVE DRINK',
            confirmLabel: '确认移除',
            cancelLabel: '先保留',
            tone: 'danger'
        });
        if (!confirmed) return;
        filterRuntimeItems('tavernData', (storedDrink) => storedDrink.id !== drink.id);
        saveData();
        renderTavernHistory();
        showToast('这杯特调已从酒柜移除', 'success');
    });

    const viewBtn = createDomElement('button', {
        className: 'view-drink-btn tavern-action-secondary !min-h-[2.9rem] flex-1 !px-4',
        attrs: {
            type: 'button',
            'data-id': drink.id
        }
    });
    setElementIconLabel(viewBtn, 'scan-search', '查看配方');
    viewBtn.addEventListener('click', () => {
        renderResult({ ...drink, saved: true }, true);
    });

    appendDomChildren(article, [
        appendDomChildren(createDomElement('div', {
            className: 'flex items-start justify-between gap-4'
        }), [
            appendDomChildren(createDomElement('div'), [
                appendDomChildren(createDomElement('div', {
                    className: 'flex flex-wrap gap-2'
                }), [
                    createDomElement('span', {
                        className: 'tavern-chip',
                        text: drink.badge
                    }),
                    createDomElement('span', {
                        className: 'tavern-chip',
                        text: drink.style
                    })
                ]),
                createDomElement('h4', {
                    className: 'tavern-display mt-4 text-2xl font-semibold text-slate-950 dark:text-slate-50',
                    text: drink.name
                }),
                createDomElement('p', {
                    className: 'mt-1 text-sm italic text-slate-500 dark:text-slate-400',
                    text: drink.enName
                })
            ]),
            deleteBtn
        ]),
        appendDomChildren(createDomElement('div', {
            className: 'mt-5 grid gap-3'
        }), [
            createTavernHistoryStatLine('基酒', drink.base),
            createTavernHistoryStatLine('香调', `${drink.top} / ${drink.middle} / ${drink.bottom}`),
            createTavernHistoryStatLine('体感', drink.feel),
            createTavernHistoryStatLine('封存时间', `${drink.date} ${drink.time}`)
        ]),
        createDomElement('p', {
            className: 'mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400',
            text: drink.quote
        }),
        appendDomChildren(createDomElement('div', {
            className: 'mt-5 flex gap-3'
        }), [
            viewBtn
        ])
    ]);

    return article;
}

function renderTavernHistory() {
    const container = document.getElementById('tavern-history-list');
    if (!container) return;

    const normalizedHistory = tavernData.map(normalizeDrinkRecord);

    document.getElementById('history-count').textContent = normalizedHistory.length;
    document.getElementById('history-secret-count').textContent = normalizedHistory.filter((drink) => drink.secret).length;
    document.getElementById('history-library-count').textContent = cocktailCatalog.length;

    if (!normalizedHistory.length) {
        container.replaceChildren(createTavernHistoryEmptyState());
        lucide.createIcons();
        if (document.getElementById('state-history')?.classList.contains('opacity-100')) {
            syncTavernContainerHeight('state-history');
        }
        return;
    }

    const fragment = document.createDocumentFragment();
    normalizedHistory.forEach((drink) => {
        fragment.appendChild(createTavernHistoryCard(drink));
    });
    container.replaceChildren(fragment);

    lucide.createIcons();
    if (document.getElementById('state-history')?.classList.contains('opacity-100')) {
        syncTavernContainerHeight('state-history');
    }
}
