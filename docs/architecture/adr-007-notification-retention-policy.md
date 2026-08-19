# ADR-007: Count-Based Notification Retention

**Status:** Accepted
**Date:** 2026-05-15
**Scope:** Per-player notification storage and retrieval

## Load rule

Load this ADR only when changing notification storage, creation, pruning, retention limits, ordering, indexes, or read caps. Verify current behavior against `backend/utils/notificationService.mjs`, the notification read path, the Prisma schema, and focused tests.

## Context

A read-side limit bounds response size but does not bound stored rows. Player-event notifications can grow indefinitely unless the write path also enforces retention.

## Decision

Use count-based, prune-on-write retention with a current limit of 100 notifications per player.

Current invariants:

- The shared notification creation service is the retention boundary.
- After a successful insert, it removes the oldest rows beyond the per-player limit.
- Reads return newest-first and use the same 100-row cap.
- Pruning is best-effort and must not turn an otherwise successful gameplay mutation into a failure.
- A prune failure may temporarily leave more than 100 rows; a later successful write retries enforcement.
- Producers must use the shared creation service rather than writing notification rows directly.

## Consequences

- Storage is bounded in normal operation without a separate cleanup scheduler.
- This is a recent-history inbox, not a permanent event ledger. Durable gameplay history belongs in the domain records that own it.
- Changing the cap, making pruning synchronous, adding archival retention, or moving cleanup to a scheduled job changes this decision and requires source-aligned tests and an ADR update.
