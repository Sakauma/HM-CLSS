/**
 * 深空酒馆事件绑定层。
 * 负责把舞台、结果卡和历史酒柜组装成完整交互。
 */

function showTavernInputState(inputState, options = {}) {
    if (options.clearTimers) {
        clearAnalysisTimers();
    }
    switchTavernState('state-input');
    syncTavernInputControls(inputState, inputState.inputEl.value);
}

function clearCurrentTavernDrinkPresentation() {
    runtimeActions.clearCurrentDrinkInfo();
    if (typeof updateVoyageAmbientPresentation === 'function') {
        updateVoyageAmbientPresentation();
    }
}

function bindTavernInputEvents(disposables, inputState, emotionBarContainer) {
    disposables.listen(inputState.inputEl, 'input', (event) => {
        syncTavernInputControls(inputState, event.target.value);
    });
    document.querySelectorAll('.tavern-suggestion').forEach((button) => {
        disposables.listen(button, 'click', () => {
            syncTavernInputControls(inputState, button.getAttribute('data-mood') || '');
        });
    });

    disposables.listen(document.getElementById('btn-random-mood'), 'click', () => {
        const suggestion = tavernSuggestionTexts[Date.now() % tavernSuggestionTexts.length];
        syncTavernInputControls(inputState, suggestion);
    });

    disposables.listen(inputState.analyzeBtn, 'click', () => {
        startTavernAnalysis(inputState.inputEl.value, emotionBarContainer);
    });

    disposables.listen(document.getElementById('btn-stop-analyze'), 'click', () => {
        showTavernInputState(inputState, { clearTimers: true });
    });
}

function bindTavernResultEvents(disposables, inputState) {
    disposables.listen(document.getElementById('btn-remix'), 'click', () => {
        const remixText = currentDrinkInfo?.text || inputState.inputEl.value;
        clearCurrentTavernDrinkPresentation();
        syncTavernInputControls(inputState, remixText);
        switchTavernState('state-input');
    });

    disposables.listen(document.getElementById('btn-back-to-input'), 'click', () => {
        showTavernInputState(inputState, { clearTimers: true });
    });

    disposables.listen(document.getElementById('btn-save-drink'), 'click', () => {
        if (!currentDrinkInfo || currentDrinkInfo.saved) return;
        const saveResult = commitRuntimeMutation(['tavernData', 'currentDrinkInfo'], () => {
            runtimeActions.prepend('tavernData', { ...currentDrinkInfo, saved: true });
            runtimeActions.setCurrentDrinkInfo({ ...currentDrinkInfo, saved: true });
        }, {
            storageKeys: ['tavernData']
        });
        if (!saveResult.ok) return;

        showToast('特调已封存入酒柜', 'success');
        renderResult(currentDrinkInfo, true);
    });

    disposables.listen(document.getElementById('btn-share-drink'), 'click', async () => {
        if (!currentDrinkInfo) return;

        try {
            await copyDrinkCard(currentDrinkInfo);
            showToast('分享文案已复制', 'success');
        } catch (error) {
            showToast('复制失败，请稍后重试', 'error');
        }
    });
}

function bindTavernHistoryEvents(disposables, inputState) {
    disposables.listen(document.getElementById('btn-result-history'), 'click', () => {
        switchTavernState('state-history');
        renderTavernHistory();
    });

    disposables.listen(document.getElementById('btn-view-tavern-history'), 'click', () => {
        switchTavernState('state-history');
        renderTavernHistory();
    });

    disposables.listen(document.getElementById('btn-close-history'), 'click', () => {
        showTavernInputState(inputState);
    });

    disposables.listen(document.getElementById('btn-history-create'), 'click', () => {
        clearCurrentTavernDrinkPresentation();
        showTavernInputState(inputState);
    });
}

function initTavernModule() {
    const disposables = createDisposables();
    const inputState = {
        inputEl: document.getElementById('mood-text-input'),
        countEl: document.getElementById('mood-char-count'),
        analyzeBtn: document.getElementById('btn-start-analyze')
    };
    const emotionBarContainer = document.getElementById('emotion-bar-container');
    const handleResize = () => {
        const activeState = document.querySelector('#view-tavern-container > [id^="state-"].opacity-100');
        if (activeState?.id) {
            syncTavernContainerHeight(activeState.id);
        }
    };

    document.getElementById('history-library-count').textContent = cocktailCatalog.length;

    bindTavernInputEvents(disposables, inputState, emotionBarContainer);
    bindTavernResultEvents(disposables, inputState);
    bindTavernHistoryEvents(disposables, inputState);

    switchTavernState('state-input');
    renderTavernHistory();
    syncTavernInputControls(inputState, inputState.inputEl.value || '');
    disposables.listen(window, 'resize', handleResize);
    return () => {
        clearAnalysisTimers();
        disposables.dispose();
    };
}
