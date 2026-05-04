/**
 * 存储迁移注册表。
 * 负责按 schema 版本登记迁移函数，供 storage.js 顺序执行。
 */

const STORAGE_MIGRATIONS = new Map();

function registerStorageMigration(version, migrate) {
    if (!Number.isInteger(version) || version <= 0) {
        throw new Error('registerStorageMigration requires a positive integer version.');
    }

    if (typeof migrate !== 'function') {
        throw new Error(`registerStorageMigration(${version}) requires a migrate function.`);
    }

    STORAGE_MIGRATIONS.set(version, migrate);
}

function getRegisteredStorageMigrationVersions() {
    return [...STORAGE_MIGRATIONS.keys()].sort((a, b) => a - b);
}

function applyRegisteredStorageMigrations(payload, fromVersion = 0, targetVersion = fromVersion) {
    let migratedPayload = { ...payload };
    let currentVersion = Number(fromVersion) || 0;

    getRegisteredStorageMigrationVersions().forEach((version) => {
        if (version <= currentVersion || version > targetVersion) return;
        const migrate = STORAGE_MIGRATIONS.get(version);
        migratedPayload = migrate(migratedPayload);
        currentVersion = version;
    });

    return migratedPayload;
}

function normalizeLegacyQuickNotes(rawNotes) {
    if (!rawNotes || typeof rawNotes !== 'object' || Array.isArray(rawNotes)) return {};

    return Object.fromEntries(
        Object.entries(rawNotes).map(([dateKey, entries]) => {
            if (!Array.isArray(entries)) return [dateKey, []];

            const normalizedEntries = entries.map((entry) => {
                if (typeof entry === 'string') {
                    return { time: null, text: entry, tag: 'idea' };
                }

                const normalized = entry && typeof entry === 'object' ? entry : {};
                return {
                    time: typeof normalized.time === 'string' ? normalized.time : null,
                    text: getNoteText(normalized),
                    tag: normalized.tag || 'idea'
                };
            }).filter((entry) => entry.text);

            return [dateKey, normalizedEntries];
        })
    );
}

function normalizeLegacyPhoneResist(rawPhoneResistData) {
    return normalizePhoneResistDataShape(rawPhoneResistData);
}

function normalizeLegacyTaskData(rawTaskData) {
    if (!rawTaskData || typeof rawTaskData !== 'object' || Array.isArray(rawTaskData)) return {};

    return Object.fromEntries(
        Object.entries(rawTaskData).map(([dateKey, entries]) => {
            if (!Array.isArray(entries)) return [dateKey, []];

            return [dateKey, entries
                .filter((entry) => entry && typeof entry === 'object')
                .map((entry, index) => normalizeTaskRecord(entry, dateKey, index))];
        })
    );
}

function normalizeLegacyCheckinData(rawCheckinData) {
    if (!rawCheckinData || typeof rawCheckinData !== 'object' || Array.isArray(rawCheckinData)) return {};

    return Object.fromEntries(
        Object.entries(rawCheckinData).map(([dateKey, dayData]) => [dateKey, ensureDayRecord(dayData)])
    );
}

function migrateStorageSchemaV1(payload) {
    return {
        ...payload,
        quickNotesData: normalizeLegacyQuickNotes(payload.quickNotesData),
        checkinData: normalizeLegacyCheckinData(payload.checkinData),
        phoneResistData: normalizeLegacyPhoneResist(payload.phoneResistData),
        taskData: normalizeLegacyTaskData(payload.taskData),
        leaveData: Array.isArray(payload.leaveData) ? payload.leaveData.map((leave) => normalizeLeaveRecord(leave)) : [],
        achievements: Array.isArray(payload.achievements) ? payload.achievements.filter((entry) => typeof entry === 'string') : [],
        tavernData: Array.isArray(payload.tavernData) ? payload.tavernData : [],
        currentTask: normalizeCurrentTaskRecord(payload.currentTask),
        ambientPreferences: normalizeAmbientPreferences(payload.ambientPreferences),
        checkinPreferences: normalizeCheckinPreferences(payload.checkinPreferences)
    };
}

registerStorageMigration(1, migrateStorageSchemaV1);
