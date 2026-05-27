# Data Compatibility Guide

HM-CLSS stores user workspace data in browser storage and can sync that workspace through GitHub Gist. Data compatibility is therefore a release-critical contract.

## Current Schema

- `CURRENT_STORAGE_SCHEMA_VERSION`: `1`
- Version key: `hmclss_storage_schema_version`
- Storage boundary: `assets/js/runtime/storage.js`, `storage-payload.js`, `storage-shapes.js`, and `storage-migrations.js`
- Sync boundary: `assets/js/workspace/data.js` and `assets/js/features/sync/`

## Compatibility Principles

- Never discard a corrupt storage key silently.
- Preserve old keys until migration can safely normalize them.
- Write through `runtimeActions` so persistence, sync, subscribers, and UI refresh behavior stay aligned.
- Keep sync credentials out of workspace snapshots and exports.
- Before cloud import overwrites local data, write a local pre-apply backup.

## Schema Change Checklist

When changing persisted data shape:

1. Increment `CURRENT_STORAGE_SCHEMA_VERSION` if existing user data needs migration.
2. Add a migration in `assets/js/runtime/storage-migrations.js`.
3. Normalize new shape in `assets/js/runtime/storage-shapes.js` or a feature-owned normalizer.
4. Update workspace snapshot/apply logic in `assets/js/workspace/data.js`.
5. Add unit tests for old payload, migrated payload, corrupt payload, and failed persistence.
6. Confirm cloud import rollback still restores memory and storage.
7. Update export tests if exported shape changes.
8. Document compatibility notes in `CHANGELOG.md`.

## Manual Recovery

If a release damages local state:

- Stop auto-sync by clearing credentials or closing the session.
- Export full workspace JSON if possible.
- Restore from local pre-apply backup if the issue followed cloud import.
- Roll back static files to the previous known-good commit.
- Re-import a known-good exported workspace only after confirming the file contains no credentials.
