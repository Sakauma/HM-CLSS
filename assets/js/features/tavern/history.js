/**
 * 深空酒馆历史层。
 * 负责酒柜列表渲染、删除和历史查看。
 */

function renderTavernHistory() {
    const container = document.getElementById('tavern-history-list');
    const normalizedHistory = tavernData.map(normalizeDrinkRecord);

    document.getElementById('history-count').textContent = normalizedHistory.length;
    document.getElementById('history-secret-count').textContent = normalizedHistory.filter((drink) => drink.secret).length;
    document.getElementById('history-library-count').textContent = cocktailCatalog.length;

    if (!normalizedHistory.length) {
        container.innerHTML = `
            <div class="tavern-panel col-span-full flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
                <div class="module-eyebrow mb-4">EMPTY CELLAR</div>
                <h4 class="tavern-display text-2xl font-semibold text-slate-950 dark:text-slate-50">酒柜还是空的</h4>
                <p class="mt-4 max-w-md text-sm leading-7 text-slate-500 dark:text-slate-400">
                    第一杯酒不需要完美。你只要留下一个当下样本，吧台就能开始记住你。
                </p>
                <button id="btn-empty-start" class="tavern-action-primary mt-6">
                    <i data-lucide="glass-water" class="w-4 h-4"></i> 去调第一杯
                </button>
            </div>
        `;
        document.getElementById('btn-empty-start')?.addEventListener('click', () => switchTavernState('state-input'));
        lucide.createIcons();
        if (document.getElementById('state-history')?.classList.contains('opacity-100')) {
            syncTavernContainerHeight('state-history');
        }
        return;
    }

    container.innerHTML = normalizedHistory.map((drink) => {
        const [a, b, c] = drink.palette;
        return `
            <article class="tavern-history-card" style="--tavern-a:${a};--tavern-b:${b};--tavern-c:${c};">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <div class="flex flex-wrap gap-2">
                            <span class="tavern-chip">${escapeHtml(drink.badge)}</span>
                            <span class="tavern-chip">${escapeHtml(drink.style)}</span>
                        </div>
                        <h4 class="tavern-display mt-4 text-2xl font-semibold text-slate-950 dark:text-slate-50">${escapeHtml(drink.name)}</h4>
                        <p class="mt-1 text-sm italic text-slate-500 dark:text-slate-400">${escapeHtml(drink.enName)}</p>
                    </div>
                    <button class="delete-drink-btn rounded-xl p-2 text-slate-400 transition-colors hover:text-danger" data-id="${escapeHtml(drink.id)}" title="删除这杯酒">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
                <div class="mt-5 grid gap-3 text-sm text-slate-600 dark:text-slate-400">
                    <div><span class="text-slate-400">基酒：</span>${escapeHtml(drink.base)}</div>
                    <div><span class="text-slate-400">香调：</span>${escapeHtml(drink.top)} / ${escapeHtml(drink.middle)} / ${escapeHtml(drink.bottom)}</div>
                    <div><span class="text-slate-400">体感：</span>${escapeHtml(drink.feel)}</div>
                    <div><span class="text-slate-400">封存时间：</span>${escapeHtml(drink.date)} ${escapeHtml(drink.time)}</div>
                </div>
                <p class="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">${escapeHtml(drink.quote)}</p>
                <div class="mt-5 flex gap-3">
                    <button class="view-drink-btn tavern-action-secondary !min-h-[2.9rem] flex-1 !px-4" data-id="${escapeHtml(drink.id)}">
                        <i data-lucide="scan-search" class="w-4 h-4"></i> 查看配方
                    </button>
                </div>
            </article>
        `;
    }).join('');

    container.querySelectorAll('.delete-drink-btn').forEach((button) => {
        button.addEventListener('click', function() {
            if (!confirm('确定要从酒柜里移除这杯特调吗？')) return;
            const id = this.getAttribute('data-id');
            tavernData = tavernData.filter((drink) => drink.id !== id);
            saveData();
            renderTavernHistory();
            showToast('这杯特调已从酒柜移除', 'success');
        });
    });

    container.querySelectorAll('.view-drink-btn').forEach((button) => {
        button.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            const targetDrink = normalizedHistory.find((drink) => drink.id === id);
            if (!targetDrink) return;
            renderResult({ ...targetDrink, saved: true }, true);
        });
    });

    lucide.createIcons();
    if (document.getElementById('state-history')?.classList.contains('opacity-100')) {
        syncTavernContainerHeight('state-history');
    }
}
