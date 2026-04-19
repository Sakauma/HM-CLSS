/**
 * 深空酒馆渲染模块。
 * 负责舞台动画、结果卡、历史酒柜和事件绑定。
 */

let analysisTimeouts = [];

function clearAnalysisTimers() {
    analysisTimeouts.forEach((timerId) => clearTimeout(timerId));
    analysisTimeouts = [];
}

function queueAnalysisStep(callback, delay) {
    const timerId = setTimeout(callback, delay);
    analysisTimeouts.push(timerId);
}

function applyTavernMotion(container, { valence = 0, intensity = 0.3, phase = 0 } = {}) {
    if (!container) return;

    const safeIntensity = clamp(intensity, 0.05, 1);
    const lean = clamp(Math.abs(valence), 0, 1);
    const tilt = clamp((valence * 3.2) + phase, -4.8, 4.8);
    const slosh = clamp(0.48 + safeIntensity * 0.9 + Math.abs(phase) * 0.06, 0.45, 1.55);
    const glow = clamp(0.18 + safeIntensity * 0.56, 0.18, 0.82);
    const foam = clamp(0.16 + safeIntensity * 0.38, 0.16, 0.72);
    const waveShift = 0.18 + lean * 0.38 + safeIntensity * 0.06;
    const waveLift = 0.05 + lean * 0.13 + safeIntensity * 0.03;
    const waveBias = clamp(valence * 0.08, -0.12, 0.12);
    const frontTilt = 1.85 + lean * 2.8 + safeIntensity * 0.35;
    const backTilt = 1.05 + lean * 1.95 + safeIntensity * 0.22;
    const frontLeft = -waveShift + waveBias;
    const frontRight = waveShift + waveBias;
    const backLeft = (-waveShift * 0.72) - waveBias;
    const backRight = (waveShift * 0.82) - waveBias;
    const frontDown = waveLift;
    const frontUp = -waveLift;
    const backDown = waveLift * 1.45;
    const backUp = waveLift * -0.6;

    container.style.setProperty('--tavern-tilt', tilt.toFixed(2));
    container.style.setProperty('--tavern-slosh', slosh.toFixed(2));
    container.style.setProperty('--tavern-glow', glow.toFixed(2));
    container.style.setProperty('--tavern-foam', foam.toFixed(2));
    container.style.setProperty('--tavern-wave-shift', `${waveShift.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-lift', `${waveLift.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-bias', `${waveBias.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-front-tilt', `${frontTilt.toFixed(2)}deg`);
    container.style.setProperty('--tavern-wave-back-tilt', `${backTilt.toFixed(2)}deg`);
    container.style.setProperty('--tavern-wave-front-left', `${frontLeft.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-front-right', `${frontRight.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-front-down', `${frontDown.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-front-up', `${frontUp.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-back-left', `${backLeft.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-back-right', `${backRight.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-back-down', `${backDown.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-back-up', `${backUp.toFixed(2)}rem`);
}

function applyPaletteToTavern(record) {
    const container = document.getElementById('view-tavern-container');
    const [a, b, c] = record.palette;
    const concentration = parseFloat(record.params) || record.intensity || 0.5;
    const fill = `${Math.round(22 + record.matchedKeywords.length * 2 + concentration * 40)}%`;
    const position = Math.round(((record.seed % 1000) / 1000) * 10 + ((concentration * 100) / 2) + 20);

    container.style.setProperty('--tavern-a', a);
    container.style.setProperty('--tavern-b', b);
    container.style.setProperty('--tavern-c', c);
    container.style.setProperty('--tavern-fill', fill);
    container.style.setProperty('--tavern-pos', `${clamp(position, 6, 94)}`);
    container.style.setProperty('--tavern-wave', `${(8 - concentration * 4).toFixed(2)}s`);
    container.style.setProperty('--tavern-bubble', `${clamp(0.16 + concentration * 0.7, 0.18, 0.78)}`);
    applyTavernMotion(container, { valence: record.valence || 0, intensity: record.intensity || concentration });
    document.getElementById('res-bar').style.width = `${Math.round(parseFloat(record.params) * 100)}%`;
    document.getElementById('res-bar').style.background = `linear-gradient(90deg, ${a}, ${b}, ${c})`;
}

function updateInputPreview(text) {
    const labelEl = document.getElementById('tavern-stage-label');
    const statusEl = document.getElementById('tavern-stage-status');
    const captionEl = document.getElementById('tavern-stage-caption');
    const scaleCopyEl = document.getElementById('emotion-scale-copy');
    const container = document.getElementById('view-tavern-container');

    if (!text.trim()) {
        container.style.setProperty('--tavern-fill', '24%');
        container.style.setProperty('--tavern-pos', '50');
        container.style.setProperty('--tavern-wave', '7s');
        container.style.setProperty('--tavern-bubble', '0.28');
        container.style.setProperty('--tavern-a', familyMeta.calm.palette[0]);
        container.style.setProperty('--tavern-b', familyMeta.calm.palette[1]);
        container.style.setProperty('--tavern-c', familyMeta.calm.palette[2]);
        labelEl.textContent = 'Idle Pour';
        statusEl.textContent = 'WAITING FOR INPUT';
        captionEl.textContent = '写下一句此刻的感受，吧台会把它翻译成可见的颜色、液面和配方结构。';
        scaleCopyEl.textContent = '目前处于待命状态，尚未开始读取情绪样本。';
        applyTavernMotion(container, { valence: 0, intensity: 0.22, phase: 0 });
        return;
    }

    const profile = analyzeMoodText(text);
    const family = familyMeta[profile.primaryFamily];
    container.style.setProperty('--tavern-a', family.palette[0]);
    container.style.setProperty('--tavern-b', family.palette[1]);
    container.style.setProperty('--tavern-c', family.palette[2]);
    container.style.setProperty('--tavern-fill', `${Math.round(18 + profile.intensity * 36)}%`);
    container.style.setProperty('--tavern-pos', `${Math.round(((profile.valence + 1) / 2) * 100)}`);
    container.style.setProperty('--tavern-wave', `${(8 - profile.intensity * 4).toFixed(2)}s`);
    container.style.setProperty('--tavern-bubble', `${clamp(0.12 + profile.intensity * 0.7, 0.16, 0.74)}`);
    applyTavernMotion(container, { valence: profile.valence, intensity: profile.intensity });

    labelEl.textContent = family.stage;
    statusEl.textContent = `${family.display} 预读中`;
    captionEl.textContent = `系统预判这段文字会落在 ${family.label}，适合用 ${family.display} 的基酒结构来承接。`;
    scaleCopyEl.textContent = '情绪指针已经开始移动，说明这段输入不是空白，它已经带有明确方向。';
}

function syncTavernContainerHeight(targetId) {
    const container = document.getElementById('view-tavern-container');
    const activeState = document.getElementById(targetId);
    const activeFrame = activeState?.firstElementChild;

    if (!container || !activeState || !activeFrame) return;

    requestAnimationFrame(() => {
        const nextHeight = Math.max(activeFrame.scrollHeight, 640);
        container.style.height = `${nextHeight}px`;
    });
}

function switchTavernState(targetId) {
    ['state-input', 'state-analyzing', 'state-result', 'state-history'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;

        if (id === targetId) {
            el.style.zIndex = '10';
            el.style.pointerEvents = 'auto';
            el.setAttribute('aria-hidden', 'false');
            el.classList.remove('opacity-0');
            el.classList.add('opacity-100');
        } else {
            el.style.zIndex = '0';
            el.style.pointerEvents = 'none';
            el.setAttribute('aria-hidden', 'true');
            el.classList.remove('opacity-100');
            el.classList.add('opacity-0');
        }
    });

    syncTavernContainerHeight(targetId);
}

function renderResult(record, fromHistory = false) {
    currentDrinkInfo = { ...record, saved: !!fromHistory || record.saved };
    if (typeof updateVoyageAmbientPresentation === 'function') {
        updateVoyageAmbientPresentation();
    }
    applyPaletteToTavern(currentDrinkInfo);

    document.getElementById('res-title').textContent = currentDrinkInfo.name;
    document.getElementById('res-subtitle').textContent = currentDrinkInfo.enName;
    document.getElementById('res-style').textContent = currentDrinkInfo.style;
    document.getElementById('res-badge').textContent = currentDrinkInfo.badge;
    document.getElementById('res-base').textContent = currentDrinkInfo.base;
    document.getElementById('res-glass').textContent = currentDrinkInfo.glass;
    document.getElementById('res-top').textContent = currentDrinkInfo.top;
    document.getElementById('res-mid').textContent = currentDrinkInfo.middle;
    document.getElementById('res-bot').textContent = currentDrinkInfo.bottom;
    document.getElementById('res-feel').textContent = currentDrinkInfo.feel;
    document.getElementById('res-garnish').textContent = currentDrinkInfo.garnish;
    document.getElementById('res-params').textContent = currentDrinkInfo.params;
    document.getElementById('res-family').textContent = currentDrinkInfo.family;
    document.getElementById('res-abv').textContent = currentDrinkInfo.abv;
    document.getElementById('res-left-family').textContent = currentDrinkInfo.family;
    document.getElementById('res-left-base').textContent = currentDrinkInfo.base;
    document.getElementById('res-left-abv').textContent = currentDrinkInfo.abv;
    document.getElementById('res-left-glass').textContent = currentDrinkInfo.glass;
    document.getElementById('res-left-feel').textContent = currentDrinkInfo.feel;
    document.getElementById('res-left-garnish').textContent = currentDrinkInfo.garnish;
    document.getElementById('res-serial').textContent = currentDrinkInfo.serial;
    document.getElementById('res-story').textContent = currentDrinkInfo.story;
    document.getElementById('res-reason').textContent = currentDrinkInfo.reason;
    document.getElementById('res-quote').textContent = currentDrinkInfo.quote;
    document.getElementById('res-intensity-label').textContent = currentDrinkInfo.intensityLabel;
    document.getElementById('res-left-service').textContent = `以${currentDrinkInfo.glass}承接 ${currentDrinkInfo.base}，入口先给出 ${currentDrinkInfo.top}，尾段让 ${currentDrinkInfo.garnish} 把整杯酒慢慢收住。`;

    const saveBtn = document.getElementById('btn-save-drink');
    if (saveBtn) {
        saveBtn.innerHTML = currentDrinkInfo.saved
            ? '<i data-lucide="archive-check" class="w-4 h-4"></i> 已封存'
            : '<i data-lucide="archive" class="w-4 h-4"></i> 保存到酒单';
        saveBtn.disabled = !!currentDrinkInfo.saved;
        saveBtn.classList.toggle('opacity-60', !!currentDrinkInfo.saved);
        saveBtn.classList.toggle('cursor-not-allowed', !!currentDrinkInfo.saved);
    }

    switchTavernState('state-result');
    lucide.createIcons();
}

function copyDrinkCard(record) {
    const shareText = [
        `${record.name} | ${record.enName}`,
        `风格：${record.style} · ${record.family}`,
        `基酒：${record.base} · 杯型：${record.glass}`,
        `香调：${record.top} / ${record.middle} / ${record.bottom}`,
        `体感：${record.feel}`,
        `浓度：${record.params} · ${record.abv}`,
        `注记：${record.reason}`
    ].join('\n');

    if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(shareText);
    }

    return new Promise((resolve, reject) => {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = shareText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

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

function initTavernModule() {
    const inputEl = document.getElementById('mood-text-input');
    const countEl = document.getElementById('mood-char-count');
    const analyzeBtn = document.getElementById('btn-start-analyze');
    const emotionBarContainer = document.getElementById('emotion-bar-container');

    document.getElementById('history-library-count').textContent = cocktailCatalog.length;

    inputEl?.addEventListener('input', (event) => {
        let text = event.target.value;
        if (text.length > MAX_MOOD_CHARS) {
            text = text.slice(0, MAX_MOOD_CHARS);
            event.target.value = text;
        }
        countEl.textContent = text.length;
        analyzeBtn.disabled = text.trim().length === 0;
        updateInputPreview(text);
    });

    document.querySelectorAll('.tavern-suggestion').forEach((button) => {
        button.addEventListener('click', () => {
            inputEl.value = button.getAttribute('data-mood') || '';
            countEl.textContent = inputEl.value.length;
            analyzeBtn.disabled = inputEl.value.trim().length === 0;
            updateInputPreview(inputEl.value);
        });
    });

    document.getElementById('btn-random-mood')?.addEventListener('click', () => {
        const suggestion = tavernSuggestionTexts[Date.now() % tavernSuggestionTexts.length];
        inputEl.value = suggestion;
        countEl.textContent = suggestion.length;
        analyzeBtn.disabled = false;
        updateInputPreview(suggestion);
    });

    analyzeBtn?.addEventListener('click', () => {
        const text = inputEl.value.trim();
        if (!text) return;

        clearAnalysisTimers();
        emotionBarContainer.classList.remove('opacity-0');

        const profile = analyzeMoodText(text);
        const recipe = pickRecipe(profile);
        const record = buildDrinkRecord(profile, recipe);
        const family = familyMeta[recipe.family];
        const container = document.getElementById('view-tavern-container');

        container.style.setProperty('--tavern-a', record.palette[0]);
        container.style.setProperty('--tavern-b', record.palette[1]);
        container.style.setProperty('--tavern-c', record.palette[2]);
        container.style.setProperty('--tavern-fill', '12%');
        container.style.setProperty('--tavern-pos', `${Math.round(((profile.valence + 1) / 2) * 100)}`);
        container.style.setProperty('--tavern-wave', `${(8 - profile.intensity * 4).toFixed(2)}s`);
        container.style.setProperty('--tavern-bubble', `${clamp(0.18 + profile.intensity * 0.72, 0.18, 0.8)}`);
        applyTavernMotion(container, { valence: profile.valence, intensity: profile.intensity, phase: -1.8 });

        document.getElementById('analysis-status-primary').textContent = family.stage;
        document.getElementById('analysis-status-secondary').textContent = family.display;
        document.getElementById('analysis-reading-family').textContent = family.label;
        document.getElementById('analysis-reading-efi').textContent = profile.valence.toFixed(2);
        document.getElementById('analysis-reading-eii').textContent = profile.intensity.toFixed(2);
        document.getElementById('analyze-text').textContent = '捕捉你的当下味道中...';

        switchTavernState('state-analyzing');

        queueAnalysisStep(() => {
            document.getElementById('analyze-text').textContent = '正在调和你的情绪基酒...';
            container.style.setProperty('--tavern-fill', `${Math.round(28 + profile.intensity * 16)}%`);
            applyTavernMotion(container, { valence: profile.valence, intensity: profile.intensity + 0.08, phase: -2.3 });
        }, 280);

        queueAnalysisStep(() => {
            document.getElementById('analysis-status-secondary').textContent = '酸甜配比校准中';
            document.getElementById('analyze-text').textContent = profile.intensity > 0.68 ? '检测到明显波动，正在压住边缘噪音...' : '波动处于可控范围，正在细化香调层次...';
            container.style.setProperty('--tavern-fill', `${Math.round(42 + profile.intensity * 18)}%`);
            applyTavernMotion(container, { valence: profile.valence, intensity: profile.intensity + 0.12, phase: 2.7 });
        }, 1280);

        queueAnalysisStep(() => {
            document.getElementById('analysis-status-secondary').textContent = '装瓶与标签打印中';
            document.getElementById('analyze-text').textContent = '正在为这杯酒写下最后一句调酒师注记...';
            container.style.setProperty('--tavern-fill', `${Math.round(52 + profile.intensity * 20)}%`);
            applyTavernMotion(container, { valence: profile.valence, intensity: profile.intensity + 0.06, phase: -1.2 });
        }, 2380);

        queueAnalysisStep(() => {
            emotionBarContainer.classList.add('opacity-0');
            renderResult(record, false);
        }, 3320);
    });

    document.getElementById('btn-stop-analyze')?.addEventListener('click', () => {
        clearAnalysisTimers();
        switchTavernState('state-input');
        updateInputPreview(inputEl.value);
    });

    document.getElementById('btn-remix')?.addEventListener('click', () => {
        const remixText = currentDrinkInfo?.text || inputEl.value;
        currentDrinkInfo = null;
        if (typeof updateVoyageAmbientPresentation === 'function') {
            updateVoyageAmbientPresentation();
        }
        inputEl.value = remixText;
        countEl.textContent = String(remixText.length);
        analyzeBtn.disabled = remixText.trim().length === 0;
        switchTavernState('state-input');
        updateInputPreview(remixText);
    });

    document.getElementById('btn-back-to-input')?.addEventListener('click', () => {
        clearAnalysisTimers();
        switchTavernState('state-input');
        updateInputPreview(inputEl.value);
    });

    document.getElementById('btn-save-drink')?.addEventListener('click', () => {
        if (!currentDrinkInfo || currentDrinkInfo.saved) return;
        tavernData.unshift({ ...currentDrinkInfo, saved: true });
        currentDrinkInfo.saved = true;
        saveData();
        showToast('特调已封存入酒柜', 'success');
        renderResult(currentDrinkInfo, true);
    });

    document.getElementById('btn-share-drink')?.addEventListener('click', async () => {
        if (!currentDrinkInfo) return;

        try {
            await copyDrinkCard(currentDrinkInfo);
            showToast('分享文案已复制', 'success');
        } catch (error) {
            showToast('复制失败，请稍后重试', 'error');
        }
    });

    document.getElementById('btn-result-history')?.addEventListener('click', () => {
        switchTavernState('state-history');
        renderTavernHistory();
    });

    document.getElementById('btn-view-tavern-history')?.addEventListener('click', () => {
        switchTavernState('state-history');
        renderTavernHistory();
    });

    document.getElementById('btn-close-history')?.addEventListener('click', () => {
        switchTavernState('state-input');
        updateInputPreview(inputEl.value);
    });

    document.getElementById('btn-history-create')?.addEventListener('click', () => {
        currentDrinkInfo = null;
        if (typeof updateVoyageAmbientPresentation === 'function') {
            updateVoyageAmbientPresentation();
        }
        switchTavernState('state-input');
        updateInputPreview(inputEl.value);
    });

    switchTavernState('state-input');
    renderTavernHistory();
    updateInputPreview('');
    window.addEventListener('resize', () => {
        const activeState = document.querySelector('#view-tavern-container > [id^="state-"].opacity-100');
        if (activeState?.id) {
            syncTavernContainerHeight(activeState.id);
        }
    });
}
