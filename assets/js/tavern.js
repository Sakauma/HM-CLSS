const MAX_MOOD_CHARS = 50;

const flavorDB = {
    bases: [
        { name: '深色朗姆', en: 'Dark Rum', style: 'from-amber-700 to-orange-900' },
        { name: '冰川伏特加', en: 'Glacier Vodka', style: 'from-blue-200 to-cyan-50' },
        { name: '植物金酒', en: 'Botanic Gin', style: 'from-emerald-300 to-teal-100' },
        { name: '烟熏威士忌', en: 'Smoked Whiskey', style: 'from-orange-400 to-amber-700' },
        { name: '星云气泡水', en: 'Nebula Sparkling', style: 'from-purple-300 to-indigo-200' }
    ],
    notes: ['薄荷叶', '可可', '香草', '柠檬皮', '迷迭香', '肉桂', '海盐', '乌龙茶', '咖啡豆', '橙花', '小豆蔻', '百里香'],
    adjectives: ['午夜的', '沉睡的', '仲夏的', '青柠的', '焦糖的', '深海的', '拂晓的'],
    nouns: ['气泡', '晚风', '呢喃', '碎片', '极光', '篝火'],
    feelings: ['期待感', '释放', '留白', '拥抱', '沉淀', '失重感']
};

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

document.addEventListener('DOMContentLoaded', () => {
    const inputEl = document.getElementById('mood-text-input');
    const countEl = document.getElementById('mood-char-count');
    const analyzeBtn = document.getElementById('btn-start-analyze');

    inputEl?.addEventListener('input', (event) => {
        let text = event.target.value;
        if (text.length > MAX_MOOD_CHARS) {
            text = text.slice(0, MAX_MOOD_CHARS);
            event.target.value = text;
        }
        countEl.textContent = text.length;
        analyzeBtn.disabled = text.trim().length === 0;
    });

    function switchTavernState(targetId) {
        ['state-input', 'state-analyzing', 'state-result', 'state-history'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;

            if (id === targetId) {
                el.style.zIndex = '10';
                el.classList.remove('opacity-0');
                el.classList.add('opacity-100');
            } else {
                el.style.zIndex = '0';
                el.classList.remove('opacity-100');
                el.classList.add('opacity-0');
            }
        });
    }

    analyzeBtn?.addEventListener('click', () => {
        const text = inputEl.value.trim();
        switchTavernState('state-analyzing');

        const seed = hashString(text);
        const baseIndex = seed % flavorDB.bases.length;
        const topIndex = (seed * 2) % flavorDB.notes.length;
        const midIndex = (seed * 3) % flavorDB.notes.length;
        const botIndex = (seed * 5) % flavorDB.notes.length;

        const baseItem = flavorDB.bases[baseIndex];
        const efi = ((seed % 100) / 100) * 2 - 1;
        const eii = (seed * 7 % 100) / 100;

        const emoContainer = document.getElementById('emotion-bar-container');
        const emoIndicator = document.getElementById('emotion-indicator');

        setTimeout(() => {
            emoContainer.classList.remove('opacity-0');
            const positionPercent = ((efi + 1) / 2) * 100;
            emoIndicator.style.left = `${positionPercent}%`;
        }, 500);

        const title = `${flavorDB.adjectives[seed % flavorDB.adjectives.length]}${flavorDB.nouns[(seed * 2) % flavorDB.nouns.length]}的${flavorDB.feelings[(seed * 3) % flavorDB.feelings.length]}`;

        let fluidGradient = '';
        if (efi > 0.3) {
            fluidGradient = 'from-amber-300 to-orange-400';
        } else if (efi < -0.3) {
            fluidGradient = 'from-slate-800 to-indigo-900';
        } else {
            fluidGradient = 'from-teal-300 to-emerald-500';
        }

        const fluid = document.getElementById('realtime-fluid');
        const ripple1 = document.getElementById('ripple-layer-1');
        const ripple2 = document.getElementById('ripple-layer-2');
        const ripple3 = document.getElementById('ripple-layer-3');
        const bubbles = document.getElementById('realtime-bubbles');
        const mixText = document.getElementById('analyze-text');

        fluid.className = `relative w-full h-[5%] bg-gradient-to-t ${fluidGradient} transition-all duration-[2500ms] ease-in-out z-10 overflow-hidden`;

        const fluctuation = Math.abs(efi);
        if (fluctuation > 0.6) {
            ripple1.style.animationDuration = '2s';
            ripple2.style.animationDuration = '3s';
            ripple3.style.opacity = '1';
            mixText.textContent = '感受剧烈情绪波动...';
        } else {
            ripple1.style.animationDuration = '6s';
            ripple2.style.animationDuration = '8s';
            ripple3.style.opacity = '0';
            mixText.textContent = '捕捉平缓思绪...';
        }

        if (eii > 0.6) {
            bubbles.style.opacity = '1';
        } else if (eii > 0.3) {
            bubbles.style.opacity = '0.4';
        } else {
            bubbles.style.opacity = '0';
        }

        setTimeout(() => fluid.style.height = '65%', 100);
        setTimeout(() => mixText.textContent = '装瓶酝酿...', 1500);

        setTimeout(() => {
            emoContainer.classList.add('opacity-0');
            setTimeout(() => {
                emoIndicator.style.left = '50%';
            }, 500);

            document.getElementById('res-title').textContent = title;
            document.getElementById('res-subtitle').textContent = 'Exclusive Blend';
            document.getElementById('res-base').textContent = baseItem.name;
            document.getElementById('res-top').textContent = flavorDB.notes[topIndex];
            document.getElementById('res-mid').textContent = flavorDB.notes[midIndex];
            document.getElementById('res-bot').textContent = flavorDB.notes[botIndex];
            document.getElementById('res-feel').textContent = flavorDB.feelings[(seed * 3) % flavorDB.feelings.length];

            const concentration = (eii * 100).toFixed(2);
            document.getElementById('res-params').textContent = `${concentration}%`;

            const resFluid = document.getElementById('res-fluid');
            const resGlow = document.getElementById('res-glow');
            resFluid.className = `relative w-full h-[10%] bg-gradient-to-t ${baseItem.style} transition-all duration-[1500ms] ease-out z-10`;
            resGlow.className = `absolute -bottom-8 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full blur-3xl z-0 opacity-50 pointer-events-none transition-all duration-1000 bg-gradient-to-t ${baseItem.style}`;

            switchTavernState('state-result');

            setTimeout(() => {
                resFluid.style.height = `${40 + (eii * 40)}%`;
                document.getElementById('res-bar').style.width = `${concentration}%`;
            }, 300);

            currentDrinkInfo = {
                id: 'drink_' + Date.now(),
                date: getTodayString(),
                time: getCurrentTimeString(),
                name: title,
                base: baseItem.name,
                top: flavorDB.notes[topIndex],
                middle: flavorDB.notes[midIndex],
                bottom: flavorDB.notes[botIndex],
                params: `浓度 ${concentration}%`
            };

            setTimeout(() => {
                fluid.style.height = '5%';
                emoIndicator.style.left = '50%';
                mixText.textContent = '萃取情绪粒子中...';
            }, 1000);

            lucide.createIcons();
        }, 3200);
    });

    document.getElementById('btn-remix')?.addEventListener('click', () => {
        inputEl.value = '';
        countEl.textContent = '0';
        analyzeBtn.disabled = true;
        switchTavernState('state-input');
    });

    document.getElementById('btn-back-to-input')?.addEventListener('click', () => {
        inputEl.value = '';
        countEl.textContent = '0';
        analyzeBtn.disabled = true;
        switchTavernState('state-input');
    });

    document.getElementById('btn-save-drink')?.addEventListener('click', () => {
        if (currentDrinkInfo) {
            tavernData.unshift(currentDrinkInfo);
            saveData();
            showToast('特调已封存入库 🍸', 'success');
            switchTavernState('state-history');
            renderTavernHistory();
            currentDrinkInfo = null;
        }
    });

    document.getElementById('btn-view-tavern-history')?.addEventListener('click', () => {
        switchTavernState('state-history');
        renderTavernHistory();
    });

    document.getElementById('btn-close-history')?.addEventListener('click', () => {
        switchTavernState('state-input');
    });

    function renderTavernHistory() {
        const container = document.getElementById('tavern-history-list');
        if (!tavernData.length) {
            container.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-slate-400 mt-20 opacity-50">
                    <i data-lucide="wine" class="w-10 h-10 mb-4"></i>
                    <p class="text-xs tracking-wider">酒柜空空如也</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        container.innerHTML = tavernData.map((drink) => `
            <div class="bg-white/50 dark:bg-[#1a1c23]/50 rounded-2xl p-5 border border-slate-100 dark:border-white/5 relative group transition-all hover:border-primary/30 backdrop-blur-md">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-serif font-bold text-slate-800 dark:text-slate-100 text-base mb-1 tracking-wide">${escapeHtml(drink.name)}</h4>
                        <div class="text-[10px] text-slate-400 font-mono">${escapeHtml(drink.date)} ${escapeHtml(drink.time)}</div>
                    </div>
                    <button class="delete-drink-btn text-slate-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity p-1" data-id="${escapeHtml(drink.id)}">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 font-mono">
                    <div><span class="opacity-70 mr-2">Base</span>${escapeHtml(drink.base)}</div>
                    <div><span class="opacity-70 mr-2">Note</span>${escapeHtml(drink.top)} / ${escapeHtml(drink.middle)} / ${escapeHtml(drink.bottom)}</div>
                    <div class="mt-2 inline-block bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] border border-slate-200 dark:border-slate-700">${escapeHtml(drink.params)}</div>
                </div>
            </div>
        `).join('');

        lucide.createIcons();

        container.querySelectorAll('.delete-drink-btn').forEach((btn) => {
            btn.addEventListener('click', function() {
                if (confirm('确定要倒掉这杯情绪特调吗？')) {
                    const id = this.getAttribute('data-id');
                    tavernData = tavernData.filter((drink) => drink.id !== id);
                    saveData();
                    renderTavernHistory();
                }
            });
        });
    }
});
