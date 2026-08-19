# Architecture Decisions

**Status:** Active index
**Last reviewed:** 2026-08-19

This directory contains cross-cutting decisions, not a system tour. Read only
the ADR whose trigger matches the task and verify it against live source,
schema, configuration, migrations, and tests.

| ADR                                         | Load only when changing                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| `adr-005-csrf-doublecsrfprotection.md`      | CSRF enforcement, token delivery, session binding, or protected-router placement |
| `adr-006-refresh-token-hash-at-rest.md`     | Refresh or verification token persistence and lookup                             |
| `adr-007-notification-retention-policy.md`  | Notification storage, pruning, retention, or read caps                           |
| `adr-009-jwt-secret-rotation-keyring.md`    | JWT signing/verification key rings and rotation                                  |
| `adr-010-ci-inline-beta-readiness-scans.md` | Beta-readiness static scans and consumer parity                                  |
| `adr-011-realtime-event-transport-sse.md`   | SSE, process-local event delivery, fallback, or multi-instance fan-out           |
| `adr-013-cron-distributed-lock.md`          | Cron scheduling, advisory locks, or multi-replica execution                      |

Create an ADR only for a durable choice with real alternatives and consequences.
Do not use one for a feature plan, audit, source inventory, library wishlist, or
player-facing design permission. Update or supersede it in the same change that
intentionally changes the decision.
