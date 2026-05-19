# ADR 0002: Script Order Startup Contract

## Status

Accepted

## Context

The app uses global browser functions and `registerAppModule` instead of ES modules. This keeps deployment simple, but load order can become implicit and fragile if it is only documented by the order of script tags.

## Decision

Treat `scripts/smoke_manifest/script-order.txt` as the canonical startup sequence. The script block in `index.html` must match it exactly. Registered app modules may declare `dependsOn`, and `scripts/check-module-dependencies.js` verifies that declared dependencies load earlier.

## Consequences

The startup contract is readable and testable without changing runtime behavior. New modules must update both the script order and dependency declarations when they rely on earlier globals.
