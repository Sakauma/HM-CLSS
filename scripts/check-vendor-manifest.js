#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..');
const VENDOR_DIR = 'assets/vendor';
const VENDOR_README = 'assets/vendor/README.md';
const VENDOR_CHECKSUMS = 'scripts/smoke_manifest/vendor-checksums.txt';

function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
}

function readManifestLines(source) {
    return source
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
}

function parseVendorChecksums(source) {
    return readManifestLines(source).map((line) => {
        const match = line.match(/^([a-f0-9]{64})\s+(.+)$/i);
        if (!match) {
            return { hash: '', path: '', error: `Invalid vendor checksum row: ${line}` };
        }
        return {
            hash: match[1].toLowerCase(),
            path: normalizePath(match[2])
        };
    });
}

function parseVendorReadmeRows(source) {
    return source
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('| `'))
        .map((line) => {
            const cells = line
                .split('|')
                .slice(1, -1)
                .map((cell) => cell.trim());
            const fileMatch = cells[0]?.match(/^`([^`]+)`$/);
            const sourceMatch = cells[3]?.match(/^`([^`]+)`$/);
            return {
                file: fileMatch ? fileMatch[1] : '',
                packageName: cells[1] || '',
                version: cells[2] || '',
                source: sourceMatch ? sourceMatch[1] : '',
                raw: line
            };
        });
}

function checkVendorManifest(options = {}) {
    const rootDir = options.rootDir || DEFAULT_ROOT_DIR;
    const readSource = options.readSource || ((relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
    const listFiles = options.listFiles || ((relativeDir) => fs.readdirSync(path.join(rootDir, relativeDir), { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => `${normalizePath(relativeDir)}/${entry.name}`));
    const exists = options.exists || ((relativePath) => fs.existsSync(path.join(rootDir, relativePath)));
    const errors = [];

    const vendorFiles = listFiles(VENDOR_DIR)
        .map(normalizePath)
        .filter((filePath) => filePath !== VENDOR_README)
        .sort();
    const checksumRows = parseVendorChecksums(readSource(VENDOR_CHECKSUMS));
    const checksumPaths = new Set();
    checksumRows.forEach((row) => {
        if (row.error) {
            errors.push(row.error);
            return;
        }
        checksumPaths.add(row.path);
        if (!exists(row.path)) {
            errors.push(`${row.path} is listed in ${VENDOR_CHECKSUMS} but does not exist.`);
        }
    });

    const readmeRows = parseVendorReadmeRows(readSource(VENDOR_README));
    const readmePaths = new Set();
    readmeRows.forEach((row) => {
        const vendorPath = `${VENDOR_DIR}/${row.file}`;
        readmePaths.add(vendorPath);
        if (!row.file || !row.packageName || !row.version || !row.source) {
            errors.push(`${VENDOR_README} has an incomplete vendor row: ${row.raw}`);
        }
        if (!row.file.includes(row.version)) {
            errors.push(`${VENDOR_README} row for ${row.file} does not include its version in the filename.`);
        }
        if (!/^https:\/\//.test(row.source)) {
            errors.push(`${VENDOR_README} row for ${row.file} must use an https source URL.`);
        }
        if (!exists(vendorPath)) {
            errors.push(`${vendorPath} is documented in ${VENDOR_README} but does not exist.`);
        }
    });

    vendorFiles.forEach((filePath) => {
        if (!checksumPaths.has(filePath)) {
            errors.push(`${filePath} is missing from ${VENDOR_CHECKSUMS}.`);
        }
        if (!readmePaths.has(filePath)) {
            errors.push(`${filePath} is missing from ${VENDOR_README}.`);
        }
    });

    checksumPaths.forEach((filePath) => {
        if (!vendorFiles.includes(filePath)) {
            errors.push(`${filePath} is listed in ${VENDOR_CHECKSUMS} but is not a vendor asset file.`);
        }
    });
    readmePaths.forEach((filePath) => {
        if (!vendorFiles.includes(filePath)) {
            errors.push(`${filePath} is documented in ${VENDOR_README} but is not a vendor asset file.`);
        }
    });

    return {
        ok: errors.length === 0,
        errors,
        checkedFiles: vendorFiles.length
    };
}

function main() {
    const result = checkVendorManifest();

    if (!result.ok) {
        console.error('Vendor manifest check failed:');
        result.errors.forEach((error) => console.error(`- ${error}`));
        process.exit(1);
    }

    console.log(`Vendor manifest check passed (${result.checkedFiles} files).`);
}

if (require.main === module) {
    main();
}

module.exports = {
    checkVendorManifest,
    parseVendorChecksums,
    parseVendorReadmeRows
};
