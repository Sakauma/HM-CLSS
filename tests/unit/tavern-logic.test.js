const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

function loadScript(context, relativePath) {
    const absolutePath = path.join(ROOT_DIR, relativePath);
    const source = fs.readFileSync(absolutePath, 'utf8');
    vm.runInContext(source, context, { filename: absolutePath });
}

function createBaseContext(overrides = {}) {
    const context = vm.createContext({
        console,
        JSON,
        Math,
        Number,
        String,
        Boolean,
        Array,
        Object,
        Date,
        Set,
        Map,
        ...overrides
    });

    context.globalThis = context;
    context.window = context;
    return context;
}

function loadTavernModules(context) {
    loadScript(context, 'assets/js/runtime/state.js');
    loadScript(context, 'assets/js/features/tavern/catalog.js');
    loadScript(context, 'assets/js/features/tavern/analyze.js');
    loadScript(context, 'assets/js/features/tavern/records.js');
    loadScript(context, 'assets/js/features/tavern/logic.js');
}

test('tavern analysis derives stable family and intensity signals', () => {
    const context = createBaseContext();
    loadTavernModules(context);

    const profile = context.analyzeMoodText('论文和实验都卡住了，但我不想认输。');

    assert.equal(profile.text, '论文和实验都卡住了，但我不想认输。');
    assert.equal(profile.primaryFamily, 'focus');
    assert.ok(profile.intensity >= 0.3);
    assert.ok(profile.matchedKeywords.includes('论文'));
    assert.ok(profile.matchedKeywords.includes('实验'));
});

test('tavern recipe selection prefers easter eggs before family catalog', () => {
    const context = createBaseContext();
    loadTavernModules(context);

    const specialProfile = context.analyzeMoodText('今天又是挽救计划和 hm-clss 的一天');
    const specialRecipe = context.pickRecipe(specialProfile);
    assert.equal(specialRecipe.secret, true);
    assert.equal(specialRecipe.family, 'cosmic');

    const normalProfile = context.analyzeMoodText('今晚想慢下来，最好连心跳都跟着轻一点。');
    const normalRecipe = context.pickRecipe(normalProfile);
    assert.equal(normalRecipe.secret, false);
    assert.equal(normalRecipe.family, normalProfile.primaryFamily);
});

test('tavern drink records expose stable metadata and normalize legacy entries', () => {
    const context = createBaseContext({
        getTodayString: () => '2026-04-20',
        getCurrentTimeString: () => '23:10'
    });
    loadTavernModules(context);

    const profile = context.analyzeMoodText('我现在脑子很热，焦虑又头大，很多事一起扑过来。');
    const recipe = context.pickRecipe(profile);
    const record = context.buildDrinkRecord(profile, recipe);

    assert.ok(record.id.startsWith('drink_'));
    assert.equal(record.date, '2026-04-20');
    assert.equal(record.time, '23:10');
    assert.equal(record.familyKey, recipe.family);
    assert.match(record.abv, /% ABV$/);
    assert.ok(Array.isArray(record.palette));
    assert.ok(record.matchedKeywords.includes('焦虑') || record.matchedKeywords.includes('头大'));

    const normalized = context.normalizeDrinkRecord({
        id: 'legacy_1',
        name: '旧酒单',
        date: '2026-04-01',
        time: '20:00',
        params: '0.50 · 标准版'
    });

    assert.equal(normalized.enName, '旧酒单');
    assert.equal(normalized.familyKey, 'calm');
    assert.equal(normalized.serial.startsWith('ARCHIVE-'), true);
    assert.equal(normalized.intensity, 0.5);
});
