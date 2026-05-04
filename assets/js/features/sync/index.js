function initSyncModule() {
    const disposables = createDisposables();
    const startupRunState = { active: true };
    populateSyncConfigInputs();
    disposables.listen(document.getElementById('save-config-btn'), 'click', saveSyncConfig);
    disposables.listen(document.getElementById('push-cloud-btn'), 'click', handlePushCloud);
    disposables.listen(document.getElementById('pull-cloud-btn'), 'click', handlePullCloud);
    disposables.listen(document.getElementById('restore-local-backup-btn'), 'click', restoreLocalBackupBeforeCloudApply);
    disposables.listen(document.getElementById('clear-local-backup-btn'), 'click', clearLocalBackupBeforeCloudApply);
    refreshLocalBackupRestoreState();
    autoPullOnStartup(startupRunState);
    return () => {
        startupRunState.active = false;
        clearAutoSyncTimer();
        disposables.dispose();
    };
}

registerAppModule({
    id: 'sync',
    order: 95,
    init: initSyncModule
});
