# Contributing

Thank you for improving HM-CLSS. The project intentionally stays zero-build, static, and browser-first, so most changes should preserve the existing file layout and script loading contract.

## Development Setup

From the repository root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

For regression checks:

```bash
bash scripts/smoke-check.sh
```

For browser-level checks:

```bash
bash scripts/setup-browser-test.sh
bash scripts/browser-smoke.sh
```

On Windows, use the PowerShell wrappers:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-check.ps1
powershell -ExecutionPolicy Bypass -File scripts/browser-smoke.ps1
```

## Branch and Commit Style

- Use short branches that describe the change. The Codex workspace convention is `codex/<topic>` for agent-created branches.
- Use Conventional Commits: `fix: ...`, `feat: ...`, `style: ...`, `chore: ...`, `docs: ...`, or `test: ...`.
- Keep unrelated refactors out of feature and fix commits.

## Code Guidelines

- Keep vanilla JavaScript, CSS, and HTML. Do not add a build chain unless the project explicitly adopts one through an ADR.
- Add new JavaScript under the matching `assets/js/runtime`, `assets/js/workspace`, `assets/js/ui`, or `assets/js/features/<feature>` boundary.
- Maintain `scripts/smoke_manifest/script-order.txt` whenever `index.html` script order changes.
- Mutate shared workspace state through `runtimeActions`; read through `runtimeSelectors` or existing compatibility globals.
- Do not use direct `innerHTML` except through the trusted template helpers.
- Keep vendor files local and checksum-protected.

## Testing Expectations

- Run `bash scripts/smoke-check.sh` before every PR.
- Run `bash scripts/browser-smoke.sh` for UI, navigation, sync, export, storage, accessibility, or layout changes.
- Add or update `tests/unit/*.test.js` for new state, storage, export, sync, statistics, template, or contract logic.
- Update `docs/functional-self-check.md` when a user-visible workflow changes and cannot be fully automated.

## Pull Request Checklist

Every PR should include:

- User-visible change summary.
- Risk notes for storage, sync, export, vendor, or localStorage migrations.
- Test commands and results.
- Screenshots or `.artifacts/browser-smoke/` notes for UI changes.
- Compatibility notes when changing data shape, schema version, or browser behavior.
