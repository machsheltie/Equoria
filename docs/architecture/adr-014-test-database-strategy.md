# ADR-014: Test Database Strategy — Canonical Real DB vs. Ephemeral Containers

**Status:** Accepted — **Option A (status quo: canonical real DB only; no separate test DB)**
**Date:** 2026-06-02
**Issue:** Equoria-qj71b (decision epic) · Equoria-p8g3a (captured artifact, discarded)
**Decider:** machsheltie (user authority per CLAUDE.md §6), 2026-06-02

> **DECISION (2026-06-02):** Option A. Equoria keeps the canonical real DB as the
> single test target per CLAUDE.md §3. No ephemeral/containerized test database is
> adopted; the captured docker-compose artifact (p8g3a) is discarded. Scoped
> fail-loud cleanup (Equoria-9jv9c + children) remains the catastrophe safety net,
> since it is now the only one. Options B/C below are recorded for posterity but
> are NOT pursued.

---

## Context

Equoria's testing philosophy is codified in `CLAUDE.md` §3: **tests run against
the canonical real database.** `backend/.env.test` points `DATABASE_URL` at the
live `equoria` Postgres instance (`localhost:5432/equoria`), and the constitution
forbids mocks for our own services/DB. The stated rationale is sound and
hard-won: Equoria's real defects are integration-shaped — breeding lineage
against real JSONB null patterns, leaderboards at real row counts and collations,
trait inheritance under real concurrent writes, inventory/transaction isolation
under real Postgres semantics. A synthetic fixture DB tests _the author's model
of the system_, not the system; the constitution accepts test/prod drift as the
price of testing against reality.

A captured artifact (Equoria-p8g3a) — a `docker-compose.yml` provisioning an
ephemeral Postgres-15 `equoria_test` container plus a `setup-worktree.sh`
bootstrap — surfaced from a dead worktree during the Equoria-6a4h5 cleanup. It
represents the **opposite** model: disposable, reproducible, per-run test
databases. Rather than adopt or discard it silently (either of which would be an
undocumented architecture change), this ADR frames the decision properly.

The decision is load-bearing because the two models conflict directly. Running
both simultaneously is the "two-tier / clean-lane-plus-dirty-lane" anti-pattern
that `.claude/rules/COMPLETION_VERIFICATION_POLICY.md` §6 explicitly forbids — the
lanes drift, and "passes in lane A" stops meaning "passes." We must pick a
coherent model (or a deliberate hybrid), not accumulate both.

### The cost the status quo has already paid

This is not a hypothetical trade-off. Incident **Equoria-c3kb6** nuked the
canonical localhost `equoria` database when a worktree ran
`node -e "import('./scripts/db-reset-test.mjs')"` as a parse-check and its
top-level `DROP DATABASE`/`CREATE DATABASE` fired against the restored production
data. The structural fix (Equoria-5z0if main-module guards) addressed _that_
trigger, but the underlying exposure remains: **tests, seeds, and scripts all
point at the same database that holds real player data.** Any unscoped
`deleteMany`, any errant DDL, any cleanup-ordering bug operates on production.
The constitution mitigates this with scoped-cleanup discipline (§3) — but that is
a _convention enforced by reviewers and doctrine checks_, not a structural
guarantee. An ephemeral test DB makes the catastrophic case structurally
impossible.

## Decision

**Proposed — not yet decided.** This ADR exists to force a deliberate choice
across the four axes below. Options under consideration:

- **Option A — Status quo (canonical real DB only).** Keep `.env.test` → real
  DB. Discard the docker-compose artifact. Double down on scoped-cleanup
  discipline + doctrine checks as the safety mechanism.
- **Option B — Ephemeral test DB only.** Adopt docker-compose (or testcontainers)
  as the test target. Seed deterministically per run. Retire the
  canonical-DB-as-test-target model.
- **Option C — Hybrid (recommended starting position for discussion).** Keep
  real-DB integration tests for the genuinely integration-shaped suites the §3
  argument is actually about (breeding genetics, leaderboards, trait
  concurrency, transaction isolation, money conservation), and run the broad
  middle — middleware, validators, controllers with simple CRUD — against an
  ephemeral DB. CI uses ephemeral by default; a tagged real-DB job runs the
  integration tier against a disposable _copy/restore_ of canonical, never the
  live instance.

## Decision axes (to be weighed explicitly before deciding)

1. **CI reproducibility.** Ephemeral wins decisively — deterministic, no ambient
   data shifting under assertions, no shared mutable target, runs identically on
   any machine. The current model can't run cleanly in untrusted CI at all
   (it needs the canonical DB).
2. **Catastrophe risk (the c3kb6 class).** Ephemeral wins — a disposable
   container cannot destroy player data. The status quo's safety is
   convention-deep, not structure-deep, and has already failed once.
3. **Real-data fidelity (§3's actual argument).** Real DB wins for the
   integration-shaped suites — real JSONB null patterns, real row counts, real
   collations, real concurrency. This is the genuine, non-naive reason the
   constitution chose the current model, and it must not be hand-waved away.
   Note: a _restore of canonical into an ephemeral instance_ preserves most of
   this fidelity while removing the catastrophe risk.
4. **Test/prod drift.** Real DB "wins" only in the sense that there is no second
   schema to drift; but a migration-applied ephemeral DB drifts no more than the
   migration history itself, which is already the source of truth. This axis is
   weaker than it first appears.

## Consequences

- **If A:** no code change; we accept that CI cannot run the suite against an
  untrusted target and that catastrophe protection stays convention-deep. The
  docker-compose artifact (p8g3a) is discarded. We should still harden scoped
  cleanup (see the failLoudCleanup migration, Equoria-9jv9c and children) since
  that is the only safety net.
- **If B or C:** a migration plan is required — provision the container, wire a
  deterministic seed, repoint `.env.test` (or add `.env.test.ephemeral`), update
  `setup-worktree.sh`, and update CI. This is a multi-issue epic, not a single
  change, and must land coherently to avoid the two-lane anti-pattern. The §3
  text in CLAUDE.md would need a corresponding, deliberate rewrite.

## Notes

- **Secret hygiene (separate, tracked under the rec-#3 issue):** the captured
  docker-compose embedded a Postgres password matching `backend/.env.test`. That
  same credential is committed in plaintext across several tracked env files and
  git history. That exposure is real regardless of which option is chosen here,
  and is tracked independently — do not let it ride on this decision.
- This ADR deliberately does **not** decide. It captures the trade-off so the
  decision is made once, on purpose, by the user — not smuggled in via a stray
  file or deferred into drift.
