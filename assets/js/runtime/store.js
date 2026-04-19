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

function getRuntimeState() {
    return runtimeState;
}

function getRuntimeValue(key) {
    return runtimeState[key];
}

function setRuntimeValue(key, value) {
    runtimeState[key] = value;
    return value;
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
