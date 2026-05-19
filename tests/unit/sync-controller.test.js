const assert = require('node:assert/strict');
const test = require('node:test');

const {
    loadScript,
    createBaseContext,
    createStorageMock
} = require('./helpers');
const {
    createButtonElement,
    createSyncApplyContext
} = require('./sync-helpers');

test('sync controller covers conflict confirmation and failure branches', async () => {
    const toastEvents = [];
    let confirmOptions = null;
    const elements = {
        'github-token-input': { value: 'ghp_test' },
        'gist-id-input': { value: 'gist_test' },
        'save-config-btn': createButtonElement(),
        'push-cloud-btn': createButtonElement(),
        'pull-cloud-btn': createButtonElement(),
        'restore-local-backup-btn': createButtonElement(),
        'clear-local-backup-btn': createButtonElement(),
        'local-backup-summary': { textContent: '' }
    };

    const context = createBaseContext({
        localStorage: createStorageMock({
            gistId: 'gist_test',
            localLastSyncTime: '2026-04-20T10:00:00.000Z'
        }),
        sessionStorage: createStorageMock({
            githubToken: 'ghp_test'
        }),
        document: {
            activeElement: null,
            getElementById(id) {
                return elements[id] || null;
            }
        },
        lucide: { createIcons() {} },
        registerAppModule() {},
        cloneChildNodesSnapshot() { return []; },
        restoreChildNodesSnapshot() {},
        setElementIconLabel() {},
        showToast(message, tone) {
            toastEvents.push({ message, tone });
        },
        showConfirmDialog: async (options) => {
            confirmOptions = options;
            return false;
        },
        applyWorkspaceDatasetSnapshot(data) {
            context.__appliedData = data;
        },
        buildCloudSyncPayload(syncTime) {
            return { lastSyncTime: syncTime };
        },
        saveData() {},
        getTodayString() { return '2026-04-20'; },
        refreshCheckinViews() {},
        updateTodayPhoneResistTimes() {},
        updateAchievementsList() {},
        updateTodayTasksList() {},
        updateSchedule() {},
        updateLeaveRecordsList() {},
        renderCurrentTaskState() {},
        refreshDashboardHome() {},
        renderTavernHistory() {},
        countTotalTaskEntries() { return 0; },
        countQuickNoteEntries() { return 0; },
        ensureDayRecord(day) { return day; },
        hasAnyCheckinRecord() { return false; },
        checkinData: {},
        phoneResistData: { totalCount: 0, records: { '2026-04-20': { count: 0 } } },
        leaveData: [],
        achievements: [],
        tavernData: [],
        currentTask: null
    });

    loadScript(context, 'assets/js/features/sync/state.js');
    loadScript(context, 'assets/js/features/sync/ui.js');
    loadScript(context, 'assets/js/features/sync/backup.js');
    loadScript(context, 'assets/js/features/sync/conflict.js');
    loadScript(context, 'assets/js/features/sync/logic.js');
    loadScript(context, 'assets/js/features/sync/index.js');

    context.saveSyncConfig();
    assert.deepEqual(toastEvents.at(-1), {
        message: '⚙️ Token 仅保存在当前会话，Gist ID 已保存到本地。',
        tone: 'success'
    });
    assert.equal(context.sessionStorage.getItem('githubToken'), 'ghp_test');
    assert.equal(context.localStorage.getItem('githubToken'), null);
    assert.equal(context.localStorage.getItem('gistId'), 'gist_test');

    context.fetchCloudWorkspaceSnapshot = async () => ({
        data: { lastSyncTime: '2026-04-21T10:00:00.000Z' },
        etag: 'etag-newer'
    });
    const overwriteConfirmed = await context.maybeConfirmCloudOverwrite();
    assert.equal(overwriteConfirmed, false);
    assert.equal(confirmOptions.badge, 'SYNC OVERRIDE');
    assert.match(confirmOptions.message, /云端较新的数据/);

    context.fetchCloudWorkspaceSnapshot = async () => ({
        data: { lastSyncTime: '2026-04-20T09:00:00.000Z' },
        etag: null
    });
    const missingEtagConfirmed = await context.maybeConfirmCloudOverwrite();
    assert.equal(missingEtagConfirmed, false);

    toastEvents.length = 0;
    let pushAttempted = false;
    context.pushCloudWorkspaceData = async () => {
        pushAttempted = true;
    };
    await context.handlePushCloud();
    assert.equal(pushAttempted, false);
    assert.deepEqual(toastEvents.at(-1), {
        message: '无法确认云端版本，已取消上传。请稍后重试或先拉取确认。',
        tone: 'warning'
    });

    toastEvents.length = 0;
    context.fetchCloudWorkspaceSnapshot = async () => { throw new Error('fetch_failed_401'); };
    context.pushCloudWorkspaceData = async () => ({ ok: true });
    await context.handlePushCloud();
    assert.deepEqual(toastEvents.at(-1), { message: '❌ 上传失败，请检查配置信息。', tone: 'error' });
    assert.equal(elements['push-cloud-btn'].disabled, false);

    toastEvents.length = 0;
    context.fetchCloudWorkspaceSnapshot = async () => ({
        data: { lastSyncTime: '2026-04-20T09:00:00.000Z' },
        etag: '"etag-conflict"'
    });
    context.pushCloudWorkspaceData = async (_payload, options = {}) => {
        assert.equal(options.etag, '"etag-conflict"');
        throw new Error('push_failed_412');
    };
    await context.handlePushCloud();
    assert.deepEqual(toastEvents.at(-1), { message: '❌ 云端数据已变化，本次上传已取消。请先拉取确认。', tone: 'warning' });

    toastEvents.length = 0;
    context.showConfirmDialog = async () => true;
    context.fetchCloudWorkspaceData = async () => { throw new Error('network down'); };
    await context.handlePullCloud();
    assert.deepEqual(toastEvents.at(-1), { message: '🌐 网络请求失败：network down', tone: 'error' });
    assert.equal(elements['pull-cloud-btn'].disabled, false);

    toastEvents.length = 0;
    context.fetchCloudWorkspaceData = async () => { throw new Error('fetch_invalid_payload'); };
    await context.handlePullCloud();
    assert.deepEqual(toastEvents.at(-1), { message: '❌ 云端数据文件内容损坏，当前无法拉取。', tone: 'error' });
});
