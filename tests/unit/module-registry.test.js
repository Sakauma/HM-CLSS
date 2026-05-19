const assert = require('node:assert/strict');
const test = require('node:test');

const {
    loadScript,
    createBaseContext
} = require('./helpers');

test('module registry disposes cleanups in reverse order and allows reinitialization', () => {
    const context = createBaseContext();
    loadScript(context, 'assets/js/runtime/module-registry.js');

    const events = [];
    context.registerAppModule({
        id: 'alpha',
        order: 10,
        init() {
            events.push('init:alpha');
            return () => events.push('dispose:alpha');
        }
    });
    context.registerAppModule({
        id: 'beta',
        order: 20,
        dependsOn: ['alpha'],
        init() {
            events.push('init:beta');
            return () => events.push('dispose:beta');
        }
    });

    const moduleSnapshot = JSON.parse(JSON.stringify(
        context.getRegisteredAppModules().map(({ id, dependsOn }) => ({ id, dependsOn: Array.from(dependsOn) }))
    ));
    assert.deepEqual(moduleSnapshot, [
        { id: 'alpha', dependsOn: [] },
        { id: 'beta', dependsOn: ['alpha'] }
    ]);
    assert.deepEqual(Array.from(context.initializeAppModules()), ['alpha', 'beta']);
    assert.deepEqual(Array.from(context.disposeAppModules()), ['beta', 'alpha']);
    assert.deepEqual(events, ['init:alpha', 'init:beta', 'dispose:beta', 'dispose:alpha']);
    assert.deepEqual(Array.from(context.initializeAppModules()), ['alpha', 'beta']);
});

test('module registry validates startup dependency metadata', () => {
    const context = createBaseContext();
    loadScript(context, 'assets/js/runtime/module-registry.js');

    assert.throws(
        () => context.registerAppModule({ id: 'bad-shape', dependsOn: 'alpha', init() {} }),
        /dependsOn must be an array/
    );
    assert.throws(
        () => context.registerAppModule({ id: 'bad-entry', dependsOn: ['alpha', ''], init() {} }),
        /dependsOn entries must be non-empty strings/
    );
    assert.throws(
        () => context.registerAppModule({ id: 'self-reference', dependsOn: ['self-reference'], init() {} }),
        /cannot depend on itself/
    );
});

test('module registry flushes deferred module registrars registered before the registry script loads', () => {
    const context = createBaseContext({
        __hmClssDeferredModuleRegistrars: [
            () => {
                context.registerAppModule({
                    id: 'deferred-theme',
                    order: 15,
                    init() {
                        context.__deferredInitialized = true;
                    }
                });
            }
        ]
    });

    loadScript(context, 'assets/js/runtime/module-registry.js');

    const moduleIds = Array.from(context.getRegisteredAppModules()).map((module) => module.id);
    assert.deepEqual(moduleIds, ['deferred-theme']);
    context.initializeAppModules();
    assert.equal(context.__deferredInitialized, true);
});
