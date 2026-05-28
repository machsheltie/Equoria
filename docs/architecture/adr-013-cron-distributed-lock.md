# ADR-013: Cron Job Distributed Lock (pg_try_advisory_xact_lock)

**Status:** Accepted
**Date:** 2026-05-28
**Issue:** Equoria-iot0h
**Decider:** machsheltie (user authority per CLAUDE.md §6)

---

## Context

`backend/services/cronJobs.mjs` schedules ten recurring jobs with
`node-cron` (`dailyTraitEvaluation`, `dailyHorseAging`,
`dailyFoalMilestoneEvaluation`, `electionStatusTransition`,
`weeklyRiderTrainerCareerWeeks`, `nightlyShowExecution`,
`auditLogRetention`, `hoofConditionDecay`, `weeklyFlagEvaluation`,
`temporaryFlagExpiry`). `node-cron` schedules fire **per process** — every
replica runs every schedule, in the same Postgres clock. Observability for
"did the cron fire?" is the in-process `heartbeats` Map plus the persistent
`CronRunLog` table (Equoria-0elk / Equoria-9wby).

The in-process Map and the persistence layer detect **silently-not-running**
jobs. Neither prevents **simultaneously-running** jobs across replicas.
On a single-replica Railway deployment this is invisible. The instant
horizontal scaling enables `replicas > 1` (or two staging boxes share the
same Postgres), every nightly handler fires N times in parallel:

- `dailyHorseAging`: every horse ages N times → off-by-N years
- `nightlyShowExecution`: every prize paid N times → double-spend
- `decayHoofConditions`: every horse's hoofCondition decays N rungs at once
- `auditLogRetention`: N parallel scoped-DELETEs of audit_logs rows
- `processHorseBirthdays`: notifications and milestones fired N times

This is a structural defect of the schedule layer, not a bug in any
specific handler. It blocks safe scaling.

## Decision

Wrap every production cron handler in a Postgres **transaction-scoped
advisory lock** (`pg_try_advisory_xact_lock`) keyed on a SHA-256 hash of
the canonical job name (first 8 bytes as a signed bigint).

Implementation lives in `backend/utils/cronLock.mjs` as
`withAdvisoryLock(jobName, handler)` and is consumed by
`CronJobService.runWithHeartbeat(jobName, handler, { applyLock: true })`.

Behaviour:

- **Lock acquired** (one replica wins) → handler runs inside the
  transaction, COMMIT releases the lock.
- **Lock contended** (other replicas) → handler is skipped, an explicit
  `status: 'skipped-locked'` heartbeat + `CronRunLog` row records the skip
  (so `/api/admin/cron/health` reflects which replicas yielded, never
  implying a phantom success).
- **Handler throws** → ROLLBACK releases the lock, error propagates,
  `status: 'error'` heartbeat recorded.
- **DB unreachable at acquire** → throws (fail-closed per
  `EDGE_CASE_FIX_DISCIPLINE.md` §3; a silent allow-through would
  re-introduce the double-execution bug).

## Why `pg_try_advisory_xact_lock` over `pg_try_advisory_lock`

- **Session-scoped locks would leak across the Prisma connection pool.**
  Two consecutive `$queryRaw` calls from a single PrismaClient can land
  on DIFFERENT pooled backend connections (= different Postgres sessions).
  A session-scoped lock acquired on connection A is NOT visible on
  connection B, so the lock would protect nothing within a single replica.
- **TX-scoped locks bind to the transaction's connection.** Any subsequent
  query in the same `$transaction(async tx => {...})` block sees the lock,
  and the lock is released the moment the transaction commits or rolls
  back — guaranteed by Postgres. No stale-lock recovery code needed.

## Why `pg_advisory` over a separate "leader election" table

- **No new table.** The advisory-lock subsystem already exists in every
  Postgres instance Equoria ships against (Railway-managed Postgres
  included). Zero migration overhead.
- **Self-healing on process death.** The lock is bound to the Postgres
  session; if the leader process crashes, Postgres closes the connection
  and Postgres releases the lock automatically. No watchdog needed.
- **Cluster-wide scope.** Same Postgres instance = same lock space.
  Multiple replicas connecting to one DB instance share the lock domain
  by construction.

## Key derivation

`jobNameToLockKey(jobName)` = SHA-256(jobName) → first 8 bytes → coerce
to signed bigint (Postgres `bigint` is signed 64-bit). Deterministic and
collision-resistant for the O(10) job names in the schedule.

## /api/admin/cron/health visibility (AC #3)

Each per-job block in the `GET /api/admin/cron/health` response now
includes:

- `lockHeld` — `true` while the handler is running with the lock held,
  `false` after release, `null` for jobs that don't use `applyLock`.
- `lastLockAcquired` — `true` if the last completed run acquired the
  lock, `false` if it yielded (skipped-locked), `null` for non-locked.

## Schedule coverage

All ten production schedules now pass `applyLock: true`. Adding a new
schedule without `applyLock` is a regression that re-opens the
double-execution risk for that handler.

## Test coverage

`backend/__tests__/cronDistributedLock.integration.test.mjs` (real DB):

- Two-`PrismaClient` race: planted side-effect counter increments by 1
  (not 2) when two parallel calls fire from two distinct Postgres backends.
- Sequential re-acquire: lock is released between runs (no permanent lock).
- Throw-path release: handler exception releases the lock so the next run
  can proceed.
- Heartbeat + CronRunLog persistence under `applyLock: true`.
- `getHealth` surfaces `lockHeld: false` + `lastLockAcquired: true` after
  the run completes.

Sentinel-positive verified: temporarily replacing `acquired = rows?.[0]?.locked === true`
with `acquired = true` in the test helper makes the race test FAIL with
`Received: 2` — proving the cross-session race is genuinely exercised.

## Alternatives considered

1. **Single-replica deployment forever.** Cheapest. Rejected — beta
   scale-up will need replicas eventually and discovering this gap then
   is worse than fixing it now.
2. **Leader-election via dedicated `CronLeader` table.** More moving
   parts (migration, election heartbeat, leader expiry, manual recovery).
   Rejected — advisory locks give the same guarantees with zero schema
   surface and built-in fail-safety.
3. **Application-level singleton scheduler (one designated "cron replica").**
   Requires deployment-side topology (env var, ordinal numbering, manual
   role assignment). Rejected — couples deployment to behavioral
   correctness; advisory locks decouple them.
4. **Redis SETNX-based lock.** Equoria does not currently run Redis. Adding
   a new infra dependency to solve a Postgres-native problem is the wrong
   trade.

## What was NOT done (scope boundary)

- Did NOT wrap the manual admin endpoints (`POST /api/admin/cron/start`,
  `manualTraitEvaluation`, `manualHorseAging`) — these are operator-driven
  one-offs and the operator can choose to bypass the lock for a forced
  re-run if needed. Adding `applyLock` here would also be defensible
  (file as follow-up if multi-admin double-fire becomes a concern).
- Did NOT change the schedule cadences. Out of scope.
- Did NOT introduce a `CronLeader` history table. The skipped-locked
  rows in `CronRunLog` already tell the operator which replicas yielded.

## Consequences

**Positive:**

- Safe to set `replicas > 1` on Railway without double-aging / double-payout.
- Zero schema migration cost.
- Lock state visible in `/api/admin/cron/health` for operator triage.
- Existing tests + heartbeats unchanged.

**Negative:**

- Adds one `BEGIN; SELECT pg_try_advisory_xact_lock(...); COMMIT;` per
  scheduled fire on the loser-replicas (small fixed cost; one round-trip).
- A long-running job (e.g. `dailyHorseAging` on a large corpus) holds the
  lock for the full duration; concurrent attempts skip rather than queue.
  This is the intended semantics — a once-per-day handler should not
  start its second run before the first finishes.
- TX timeout is set to 60 minutes (`DEFAULT_LOCK_TX_TIMEOUT_MS`). Jobs
  exceeding this would hit Prisma's transaction timeout. Currently no
  handler approaches this; if one ever does, raise the per-job timeout
  via the opts argument.

## Cross-references

- `backend/utils/cronLock.mjs` — implementation
- `backend/services/cronJobs.mjs` — applyLock wiring on all schedules
- `backend/__tests__/cronDistributedLock.integration.test.mjs` — sentinels
- `packages/database/prisma/schema.prisma` — `CronRunLog.status` comment
  documents the new `'skipped-locked'` value
- ADR-related: Equoria-0elk (heartbeat), Equoria-9wby (persistence),
  Equoria-304a (stale alert), Equoria-s20o (realm-safe ISO)
