const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

function loadScript(context, relativePath) {
    const absolutePath = path.join(ROOT_DIR, relativePath);
    const source = fs.readFileSync(absolutePath, 'utf8');
    vm.runInContext(source, context, { filename: absolutePath });
}

function createBaseContext(overrides = {}) {
    const context = vm.createContext({
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        JSON,
        Math,
        Number,
        String,
        Boolean,
        Array,
        Object,
        Date,
        Intl,
        Map,
        Set,
        Promise,
        Error,
        structuredClone: global.structuredClone,
        ...overrides
    });

    context.globalThis = context;
    context.window = context;
    return context;
}

function createCheckinDay(overrides = {}) {
    const emptyPeriod = () => ({
        checkIn: null,
        checkOut: null,
        status: { checkIn: null, checkOut: null },
        entrySource: null,
        updatedAt: null,
        correctionReason: ''
    });

    return {
        morning: emptyPeriod(),
        afternoon: emptyPeriod(),
        evening: emptyPeriod(),
        leave: false,
        leaveReason: '',
        leaveMeta: null,
        partialLeaves: [],
        ...overrides
    };
}

function createStorageMock(initialEntries = {}) {
    const store = new Map(
        Object.entries(initialEntries).map(([key, value]) => [key, String(value)])
    );

    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        dump() {
            return Object.fromEntries(store.entries());
        }
    };
}

module.exports = {
    ROOT_DIR,
    loadScript,
    createBaseContext,
    createCheckinDay,
    createStorageMock
};
