/**
 * 云同步冲突判断层。
 * 负责判断本地/云端版本关系，并生成上传前保护结果。
 */

function hasMeaningfulLocalData() {
    if (runtimeSelectors.currentTask()) return true;

    if (phoneResistData.totalCount > 0 || leaveData.length > 0 || achievements.length > 0 || tavernData.length > 0) {
        return true;
    }

    if (countTotalTaskEntries() > 0 || countQuickNoteEntries() > 0) {
        return true;
    }

    return Object.values(checkinData).some((day) => {
        if (!day || typeof day !== 'object') return false;
        const normalizedDay = ensureDayRecord(day);
        if (normalizedDay.leave) return true;
        if (Array.isArray(normalizedDay.partialLeaves) && normalizedDay.partialLeaves.length > 0) return true;
        return hasAnyCheckinRecord(normalizedDay);
    });
}

function isCloudSyncNewerThanLocal(cloudSyncTime) {
    if (!cloudSyncTime) return false;
    const cloudTimestamp = new Date(cloudSyncTime).getTime();
    const localTimestamp = localLastSyncTime ? new Date(localLastSyncTime).getTime() : NaN;

    if (!Number.isFinite(cloudTimestamp)) return false;
    return !Number.isFinite(localTimestamp) || cloudTimestamp > localTimestamp;
}

function hasConditionalCloudUploadToken(cloudSnapshot) {
    return typeof cloudSnapshot?.etag === 'string' && cloudSnapshot.etag.trim().length > 0;
}

function shouldAutoApplyCloudData(cloudData) {
    if (!cloudData?.lastSyncTime) return false;
    if (!localLastSyncTime) return !hasMeaningfulLocalData();
    return isCloudSyncNewerThanLocal(cloudData.lastSyncTime);
}

async function inspectCloudBeforeUpload() {
    const cloudSnapshot = await fetchCloudWorkspaceSnapshot();
    const cloudData = cloudSnapshot.data;
    if (!hasConditionalCloudUploadToken(cloudSnapshot)) {
        return {
            confirmed: false,
            reason: 'missing_etag',
            etag: null
        };
    }

    if (!cloudData?.lastSyncTime) {
        return {
            confirmed: true,
            etag: cloudSnapshot.etag
        };
    }

    if (isCloudSyncNewerThanLocal(cloudData.lastSyncTime)) {
        const confirmed = await showConfirmDialog({
            title: '云端版本更新于本地之后',
            message: '如果继续上传，云端较新的数据会被本地版本覆盖。更稳妥的做法是先拉取云端数据再决定。',
            badge: 'SYNC OVERRIDE',
            confirmLabel: '仍然上传',
            cancelLabel: '先去拉取',
            tone: 'danger'
        });
        return {
            confirmed,
            etag: cloudSnapshot.etag
        };
    }

    return {
        confirmed: true,
        etag: cloudSnapshot.etag
    };
}

async function maybeConfirmCloudOverwrite() {
    const uploadGuard = await inspectCloudBeforeUpload();
    return uploadGuard.confirmed;
}
