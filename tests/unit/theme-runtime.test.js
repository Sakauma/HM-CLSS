const assert = require('node:assert/strict');
const test = require('node:test');

const {
    loadScript,
    createBaseContext
} = require('./helpers');
const {
    createButtonElement,
    createClassList
} = require('./sync-helpers');

test('theme module tolerates unavailable localStorage', () => {
    const htmlClassList = createClassList();
    const themeToggle = createButtonElement();
    let registeredModule = null;
    const context = createBaseContext({
        console: { ...console, error() {} },
        localStorage: {
            getItem() {
                throw new Error('storage disabled');
            },
            setItem() {
                throw new Error('storage disabled');
            }
        },
        document: {
            documentElement: { classList: htmlClassList },
            getElementById(id) {
                if (id === 'theme-toggle') return themeToggle;
                if (id === 'theme-icon-dark' || id === 'theme-icon-light') {
                    return { classList: createClassList(['hidden']) };
                }
                return null;
            },
            querySelector() {
                return null;
            }
        },
        matchMedia: () => ({
            matches: true,
            addEventListener() {},
            removeEventListener() {}
        }),
        lucide: { createIcons() {} },
        createDisposables: () => ({
            listen() { return () => {}; },
            dispose() {}
        }),
        registerAppModule(module) {
            registeredModule = module;
        }
    });

    loadScript(context, 'assets/js/runtime/theme.js');

    assert.equal(htmlClassList.contains('dark'), true);
    assert.equal(registeredModule.id, 'runtime-theme');
    assert.doesNotThrow(() => context.handleThemeToggleClick());
});
