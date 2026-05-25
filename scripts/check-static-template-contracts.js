#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_INDEX_PATH = path.join(DEFAULT_ROOT_DIR, 'index.html');

const STATIC_TEMPLATE_ATTRIBUTES = Object.freeze([
    ['data-tavern-vessel-template', '[data-tavern-vessel-template]'],
    ['data-tavern-spectrum-template', '[data-tavern-spectrum-template]'],
    ['data-tavern-stat-template', '[data-tavern-stat-template]'],
    ['data-shift-card-template', '[data-shift-card-template]'],
    ['data-checkin-table-row-template', '[data-checkin-table-row-template]'],
    ['data-metric-card-template', '[data-metric-card-template]']
]);

const STATIC_TEMPLATE_ATTRIBUTE_NAMES = new Set(
    STATIC_TEMPLATE_ATTRIBUTES.map(([attributeName]) => attributeName)
);

function dataNameToDatasetKey(attributeName) {
    return attributeName
        .slice('data-'.length)
        .replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function parseAttributes(attributeSource) {
    const attrs = new Map();
    const attrPattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let match = attrPattern.exec(attributeSource);

    while (match) {
        attrs.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
        match = attrPattern.exec(attributeSource);
    }

    return attrs;
}

function attrsToDataset(attrs) {
    const dataset = {};

    attrs.forEach((value, name) => {
        if (!name.startsWith('data-')) return;
        dataset[dataNameToDatasetKey(name)] = value;
    });

    return dataset;
}

function collectStaticTemplatePlaceholders(html) {
    const placeholders = [];
    const tagPattern = /<([a-z0-9-]+)\b([^>]*\bdata-template-ids\s*=\s*(?:"[^"]*"|'[^']*')[^>]*)>/gi;
    let match = tagPattern.exec(html);

    while (match) {
        const attrs = parseAttributes(match[2]);
        const matchedTemplates = STATIC_TEMPLATE_ATTRIBUTES.filter(([attributeName]) => attrs.has(attributeName));
        const declaredIds = (attrs.get('data-template-ids') || '')
            .split(/\s+/)
            .map((value) => value.trim())
            .filter(Boolean);

        placeholders.push({
            tagName: match[1].toLowerCase(),
            index: match.index,
            line: html.slice(0, match.index).split(/\r?\n/).length,
            attrs,
            dataset: attrsToDataset(attrs),
            declaredIds,
            selector: matchedTemplates.length === 1 ? matchedTemplates[0][1] : null,
            matchedTemplateCount: matchedTemplates.length,
            knownTemplateMarkers: [...attrs.keys()].filter((name) => STATIC_TEMPLATE_ATTRIBUTE_NAMES.has(name))
        });

        match = tagPattern.exec(html);
    }

    return placeholders;
}

function createTemplateRuntime(rootDir) {
    const context = vm.createContext({
        console,
        Object,
        String,
        Array,
        Boolean,
        Number,
        Math,
        JSON,
        Error,
        Map,
        Set,
        Symbol,
        registerAppModule() {}
    });
    context.globalThis = context;
    context.window = context;

    ['assets/js/runtime/dom-utils.js', 'assets/js/ui/static-templates.js'].forEach((relativePath) => {
        const absolutePath = path.join(rootDir, relativePath);
        vm.runInContext(fs.readFileSync(absolutePath, 'utf8'), context, { filename: absolutePath });
    });

    context.createTrustedHtml = (html) => ({
        __hmTrustedHtml: true,
        value: String(html ?? '')
    });
    context.replaceElementChildrenWithTrustedHtml = (target, trustedHtml) => {
        target.renderedHtml = trustedHtml.value;
        return target;
    };

    return context;
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderedHtmlContainsId(renderedHtml, elementId) {
    return new RegExp(`\\bid=["']${escapeRegExp(elementId)}["']`).test(renderedHtml);
}

function checkStaticTemplateContracts(options = {}) {
    const rootDir = options.rootDir || DEFAULT_ROOT_DIR;
    const html = options.html ?? fs.readFileSync(options.indexPath || DEFAULT_INDEX_PATH, 'utf8');
    const placeholders = collectStaticTemplatePlaceholders(html);
    const errors = [];
    const validPlaceholders = [];

    placeholders.forEach((placeholder) => {
        if (placeholder.declaredIds.length === 0) {
            errors.push(`line ${placeholder.line}: data-template-ids must declare at least one id.`);
        }

        if (placeholder.matchedTemplateCount === 0) {
            errors.push(`line ${placeholder.line}: data-template-ids is present without a known static template marker.`);
            return;
        }

        if (placeholder.matchedTemplateCount > 1) {
            errors.push(
                `line ${placeholder.line}: data-template-ids is attached to multiple static template markers ` +
                `(${placeholder.knownTemplateMarkers.join(', ')}).`
            );
            return;
        }

        validPlaceholders.push(placeholder);
    });

    if (validPlaceholders.length > 0) {
        const targetsBySelector = new Map(
            STATIC_TEMPLATE_ATTRIBUTES.map(([, selector]) => [selector, []])
        );
        const targets = validPlaceholders.map((placeholder) => {
            const target = {
                dataset: { ...placeholder.dataset },
                renderedHtml: '',
                placeholder
            };
            targetsBySelector.get(placeholder.selector).push(target);
            return target;
        });

        const context = createTemplateRuntime(rootDir);
        context.renderStaticUiTemplates({
            querySelectorAll(selector) {
                return targetsBySelector.get(selector) || [];
            }
        });

        targets.forEach((target) => {
            const { placeholder } = target;

            if (target.dataset.hydrated !== 'true') {
                errors.push(`line ${placeholder.line}: ${placeholder.selector} was not marked hydrated.`);
            }

            placeholder.declaredIds.forEach((elementId) => {
                if (!renderedHtmlContainsId(target.renderedHtml, elementId)) {
                    errors.push(
                        `line ${placeholder.line}: ${placeholder.selector} declares "${elementId}" ` +
                        `but rendered HTML did not contain id="${elementId}".`
                    );
                }
            });
        });
    }

    return {
        ok: errors.length === 0,
        errors,
        placeholders
    };
}

function main() {
    const result = checkStaticTemplateContracts();

    if (!result.ok) {
        console.error('Static template contract check failed:');
        result.errors.forEach((error) => console.error(`- ${error}`));
        process.exit(1);
    }

    console.log(`Static template contract check passed (${result.placeholders.length} placeholders).`);
}

if (require.main === module) {
    main();
}

module.exports = {
    checkStaticTemplateContracts,
    collectStaticTemplatePlaceholders,
    dataNameToDatasetKey,
    parseAttributes
};
