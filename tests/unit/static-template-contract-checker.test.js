const assert = require('node:assert/strict');
const test = require('node:test');

const {
    ROOT_DIR
} = require('./helpers');

const {
    checkStaticTemplateContracts,
    collectStaticTemplatePlaceholders,
    dataNameToDatasetKey,
    parseAttributes
} = require('../../scripts/check-static-template-contracts');

test('static template contract checker validates real index placeholders', () => {
    const result = checkStaticTemplateContracts({ rootDir: ROOT_DIR });

    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.placeholders.length, 10);
});

test('static template contract checker parses boolean template attrs and dataset names', () => {
    const attrs = parseAttributes('class="shift-card" data-shift-card-template data-template-ids="morning-checkin" data-period="morning"');
    const placeholders = collectStaticTemplatePlaceholders('<div class="shift-card" data-shift-card-template data-template-ids="morning-checkin" data-period="morning"></div>');

    assert.equal(attrs.get('data-shift-card-template'), '');
    assert.equal(dataNameToDatasetKey('data-checkin-table-row-template'), 'checkinTableRowTemplate');
    assert.equal(placeholders.length, 1);
    assert.equal(placeholders[0].selector, '[data-shift-card-template]');
    assert.deepEqual(placeholders[0].declaredIds, ['morning-checkin']);
});

test('static template contract checker catches declared ids missing from rendered markup', () => {
    const html = `
        <div data-metric-card-template data-template-ids="missing-preview-id" data-label="Preview" data-value-id="actual-preview-id" data-value="0"></div>
    `;
    const result = checkStaticTemplateContracts({ rootDir: ROOT_DIR, html });

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /missing-preview-id/);
    assert.match(result.errors.join('\n'), /rendered HTML did not contain/);
});

test('static template contract checker catches unknown template markers', () => {
    const html = '<div data-template-ids="example-id" data-unknown-template></div>';
    const result = checkStaticTemplateContracts({ rootDir: ROOT_DIR, html });

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /without a known static template marker/);
});
