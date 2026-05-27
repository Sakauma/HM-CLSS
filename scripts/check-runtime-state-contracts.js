#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..');
const STATE_KEYS = Object.freeze([
    'checkinData',
    'phoneResistData',
    'taskData',
    'leaveData',
    'achievements',
    'currentTask',
    'taskTimer',
    'quickNotesData',
    'tavernData',
    'currentDrinkInfo',
    'ambientPreferences',
    'checkinPreferences',
    'selectedEmotions'
]);
const STATE_KEY_PATTERN = STATE_KEYS.join('|');
const STORE_MODULE_PATH = 'assets/js/runtime/store.js';
const RUNTIME_WRITE_HELPERS = Object.freeze([
    'setRuntimeValue',
    'updateRuntimeValue',
    'patchRuntimeValue',
    'appendRuntimeItem',
    'prependRuntimeItem',
    'mapRuntimeItems',
    'filterRuntimeItems',
    'updateRuntimeObjectEntry',
    'removeRuntimeObjectEntry'
]);

function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
}

function collectJavaScriptFiles(rootDir, currentDir = path.join(rootDir, 'assets', 'js')) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    const files = [];

    entries.forEach((entry) => {
        const absolutePath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectJavaScriptFiles(rootDir, absolutePath));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(normalizePath(path.relative(rootDir, absolutePath)));
        }
    });

    return files.sort();
}

function stripCommentsAndStrings(source) {
    let output = '';
    let quote = '';
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    let templateLiteral = false;
    const templateExpressionStack = [];

    function appendSanitized(char) {
        output += char === '\n' ? '\n' : ' ';
    }

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];
        const nextChar = source[index + 1];

        if (lineComment) {
            if (char === '\n') {
                lineComment = false;
                output += char;
            } else {
                output += ' ';
            }
            continue;
        }

        if (blockComment) {
            if (char === '*' && nextChar === '/') {
                blockComment = false;
                output += '  ';
                index += 1;
            } else {
                output += char === '\n' ? '\n' : ' ';
            }
            continue;
        }

        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === quote) {
                quote = '';
            }
            appendSanitized(char);
            continue;
        }

        if (templateLiteral) {
            if (escaped) {
                escaped = false;
                appendSanitized(char);
                continue;
            }
            if (char === '\\') {
                escaped = true;
                appendSanitized(char);
                continue;
            }
            if (char === '`') {
                templateLiteral = false;
                appendSanitized(char);
                continue;
            }
            if (char === '$' && nextChar === '{') {
                templateExpressionStack.push({ braceDepth: 1 });
                templateLiteral = false;
                output += '  ';
                index += 1;
                continue;
            }
            appendSanitized(char);
            continue;
        }

        if (char === '/' && nextChar === '/') {
            lineComment = true;
            output += '  ';
            index += 1;
            continue;
        }
        if (char === '/' && nextChar === '*') {
            blockComment = true;
            output += '  ';
            index += 1;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            output += ' ';
            continue;
        }
        if (char === '`') {
            templateLiteral = true;
            output += ' ';
            continue;
        }

        const activeTemplateExpression = templateExpressionStack[templateExpressionStack.length - 1];
        if (activeTemplateExpression && char === '{') {
            activeTemplateExpression.braceDepth += 1;
            output += char;
            continue;
        }
        if (activeTemplateExpression && char === '}') {
            activeTemplateExpression.braceDepth -= 1;
            if (activeTemplateExpression.braceDepth === 0) {
                templateExpressionStack.pop();
                templateLiteral = true;
                output += ' ';
                continue;
            }
            output += char;
            continue;
        }

        output += char;
    }

    return output;
}

function getLineNumber(source, index) {
    return source.slice(0, index).split(/\r?\n/).length;
}

function getLinePrefix(source, index) {
    const lineStart = Math.max(source.lastIndexOf('\n', index - 1) + 1, 0);
    return source.slice(lineStart, index);
}

function isDeclarationAssignment(source, index) {
    return /\b(?:const|let|var)\s+$/.test(getLinePrefix(source, index));
}

function findMatches(source, pattern) {
    const matches = [];
    pattern.lastIndex = 0;
    let match = pattern.exec(source);

    while (match) {
        matches.push({
            index: match.index,
            text: match[0],
            key: match.slice(1).find(Boolean)
        });
        match = pattern.exec(source);
    }

    return matches;
}

function checkRuntimeStateContracts(options = {}) {
    const rootDir = options.rootDir || DEFAULT_ROOT_DIR;
    const scriptPaths = (options.scriptPaths || collectJavaScriptFiles(rootDir)).map(normalizePath);
    const readSource = options.readSource || ((scriptPath) => fs.readFileSync(path.join(rootDir, scriptPath), 'utf8'));
    const errors = [];
    const stateBracketAccess = '\\[[^\\]]+\\]';
    const statePropertyAccess = '\\.\\s*[A-Za-z_$][\\w$]*';
    const stateAccessChain = `\\b(${STATE_KEY_PATTERN})(?:\\s*(?:${stateBracketAccess}|${statePropertyAccess}))+`;
    const directStateWritePattern = new RegExp(
        `${stateAccessChain}\\s*(?:=(?!=|>)|[+\\-*/%&|^]=|&&=|\\|\\|=|\\?\\?=)`,
        'g'
    );
    const directStateMutationPattern = new RegExp(
        `\\b(${STATE_KEY_PATTERN})(?:\\s*(?:${stateBracketAccess}|${statePropertyAccess}))*\\s*\\.\\s*(push|pop|splice|shift|unshift|sort|reverse)\\s*\\(`,
        'g'
    );
    const directStateUpdatePattern = new RegExp(
        `(?:\\+\\+|--)\\s*${stateAccessChain}|${stateAccessChain}\\s*(?:\\+\\+|--)`,
        'g'
    );
    const directStateDeletePattern = new RegExp(`\\bdelete\\s+${stateAccessChain}`, 'g');
    const bareStateAssignmentPattern = new RegExp(`\\b(${STATE_KEY_PATTERN})\\s*=(?!=|>)`, 'g');
    const runtimeWriteHelperPattern = new RegExp(`\\b(${RUNTIME_WRITE_HELPERS.join('|')})\\s*\\(`, 'g');

    scriptPaths.forEach((scriptPath) => {
        const source = readSource(scriptPath);
        const sanitizedSource = stripCommentsAndStrings(source);

        if (scriptPath !== STORE_MODULE_PATH) {
            findMatches(sanitizedSource, runtimeWriteHelperPattern).forEach((match) => {
                errors.push(`${scriptPath}:${getLineNumber(sanitizedSource, match.index)} uses ${match.key}() outside ${STORE_MODULE_PATH}; use runtimeActions instead.`);
            });

            findMatches(sanitizedSource, directStateWritePattern).forEach((match) => {
                errors.push(`${scriptPath}:${getLineNumber(sanitizedSource, match.index)} writes ${match.key} directly; use runtimeActions instead.`);
            });

            findMatches(sanitizedSource, directStateMutationPattern).forEach((match) => {
                errors.push(`${scriptPath}:${getLineNumber(sanitizedSource, match.index)} mutates ${match.key} in place; use runtimeActions instead.`);
            });

            findMatches(sanitizedSource, directStateUpdatePattern).forEach((match) => {
                errors.push(`${scriptPath}:${getLineNumber(sanitizedSource, match.index)} updates ${match.key} directly; use runtimeActions instead.`);
            });

            findMatches(sanitizedSource, directStateDeletePattern).forEach((match) => {
                errors.push(`${scriptPath}:${getLineNumber(sanitizedSource, match.index)} deletes from ${match.key} directly; use runtimeActions instead.`);
            });

            findMatches(sanitizedSource, bareStateAssignmentPattern)
                .filter((match) => !isDeclarationAssignment(sanitizedSource, match.index))
                .forEach((match) => {
                    errors.push(`${scriptPath}:${getLineNumber(sanitizedSource, match.index)} assigns ${match.key} directly; use runtimeActions instead.`);
                });
        }
    });

    return {
        ok: errors.length === 0,
        errors,
        checkedFiles: scriptPaths.length
    };
}

function main() {
    const result = checkRuntimeStateContracts();

    if (!result.ok) {
        console.error('Runtime state contract check failed:');
        result.errors.forEach((error) => console.error(`- ${error}`));
        process.exit(1);
    }

    console.log(`Runtime state contract check passed (${result.checkedFiles} files).`);
}

if (require.main === module) {
    main();
}

module.exports = {
    RUNTIME_WRITE_HELPERS,
    STATE_KEYS,
    checkRuntimeStateContracts,
    stripCommentsAndStrings
};
