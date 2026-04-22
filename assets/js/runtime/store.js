/**
 * 运行时共享状态容器。
 * 负责托管可变内存态，并通过全局代理兼容现有模块访问方式。
 */

const runtimeState = {
    checkinData: {},
    phoneResistData: { totalCount: 0, records: {} },
    taskData: {},
    leaveData: [],
    achievements: [],
    currentTask: null,
    taskTimer: null,
    taskStartTime: null,
    quickNotesData: {},
    tavernData: [],
    currentDrinkInfo: null,
    ambientPreferences: null,
    checkinPreferences: null,
    selectedEmotions: []
};

const runtimeStateKeys = Object.keys(runtimeState);
const runtimeStateSubscribers = new Map();

function getRuntimeState() {
    return runtimeState;
}

function getRuntimeValue(key) {
    return runtimeState[key];
}

function selectRuntimeValue(key) {
    return getRuntimeValue(key);
}

function selectRuntimeSlice(selector) {
    if (typeof selector !== 'function') {
        throw new Error('selectRuntimeSlice requires a selector function.');
    }

    return selector(runtimeState);
}

function notifyRuntimeSubscribers(key, value, previousValue) {
    const subscribers = runtimeStateSubscribers.get(key);
    if (!subscribers || subscribers.size === 0) return;

    subscribers.forEach((listener) => {
        try {
            listener(value, previousValue, key);
        } catch (error) {
            console.error(`Runtime subscriber for "${key}" failed:`, error);
        }
    });
}

function setRuntimeValue(key, value) {
    const previousValue = runtimeState[key];
    runtimeState[key] = value;
    notifyRuntimeSubscribers(key, value, previousValue);
    return value;
}

function updateRuntimeValue(key, updater) {
    return setRuntimeValue(key, updater(getRuntimeValue(key)));
}

function patchRuntimeValue(key, patch) {
    const currentValue = runtimeState[key];
    if (!currentValue || typeof currentValue !== 'object' || Array.isArray(currentValue)) {
        return setRuntimeValue(key, patch);
    }

    return setRuntimeValue(key, { ...currentValue, ...patch });
}

function appendRuntimeItem(key, item) {
    const currentValue = Array.isArray(getRuntimeValue(key)) ? getRuntimeValue(key) : [];
    return setRuntimeValue(key, [...currentValue, item]);
}

function prependRuntimeItem(key, item) {
    const currentValue = Array.isArray(getRuntimeValue(key)) ? getRuntimeValue(key) : [];
    return setRuntimeValue(key, [item, ...currentValue]);
}

function mapRuntimeItems(key, mapper) {
    const currentValue = Array.isArray(getRuntimeValue(key)) ? getRuntimeValue(key) : [];
    return setRuntimeValue(key, currentValue.map(mapper));
}

function filterRuntimeItems(key, predicate) {
    const currentValue = Array.isArray(getRuntimeValue(key)) ? getRuntimeValue(key) : [];
    return setRuntimeValue(key, currentValue.filter(predicate));
}

function updateRuntimeObjectEntry(key, entryKey, updater, defaultValue = {}) {
    return updateRuntimeValue(key, (currentValue) => {
        const baseValue = currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)
            ? currentValue
            : {};
        const nextValue = typeof updater === 'function'
            ? updater(baseValue[entryKey] ?? defaultValue)
            : updater;
        return {
            ...baseValue,
            [entryKey]: nextValue
        };
    });
}

function removeRuntimeObjectEntry(key, entryKey) {
    return updateRuntimeValue(key, (currentValue) => {
        const baseValue = currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)
            ? currentValue
            : {};
        if (!(entryKey in baseValue)) return baseValue;
        const nextValue = { ...baseValue };
        delete nextValue[entryKey];
        return nextValue;
    });
}

function subscribeRuntimeValue(key, listener, options = {}) {
    if (typeof listener !== 'function') {
        throw new Error(`subscribeRuntimeValue("${key}") requires a listener function.`);
    }

    const subscribers = runtimeStateSubscribers.get(key) || new Set();
    subscribers.add(listener);
    runtimeStateSubscribers.set(key, subscribers);

    if (options.immediate) {
        listener(getRuntimeValue(key), undefined, key);
    }

    return () => {
        const currentSubscribers = runtimeStateSubscribers.get(key);
        if (!currentSubscribers) return;
        currentSubscribers.delete(listener);
        if (currentSubscribers.size === 0) {
            runtimeStateSubscribers.delete(key);
        }
    };
}

const runtimeSelectors = Object.freeze({
    state: getRuntimeState,
    value: selectRuntimeValue,
    slice: selectRuntimeSlice,
    checkinData: () => selectRuntimeValue('checkinData'),
    phoneResistData: () => selectRuntimeValue('phoneResistData'),
    taskData: () => selectRuntimeValue('taskData'),
    leaveData: () => selectRuntimeValue('leaveData'),
    achievements: () => selectRuntimeValue('achievements'),
    quickNotesData: () => selectRuntimeValue('quickNotesData'),
    tavernData: () => selectRuntimeValue('tavernData'),
    currentTask: () => selectRuntimeValue('currentTask'),
    taskTimer: () => selectRuntimeValue('taskTimer'),
    ambientPreferences: () => selectRuntimeValue('ambientPreferences'),
    checkinPreferences: () => selectRuntimeValue('checkinPreferences'),
    currentDrinkInfo: () => selectRuntimeValue('currentDrinkInfo'),
    selectedEmotions: () => selectRuntimeValue('selectedEmotions')
});
globalThis.runtimeSelectors = runtimeSelectors;

const runtimeActions = Object.freeze({
    set: setRuntimeValue,
    update: updateRuntimeValue,
    patch: patchRuntimeValue,
    append: appendRuntimeItem,
    prepend: prependRuntimeItem,
    map: mapRuntimeItems,
    filter: filterRuntimeItems,
    updateObjectEntry: updateRuntimeObjectEntry,
    removeObjectEntry: removeRuntimeObjectEntry,
    setCheckinData(value) {
        return setRuntimeValue('checkinData', value);
    },
    setPhoneResistData(value) {
        return setRuntimeValue('phoneResistData', value);
    },
    setTaskData(value) {
        return setRuntimeValue('taskData', value);
    },
    setLeaveData(value) {
        return setRuntimeValue('leaveData', value);
    },
    setAchievements(value) {
        return setRuntimeValue('achievements', value);
    },
    setQuickNotesData(value) {
        return setRuntimeValue('quickNotesData', value);
    },
    setTavernData(value) {
        return setRuntimeValue('tavernData', value);
    },
    updateCheckinDay(date, updater, defaultDayFactory = () => ({})) {
        return updateRuntimeObjectEntry('checkinData', date, updater, defaultDayFactory());
    },
    removeCheckinDay(date) {
        return removeRuntimeObjectEntry('checkinData', date);
    },
    updateTaskEntries(date, updater) {
        return updateRuntimeObjectEntry('taskData', date, updater, []);
    },
    updateQuickNoteEntries(date, updater) {
        return updateRuntimeObjectEntry('quickNotesData', date, updater, []);
    },
    updatePhoneResistRecord(date, updater) {
        return updateRuntimeValue('phoneResistData', (currentValue) => {
            const baseValue = currentValue && typeof currentValue === 'object'
                ? currentValue
                : { totalCount: 0, records: {} };
            const records = baseValue.records && typeof baseValue.records === 'object'
                ? baseValue.records
                : {};
            const nextRecord = typeof updater === 'function'
                ? updater(records[date] ?? { count: 0, times: [] })
                : updater;
            return {
                ...baseValue,
                records: {
                    ...records,
                    [date]: nextRecord
                }
            };
        });
    },
    setCurrentTask(task) {
        return setRuntimeValue('currentTask', task);
    },
    clearCurrentTask() {
        return setRuntimeValue('currentTask', null);
    },
    setTaskTimer(timerId) {
        return setRuntimeValue('taskTimer', timerId);
    },
    setAmbientPreferences(preferences) {
        return setRuntimeValue('ambientPreferences', preferences);
    },
    setCheckinPreferences(preferences) {
        return setRuntimeValue('checkinPreferences', preferences);
    },
    setCurrentDrinkInfo(drinkInfo) {
        return setRuntimeValue('currentDrinkInfo', drinkInfo);
    },
    clearCurrentDrinkInfo() {
        return setRuntimeValue('currentDrinkInfo', null);
    }
});
globalThis.runtimeActions = runtimeActions;

function bindRuntimeGlobals(target = window) {
    runtimeStateKeys.forEach((key) => {
        Object.defineProperty(target, key, {
            configurable: true,
            enumerable: true,
            get() {
                return getRuntimeValue(key);
            },
            set(value) {
                setRuntimeValue(key, value);
            }
        });
    });
}

bindRuntimeGlobals();
