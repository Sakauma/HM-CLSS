# Changelog

All notable changes to HM-CLSS are tracked here. The project uses human-readable release notes and Conventional Commit style summaries.

## Unreleased

### Added

- Nothing yet.

### Changed

- Nothing yet.

### Verified

- Not run yet.

## v1.0.0 - 2026-05-27

### Added

- Runtime state contract smoke check to block direct shared-state writes outside the runtime store.
- Commercial readiness audit and governance documentation for release, security, contribution, troubleshooting, browser support, and data compatibility.
- Static template contract coverage for additional metric card placeholders.
- Chromium browser smoke support in CI with Chrome for Testing.
- Browser-specific visual baseline support for Chromium layout differences.
- Vendor manifest validation and recorded vendor review evidence.

### Changed

- Tavern, leave, and achievement state writes now use `runtimeActions` instead of legacy global write helpers.
- Smoke checks now include governance and runtime-state contract gates.
- Chart.js vendor asset updated from 4.4.8 to 4.5.1.
- DOMPurify vendor asset updated from 3.0.6 to 3.4.7.

### Fixed

- Chromium smoke checks now use a stable emulated viewport instead of relying on headless browser window chrome behavior.
- Browser smoke failure artifacts are written under the repository `.artifacts` directory and uploaded by CI when failures occur.

### Security

- Refreshed DOMPurify to the latest reviewed 3.x sanitizer release.
- Documented sensitive data handling, token storage expectations, vulnerability reporting, and vendor review cadence.

### Compatibility

- Firefox remains the local browser smoke baseline.
- Chromium is verified in CI with Chrome for Testing.
- Tailwind browser build, Lucide, and marked were reviewed and deferred because their latest versions are cross-major upgrades requiring dedicated compatibility passes.

### Verified

- `bash scripts/smoke-check.sh`
- `bash scripts/browser-smoke.sh`
- GitHub Actions `ci` with Firefox and Chromium browser smoke.

## Release Note Template

Use this template when cutting a tagged release:

```markdown
## vX.Y.Z - YYYY-MM-DD

### Added

### Changed

### Fixed

### Security

### Compatibility

### Verification
```
