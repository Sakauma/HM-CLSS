const assert = require('node:assert/strict');
const test = require('node:test');

const {
    checkModuleDependencies,
    findRegisterAppModuleObjects
} = require('../../scripts/check-module-dependencies');

function check(scriptPaths, sources) {
    return checkModuleDependencies({
        scriptPaths,
        readSource(scriptPath) {
            return sources[scriptPath] || '';
        }
    });
}

test('module dependency checker validates earlier dependencies and ignores comments and strings', () => {
    const scriptPaths = [
        'assets/js/runtime/module-registry.js',
        'assets/js/features/tasks/index.js'
    ];
    const sources = {
        'assets/js/runtime/module-registry.js': `
            registerAppModule({ id: 'module-registry', init() {} });
        `,
        'assets/js/features/tasks/index.js': `
            // registerAppModule({ id: 'commented', dependsOn: ['later'], init() {} });
            const text = "registerAppModule({ id: 'stringed', init() {} })";
            registerAppModule({
                id: 'tasks',
                dependsOn: ['module-registry'],
                init() {}
            });
        `
    };

    const result = check(scriptPaths, sources);

    assert.equal(result.ok, true);
    assert.deepEqual(result.moduleDefinitions.map((definition) => definition.id), ['module-registry', 'tasks']);
});

test('module dependency checker reports dependencies that load later', () => {
    const result = check(
        [
            'assets/js/features/tasks/index.js',
            'assets/js/runtime/module-registry.js'
        ],
        {
            'assets/js/features/tasks/index.js': `
                registerAppModule({ id: 'tasks', dependsOn: ['module-registry'], init() {} });
            `,
            'assets/js/runtime/module-registry.js': `
                registerAppModule({ id: 'module-registry', init() {} });
            `
        }
    );

    assert.equal(result.ok, false);
    assert.match(result.errors[0], /tasks depends on "module-registry"/);
    assert.match(result.errors[0], /loads at position 2/);
});

test('module dependency checker reports unknown and ambiguous aliases', () => {
    const result = check(
        [
            'assets/js/features/a/index.js',
            'assets/js/features/b/index.js',
            'assets/js/features/c/index.js'
        ],
        {
            'assets/js/features/a/index.js': `registerAppModule({ id: 'a', init() {} });`,
            'assets/js/features/b/index.js': `registerAppModule({ id: 'b', init() {} });`,
            'assets/js/features/c/index.js': `registerAppModule({ id: 'c', dependsOn: ['index', 'missing'], init() {} });`
        }
    );

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /c declares unknown dependsOn entry "index"/);
    assert.match(result.errors.join('\n'), /c declares unknown dependsOn entry "missing"/);
});

test('module dependency checker reports self dependencies', () => {
    const result = check(
        ['assets/js/features/tasks/index.js'],
        {
            'assets/js/features/tasks/index.js': `
                registerAppModule({ id: 'tasks', dependsOn: ['tasks'], init() {} });
            `
        }
    );

    assert.equal(result.ok, false);
    assert.match(result.errors[0], /tasks cannot depend on itself/);
});

test('findRegisterAppModuleObjects extracts calls with comments inside the object', () => {
    const objects = findRegisterAppModuleObjects(`
        registerAppModule({
            id: 'alpha',
            // dependsOn: ['ignored'],
            dependsOn: ['module-registry'],
            init() {}
        });
    `);

    assert.equal(objects.length, 1);
    assert.match(objects[0], /id: 'alpha'/);
});
