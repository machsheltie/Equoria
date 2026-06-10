# Sprint Change Proposal: Restore CI and Backend Test Infrastructure Trust

**Date:** 2026-06-10  
**Prepared for:** Heirr / EquoriaLeadArchitect  
**Execution handoff:** Claude Code agent  
**Tracking issue:** `Equoria-4umc5`  
**Change scope:** Major technical course correction within the active tech-debt campaign  
**Recommended mode:** Direct adjustment with sequenced recovery workstreams; no rollback of completed remediation

## 1. Executive Decision

Pause broad tech-debt closure claims and make **CI/test-infrastructure recovery the immediate P0/P1 lane**.

The reported caveat is not one problem. It is six independent failure classes:

1. **Fresh-database migration history is broken.** A 2026 migration adds
   `horses_userId_fkey`, but the initial schema migration already created that
   constraint. This blocks the canonical Quality Gate, backend cookie-auth
   workflow, and ZAP workflow before their tests or scans begin.
2. **The local full parallel backend suite is not a trustworthy gate.** Roughly
   175 suites call `fetchCsrf`, and 205 suites import the full Express app.
   Parallel execution causes widespread setup timeouts, while the pre-push hook
   deliberately runs `--runInBand`. The exact contention mechanism still needs
   measured diagnosis; it must not be guessed or hidden with longer timeouts.
3. **`Equoria-lax36` was a deterministic production CSRF compatibility defect,
   separate from the parallel-infra failure.** Bearer-header authentication
   populated `req.user.id` only during validation, while anonymous CSRF
   issuance used the salt identifier. That issue/validate asymmetry rejected
   legitimate Bearer-authenticated mutations with 403. It was fixed on master
   in `e444ae2c0`; suite cleanup hardening remains under `Equoria-fefh2.16`.
4. **Backend lint has eight real errors.** All eight are in
   `backend/scripts/relocate-orphan-services-tests.mjs`; warnings are separate
   debt and do not currently fail the gate.
5. **Evidence Verification contains stale executable evidence.**
   `Equoria-veql.md` expects `TEST-PATTERN-COUNT:3`, while the current canonical
   workflow produces `TEST-PATTERN-COUNT:0`.
6. **CodeQL is double-configured.** GitHub default setup is enabled while the
   repository also runs an advanced CodeQL workflow. The advanced run uploads
   results successfully, then GitHub rejects the SARIF because default and
   advanced setup cannot coexist. A separate default-setup CodeQL run is green.

The correct response is a dependency-ordered recovery program. Do not treat
targeted green suites as a substitute for the full gate, and do not treat every
red workflow as evidence of application defects.

## 2. Trigger and Evidence

### Trigger

The active epic `Equoria-fefh2` reported:

> the full parallel backend suite remains red (193 suites of fetchCsrf timeouts
> ... plus lax36); targeted real-DB suites and doctrine checks were used before
> pushes; master CI was already failing.

### Verified evidence on current master

Current examined commit: `6e0922716`.

| Signal                                      | Result                | Interpretation                                                  |
| ------------------------------------------- | --------------------- | --------------------------------------------------------------- |
| Doctrine Gate                               | Green                 | Doctrine changes are not the current blocker                    |
| Session-Close Validation                    | Green                 | Session-close policy gate is operational                        |
| Equoria CI/CD Pipeline                      | Green                 | Build sidecar is not broadly broken                             |
| Quality Gate                                | Red                   | Stops at backend lint and DB migration                          |
| HttpOnly Cookie Auth                        | Red                   | Backend job stops at DB migration; frontend job is green        |
| OWASP ZAP                                   | Red                   | Stops at DB schema setup; scan never starts                     |
| Evidence Verification                       | Red                   | One stale evidence marker                                       |
| CodeQL advanced workflow                    | Red                   | Conflicts with enabled default setup                            |
| CodeQL default setup                        | Green                 | Confirms duplicate configuration, not a failed analysis finding |
| `legacyUserDelete` isolated run at baseline | 1/3 red               | Exposed Bearer-header CSRF issue/validate asymmetry             |
| `Equoria-lax36` current status              | Closed at `e444ae2c0` | Production fix landed; 3/3 suite and 3/3 sentinel green         |

Relevant CI runs:

- Quality Gate: <https://github.com/machsheltie/Equoria/actions/runs/27273633611>
- HttpOnly Cookie Authentication Tests:
  <https://github.com/machsheltie/Equoria/actions/runs/27273633623>
- OWASP ZAP Security Scan:
  <https://github.com/machsheltie/Equoria/actions/runs/27273633616>
- Evidence Verification:
  <https://github.com/machsheltie/Equoria/actions/runs/27273633619>
- Advanced CodeQL failure:
  <https://github.com/machsheltie/Equoria/actions/runs/27273633607>

## 3. Root-Cause Analysis

### 3.1 Broken migration chain

The initial migration already contains:

```sql
ALTER TABLE "horses"
ADD CONSTRAINT "horses_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
```

The later migration `20260530120000_v58ta_horse_restrict_fks` incorrectly says
the constraint did not exist and attempts to add it again. A clean database
therefore fails with:

```text
constraint "horses_userId_fkey" for relation "horses" already exists
```

The intended operation is to **replace** the existing constraint's delete
action, not add a missing constraint. This is the highest-priority defect
because it blocks multiple independent CI workflows at their shared database
bootstrap boundary.

### 3.2 Parallel full-suite failure

The current Jest default is `maxWorkers: '50%'`, but the pre-push hook uses
`--runInBand`. At current scale:

- 175 test files call `fetchCsrf`.
- 205 test files import `app.mjs`.
- Each Jest worker gets an isolated module registry and constructs substantial
  app/middleware state.
- CSRF requests traverse the live Express request pipeline.
- Tests share one real PostgreSQL database and in-memory process-local rate
  limiter state.

This creates several plausible contention sources: worker startup/import
pressure, database pool multiplication, shared DB locking, app initialization,
or per-worker HTTP setup. None is yet proven.

The remediation must instrument and bisect worker counts. Raising every
`beforeAll` timeout would only convert a fast diagnostic failure into a slower,
less-informative one.

### 3.3 `lax36` resolution and remaining cleanup

`legacyUserDelete.integration.test.mjs` does this once:

```js
csrf = await fetchCsrf(app);
```

It later sends authenticated mutations with Bearer tokens while forwarding the
anonymous CSRF pair. The middleware incorrectly changed the session identifier
from the salt at issuance to `req.user.id` at validation. That made every
legitimate Bearer-header mutation using this flow fail with 403.

Commit `e444ae2c0` corrected the production behavior by recording
`req.authTokenSource` and preserving the salt/refresh identifier for
Bearer-header authentication. Cookie-authenticated sessions remain bound to
`req.user.id`, preserving cross-user replay protection. The accompanying
`csrfBearerHeaderBinding.sentinel.test.mjs` proves Bearer compatibility, CSRF
enforcement, and cookie cross-user replay rejection.

The suite's generic cleanup can still fail to delete fixture users while a
`ClubMembership` references them. `Equoria-fefh2.16` therefore remains open
only for suite-scoped, fail-loud, FK-ordered cleanup and zero-leak verification.

### 3.4 Remaining independent CI failures

- Lint: eight autofixable errors in one maintenance script.
- Evidence: one command/marker no longer matches the canonical workflow.
- CodeQL: repository advanced setup conflicts with GitHub default setup.

These are small repairs, but they must be kept separate from migration and Jest
infrastructure work so their verification remains precise.

## 4. Impact Analysis

### Epic impact

`Equoria-fefh2` remains viable, but its completion sequence must change.
Infrastructure recovery becomes a blocking workstream ahead of further closure
or broad verification claims.

No gameplay epic must be rolled back. The affected work is quality
infrastructure, migration integrity, test correctness, and CI configuration.

### Story impact

- `Equoria-lax36` is closed at `e444ae2c0`; `Equoria-fefh2.16` retains only
  the cleanup-hardening remainder.
- New child issues should be added under `Equoria-fefh2` for migration
  integrity, parallel-suite diagnosis, lint, evidence, and CodeQL ownership.
- Existing tech-debt children may continue only when they do not compete for
  the same CI/test-infrastructure files and do not claim campaign completion.

### Artifact impact

| Artifact                     | Required change                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `docs/epics.md`              | Add a CI/test-infrastructure recovery workstream under the test-quality/tech-debt context                        |
| PRD-06 Testing Strategy      | Replace stale balanced-mocking/test-DB assumptions with current real-DB doctrine and explicit execution profiles |
| PRD-09 Development Standards | Align branch, push, pre-push, and quality-gate text with current `master` workflow and active exception          |
| `docs/devops-cicd.md`        | Correct workflow state, Redis comments, migration preflight behavior, and CodeQL setup ownership                 |
| `CLAUDE.md`                  | Remove the pre-push exception only after the full gate is restored and explicitly authorized by the user         |
| Sprint status                | Add recovery stories only after this proposal is approved                                                        |
| UX documentation             | No change                                                                                                        |

### MVP/beta impact

Product scope does not change, but readiness evidence is affected. A pipeline
that stops before backend tests, auth tests, or ZAP cannot support a release
claim. Beta/deployment signoff must remain blocked until the recovery exit gate
passes.

## 5. Recommended Workstreams

## Workstream 0: Establish the Recovery Baseline

**Priority:** P0  
**Owner:** EquoriaLeadArchitect / QA  
**Effort:** 0.5 day

1. Create the child Beads issues listed in Section 8.
2. Record current commit, CI run URLs, local Node version, CPU count, DB target,
   and baseline command outputs in issue notes.
3. Explicitly classify each failure as:
   - application defect,
   - test defect,
   - migration defect,
   - workflow/configuration defect,
   - unresolved infrastructure contention.
4. Prohibit umbrella closure based only on targeted-suite results.

**Exit criteria**

- Every red signal has one owner and one issue.
- No issue description conflates `lax36` with the parallel timeout wave.

## Workstream 1: Repair Fresh-Database Migration Integrity

**Priority:** P0, blocks Workstreams 4 and final gate  
**Owner:** DatabaseEngineer  
**Effort:** 0.5-1 day  
**Risk:** High because migration history may already be applied in local and
production databases.

### Implementation requirements

1. Inspect `_prisma_migrations` in:
   - a fresh temporary database,
   - the canonical local Equoria database,
   - Railway production using Railway-injected `DATABASE_URL`.
2. Do not edit an applied migration until deployment state is proven.
3. Select the repair strategy based on that evidence:

   **Preferred when the bad migration is not applied in production:** amend
   `20260530120000_v58ta_horse_restrict_fks` to drop each existing FK before
   recreating it with `ON DELETE RESTRICT`.

   **Required when the bad migration is already applied somewhere important:**
   preserve history and add a compensating migration, plus reconcile the fresh
   database path without rewriting production-applied history. Document the
   exact Prisma strategy before changing files.

4. Add a migration sentinel that creates an empty PostgreSQL database and runs
   the complete migration chain.
5. Verify final FK delete actions from `pg_constraint`, not only Prisma status.
6. Correct the false migration comment that says `horses_userId_fkey` did not
   exist.

### Verification

```bash
cd packages/database
npx prisma migrate deploy
npx prisma migrate status
```

Run against a newly created empty database, then query all three constraints:

- `horses_userId_fkey`
- `horses_sireId_fkey`
- `horses_damId_fkey`

All must exist once and use `RESTRICT`.

Then rerun:

- Quality Gate database-preflight job
- HttpOnly Cookie backend job through migrations
- ZAP workflow through schema setup

### Stop conditions

- Stop if production migration state differs from assumptions.
- Stop if the proposed repair requires marking a failed migration as applied
  without proving schema equivalence.
- Never solve this with `db push`, migration reset, or CI-only constraint
  suppression.

## Workstream 2: Finish `Equoria-fefh2.16` Cleanup Hardening

**Priority:** P1  
**Owner:** BackendSpecialistAgent + QA  
**Effort:** 0.5 day

### Completed prerequisite

`Equoria-lax36` fixed Bearer-header CSRF issue/validate symmetry in
`e444ae2c0`. Do not replace that production fix with per-user CSRF changes in
the test.

### Remaining required changes

1. Replace generic cleanup with suite-scoped fail-loud, FK-ordered cleanup for
   club membership, club, forum, direct messages, staff, notifications,
   transactions, horses, and users.
2. Confirm the non-self 403 comes from `requireSelfAccess`, not CSRF.
3. Preserve and run the Bearer-header CSRF sentinel added by `lax36`.

### Verification

```bash
cd backend
npm test -- legacyUserDelete --runInBand
npm test -- userRoutes userController gdprAccountRoutes --runInBand
```

**Exit criteria**

- 3/3 `legacyUserDelete` tests remain green.
- 3/3 `csrfBearerHeaderBinding` sentinel tests remain green.
- The self-delete reaches controller/service behavior.
- The non-self test reaches `requireSelfAccess`, not CSRF rejection.
- Cleanup leaves zero suite fixture rows.

## Workstream 3: Diagnose and Restore the Full Backend Gate

**Priority:** P0/P1  
**Owner:** QualityAssuranceAgent with BackendSpecialistAgent  
**Effort:** 2-5 days  
**Risk:** High; cross-suite and shared-resource behavior

### Phase A: Reproduce with structured evidence

Run the full suite at fixed worker counts and capture JSON plus process metrics:

```bash
cd backend
npm test -- --runInBand --json --outputFile=full-run-inband.json
npm test -- --maxWorkers=2 --json --outputFile=full-run-w2.json
npm test -- --maxWorkers=4 --json --outputFile=full-run-w4.json
npm test -- --maxWorkers=50% --json --outputFile=full-run-default.json
```

For each run record:

- elapsed time,
- peak Node/worker count and memory,
- first 20 failures,
- number of `fetchCsrf` setup timeouts,
- PostgreSQL active/idle connections,
- lock waits and longest queries,
- whether failures cluster by shard or start time.

Use `utils/agent-skills/log-surgeon.mjs` on each large log.

### Phase B: Instrument the real bottleneck

Add temporary opt-in diagnostics controlled by an environment variable:

- `fetchCsrf` start/end duration and worker ID,
- app import/ready duration,
- Prisma pool connection count,
- PostgreSQL `pg_stat_activity` snapshots,
- rate-limiter initialization count.

Diagnostics must be removable or remain behind an explicit debug flag. Do not
add retries to `fetchCsrf` until the failure mode is known.

### Phase C: Correct the execution architecture

Choose the smallest proven fix:

- If DB pool multiplication is the cause, cap Prisma connection limits per
  worker and set a worker count based on the database connection budget.
- If app construction/import is the cause, reduce repeated heavyweight startup
  or split full-app integration suites from isolated unit/sentinel suites.
- If shared canonical-DB locking is the cause, serialize only the affected
  real-DB integration group using a custom sequencer or explicit Jest project.
- If in-memory rate-limit state is the cause, reset stores deterministically;
  do not restore bypass headers.
- If a subset of suites corrupt shared state, repair fixture isolation and
  cleanup order rather than globally serializing everything.

The repository should end with named, documented profiles:

1. `test:backend:full` - authoritative local pre-push gate.
2. `test:backend:ci` - authoritative CI configuration, equivalent in coverage.
3. `test:backend:targeted` - developer feedback only; never closure evidence.
4. `test:backend:diagnostic` - metrics/log-heavy troubleshooting.

### Required regression protection

- A sentinel verifies the authoritative full command and pre-push hook stay in
  sync.
- A test or script verifies the chosen worker/database connection budget.
- CI uploads Jest JSON and summarized failure artifacts on failure.
- No blanket timeout increase without a before/after latency distribution.

### Exit criteria

- Three consecutive full local runs pass using the authoritative command.
- All backend CI shards pass twice on the same commit.
- Zero `fetchCsrf` setup timeouts.
- No leaked fixture rows or failed cleanup trackers.
- The user can remove the `--no-verify` active exception based on evidence.

## Workstream 4: Clear Independent CI Gate Defects

**Priority:** P1  
**Owner:** QA / DevOps  
**Effort:** 0.5-1 day

### 4A. Backend lint

Fix only the eight errors in
`backend/scripts/relocate-orphan-services-tests.mjs`:

- six `prefer-template`/related string-construction errors,
- two `curly` errors.

Run backend lint and classify the 80 warnings separately. Do not suppress or
mass-rewrite warnings as part of this repair.

### 4B. Evidence Verification

Re-evaluate `Equoria-veql` against the current static-scan implementation.
Either:

- update its command and marker to the new canonical implementation, with an
  explanation of the changed pattern, or
- retire/supersede the evidence if its original protection was replaced.

Do not simply change `3` to `0`; the command must still prove that the mock-data
guard exists and that a sentinel fixture is detected.

### 4C. CodeQL ownership

Choose exactly one supported setup:

- **Recommended:** keep `.github/workflows/codeql.yml` advanced setup and
  disable GitHub default setup in repository settings.
- Alternative: remove the custom workflow and accept default setup, only if its
  scope/query coverage satisfies the documented security requirement.

Upgrade `github/codeql-action` from v3 to v4 before the December 2026
deprecation, then verify only one CodeQL analysis is triggered per event.

### Verification

- `npm --prefix backend run lint`
- `node scripts/verify-evidence-files.mjs`
- one green CodeQL run with no duplicate sibling run

## Workstream 5: Re-run the Complete Gate and Retire the Exception

**Priority:** P0 release gate  
**Owner:** EquoriaLeadArchitect + QA  
**Effort:** 0.5-1 day after prior workstreams

Run in this order:

1. Doctrine suite, 24/24.
2. Backend lint and formatting.
3. Fresh-database migration replay.
4. Full backend authoritative suite.
5. Frontend Vitest.
6. Playwright readiness and broader E2E as required by current doctrine.
7. Evidence Verification.
8. CodeQL and ZAP.
9. Full master CI on the resulting commit.

Only after every required gate is green should the user remove the active
`--no-verify` exception from `CLAUDE.md`.

## 6. Sequencing and Dependencies

```text
WS0 Baseline
  |
  +--> WS1 Migration repair --------------------+
  |                                             |
  +--> WS2 lax36 cleanup remainder              |
  |                                             v
  +--> WS3 Full-suite diagnosis ----------> WS5 Complete gate
  |                                             ^
  +--> WS4A Lint -------------------------------|
  +--> WS4B Evidence ---------------------------|
  +--> WS4C CodeQL -----------------------------+
```

WS1 must land before trusting auth-cookie or ZAP workflow outcomes. WS2 and WS4
can run in parallel with WS3 if agents do not touch the same files. WS5 is
strictly last.

## 7. Proposed Artifact Edits

### Epic / backlog change

**Current**

`Equoria-fefh2` tracks broad mock and test-hygiene remediation without a
dedicated infrastructure recovery lane.

**Proposed**

Add a blocking recovery group:

- Fresh-database migration-chain repair
- Full backend suite concurrency diagnosis
- `lax36` follow-up cleanup hardening
- CI lint/evidence/CodeQL repair
- Full-gate restoration and exception retirement

**Rationale:** These items determine whether the campaign's verification is
credible.

### PRD-06 quality gate change

**Current**

The document still describes Prisma mocking, an isolated `equoria_test`
database, old suite sizes, and sub-minute backend targets.

**Proposed**

Document:

- current real-DB doctrine and scoped cleanup requirements,
- targeted versus authoritative test profiles,
- worker/database connection budgeting,
- mandatory empty-database migration replay,
- executable evidence freshness,
- required distinction between infrastructure failure and product failure.

**Rationale:** Current implementation and governing doctrine have diverged from
the PRD.

### DevOps documentation change

**Current**

The document says the Quality Gate is canonical but contains stale Redis and
pre-push descriptions and does not record the default/advanced CodeQL ownership
constraint.

**Proposed**

Add:

- one-owner rule for CodeQL,
- migration replay as the shared prerequisite for DB-dependent workflows,
- exact authoritative backend commands,
- failure artifact and diagnostic requirements,
- exception removal criteria.

## 8. Beads Issue Plan

Create these issues under `Equoria-fefh2`:

1. **P0 BUG: Repair fresh-database horse FK migration chain**
   - Blocks: auth-cookie CI, ZAP, Quality Gate DB preflight.
2. **P0 BUG: Diagnose full parallel Jest `fetchCsrf` timeout wave**
   - Acceptance includes worker-count matrix and measured root cause.
3. **P1 BUG: Finish `legacyUserDelete` FK-ordered fail-loud cleanup**
   - Existing issue: `Equoria-fefh2.16`; related `Equoria-lax36` is closed.
4. **P1 CHORE: Clear backend lint errors in relocation script**
5. **P1 QUALITY: Re-establish or supersede `Equoria-veql` evidence**
6. **P1 CI: Resolve CodeQL default/advanced setup conflict and upgrade v4**
7. **P0 QUALITY: Restore complete master gate and retire push exception**
   - Depends on all six preceding issues.

Do not close the parent epic until issue 7 has green CI links and raw local
full-suite evidence.

## 9. Risk Controls

| Risk                                       | Control                                                           |
| ------------------------------------------ | ----------------------------------------------------------------- |
| Rewriting applied migration history        | Inspect local and Railway `_prisma_migrations` before editing     |
| Hiding contention with timeouts/retries    | Require worker matrix and database/process metrics                |
| Authorization test passes for wrong reason | Assert middleware-specific response and use identity-bound CSRF   |
| Cleanup damages shared DB                  | ID-scoped, FK-ordered, fail-loud cleanup only                     |
| Targeted suites mistaken for full proof    | Label targeted profile non-authoritative in scripts/docs          |
| CodeQL coverage reduced during dedupe      | Compare advanced queries/path scope before disabling either setup |
| CI green because jobs are skipped          | Deployment gate must show required jobs executed, not skipped     |

## 10. Definition of Done

This course correction is complete only when all are true:

- A fresh PostgreSQL database applies every migration from zero.
- The three horse FKs exist exactly once with intended delete behavior.
- `legacyUserDelete` and its Bearer-header sentinel remain green and leave no
  fixtures.
- Backend lint has zero errors.
- Evidence Verification is green with meaningful sentinel-positive proof.
- Exactly one CodeQL configuration runs and succeeds.
- ZAP reaches and completes its scan phase.
- Three consecutive authoritative local backend runs pass.
- Two consecutive backend CI runs pass on the same code state.
- The complete Quality Gate reaches all required jobs and is green.
- The active pre-push bypass exception is removed by the user.
- `Equoria-fefh2` closure notes link raw evidence rather than only targeted
  suite counts.

## 11. Checklist Status

### Trigger and context

- [x] Trigger identified: `Equoria-fefh2` wave-1 completion caveat
- [x] Core problem separated into six failure classes
- [x] Supporting local and CI evidence collected

### Epic and artifact impact

- [x] Parent epic remains viable with reordered priorities
- [x] New recovery stories required
- [x] PRD/testing/devops documentation drift identified
- [N/A] UX changes

### Path forward

- [x] Direct adjustment is viable
- [x] Rollback rejected: completed remediation is not the root cause
- [x] MVP scope unchanged; readiness evidence remains blocked
- [x] Recommended hybrid: repair, diagnose, then restore full gate

### Finalization

- [x] Implementation handoff and success criteria defined
- [!] User approval required before backlog/sprint-status edits
- [!] Execution remains with the Claude agent

## 12. Handoff Instruction

The executing Claude agent should begin with Workstream 0 and Workstream 1.
It must not start by increasing Jest timeouts or editing `CLAUDE.md`. Each
workstream should be one or more narrowly scoped Beads issues and commits,
with doctrine checks before every push under the current active exception.
