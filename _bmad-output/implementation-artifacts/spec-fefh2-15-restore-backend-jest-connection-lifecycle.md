---
title: 'Equoria-fefh2.15 Restore Backend Jest Connection Lifecycle'
type: 'bugfix'
created: '2026-06-10'
status: 'in-progress'
baseline_commit: 'e71788240487bd8e5d6ac33583508f1869793754'
context:
  - 'docs/sprint-change-proposal-2026-06-10-ci-test-infrastructure-recovery.md'
  - 'CLAUDE.md'
  - '.claude/rules/OPTIMAL_FIX_DISCIPLINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Parallel Jest files create separate Prisma clients, while cleanup registration and draining can resolve different `jest.setup.mjs` instances and suppress failures. PostgreSQL reaches 100 connections, mostly idle, causing `fetchCsrf` timeouts despite low request latency and no lock waits.

**Approach:** Replace the module-local cleanup Set with one explicit per-Jest-environment registry on `globalThis`, register clients without a native dynamic import, and make cleanup failures visible. Preserve the serial fresh-process authoritative gate, then expose named test profiles and enforce that package scripts, the pre-push hook, and CI use documented, budgeted commands.

## Boundaries & Constraints

**Always:** Use the canonical real database; keep cleanup awaited and fail-loud; retain scoped fixture cleanup; preserve eight sequential fresh-process shards; add sentinel-positive registry coverage; record before/after connection evidence.

**Ask First:** Production database mutation, changing the canonical real-DB doctrine, removing the active `--no-verify` exception, or replacing the serial authoritative gate with parallel execution.

**Never:** Increase Jest or `fetchCsrf` timeouts as the remedy; add retries or bypass headers; lower test coverage; silently catch registration/disconnect errors; use one monolithic `--runInBand` process as the authoritative gate; kill unrelated agent processes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Normal suite lifecycle | A test file imports the shared Prisma client | Exactly one client is registered in that file's Jest global and disconnected in `afterAll` | Cleanup completes before the environment exits |
| Duplicate imports | Multiple modules import Prisma in one test file | Registry deduplicates the same client | No duplicate disconnect |
| Standalone script | `NODE_ENV=test` outside Jest | Client works without importing Jest setup | Only non-Jest use may omit registration |
| Disconnect failure | `$disconnect()` rejects | The test file fails with client/context details | Do not clear the failed entry silently |
| Parallel files | Two or more Jest workers process many app-import suites | Connection count remains within the configured worker/pool budget | Diagnostic run fails clearly before PostgreSQL exhaustion |

</frozen-after-approval>

## Code Map

- `packages/database/prismaClient.mjs` -- constructs the per-file singleton and performs fragile registration.
- `backend/jest.setup.mjs` -- cleanup registry API and disconnect behavior.
- `backend/tests/setup.mjs` -- per-file awaited `afterAll` drain.
- `packages/database/dbPoolConfig.mjs` -- test pool size and connection-budget source.
- `backend/scripts/run-suite-sharded.mjs` -- existing fresh-process serial runner.
- `backend/scripts/diagnose-full-suite.mjs` -- worker matrix and PostgreSQL/process evidence.
- `backend/package.json` and `package.json` -- named backend test profiles.
- `.husky/pre-push` -- authoritative local gate entry point.
- `.github/workflows/test.yml` -- CI backend shard command and failure artifacts.
- `scripts/doctrine-checks/` -- command-sync and budget sentinels.

## Tasks & Acceptance

**Execution:**
- [ ] Add a failing sentinel proving registration and cleanup can diverge or fail silently.
- [ ] Refactor the Prisma cleanup registry to a shared `globalThis` contract, remove the native setup-module import, and surface registration/disconnect errors.
- [ ] Add focused lifecycle tests for deduplication, successful drain, failed disconnect, and non-Jest standalone use.
- [ ] Add named full, CI, targeted, and diagnostic backend profiles using existing real-DB runners.
- [ ] Add sentinel-positive doctrine checks for authoritative-command synchronization and worker × pool connection budget.
- [ ] Make CI emit Jest JSON and upload it with summarized failure artifacts.
- [ ] Run post-fix worker diagnostics, three authoritative local gates on a frozen tree, and capture CI evidence in `Equoria-fefh2.15`.

**Acceptance Criteria:**
- Given repeated app-import suites at two and default workers, diagnostics keep connections below budget with zero `fetchCsrf` setup timeouts.
- Given a planted registry mismatch or rejected disconnect, when lifecycle sentinels run, then they fail rather than report green.
- Given the authoritative profile, when it runs three consecutive times on one commit, then all backend suites pass without leaked fixture rows.
- Given the same commit in CI, when backend shards run twice, then both runs pass and retain downloadable Jest failure evidence.
- Given any drift between package scripts, pre-push, CI, or pool budget, when doctrine checks run, then the gate fails locally.

## Design Notes

Prefer a database-owned registry helper or `Symbol.for(...)` key on the Jest environment's `globalThis`. Direct registration avoids importing backend test setup from database code. A process-global registry is rejected because the lifecycle boundary is one Jest environment, not the worker process.

### Measured Correction After Planning

The initial module-instance hypothesis in the frozen intent was not the complete cause. A focused real-database sentinel proved registration and direct cleanup could work. Clean before/after diagnostics identified the decisive lifecycle defect: shared cleanup was registered before suite-owned `afterAll` hooks, so later fixture cleanup could reconnect Prisma after it had been disconnected. The implementation therefore keeps the per-environment registry but drains it from custom Jest environment teardown, after suite hooks. This correction preserves the approved outcome and constraints while replacing the disproven mechanism with measured evidence.

## Verification

**Commands:**
- `npm --prefix backend test -- --runInBand <lifecycle-sentinel>` -- expected: sentinel-positive lifecycle cases pass after first proving red.
- `npm --prefix backend run lint` and `npm --prefix backend run format:check` -- expected: zero errors.
- `bash scripts/doctrine-checks/run-all.sh` -- expected: all doctrine checks pass, including planted sync/budget violations.
- `npm --prefix backend run test:backend:diagnostic -- --workers=2` and `--workers=50%` -- expected: bounded connections and zero CSRF setup timeouts.
- `npm --prefix backend run test:backend:full` three times on one commit -- expected: all suites pass.
