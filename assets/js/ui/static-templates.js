/**
 * Static UI template hydration for zero-build HTML.
 * Keeps repeated ornamental structures out of index.html without owning business state.
 */

function joinTemplateClasses(...values) {
    return values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(' ');
}

function templateAttr(name, value) {
    if (!value) return '';
    return ` ${name}="${escapeHtml(value)}"`;
}

function createTavernWaveStackMarkup() {
    return `
        <div class="tavern-wave-stack" aria-hidden="true">
            <svg class="tavern-wave tavern-wave-back tavern-wave-fill-layer" viewBox="0 0 240 44" preserveAspectRatio="none">
                <path class="tavern-wave-fill" d="M0 25 C 34 12 78 10 118 16 C 164 23 204 31 240 24 L240 44 L0 44 Z"></path>
            </svg>
            <svg class="tavern-wave tavern-wave-front tavern-wave-fill-layer" viewBox="0 0 240 44" preserveAspectRatio="none">
                <path class="tavern-wave-fill" d="M0 20 C 44 7 96 10 138 19 C 178 27 212 24 240 18 L240 48 L0 48 Z"></path>
            </svg>
            <svg class="tavern-wave tavern-wave-back tavern-wave-line-layer" viewBox="0 0 240 44" preserveAspectRatio="none">
                <path class="tavern-wave-line tavern-wave-line-soft" d="M0 25 C 34 12 78 10 118 16 C 164 23 204 31 240 24"></path>
            </svg>
            <svg class="tavern-wave tavern-wave-front tavern-wave-line-layer" viewBox="0 0 240 44" preserveAspectRatio="none">
                <path class="tavern-wave-line" d="M0 20 C 44 7 96 10 138 19 C 178 27 212 24 240 18"></path>
            </svg>
        </div>
    `;
}

function createTavernVesselTemplateHtml(options = {}) {
    const wrapClass = joinTemplateClasses('tavern-vessel-wrap', options.wrapClass);
    const vesselClass = joinTemplateClasses('tavern-vessel', options.vesselClass);
    const liquidClass = joinTemplateClasses('tavern-liquid', options.liquidClass);
    const label = options.label || '';

    return `
        <div class="${wrapClass}">
            <div class="${vesselClass}">
                <div class="tavern-vessel-label"${templateAttr('id', options.labelId)}>${escapeHtml(label)}</div>
                <div${templateAttr('id', options.liquidId)} class="${liquidClass}">
                    ${createTavernWaveStackMarkup()}
                    <div${templateAttr('id', options.bubblesId)} class="tavern-bubbles">
                        <span></span><span></span><span></span><span></span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderTavernVesselTemplate(target, options = {}) {
    if (!target) return null;
    replaceElementChildrenWithTrustedHtml(target, createTrustedHtml(createTavernVesselTemplateHtml(options)));
    return target;
}

function createTavernSpectrumTemplateHtml(options = {}) {
    const dotId = options.dotId || '';
    const copyId = options.copyId || '';
    return `
        <div class="mb-2 flex justify-between text-[10px] font-mono uppercase tracking-[0.16em] text-slate-400">
            <span>${escapeHtml(options.leftLabel || '')}</span>
            <span>${escapeHtml(options.midLabel || '')}</span>
            <span>${escapeHtml(options.rightLabel || '')}</span>
        </div>
        <div class="tavern-spectrum-bar">
            <div${templateAttr('id', dotId)} class="tavern-spectrum-dot"></div>
        </div>
        <p${templateAttr('id', copyId)} class="mt-3 text-center text-xs leading-6 text-slate-500 dark:text-slate-400">
            ${escapeHtml(options.copy || '')}
        </p>
    `;
}

function renderTavernSpectrumTemplate(target, options = {}) {
    if (!target) return null;
    replaceElementChildrenWithTrustedHtml(target, createTrustedHtml(createTavernSpectrumTemplateHtml(options)));
    return target;
}

function createTavernStatTemplateHtml(options = {}) {
    const valueClass = joinTemplateClasses(
        options.valueClass || 'text-lg font-semibold text-slate-900 dark:text-slate-100'
    );

    return `
        <div class="text-[11px] font-mono uppercase tracking-[0.16em] text-slate-400">${escapeHtml(options.label || '')}</div>
        <div${templateAttr('id', options.valueId)} class="mt-3 ${valueClass}">${escapeHtml(options.value || '')}</div>
    `;
}

function renderTavernStatTemplate(target, options = {}) {
    if (!target) return null;
    replaceElementChildrenWithTrustedHtml(target, createTrustedHtml(createTavernStatTemplateHtml(options)));
    return target;
}

function createShiftCardTemplateHtml(options = {}) {
    const period = options.period || '';
    const checkinId = period ? `${period}-checkin` : '';
    const checkoutId = period ? `${period}-checkout` : '';
    const checkinTimeId = period ? `${period}-checkin-time` : '';
    const checkoutTimeId = period ? `${period}-checkout-time` : '';

    return `
        <div class="mb-4 flex items-start justify-between gap-4">
            <div>
                <div class="module-eyebrow mb-2">${escapeHtml(options.eyebrow || '')}</div>
                <h3 class="text-xl font-bold text-slate-950 dark:text-slate-50">${escapeHtml(options.title || '')}</h3>
                <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">${escapeHtml(options.copy || '')}</p>
            </div>
            <span class="shift-window">${escapeHtml(options.window || '')}</span>
        </div>

        <div class="mb-5 grid grid-cols-2 gap-3 text-sm">
            <div class="metric-card">
                <span class="metric-label">${escapeHtml(options.primaryLabel || '')}</span>
                <span class="mt-2 block text-base font-extrabold text-slate-950 dark:text-slate-50">${escapeHtml(options.primaryValue || '')}</span>
            </div>
            <div class="metric-card">
                <span class="metric-label">${escapeHtml(options.secondaryLabel || '')}</span>
                <span class="mt-2 block text-base font-extrabold text-slate-950 dark:text-slate-50">${escapeHtml(options.secondaryValue || '')}</span>
            </div>
        </div>

        <div class="space-y-3">
            <button${templateAttr('id', checkinId)} class="action-btn action-btn-primary">${escapeHtml(options.checkinLabel || '')}</button>
            <button${templateAttr('id', checkoutId)} class="action-btn action-btn-disabled" disabled>${escapeHtml(options.checkoutLabel || '')}</button>
        </div>

        <div class="mt-4 flex justify-between gap-4 text-xs font-mono text-slate-400">
            <span${templateAttr('id', checkinTimeId)}>${escapeHtml(options.checkinTime || '')}</span>
            <span${templateAttr('id', checkoutTimeId)}>${escapeHtml(options.checkoutTime || '')}</span>
        </div>
    `;
}

function renderShiftCardTemplate(target, options = {}) {
    if (!target) return null;
    replaceElementChildrenWithTrustedHtml(target, createTrustedHtml(createShiftCardTemplateHtml(options)));
    return target;
}

function createCheckinTableRowTemplateHtml(options = {}) {
    const period = options.period || '';
    const checkinId = period ? `table-${period}-checkin` : '';
    const checkoutId = period ? `table-${period}-checkout` : '';
    const checkinStatusId = period ? `table-${period}-checkin-status` : '';
    const checkoutStatusId = period ? `table-${period}-checkout-status` : '';

    return `
        <td class="py-3 px-4 font-medium">${escapeHtml(options.label || '')}</td>
        <td class="py-3 px-4 font-mono text-slate-500"${templateAttr('id', checkinId)}>-</td>
        <td class="py-3 px-4 font-mono text-slate-500"${templateAttr('id', checkoutId)}>-</td>
        <td class="py-3 px-4"${templateAttr('id', checkinStatusId)}>-</td>
        <td class="py-3 px-4"${templateAttr('id', checkoutStatusId)}>-</td>
    `;
}

function renderCheckinTableRowTemplate(target, options = {}) {
    if (!target) return null;
    replaceElementChildrenWithTrustedHtml(target, createTrustedHtml(createCheckinTableRowTemplateHtml(options)));
    return target;
}

function createMetricCardTemplateHtml(options = {}) {
    const valueClass = joinTemplateClasses('metric-value', options.valueClass);
    const hintClass = joinTemplateClasses(options.hintClass || 'metric-hint');
    const hintHtml = options.hint || options.hintId
        ? `<p${templateAttr('id', options.hintId)} class="${escapeHtml(hintClass)}">${escapeHtml(options.hint || '')}</p>`
        : '';

    return `
        <span${templateAttr('id', options.labelId)} class="metric-label">${escapeHtml(options.label || '')}</span>
        <span${templateAttr('id', options.valueId)} class="${escapeHtml(valueClass)}">${escapeHtml(options.value || '')}</span>
        ${hintHtml}
    `;
}

function renderMetricCardTemplate(target, options = {}) {
    if (!target) return null;
    replaceElementChildrenWithTrustedHtml(target, createTrustedHtml(createMetricCardTemplateHtml(options)));
    return target;
}

const STATIC_TEMPLATE_RENDERERS = Object.freeze([
    ['[data-tavern-vessel-template]', renderTavernVesselTemplate],
    ['[data-tavern-spectrum-template]', renderTavernSpectrumTemplate],
    ['[data-tavern-stat-template]', renderTavernStatTemplate],
    ['[data-shift-card-template]', renderShiftCardTemplate],
    ['[data-checkin-table-row-template]', renderCheckinTableRowTemplate],
    ['[data-metric-card-template]', renderMetricCardTemplate]
]);

function markStaticTemplateHydrated(target) {
    if (target?.dataset) {
        target.dataset.hydrated = 'true';
    }
}

function shouldHydrateStaticTemplate(target) {
    return target?.dataset?.hydrated !== 'true';
}

function renderStaticUiTemplates(root = document) {
    if (!root?.querySelectorAll) return false;

    STATIC_TEMPLATE_RENDERERS.forEach(([selector, renderer]) => {
        root.querySelectorAll(selector).forEach((target) => {
            if (!shouldHydrateStaticTemplate(target)) return;
            renderer(target, target.dataset);
            markStaticTemplateHydrated(target);
        });
    });

    return true;
}

registerAppModule({
    id: 'ui/static-templates',
    order: 5,
    dependsOn: ['module-registry', 'runtime/dom-utils'],
    init() {
        renderStaticUiTemplates();
    }
});
