# ADR 0001: Zero-Build Static App

## Status

Accepted

## Context

HM-CLSS runs as a static browser application from `index.html`. The repository intentionally avoids a bundler, package install step, or generated runtime assets. Local development can use a plain static server, and CI can validate source files directly.

## Decision

Keep the runtime as native HTML, CSS, and JavaScript loaded by explicit script tags. Third-party browser libraries are vendored under `assets/vendor/` and protected by checksum checks.

## Consequences

Startup order is a first-class contract rather than something delegated to a bundler. Shared behavior should live in small runtime or feature modules, and new files must be added to the smoke manifests so local and CI checks stay complete.
