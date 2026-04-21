/**
 * 运行时 DOM 工具。
 * 负责轻量节点构建、图标标签封装和旧记录字段兼容。
 */

/**
 * 对动态插入到 HTML 中的文本做最小转义，避免渲染层注入风险。
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
    const normalized = value == null ? '' : String(value);
    return normalized.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

/**
 * 创建轻量 DOM 节点，便于列表和卡片渲染摆脱大段字符串拼接。
 * @param {string} tagName
 * @param {{ className?: string, text?: string, attrs?: Record<string, unknown> }} [options]
 * @returns {HTMLElement}
 */
function createDomElement(tagName, options = {}) {
    const { className = '', text, attrs = {} } = options;
    const element = document.createElement(tagName);

    if (className) {
        element.className = className;
    }

    if (text != null) {
        element.textContent = String(text);
    }

    Object.entries(attrs).forEach(([key, value]) => {
        if (value == null) return;
        element.setAttribute(key, String(value));
    });

    return element;
}

function createDisposables() {
    const disposers = [];

    return {
        add(disposer) {
            if (typeof disposer === 'function') {
                disposers.push(disposer);
            }
            return disposer;
        },
        listen(target, type, listener, options) {
            if (!target?.addEventListener || typeof listener !== 'function') {
                return () => {};
            }

            target.addEventListener(type, listener, options);
            const dispose = () => {
                if (typeof target.removeEventListener === 'function') {
                    target.removeEventListener(type, listener, options);
                }
            };
            disposers.push(dispose);
            return dispose;
        },
        dispose() {
            while (disposers.length) {
                const dispose = disposers.pop();
                try {
                    dispose();
                } catch (error) {
                    console.error('Disposer execution failed:', error);
                }
            }
        }
    };
}

function createTrustedHtml(html) {
    return Object.freeze({
        __hmTrustedHtml: true,
        value: String(html ?? '')
    });
}

function createTrustedHtmlFragment(trustedHtml) {
    if (!trustedHtml || trustedHtml.__hmTrustedHtml !== true) {
        throw new Error('createTrustedHtmlFragment requires createTrustedHtml() input.');
    }
    const template = document.createElement('template');
    template.innerHTML = trustedHtml.value;
    return template.content.cloneNode(true);
}

function replaceElementChildrenWithTrustedHtml(element, trustedHtml) {
    if (!element) return element;
    element.replaceChildren(createTrustedHtmlFragment(trustedHtml));
    return element;
}

/**
 * 向父节点按顺序挂载一组子节点，并自动跳过空值。
 * @param {HTMLElement | DocumentFragment} parent
 * @param {Array<Node | null | undefined | false>} children
 * @returns {HTMLElement | DocumentFragment}
 */
function appendDomChildren(parent, children) {
    children.forEach((child) => {
        if (child) {
            parent.appendChild(child);
        }
    });
    return parent;
}

function cloneChildNodesSnapshot(element) {
    if (!element) return [];
    return Array.from(element.childNodes).map((node) => node.cloneNode(true));
}

function restoreChildNodesSnapshot(element, snapshot = []) {
    if (!element) return;
    element.replaceChildren(...snapshot.map((node) => node.cloneNode(true)));
}

function createLucideIconElement(icon, className = '') {
    return createDomElement('i', {
        className,
        attrs: { 'data-lucide': icon }
    });
}

function setElementIconLabel(element, icon, label, options = {}) {
    if (!element) return;

    const {
        iconClass = 'w-4 h-4',
        labelClass = ''
    } = options;

    const fragment = document.createDocumentFragment();
    fragment.appendChild(createLucideIconElement(icon, iconClass));
    fragment.appendChild(createDomElement('span', {
        className: labelClass,
        text: label
    }));
    element.replaceChildren(fragment);
}

function setElementBadgeLabel(element, badgeText, label, options = {}) {
    if (!element) return;

    const {
        badgeClass = '',
        labelClass = ''
    } = options;

    const fragment = document.createDocumentFragment();
    if (badgeText) {
        fragment.appendChild(createDomElement('span', {
            className: badgeClass,
            text: badgeText
        }));
    }

    if (labelClass) {
        fragment.appendChild(createDomElement('span', {
            className: labelClass,
            text: label
        }));
    } else {
        fragment.appendChild(document.createTextNode(String(label)));
    }

    element.replaceChildren(fragment);
}

/**
 * 兼容旧结构的速记记录，稳定地读取文本内容。
 * @param {object} note
 * @returns {string}
 */
function getNoteText(note) {
    return note && typeof note.text === 'string' ? note.text : '';
}

/**
 * 兼容旧结构的速记记录，稳定地读取时间字段。
 * @param {object} note
 * @returns {string}
 */
function getNoteTime(note) {
    return note && typeof note.time === 'string' ? note.time : '--:--';
}
