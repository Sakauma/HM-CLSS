function initSyncModule() {
    populateSyncConfigInputs();
    document.getElementById('save-config-btn')?.addEventListener('click', saveSyncConfig);
    document.getElementById('push-cloud-btn')?.addEventListener('click', handlePushCloud);
    document.getElementById('pull-cloud-btn')?.addEventListener('click', handlePullCloud);
    autoPullOnStartup();
}

registerAppModule({
    id: 'sync',
    order: 95,
    init: initSyncModule
});
