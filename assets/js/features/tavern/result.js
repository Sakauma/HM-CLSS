/**
 * 深空酒馆结果卡层。
 * 负责结果卡渲染与分享文案生成。
 */

function createTavernResultDomAdapter(rootDocument) {
    const textBindings = [
        ['res-title', 'name'],
        ['res-subtitle', 'enName'],
        ['res-style', 'style'],
        ['res-badge', 'badge'],
        ['res-base', 'base'],
        ['res-glass', 'glass'],
        ['res-top', 'top'],
        ['res-mid', 'middle'],
        ['res-bot', 'bottom'],
        ['res-feel', 'feel'],
        ['res-garnish', 'garnish'],
        ['res-params', 'params'],
        ['res-family', 'family'],
        ['res-abv', 'abv'],
        ['res-left-family', 'family'],
        ['res-left-base', 'base'],
        ['res-left-abv', 'abv'],
        ['res-left-glass', 'glass'],
        ['res-left-feel', 'feel'],
        ['res-left-garnish', 'garnish'],
        ['res-serial', 'serial'],
        ['res-story', 'story'],
        ['res-reason', 'reason'],
        ['res-quote', 'quote'],
        ['res-intensity-label', 'intensityLabel']
    ];

    function requireElement(id) {
        const element = rootDocument.getElementById(id);
        if (!element) {
            throw new Error(`Missing tavern result element: ${id}`);
        }
        return element;
    }

    return {
        renderDrinkInfo(drinkInfo) {
            textBindings.forEach(([id, key]) => {
                requireElement(id).textContent = drinkInfo[key];
            });
            requireElement('res-left-service').textContent = `?${drinkInfo.glass}?? ${drinkInfo.base}?????? ${drinkInfo.top}???? ${drinkInfo.garnish} ?????????`;
        },
        updateSaveButton(drinkInfo) {
            const saveBtn = rootDocument.getElementById('btn-save-drink');
            if (!saveBtn) return;

            setElementIconLabel(
                saveBtn,
                drinkInfo.saved ? 'archive-check' : 'archive',
                drinkInfo.saved ? '???' : '?????'
            );
            saveBtn.disabled = !!drinkInfo.saved;
            saveBtn.classList.toggle('opacity-60', !!drinkInfo.saved);
            saveBtn.classList.toggle('cursor-not-allowed', !!drinkInfo.saved);
        }
    };
}

function renderResult(record, fromHistory = false) {
    runtimeActions.setCurrentDrinkInfo({ ...record, saved: !!fromHistory || record.saved });
    if (typeof updateVoyageAmbientPresentation === 'function') {
        updateVoyageAmbientPresentation();
    }
    applyPaletteToTavern(currentDrinkInfo);

    const resultDom = createTavernResultDomAdapter(document);
    resultDom.renderDrinkInfo(currentDrinkInfo);
    resultDom.updateSaveButton(currentDrinkInfo);

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
