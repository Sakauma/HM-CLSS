# Troubleshooting Guide

This guide is for diagnosing user-visible failures without exposing private workspace data.

## Browser Smoke Failures

Artifacts are written to `.artifacts/browser-smoke/`.

- `failures/`: screenshots, page source, console logs, and error summaries.
- `visual/`: layout snapshots and current visual baseline screenshots.
- `server.log`: local static server output.

Do not commit these files. Redact screenshots before sharing if they contain personal records.

## Local Data Looks Corrupted

Symptoms:

- A section falls back to empty state unexpectedly.
- A toast reports damaged local cache.
- A save failure pauses automatic sync.

Response:

1. Do not upload to cloud until the local state is understood.
2. Export full workspace JSON if the export panel still works.
3. Inspect browser storage keys using disposable test data when possible.
4. If the issue followed a cloud import, use the local pre-apply backup restore path.
5. Preserve the failing browser, OS, commit SHA, and console messages for debugging.

## Sync Fails

Check:

- GitHub Token has only the `gist` permission and has not expired.
- Token is present in `sessionStorage`, not `localStorage`.
- Gist ID points to a secret or private test Gist containing `workspace_data.json`.
- Network and GitHub API status are healthy.
- Conflict and ETag warnings are respected instead of forcing upload.

Safe recovery:

1. Export local workspace JSON.
2. Pull from cloud only after confirming the cloud timestamp and intent.
3. If cloud import overwrites good local data, restore from local backup.

## Export Fails or Looks Wrong

Check:

- `全量工作区 JSON` disables the month field.
- Monthly JSON, Markdown, and CSV use the expected month.
- Exported content does not contain `githubToken` or `gistId`.
- CSV contains `category`, `date`, `label`, `status`, and `metric` columns.

## UI or Layout Regression

Run browser smoke first. If it fails:

- Compare `.artifacts/browser-smoke/visual/layout-current.json` with `tests/fixtures/visual-layout-baselines.json`.
- Inspect screenshots for clipped text, blocked controls, inaccessible focus, or mismatched dark-mode colors.
- Update the baseline only after confirming the new layout is intentional.

## Vendor Checksum Failure

This usually means a committed vendor file changed without updating the manifest.

Response:

1. Verify the source and version in `assets/vendor/README.md`.
2. Refresh `scripts/smoke_manifest/vendor-checksums.txt`.
3. Run `bash scripts/smoke-check.sh`.
