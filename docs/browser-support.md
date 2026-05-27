# Browser Support Matrix

HM-CLSS is a static browser app that relies on modern DOM APIs, `localStorage`, `sessionStorage`, Clipboard APIs for sharing, and optional GitHub Gist network requests.

## Support Levels

| Browser | Level | Evidence |
| --- | --- | --- |
| Firefox ESR/current | Verified | `scripts/browser-smoke.sh` runs Selenium against the project browser environment. |
| Chromium/Chrome current | Verified in CI | GitHub Actions installs Chrome for Testing with `browser-actions/setup-chrome@v2` and runs `HM_CLSS_BROWSER=chromium bash scripts/browser-smoke.sh`. |
| Edge current | Supported target | Expected to follow Chromium behavior; manual verification recommended for releases. |
| Safari current | Best effort | Manual verification required; local file and storage behavior may differ. |
| Mobile browsers | Best effort | Layout is responsive, but core smoke currently targets desktop browser automation. |

## Required Capabilities

- ES2020-class JavaScript runtime.
- `localStorage` and `sessionStorage`.
- Fetch API for GitHub Gist sync.
- Blob downloads for export.
- Clipboard API for share-copy paths, with graceful failure.
- SVG/icon rendering through local Lucide vendor bundle.

## Release Expectation

- Every release must pass Firefox browser smoke.
- Every release must pass Chromium smoke in CI, or explicitly document an external CI outage or browser-action failure.
- Local Chromium runs can use `HM_CLSS_BROWSER=chromium` plus `HM_CLSS_CHROME_PATH` and `HM_CLSS_CHROMEDRIVER_PATH` when the tools are outside `PATH`.
- Any browser-specific limitation should be recorded in `CHANGELOG.md` under `Compatibility`.

## Known Automation Gap

Chromium is wired as a CI smoke target through `browser-actions/setup-chrome@v2`. The checked-in conda environment still installs Firefox/geckodriver only; local Chromium runs require a local Chrome/Chromium and matching `chromedriver` or explicit `HM_CLSS_CHROME_PATH` / `HM_CLSS_CHROMEDRIVER_PATH` values.
