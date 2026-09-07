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

### 2026-09-07 Quarterly Review

Source check completed against the npm registry with `npm view <package> version dist-tags.latest license time.modified homepage repository.url --json`. The pinned download URLs in `assets/vendor/README.md` were fetched and compared after normalizing CRLF and removing only the unvendored upstream `sourceMappingURL` trailer. The OSV API was queried on 2026-09-07 for the five pinned npm package versions. OSV returned no entries at query time for Tailwind 3.4.17, Lucide 0.514.0, Chart.js 4.5.1, marked 12.0.2, or the upgraded DOMPurify 3.4.15; this records a time-scoped query result rather than a guarantee that no vulnerability exists.

| Package | Pinned version | Latest reviewed | License | Decision and security judgment |
| --- | --- | --- | --- | --- |
| `@tailwindcss/browser` / Tailwind browser build | 3.4.17 | 4.3.3 | MIT | Keep pinned. Major zero-build runtime change; upgrade needs a visual/theming pass. OSV returned no entries for the pinned version at query time. |
| `lucide` | 0.514.0 | 1.41.0 | ISC | Keep pinned. Major boundary/API and icon set change. OSV returned no entries for the pinned version at query time. |
| `chart.js` | 4.5.1 | 4.5.1 | MIT | Keep pinned. Pinned release is current; statistics smoke covers chart creation. OSV returned no entries for the pinned version at query time. |
| `marked` | 12.0.2 | 18.0.11 | MIT | Keep pinned. Multiple major versions; marked output remains unsanitized and must stay behind DOMPurify. OSV returned no entries for the pinned version at query time. |
| `dompurify` | 3.4.15 | 3.4.15 | MPL-2.0 OR Apache-2.0 | Upgraded from 3.4.7. OSV returned no entries for 3.4.15 at query time, and this version is outside all vulnerable ranges reported for the former pin. |

OSV reported five advisories against the former DOMPurify 3.4.7 pin:

- [`GHSA-gvmj-g25r-r7wr`](https://github.com/advisories/GHSA-gvmj-g25r-r7wr), fixed in 3.4.8.
- [`GHSA-vxr8-fq34-vvx9`](https://github.com/advisories/GHSA-vxr8-fq34-vvx9), fixed in 3.4.9.
- [`GHSA-cmwh-pvxp-8882`](https://github.com/advisories/GHSA-cmwh-pvxp-8882), fixed in 3.4.11.
- [`GHSA-c2j3-45gr-mqc4`](https://github.com/advisories/GHSA-c2j3-45gr-mqc4), fixed in 3.4.12.
- [`GHSA-55q2-fjhq-7xh7`](https://github.com/advisories/GHSA-55q2-fjhq-7xh7), fixed in 3.4.13.

HM-CLSS currently calls `DOMPurify.sanitize(marked.parse(noteText))`, using default string input and output. It does not call `setConfig`, `addHook`, or `clearConfig`, and it does not enable `IN_PLACE`, `CUSTOM_ELEMENT_HANDLING`, `SAFE_FOR_TEMPLATES`, DOM-return modes, or Trusted Types return modes. The optional configuration and hook preconditions described by these advisories are therefore not reachable through the current note-rendering path. The 3.4.15 upgrade still removes the published vulnerable ranges and prevents future configuration changes from silently reintroducing those defects.

Public sources checked:

- npm package metadata: `https://www.npmjs.com/package/@tailwindcss/browser`, `https://www.npmjs.com/package/lucide`, `https://www.npmjs.com/package/chart.js`, `https://www.npmjs.com/package/marked`, `https://www.npmjs.com/package/dompurify`.
- Project release and security references: `https://github.com/tailwindlabs/tailwindcss`, `https://github.com/lucide-icons/lucide`, `https://github.com/chartjs/Chart.js`, `https://github.com/markedjs/marked`, and `https://github.com/cure53/DOMPurify`.
- Vulnerability queries and advisory records: `https://api.osv.dev/v1/query` and the five GitHub Security Advisory links above.
- Exact pinned asset sources and versions: `assets/vendor/README.md`.

Updated in this review:

- Removed only the stale source-map trailers from `chart.umd-4.5.1.min.js` and `lucide-0.514.0.min.js`; license headers and executable payloads match their pinned CDN sources exactly after that normalization.
- Replaced `purify-3.4.7.min.js` with the official `purify-3.4.15.min.js` browser bundle and omitted its stale source-map trailer. Its executable payload matches the pinned CDN source after CRLF and trailer normalization.
- Refreshed the three corresponding rows in `scripts/smoke_manifest/vendor-checksums.txt`; DOMPurify 3.4.15 has normalized SHA-256 `c5fbf946a4d77074cedd02116491fea15c6e3c652b4de8f523ef665cde4d89a4`.
- Added a real-browser regression for the stored Markdown rendering path. It verifies the loaded DOMPurify version, safe heading and strong rendering, removal of script nodes, inline event handlers, and `javascript:` links, and absence of payload execution.

Follow-up: plan separate major-upgrade reviews for the Tailwind browser runtime, Lucide, and marked.

## Local Gates

The following gates must pass after any vendor change:

```bash
node scripts/check-vendor-manifest.js
bash scripts/smoke-check.sh
```

Run browser smoke if the changed library affects UI, charts, markdown, icons, sanitization, or Tailwind styling.
