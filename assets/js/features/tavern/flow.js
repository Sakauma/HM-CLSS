/**
 * 深空酒馆流程层。
 * 负责输入控件同步与情绪分析动画编排。
 */

function syncTavernInputControls(inputState, text) {
    const { inputEl, countEl, analyzeBtn } = inputState;
    const nextText = String(text ?? '').slice(0, MAX_MOOD_CHARS);

    if (inputEl && inputEl.value !== nextText) {
        inputEl.value = nextText;
    }
    if (countEl) {
        countEl.textContent = String(nextText.length);
    }
    if (analyzeBtn) {
        analyzeBtn.disabled = nextText.trim().length === 0;
    }

    updateInputPreview(nextText);
    return nextText;
}

function startTavernAnalysis(inputText, emotionBarContainer) {
    const text = inputText.trim();
    if (!text) return false;

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

    return true;
}
