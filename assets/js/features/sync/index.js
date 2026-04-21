function initSyncModule() {
    const disposables = createDisposables();
    populateSyncConfigInputs();
    disposables.listen(document.getElementById('save-config-btn'), 'click', saveSyncConfig);
    disposables.listen(document.getElementById('push-cloud-btn'), 'click', handlePushCloud);
    disposables.listen(document.getElementById('pull-cloud-btn'), 'click', handlePullCloud);
    autoPullOnStartup();
    return () => {
        clearAutoSyncTimer();
        disposables.dispose();
    };
}

registerAppModule({
    id: 'sync',
    order: 95,
    init: initSyncModule
});
