/**
 * 深空酒馆结果卡层。
 * 负责结果卡渲染与分享文案生成。
 */

function renderResult(record, fromHistory = false) {
    setRuntimeValue('currentDrinkInfo', { ...record, saved: !!fromHistory || record.saved });
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
