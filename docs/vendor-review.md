# Vendor Review Cadence

HM-CLSS commits browser vendor files so the app can run offline without a build step. Checksum validation proves local integrity, but it does not prove the pinned versions are still current or free from newly disclosed issues. This document defines the recurring review process.

## Current Inventory

The authoritative local inventory is:

- `assets/vendor/README.md`
- `scripts/smoke_manifest/vendor-checksums.txt`
- `scripts/check-vendor-manifest.js`

Pinned files:

- Tailwind CSS browser build.
- Lucide UMD bundle.
- Chart.js UMD bundle.
- marked browser bundle.
- DOMPurify browser bundle.

## Review Cadence

- Review before every tagged release.
- Review immediately for sanitizer, markdown, or rendering-related security advisories.
- Review after a browser smoke failure that points at vendor behavior.
- Review at least quarterly even when no release is planned.

## Online Sources

Use primary package and project sources first:

- npm package pages for current version, publish date, license, and repository links.
- Project release notes or changelogs when deciding whether to upgrade.
- Security advisory channels for packages that publish them.
- CDN URLs only as download sources after the package version decision is made.

DOMPurify is security-sensitive. Its npm page documents a security mailing list for security-critical releases; subscribe or check that channel during release review.

marked is paired with DOMPurify intentionally. marked's npm documentation warns that marked output is not sanitized, so any markdown rendering path must keep sanitization in place.

## Upgrade Decision Rules

- Patch updates may be accepted when smoke and browser smoke pass.
- Minor updates need a changelog review and browser smoke.
- Major updates need an ADR or explicit compatibility note because this project has no build pipeline to absorb breaking API changes.
- Tailwind browser-build updates need extra care because the project depends on the no-build browser script behavior.
- Sanitizer and markdown upgrades require a security-focused review of rendered HTML paths.

## Review Evidence

For each vendor review, update the release notes or PR description with:

- Packages checked.
- Current pinned version.
- Latest reviewed version.
- Decision: keep pinned, upgrade now, or defer with reason.
- Commands run, at minimum `bash scripts/smoke-check.sh`; add browser smoke when any file changes.

## Local Gates

The following gates must pass after any vendor change:

```bash
node scripts/check-vendor-manifest.js
bash scripts/smoke-check.sh
```

Run browser smoke if the changed library affects UI, charts, markdown, icons, sanitization, or Tailwind styling.
