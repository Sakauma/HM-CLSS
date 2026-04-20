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
        runtimeState[key] = patch;
        return runtimeState[key];
    }

    runtimeState[key] = { ...currentValue, ...patch };
    return runtimeState[key];
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
