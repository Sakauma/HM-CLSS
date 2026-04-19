/**
 * 深空酒馆事件绑定层。
 * 负责把舞台、结果卡和历史酒柜组装成完整交互。
 */

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
