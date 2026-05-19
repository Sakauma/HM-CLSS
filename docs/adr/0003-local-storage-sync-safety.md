# ADR 0003: Local Storage Sync Safety

## Status

Accepted

## Context

HM-CLSS stores the user workspace in browser localStorage and can overwrite it with cloud data from a GitHub Gist. Failed writes, corrupt cloud payloads, or stale sync state can cause data loss if not handled transactionally.

## Decision

Before applying cloud data, write a pre-apply local backup. Apply imported datasets and workspace state through an explicit transaction path. If persistence fails, roll memory and storage back to the previous workspace snapshot and surface an error toast.

## Consequences

Cloud sync code is more careful than a simple replace operation. Tests must cover backup creation, restore, failed dataset persistence, failed state persistence, and conflict handling. Token storage remains session-scoped while the Gist ID remains local.
