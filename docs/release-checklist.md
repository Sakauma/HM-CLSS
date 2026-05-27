# Release Checklist

Use this checklist before publishing a tagged HM-CLSS release or merging a broad change set into `main`.

## 1. Scope

- Confirm the release goal and user-visible changes are summarized in `CHANGELOG.md`.
- Confirm no unrelated local changes are included.
- Confirm data shape, sync behavior, export format, and vendor changes are called out explicitly.

## 2. Automated Gates

Run:

```bash
bash scripts/smoke-check.sh
```

For UI, navigation, storage, sync, export, accessibility, or layout changes, also run:

```bash
bash scripts/browser-smoke.sh
```

Expected evidence:

- JavaScript syntax passes for every manifest entry.
- Module dependency and script order contracts pass.
- Static template and runtime state contracts pass.
- Node unit tests pass.
- Python browser smoke files compile.
- Vendor checksums match.
- Required docs and resources exist.

## 3. Manual Product Check

Use `docs/functional-self-check.md` for flows that still benefit from human inspection:

- Dashboard and navigation.
- Check-in and retro check-in.
- Leave workflows.
- Task and quick capture flows.
- Tavern analysis and history.
- Statistics, sync settings, and export downloads.
- Dark mode and reduced-motion behavior.

Record any skipped item and why in the PR or release notes.

## 4. Data Safety

- Export a test workspace and confirm sync credentials are absent.
- Confirm `githubToken` is not written to `localStorage`.
- Confirm cloud import backup and rollback tests still pass.
- If `CURRENT_STORAGE_SCHEMA_VERSION` changes, document migration behavior in `docs/data-compatibility.md`.

## 5. Rollback

Because HM-CLSS is a static app, rollback means serving the previous known-good commit or tag.

Before release:

- Identify the previous known-good commit.
- Keep the previous `assets/vendor/` files and checksum manifest in Git history.
- Preserve user data by avoiding forced cloud import during release validation.

After rollback:

- Ask users to reload the static files.
- If a cloud import ran with bad data, restore from the local pre-apply backup or the user's exported workspace JSON.
