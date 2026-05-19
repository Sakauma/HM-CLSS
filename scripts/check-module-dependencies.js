#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const scriptOrderPath = path.join(rootDir, 'scripts', 'smoke_manifest', 'script-order.txt');

function readManifest(filePath) {
    return fs.readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
}

function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
}

function addAlias(aliasMap, collisions, alias, scriptPath) {
    if (!alias || collisions.has(alias)) return;
    const existing = aliasMap.get(alias);
    if (existing && existing !== scriptPath) {
        aliasMap.delete(alias);
        collisions.add(alias);
        return;
    }
    aliasMap.set(alias, scriptPath);
}

function buildAliasMap(scriptPaths, moduleDefinitions) {
    const aliasMap = new Map();
    const collisions = new Set();
    const basenameCounts = new Map();

    scriptPaths.forEach((scriptPath) => {
        const basename = path.posix.basename(scriptPath, '.js');
        basenameCounts.set(basename, (basenameCounts.get(basename) || 0) + 1);
    });

    scriptPaths.forEach((scriptPath) => {
        if (!scriptPath.endsWith('.js')) return;

        const withoutExtension = scriptPath.slice(0, -3);
        const withoutAssetsPrefix = withoutExtension.replace(/^assets\/js\//, '');
        addAlias(aliasMap, collisions, scriptPath, scriptPath);
        addAlias(aliasMap, collisions, withoutExtension, scriptPath);
        addAlias(aliasMap, collisions, withoutAssetsPrefix, scriptPath);

        const basename = path.posix.basename(scriptPath, '.js');
        if (basenameCounts.get(basename) === 1) {
            addAlias(aliasMap, collisions, basename, scriptPath);
        }

        const featureMatch = withoutAssetsPrefix.match(/^features\/([^/]+)\/(.+)$/);
        if (featureMatch) {
            addAlias(aliasMap, collisions, `${featureMatch[1]}/${featureMatch[2]}`, scriptPath);
            if (featureMatch[2] === 'index') {
                addAlias(aliasMap, collisions, featureMatch[1], scriptPath);
            }
        }
    });

    moduleDefinitions.forEach((definition) => {
        addAlias(aliasMap, collisions, definition.id, definition.scriptPath);
    });

    return aliasMap;
}

function findRegisterAppModuleObjects(source) {
    const objects = [];
    let searchIndex = 0;

    while (searchIndex < source.length) {
        const callIndex = source.indexOf('registerAppModule', searchIndex);
        if (callIndex === -1) break;

        const parenIndex = source.indexOf('(', callIndex + 'registerAppModule'.length);
        if (parenIndex === -1) break;

        let objectStart = parenIndex + 1;
        while (/\s/.test(source[objectStart])) objectStart += 1;
        if (source[objectStart] !== '{') {
            searchIndex = parenIndex + 1;
            continue;
        }

        let depth = 0;
        let quote = '';
        let escaped = false;
        let lineComment = false;
        let blockComment = false;

        for (let index = objectStart; index < source.length; index += 1) {
            const char = source[index];
            const nextChar = source[index + 1];

            if (lineComment) {
                if (char === '\n') lineComment = false;
                continue;
            }

            if (blockComment) {
                if (char === '*' && nextChar === '/') {
                    blockComment = false;
                    index += 1;
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
                continue;
            }

            if (char === '/' && nextChar === '/') {
                lineComment = true;
                index += 1;
                continue;
            }
            if (char === '/' && nextChar === '*') {
                blockComment = true;
                index += 1;
                continue;
            }
            if (char === '"' || char === "'" || char === '`') {
                quote = char;
                continue;
            }
            if (char === '{') {
                depth += 1;
            } else if (char === '}') {
                depth -= 1;
                if (depth === 0) {
                    objects.push(source.slice(objectStart, index + 1));
                    searchIndex = index + 1;
                    break;
                }
            }
        }

        if (searchIndex <= callIndex) break;
    }

    return objects;
}

function parseStringProperty(objectSource, propertyName) {
    const match = objectSource.match(new RegExp(`${propertyName}\\s*:\\s*(['"\`])([\\s\\S]*?)\\1`));
    return match ? match[2] : null;
}

function parseDependsOn(objectSource) {
    const match = objectSource.match(/dependsOn\s*:\s*\[([\s\S]*?)\]/);
    if (!match) return [];

    const dependencies = [];
    const stringPattern = /(['"`])([\s\S]*?)\1/g;
    let stringMatch = stringPattern.exec(match[1]);
    while (stringMatch) {
        dependencies.push(stringMatch[2]);
        stringMatch = stringPattern.exec(match[1]);
    }
    return dependencies;
}

function collectModuleDefinitions(scriptPaths) {
    const definitions = [];

    scriptPaths.forEach((scriptPath) => {
        if (!scriptPath.startsWith('assets/js/') || !scriptPath.endsWith('.js')) return;
        const absolutePath = path.join(rootDir, scriptPath);
        const source = fs.readFileSync(absolutePath, 'utf8');

        findRegisterAppModuleObjects(source).forEach((objectSource) => {
            const id = parseStringProperty(objectSource, 'id');
            if (!id) {
                throw new Error(`${scriptPath} contains registerAppModule without a literal id.`);
            }
            definitions.push({
                id,
                dependsOn: parseDependsOn(objectSource),
                scriptPath
            });
        });
    });

    return definitions;
}

function main() {
    const scriptPaths = readManifest(scriptOrderPath).map(normalizePath);
    const scriptIndexByPath = new Map(scriptPaths.map((scriptPath, index) => [scriptPath, index]));
    const moduleDefinitions = collectModuleDefinitions(scriptPaths);
    const aliasMap = buildAliasMap(scriptPaths, moduleDefinitions);
    const errors = [];

    moduleDefinitions.forEach((definition) => {
        const moduleScriptIndex = scriptIndexByPath.get(definition.scriptPath);
        if (moduleScriptIndex === undefined) {
            errors.push(`${definition.id} is registered in ${definition.scriptPath}, but that script is missing from script-order.txt.`);
            return;
        }

        definition.dependsOn.forEach((dependencyId) => {
            const dependencyPath = aliasMap.get(dependencyId);
            if (!dependencyPath) {
                errors.push(`${definition.id} declares unknown dependsOn entry "${dependencyId}".`);
                return;
            }

            if (dependencyPath === definition.scriptPath || dependencyId === definition.id) {
                errors.push(`${definition.id} cannot depend on itself via "${dependencyId}".`);
                return;
            }

            const dependencyScriptIndex = scriptIndexByPath.get(dependencyPath);
            if (dependencyScriptIndex === undefined) {
                errors.push(`${definition.id} depends on "${dependencyId}", but ${dependencyPath} is missing from script-order.txt.`);
                return;
            }

            if (dependencyScriptIndex >= moduleScriptIndex) {
                errors.push(
                    `${definition.id} depends on "${dependencyId}", but ${dependencyPath} loads at position ${dependencyScriptIndex + 1} ` +
                    `and ${definition.scriptPath} loads at position ${moduleScriptIndex + 1}.`
                );
            }
        });
    });

    if (errors.length > 0) {
        console.error('Module dependency check failed:');
        errors.forEach((error) => console.error(`- ${error}`));
        process.exit(1);
    }

    console.log(`Module dependency check passed (${moduleDefinitions.length} modules).`);
}

main();
