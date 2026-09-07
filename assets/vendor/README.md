# Vendor Assets

These files are committed so HM-CLSS can run without CDN access or a build step. Update them only intentionally, then refresh `scripts/smoke_manifest/vendor-checksums.txt`.

The minified files retain their upstream license headers. Unvendored `sourceMappingURL` trailers are omitted so the offline application does not request missing source maps.

| File | Package | Version | Source |
| --- | --- | --- | --- |
| `tailwindcss-3.4.17.js` | Tailwind CSS browser build | 3.4.17 | `https://cdn.tailwindcss.com/3.4.17` |
| `lucide-0.514.0.min.js` | Lucide | 0.514.0 | `https://unpkg.com/lucide@0.514.0/dist/umd/lucide.min.js` |
| `chart.umd-4.5.1.min.js` | Chart.js | 4.5.1 | `https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js` |
| `marked-12.0.2.min.js` | marked | 12.0.2 | `https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js` |
| `purify-3.4.15.min.js` | DOMPurify | 3.4.15 | `https://cdn.jsdelivr.net/npm/dompurify@3.4.15/dist/purify.min.js` |
