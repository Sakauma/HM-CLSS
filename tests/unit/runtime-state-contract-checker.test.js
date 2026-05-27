const assert = require('node:assert/strict');
const test = require('node:test');

const {
    ROOT_DIR
} = require('./helpers');

const {
    checkRuntimeStateContracts,
    stripCommentsAndStrings
} = require('../../scripts/check-runtime-state-contracts');

test('runtime state contract checker validates real app scripts', () => {
    const result = checkRuntimeStateContracts({ rootDir: ROOT_DIR });

    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
    assert.ok(result.checkedFiles > 60);
});

test('runtime state contract checker catches direct global state writes', () => {
    const result = checkRuntimeStateContracts({
        rootDir: ROOT_DIR,
        scriptPaths: ['assets/js/features/checkin/index.js'],
        readSource() {
            return `
                checkinData[today] = createEmptyDayRecord();
                phoneResistData.records[today] = { count: 0, times: [] };
                checkinData[today].morning.status = 'success';
                phoneResistData.totalCount += 1;
                taskData[today].push(task);
                currentTask.startedAt++;
                delete quickNotesData[today];
                tavernData.push(record);
            `;
        }
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /writes checkinData directly/);
    assert.match(result.errors.join('\n'), /writes phoneResistData directly/);
    assert.match(result.errors.join('\n'), /mutates taskData in place/);
    assert.match(result.errors.join('\n'), /updates currentTask directly/);
    assert.match(result.errors.join('\n'), /deletes from quickNotesData directly/);
    assert.match(result.errors.join('\n'), /mutates tavernData in place/);
});

test('runtime state contract checker catches runtime write helpers outside the store module', () => {
    const result = checkRuntimeStateContracts({
        rootDir: ROOT_DIR,
        scriptPaths: ['assets/js/runtime/storage.js'],
        readSource() {
            return `
                setRuntimeValue('taskData', {});
                appendRuntimeItem('achievements', achievement.id);
            `;
        }
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /uses setRuntimeValue\(\) outside/);
    assert.match(result.errors.join('\n'), /uses appendRuntimeItem\(\) outside/);
});

test('runtime state contract checker allows selectors and runtimeActions writes', () => {
    const result = checkRuntimeStateContracts({
        rootDir: ROOT_DIR,
        scriptPaths: ['assets/js/features/tasks/index.js'],
        readSource() {
            return `
                const taskData = runtimeSelectors.taskData();
                const currentTask = runtimeSelectors.currentTask();
                runtimeActions.appendTaskEntry(today, currentTask);
            `;
        }
    });

    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
});

test('runtime state contract checker ignores strings and comments', () => {
    const sanitized = stripCommentsAndStrings(`
        // checkinData[today] = {};
        const message = "setRuntimeValue('taskData', {})";
        const templateText = \`phoneResistData.totalCount += 1\`;
    `);
    const result = checkRuntimeStateContracts({
        rootDir: ROOT_DIR,
        scriptPaths: ['assets/js/features/tasks/index.js'],
        readSource() {
            return sanitized;
        }
    });

    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
});

test('runtime state contract checker keeps template expressions visible', () => {
    const result = checkRuntimeStateContracts({
        rootDir: ROOT_DIR,
        scriptPaths: ['assets/js/features/tasks/index.js'],
        readSource() {
            return 'const message = `${checkinData[today].morning = { checkIn: "08:00" }}`;';
        }
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /writes checkinData directly/);
});
