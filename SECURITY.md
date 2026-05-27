# Security Policy

HM-CLSS is a zero-build, browser-only personal workspace. The main security boundary is the user's browser storage plus an optional private GitHub Gist used for sync.

## Supported Versions

Only the current `main` branch is actively maintained. Because this project is distributed as static files, security fixes should be applied by updating to the latest committed version and rerunning the smoke checks.

## Sensitive Data Rules

- Do not commit real GitHub tokens, Gist IDs, browser exports, screenshots containing private records, or `.artifacts/` output.
- GitHub tokens must use the smallest useful scope: classic tokens need only the `gist` permission for the current sync implementation.
- Tokens are intended to live in `sessionStorage`; Gist IDs may live in `localStorage`.
- Exported workspace files must not contain sync credentials.
- Vendor files in `assets/vendor/` are intentionally committed and protected by `scripts/smoke_manifest/vendor-checksums.txt`.

## Reporting a Vulnerability

If you find a vulnerability, open a private report with:

- A short description of the issue and impact.
- Reproduction steps using local static files or `python3 -m http.server 8000`.
- Whether local data, sync credentials, cloud Gist contents, or exported files are affected.
- Browser, OS, and commit SHA.

Do not include real tokens or private workspace exports in the report. Use redacted samples or throwaway test data.

## Security Review Checklist

Before merging code that touches sync, storage, export, vendor assets, or rendered HTML:

- Run `bash scripts/smoke-check.sh`.
- Run `bash scripts/browser-smoke.sh` when UI, navigation, sync, export, or storage behavior changes.
- Confirm `githubToken` remains session-scoped and is not present in exported workspace data.
- Confirm cloud import still writes a pre-apply local backup and rolls back on failed persistence.
- Confirm any HTML rendering path uses trusted templates or sanitized content.
- If vendor files changed, update `assets/vendor/README.md` and `scripts/smoke_manifest/vendor-checksums.txt` together.

## Dependency and Vendor Updates

HM-CLSS does not install runtime npm dependencies. Browser vendor files are committed under `assets/vendor/` for offline use. Update them only intentionally:

1. Record package, version, and source in `assets/vendor/README.md`.
2. Refresh `scripts/smoke_manifest/vendor-checksums.txt`.
3. Run `bash scripts/smoke-check.sh`.
4. Run browser smoke when the dependency affects UI, charts, markdown, icons, or sanitization.
