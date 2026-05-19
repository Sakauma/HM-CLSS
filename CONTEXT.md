# HM-CLSS Context

HM-CLSS is a zero-build static web app for personal work discipline, check-in tracking, task focus, leave records, sync, export, and a tavern-style emotion journal.

## Domain Terms

- **Workspace**: The complete local user dataset persisted in browser storage. It includes check-in records, task records, quick notes, leave records, tavern history, achievements, preferences, and current task state.
- **Check-in**: A dated work-period record for morning, afternoon, or evening. Check-in status depends on schedule rules, grace windows, and optional retroactive correction.
- **Task**: A focused work session with name, tag, start time, optional active state, and daily duration totals.
- **Leave**: A dated absence or correction record that can affect check-in interpretation and workday summaries.
- **Cloud Sync**: GitHub Gist based import/export of workspace data. Tokens are session-scoped; Gist IDs are persisted locally.
- **Pre-apply Backup**: A local snapshot written before cloud data overwrites the workspace. It is intended to let the user restore local data if an import was wrong.
- **Tavern Emotion Record**: A mood analysis result stored as a drink-like record, including family, recipe metadata, intensity, and narrative copy.

## Engineering Terms

- **Script Order Contract**: The explicit startup sequence in `scripts/smoke_manifest/script-order.txt`, mirrored by the script block in `index.html`.
- **App Module**: A registered startup unit declared with `registerAppModule({ id, order, dependsOn, init })`.
- **Storage Schema**: The localStorage payload shape guarded by migration and safe parse helpers.
- **Browser Smoke Baseline**: Selenium/Firefox checks and visual fixtures that protect boot, navigation, sync, accessibility, and layout behavior.
