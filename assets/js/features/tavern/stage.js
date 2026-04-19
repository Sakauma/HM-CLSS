/**
 * 深空酒馆舞台层。
 * 负责液面运动、舞台状态切换和输入态预览。
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
