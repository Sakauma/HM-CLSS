/**
 * 应用模块注册中心。
 * 负责收集各功能模块的 init 入口，并在启动时按顺序统一执行。
 */

const appModuleRegistry = [];
const initializedAppModules = new Map();
let appModuleRegistrationOrder = 0;

/**
 * 注册一个启动模块。
 * @param {{ id: string, init: Function, order?: number }} definition
 */
function registerAppModule(definition) {
    if (!definition || typeof definition.id !== 'string' || !definition.id.trim()) {
        throw new Error('registerAppModule requires a non-empty module id.');
    }

    if (typeof definition.init !== 'function') {
        throw new Error(`registerAppModule("${definition.id}") requires an init function.`);
    }

    if (appModuleRegistry.some((module) => module.id === definition.id)) {
        throw new Error(`App module "${definition.id}" has already been registered.`);
    }

    appModuleRegistry.push({
        id: definition.id,
        init: definition.init,
        order: Number.isFinite(definition.order) ? definition.order : 1000,
        registrationOrder: appModuleRegistrationOrder++
    });
}

/**
 * 返回当前已注册模块的有序快照，便于调试和测试。
 * @returns {Array<{ id: string, init: Function, order: number, registrationOrder: number }>}
 */
function getRegisteredAppModules() {
    return [...appModuleRegistry].sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.registrationOrder - b.registrationOrder;
    });
}

/**
 * 按顺序执行所有尚未初始化的模块。
 * @returns {string[]}
 */
function initializeAppModules() {
    const initializedIds = [];

    getRegisteredAppModules().forEach((module) => {
        if (initializedAppModules.has(module.id)) return;

        const cleanup = module.init();
        initializedAppModules.set(module.id, typeof cleanup === 'function' ? cleanup : null);
        initializedIds.push(module.id);
    });

    return initializedIds;
}

/**
 * 按初始化逆序执行 cleanup，并允许测试或重载场景回收副作用。
 * @returns {string[]}
 */
function disposeAppModules() {
    const disposedIds = [];

    [...getRegisteredAppModules()].reverse().forEach((module) => {
        if (!initializedAppModules.has(module.id)) return;

        const cleanup = initializedAppModules.get(module.id);
        initializedAppModules.delete(module.id);

        if (typeof cleanup === 'function') {
            try {
                cleanup();
            } catch (error) {
                console.error(`App module "${module.id}" cleanup failed:`, error);
            }
        }

        disposedIds.push(module.id);
    });

    return disposedIds;
}
