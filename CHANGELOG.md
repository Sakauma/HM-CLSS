# Changelog

All notable changes to HM-CLSS are tracked here. The project uses human-readable release notes and Conventional Commit style summaries.

## Unreleased

### Added

- Runtime state contract smoke check to block direct shared-state writes outside the runtime store.
- Commercial readiness audit and governance documentation for release, security, contribution, troubleshooting, browser support, and data compatibility.
- Static template contract coverage for additional metric card placeholders.

### Changed

- Tavern, leave, and achievement state writes now use `runtimeActions` instead of legacy global write helpers.
- Smoke checks now include governance and runtime-state contract gates.

### Verified

- `bash scripts/smoke-check.sh`
- `bash scripts/browser-smoke.sh`

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
