const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
    ROOT_DIR,
    createBaseContext,
    loadScript
} = require('./helpers');

test('static template module registers before business modules and generates tavern vessel ids', () => {
    const registeredModules = [];
    const context = createBaseContext({
        registerAppModule(definition) {
            registeredModules.push(definition);
        }
    });

    loadScript(context, 'assets/js/runtime/dom-utils.js');
    loadScript(context, 'assets/js/ui/static-templates.js');

    assert.equal(registeredModules.length, 1);
    assert.equal(registeredModules[0].id, 'ui/static-templates');
    assert.equal(registeredModules[0].order, 5);
    assert.equal(registeredModules[0].dependsOn.length, 2);
    assert.equal(registeredModules[0].dependsOn[0], 'module-registry');
    assert.equal(registeredModules[0].dependsOn[1], 'runtime/dom-utils');

    const html = context.createTavernVesselTemplateHtml({
        labelId: 'example-label',
        label: 'Example',
        liquidId: 'example-liquid',
        bubblesId: 'example-bubbles'
    });

    assert.match(html, /id="example-label"/);
    assert.match(html, /id="example-liquid"/);
    assert.match(html, /id="example-bubbles"/);
    assert.match(html, /tavern-wave-stack/);
});

test('static template hydration is safe for missing roots and idempotent targets', () => {
    const context = createBaseContext({
        registerAppModule() {}
    });

    loadScript(context, 'assets/js/runtime/dom-utils.js');
    loadScript(context, 'assets/js/ui/static-templates.js');

    context.createTrustedHtml = (html) => ({ value: html });
    context.replaceElementChildrenWithTrustedHtml = (target, trustedHtml) => {
        target.html = trustedHtml.value;
        return target;
    };

    const vesselTarget = {
        dataset: {
            labelId: 'vessel-label',
            label: 'Idle Pour',
            liquidId: 'vessel-liquid',
            bubblesId: 'vessel-bubbles'
        }
    };
    const shiftTarget = {
        dataset: {
            period: 'morning',
            eyebrow: 'ALPHA WATCH',
            title: 'Alpha',
            copy: 'Copy',
            window: '08:00',
            primaryLabel: 'Window',
            primaryValue: '06:00 - 12:00',
            secondaryLabel: 'Rest',
            secondaryValue: '12:00',
            checkinLabel: 'Start',
            checkoutLabel: 'Stop',
            checkinTime: 'Start: -',
            checkoutTime: 'End: -'
        }
    };
    const checkinTableRowTarget = {
        dataset: {
            period: 'morning',
            label: 'Alpha'
        }
    };
    const metricTarget = {
        dataset: {
            label: 'Work',
            valueId: 'metric-work',
            value: '0 h',
            hintId: 'metric-work-hint',
            hint: 'Ready'
        }
    };
    const root = {
        querySelectorAll(selector) {
            return {
                '[data-tavern-vessel-template]': [vesselTarget],
                '[data-tavern-spectrum-template]': [],
                '[data-tavern-stat-template]': [],
                '[data-shift-card-template]': [shiftTarget],
                '[data-checkin-table-row-template]': [checkinTableRowTarget],
                '[data-metric-card-template]': [metricTarget]
            }[selector] || [];
        }
    };

    assert.equal(context.renderStaticUiTemplates(null), false);
    assert.equal(context.renderStaticUiTemplates(root), true);
    assert.equal(vesselTarget.dataset.hydrated, 'true');
    assert.equal(shiftTarget.dataset.hydrated, 'true');
    assert.equal(checkinTableRowTarget.dataset.hydrated, 'true');
    assert.equal(metricTarget.dataset.hydrated, 'true');
    assert.match(vesselTarget.html, /id="vessel-liquid"/);
    assert.match(shiftTarget.html, /id="morning-checkin"/);
    assert.match(checkinTableRowTarget.html, /id="table-morning-checkin-status"/);
    assert.match(metricTarget.html, /id="metric-work"/);
    assert.match(metricTarget.html, /id="metric-work-hint"/);

    vesselTarget.html = 'unchanged';
    context.renderStaticUiTemplates(root);
    assert.equal(vesselTarget.html, 'unchanged');
});

test('CSS ownership keeps panel layout out of generic components', () => {
    const componentsCss = fs.readFileSync(path.join(ROOT_DIR, 'assets/css/components.css'), 'utf8');
    const shellPanelsCss = fs.readFileSync(path.join(ROOT_DIR, 'assets/css/shell-panels.css'), 'utf8');
    const tavernCss = fs.readFileSync(path.join(ROOT_DIR, 'assets/css/features-tavern.css'), 'utf8');

    assert.doesNotMatch(componentsCss, /\.shift-card\b/);
    assert.doesNotMatch(componentsCss, /\.ops-table-shell\b/);
    assert.doesNotMatch(componentsCss, /\.system-panel-actions\s+\.action-btn\b/);
    assert.match(shellPanelsCss, /\.shift-card\b/);
    assert.match(shellPanelsCss, /\.ops-table-shell\b/);
    assert.match(shellPanelsCss, /\.system-panel-actions\s+\.action-btn\b/);
    assert.match(tavernCss, /\.tavern-/);
});
