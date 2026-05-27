#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..');
const REQUIRED_DOCS_MANIFEST = 'scripts/smoke_manifest/required-docs.txt';

const GOVERNANCE_DOCS = Object.freeze([
    {
        path: 'SECURITY.md',
        requiredHeadings: [
            'Supported Versions',
            'Sensitive Data Rules',
            'Reporting a Vulnerability',
            'Security Review Checklist',
            'Dependency and Vendor Updates'
        ],
        requiredTerms: ['sessionStorage', 'githubToken', 'vendor-checksums.txt']
    },
    {
        path: 'CONTRIBUTING.md',
        requiredHeadings: [
            'Development Setup',
            'Branch and Commit Style',
            'Code Guidelines',
            'Testing Expectations',
            'Pull Request Checklist'
        ],
        requiredTerms: ['runtimeActions', 'smoke-check.sh', 'browser-smoke.sh']
    },
    {
        path: 'CHANGELOG.md',
        requiredHeadings: ['Unreleased', 'Added', 'Changed', 'Verified'],
        requiredTerms: ['Release Note Template']
    },
    {
        path: 'docs/release-checklist.md',
        requiredHeadings: ['Scope', 'Automated Gates', 'Manual Product Check', 'Data Safety', 'Rollback'],
        requiredTerms: ['functional-self-check.md', 'CURRENT_STORAGE_SCHEMA_VERSION']
    },
    {
        path: 'docs/release-validation.md',
        requiredHeadings: ['Scope', 'Automated Evidence', 'Functional Self-Check Mapping', 'Residual Release Notes'],
        requiredTerms: ['smoke-check.sh', 'browser-smoke.sh', 'Vendor manifest check passed', '83 tests passed']
    },
    {
        path: 'docs/troubleshooting.md',
        requiredHeadings: [
            'Browser Smoke Failures',
            'Local Data Looks Corrupted',
            'Sync Fails',
            'Export Fails or Looks Wrong',
            'UI or Layout Regression',
            'Vendor Checksum Failure'
        ],
        requiredTerms: ['.artifacts/browser-smoke', 'githubToken', 'vendor-checksums.txt']
    },
    {
        path: 'docs/browser-support.md',
        requiredHeadings: ['Support Levels', 'Required Capabilities', 'Release Expectation', 'Known Automation Gap'],
        requiredTerms: ['Firefox', 'Chromium', 'Safari']
    },
    {
        path: 'docs/data-compatibility.md',
        requiredHeadings: ['Current Schema', 'Compatibility Principles', 'Schema Change Checklist', 'Manual Recovery'],
        requiredTerms: ['CURRENT_STORAGE_SCHEMA_VERSION', 'runtimeActions', 'pre-apply backup']
    },
    {
        path: 'docs/vendor-review.md',
        requiredHeadings: ['Current Inventory', 'Review Cadence', 'Online Sources', 'Upgrade Decision Rules', 'Review Evidence', 'Local Gates'],
        requiredTerms: ['check-vendor-manifest.js', 'DOMPurify', 'marked']
    },
    {
        path: 'docs/commercial-readiness-audit.md',
        requiredHeadings: ['目标口径', '当前基线', '已验证证据', '仍需推进的商业级缺口'],
        requiredTerms: ['smoke-check.sh', 'browser-smoke.sh']
    }
]);

function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
}

function readManifestEntries(source) {
    return source
        .split(/\r?\n/)
        .map((line) => line.replace(/\r$/, '').trim())
        .filter((line) => line && !line.startsWith('#'));
}

function hasHeading(source, heading) {
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^#{1,6}\\s+(?:\\d+\\.\\s+)?${escapedHeading}\\s*$`, 'mi').test(source);
}

function defaultReadSource(rootDir, relativePath) {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function defaultExists(rootDir, relativePath) {
    return fs.existsSync(path.join(rootDir, relativePath));
}

function checkReleaseGovernance(options = {}) {
    const rootDir = options.rootDir || DEFAULT_ROOT_DIR;
    const readSource = options.readSource || ((relativePath) => defaultReadSource(rootDir, relativePath));
    const exists = options.exists || ((relativePath) => defaultExists(rootDir, relativePath));
    const errors = [];
    const manifestPath = options.manifestPath || REQUIRED_DOCS_MANIFEST;
    const manifestEntries = new Set(readManifestEntries(readSource(manifestPath)).map(normalizePath));

    GOVERNANCE_DOCS.forEach((doc) => {
        const docPath = normalizePath(doc.path);
        if (!exists(docPath)) {
            errors.push(`${docPath} is missing.`);
            return;
        }

        if (!manifestEntries.has(docPath)) {
            errors.push(`${docPath} is missing from ${manifestPath}.`);
        }

        const source = readSource(docPath);
        doc.requiredHeadings.forEach((heading) => {
            if (!hasHeading(source, heading)) {
                errors.push(`${docPath} is missing heading "${heading}".`);
            }
        });
        doc.requiredTerms.forEach((term) => {
            if (!source.includes(term)) {
                errors.push(`${docPath} is missing required term "${term}".`);
            }
        });
    });

    const readme = readSource('README.md');
    GOVERNANCE_DOCS.forEach((doc) => {
        const docPath = normalizePath(doc.path);
        if (!readme.includes(docPath)) {
            errors.push(`README.md does not reference ${docPath}.`);
        }
    });

    return {
        ok: errors.length === 0,
        errors,
        checkedDocs: GOVERNANCE_DOCS.length
    };
}

function main() {
    const result = checkReleaseGovernance();

    if (!result.ok) {
        console.error('Release governance check failed:');
        result.errors.forEach((error) => console.error(`- ${error}`));
        process.exit(1);
    }

    console.log(`Release governance check passed (${result.checkedDocs} docs).`);
}

if (require.main === module) {
    main();
}

module.exports = {
    GOVERNANCE_DOCS,
    checkReleaseGovernance,
    readManifestEntries
};
