# ADR-007: Notification Table Retention Policy (Prune-on-Write, Count-Based)

**Status:** Accepted
**Date:** 2026-05-15
**Deciders:** Backend Team
**Epic:** Notifications / Messaging
**Implementation:** `backend/utils/notificationService.mjs` (NOTIFICATION_RETENTION_COUNT = 100, `pruneOldNotifications`, `createNotification` fire-and-forget prune)
**Tracking:** bd `Equoria-1fqs` (implementation), `Equoria-b8jx` (design / this ADR)

---

## Context

The `Notification` table receives a row on every player-relevant in-game event:

- `stat_gain` — produced by the feed system after a stat-boosting feed roll succeeds (`horseFeedController.feedHorseHandler`).
- `foal_born` — produced by the foaling service when a pregnancy resolves (`foalingService.createFoalFromPregnancy`).
- Future planned events: `horse_purchased`, `horse_sold`, competition-placement notifications.

Prior to this ADR, the only cap on the table was a **display-time** `take: 100` in `userController.getGameNotifications`. That limit reduced the response size sent to the client, but it did not bound storage. Every notification ever generated for a user stayed in the table forever. A long-lived account with active feeding, breeding, and competition usage would accumulate tens of thousands of rows. Spec `spec-feed-stat-gain-notifications.md` had explicitly deferred this to "future concern," and its "Suggested Review Order" overstated reality by describing the read cap as a storage cap.

Threat model:

- **Storage cost growth** — linear in event count per user, unbounded.
- **Query cost growth** — `ORDER BY createdAt DESC LIMIT 100` is acceptable at small N but degrades as the user's row count grows, especially without a `(userId, createdAt)` composite index.
- **Index bloat** — every existing index on `Notification` grows with the row count.

---

## Decision

Cap retention at the application layer using **prune-on-write, count-based**: every successful insert via `createNotification` fires a non-blocking follow-up that deletes the oldest excess rows beyond `NOTIFICATION_RETENTION_COUNT = 100` for that user.

**Cap value:** 100 per user. Matches the existing read-side `take: 100` so the read and write paths agree exactly. Users see at most what is stored.

**Cap unit:** count, not age. Power users generating many events per day care about the latest events, not events from a specific calendar window. A 30-day TTL would silently drop all of a returning player's catch-up notifications; a count-based cap keeps the most recent N regardless of cadence.

**Cap location:** application layer in `notificationService.mjs`, not a DB constraint or trigger. Keeps the policy in the same module as the writer, testable in JS, and revisable without a migration.

**Cap timing:** fire-and-forget after the insert returns. The notification write is the user-facing event; the prune is housekeeping. If the prune transiently fails, the user has one extra row, which the next insert cleans up. A failure mode where the prune blocks a notification write was rejected — that would make the housekeeping path a single point of failure for the user-facing path.

---

## Alternatives Considered

### A. Daily TTL-based cleanup cron

Approach: a scheduled job that nightly deletes read notifications older than 30 days and unread older than 90 days.

Rejected because:

- Adds operational surface (a cron must be scheduled, monitored, alerted on failure).
- Calendar-based, not interaction-based — a player who returns after a 6-month break loses the unread notifications that motivated their return.
- Same-day events would accumulate freely between cron runs; the table is bounded only in daily steps.
- Hardest part is choosing the right threshold pair; we have no current data to pick informed values.

### B. JSONB rollup ("summary row" of older entries)

Approach: when the table exceeds N, compress older entries into one JSONB blob attached to a special `type: 'archive'` row.

Rejected because:

- Forces every read path to know about both the row format and the archive format.
- Loses per-event mutability — marking a single old archived item as read is impossible without exploding the archive.
- Solves a problem we don't have: there is no requirement to ever surface notifications older than the most recent 100.

### C. Database `TRIGGER` on insert

Approach: Postgres trigger that prunes the user's rows after every insert, in the same transaction.

Rejected because:

- Couples application semantics to a DB-layer trigger, hard to test alongside the application code.
- Adds the prune cost to the critical insert transaction. Trigger failure would fail the insert. The fire-and-forget app-layer approach decouples these intentionally.
- Migration history complexity — every schema change to `Notification` needs to consider the trigger.

### D. Per-user `INSERT...DELETE` in a single statement via CTE

Approach: a single SQL statement that inserts and prunes in one transaction.

Rejected because:

- Loses Prisma type safety — would need `prisma.$queryRaw`, which downstream callers can't easily test.
- The cost optimization is minimal (one round-trip saved) and would couple the two operations such that an insert failure means a prune failure or vice versa.

---

## Implementation

**Service layer** (`backend/utils/notificationService.mjs`):

- `NOTIFICATION_RETENTION_COUNT = 100` — public export, so tests and future readers can reference the same constant.
- `pruneOldNotifications(userId, retentionCount = 100)` — two-step delete:
  1. `findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip: retentionCount, select: { id: true } })` collects the ids of stale rows.
  2. `deleteMany({ where: { id: { in: ids } } })` deletes by id.

  The two-step pattern (vs a single bulk delete with offset) guarantees that a row inserted concurrently between the two calls cannot be deleted, because its id will not be in the snapshot's `ids` list.

- `createNotification(userId, type, payload)` — inserts via Prisma, then calls `pruneOldNotifications(userId).catch(logger.error)`. The promise is intentionally not awaited.

**Tests** (`backend/__tests__/notificationService.test.mjs`):

- Sentinel positive test: seed N+10 rows with deterministic createdAt timestamps, call `pruneOldNotifications`, assert exactly N rows survive and the oldest survivor is index 10 (rows 0..9 deleted).
- End-to-end test: seed N rows with past createdAt, insert one row via `createNotification`, poll until count returns to N, and assert the newest row is the sentinel from the helper insert.

Both tests run against the real Equoria DB per project policy (no Prisma mocks).

---

## Consequences

**Positive:**

- Storage cost is now O(active_users × 100) instead of O(active_users × lifetime_events).
- Read-path `take: 100` becomes defense-in-depth, not the primary cap.
- No new operational surface — no cron, no trigger, no migration.
- Failure of the prune step does not impact the user-facing notification write.

**Negative:**

- A bursty insert pattern (e.g., 200 stat_gains within seconds) means each insert runs its own prune. With the current single-digit-per-minute realistic burst rate this is negligible, but if future systems (e.g., a daily "yield" batch) generate hundreds of notifications at once, consider switching to a single bulk-prune at the end of the batch.
- The cap is enforced post-insert, so for a brief window after the Nth+1 row's write the table has N+1 rows. This is benign for any read using `take: 100`.

**Reversible:** the constant `NOTIFICATION_RETENTION_COUNT` is a single edit; the policy can be tightened or relaxed without a migration.

---

## Backfill

No backfill is required at deployment time:

- Existing user tables: the next insert per user will trigger the prune and bring that user's row count down to N. Users who never insert a new notification keep their existing rows until they do — acceptable because the read path already caps at 100, so they see no behavior change.
- If a synchronous one-time backfill is later wanted (e.g., to reclaim storage immediately), expose `pruneOldNotifications` as a CLI / admin endpoint and iterate over all users.

---

## Related Decisions

- `spec-feed-stat-gain-notifications.md` — feed system notification spec; its "Suggested Review Order" has been corrected to reference this policy.
- Future: a notification grouping or aggregation system could combine N consecutive stat_gain rows for the same horse into one "gained X stats from Y feedings" row, further reducing read-side row count. Out of scope for this ADR.
