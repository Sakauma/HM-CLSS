const assert = require('node:assert/strict');
const test = require('node:test');

const { ROOT_DIR } = require('./helpers');

const {
    checkVendorManifest,
    parseVendorChecksums,
    parseVendorReadmeRows
} = require('../../scripts/check-vendor-manifest');

test('vendor manifest checker validates real vendor inventory', () => {
    const result = checkVendorManifest({ rootDir: ROOT_DIR });

    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.checkedFiles, 5);
});

test('vendor manifest checker catches missing checksum and README rows', () => {
    const sources = {
        'scripts/smoke_manifest/vendor-checksums.txt': 'a'.repeat(64) + ' assets/vendor/known-1.0.0.js\n',
        'assets/vendor/README.md': [
            '| File | Package | Version | Source |',
            '| --- | --- | --- | --- |',
            '| `known-1.0.0.js` | Known | 1.0.0 | `https://example.test/known.js` |'
        ].join('\n')
    };

    const result = checkVendorManifest({
        rootDir: ROOT_DIR,
        exists(relativePath) {
            return [
                'assets/vendor/known-1.0.0.js',
                'assets/vendor/missing-2.0.0.js'
            ].includes(relativePath);
        },
        listFiles() {
            return [
                'assets/vendor/known-1.0.0.js',
                'assets/vendor/missing-2.0.0.js',
                'assets/vendor/README.md'
            ];
        },
        readSource(relativePath) {
            return sources[relativePath] || '';
        }
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /assets\/vendor\/missing-2\.0\.0\.js is missing from scripts\/smoke_manifest\/vendor-checksums\.txt/);
    assert.match(result.errors.join('\n'), /assets\/vendor\/missing-2\.0\.0\.js is missing from assets\/vendor\/README\.md/);
});

test('vendor manifest checker catches incomplete and unsafe README rows', () => {
    const result = checkVendorManifest({
        rootDir: ROOT_DIR,
        exists() {
            return true;
        },
        listFiles() {
            return ['assets/vendor/pkg-1.0.0.js'];
        },
        readSource(relativePath) {
            if (relativePath === 'scripts/smoke_manifest/vendor-checksums.txt') {
                return `${'b'.repeat(64)} assets/vendor/pkg-1.0.0.js\n`;
            }
            return [
                '| File | Package | Version | Source |',
                '| --- | --- | --- | --- |',
                '| `pkg.js` | Pkg | 1.0.0 | `http://example.test/pkg.js` |'
            ].join('\n');
        }
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /does not include its version in the filename/);
    assert.match(result.errors.join('\n'), /must use an https source URL/);
});

test('vendor parsers ignore blanks and comments', () => {
    assert.deepEqual(parseVendorChecksums('\n# comment\n' + 'c'.repeat(64) + ' assets/vendor/pkg-1.0.0.js\n'), [
        { hash: 'c'.repeat(64), path: 'assets/vendor/pkg-1.0.0.js' }
    ]);

    assert.deepEqual(parseVendorReadmeRows('| `pkg-1.0.0.js` | Pkg | 1.0.0 | `https://example.test/pkg.js` |\n'), [
        {
            file: 'pkg-1.0.0.js',
            packageName: 'Pkg',
            version: '1.0.0',
            source: 'https://example.test/pkg.js',
            raw: '| `pkg-1.0.0.js` | Pkg | 1.0.0 | `https://example.test/pkg.js` |'
        }
    ]);
});
