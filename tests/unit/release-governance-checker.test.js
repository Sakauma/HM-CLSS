const assert = require('node:assert/strict');
const test = require('node:test');

const {
    ROOT_DIR
} = require('./helpers');

const {
    GOVERNANCE_DOCS,
    checkReleaseGovernance,
    readManifestEntries
} = require('../../scripts/check-release-governance');

test('release governance checker validates real governance docs', () => {
    const result = checkReleaseGovernance({ rootDir: ROOT_DIR });

    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.checkedDocs, GOVERNANCE_DOCS.length);
});

test('release governance checker catches missing manifest and README references', () => {
    const sources = {
        'README.md': 'See SECURITY.md',
        'scripts/smoke_manifest/required-docs.txt': 'SECURITY.md\n'
    };
    GOVERNANCE_DOCS.forEach((doc) => {
        sources[doc.path] = [
            `# ${doc.path}`,
            ...doc.requiredHeadings.map((heading) => `## ${heading}`),
            ...doc.requiredTerms
        ].join('\n');
    });

    const result = checkReleaseGovernance({
        rootDir: ROOT_DIR,
        exists: () => true,
        readSource(relativePath) {
            return sources[relativePath] || '';
        }
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /CONTRIBUTING\.md is missing from scripts\/smoke_manifest\/required-docs\.txt/);
    assert.match(result.errors.join('\n'), /README\.md does not reference CONTRIBUTING\.md/);
});

test('release governance checker catches missing required sections', () => {
    const sources = {
        'README.md': GOVERNANCE_DOCS.map((doc) => doc.path).join('\n'),
        'scripts/smoke_manifest/required-docs.txt': GOVERNANCE_DOCS.map((doc) => doc.path).join('\n')
    };
    GOVERNANCE_DOCS.forEach((doc) => {
        sources[doc.path] = '# Thin doc\n';
    });

    const result = checkReleaseGovernance({
        rootDir: ROOT_DIR,
        exists: () => true,
        readSource(relativePath) {
            return sources[relativePath] || '';
        }
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /SECURITY\.md is missing heading "Supported Versions"/);
    assert.match(result.errors.join('\n'), /docs\/data-compatibility\.md is missing required term "CURRENT_STORAGE_SCHEMA_VERSION"/);
});

test('readManifestEntries ignores blanks and comments', () => {
    assert.deepEqual(readManifestEntries('\n# comment\nREADME.md\r\n\nSECURITY.md\n'), [
        'README.md',
        'SECURITY.md'
    ]);
});
