# Pending bd issues — buffer during the bd outage (2026-08-18)

`bd create` is down: Windows Device Guard / Smart App Control blocks the
unsigned `bd.exe` (`spawn UNKNOWN` from bd.js; npm reinstall confirms:
"blocked by your organization's Device Guard policy"). Resolving the block is
a user security decision. **Import each item below into bd and delete this
file once bd works.** This is an outage buffer, not a TODO list — per
CLAUDE.md Principle 5 these belong in bd.

## 1. Backend Jest memory footprint audit (task, P2)

Per-worker RSS under ~750MB so the 2-worker budget stops costing anything.
User directive 2026-08-18: full-suite runs must fit ~1.5–2GB RAM. The knob
fix landed same day (maxWorkers 2 pinned in config+script, 512MB
workerIdleMemoryLimit, 1536MB local heap, 4096 CI heap, hygiene flag set
clearMocks/resetMocks/restoreMocks/resetModules, posttest orphan reaper) and
the measured full run fit: peak jest RSS 1697MB, 860 suites in ~9.5 min.
Structural work: (1) `--logHeapUsage` profile, rank worst suites; (2) measure
the `--experimental-vm-modules` module-registry retention share (a serial
full run exit-134 OOM'd at a 1536MB ceiling before ONE suite completed —
that's the leak's size); (3) shared app bootstrap for integration suites;
(4) re-tune workers upward once steady-state per-worker RSS < 750MB.
Acceptance: measured peak combined jest RSS ≤ 2GB, zero recycle events in a
clean run, wall-clock within 2x of the 8-min baseline.

## 2. buyStoreHorseSystemAccountPair flakes under parallel workers (bug, P3)

`modules/marketplace/__tests__/buyStoreHorseSystemAccountPair.integration.test.mjs`
asserts an EXACT before/after delta on the global `SystemAccount.burn`
balance (line ~183). Under 2-worker parallel runs another suite can credit
burn between the snapshots (observed 2026-08-18: expected +STORE_PRICE,
got +STORE_PRICE+400; passes 4/4 in isolation). Violates the CLAUDE.md
fixture-coexistence rule (never assume your delta is the only one on a
shared global row). Fix shape: assert the purchase's own ledger row
(amount + linked account + linked user) instead of a global balance delta;
keep the user-side exact-delta assertion (test-owned row, race-free).
Adjacent-locations check REQUIRED: grep other suites asserting exact
global SystemAccount/burn balance deltas (showEscrowMoneyConservation is
sentinel-class — review, don't blindly change).

## 3. Root `npm test` + `test:backend:full` sharded profile not re-audited for the memory budget (task, P3)

The 2026-08-18 budget work retuned `backend/jest.config.mjs`, backend test
scripts, and root `jest.config.js` (2 workers / 512MB / forceExit / hygiene
flags). NOT re-audited: the root 2-project invocation's real memory profile,
and `test:backend:full` (`run-suite-sharded.mjs --jest-shards=8 --heap=4096`)
— the pre-push profile, currently dormant under the --no-verify exception
but due for the same budget treatment before the hook returns
(Equoria-fefh2.20).

## 4. reap-orphan-jest.mjs has no sentinel test (task, P4)

`backend/scripts/reap-orphan-jest.mjs` (posttest orphan reaper) ships
without a test proving it fires (OPTIMAL_FIX §2). Windows-only script;
a sentinel would spawn a throwaway node process masquerading as an orphaned
jest worker and assert the reaper kills it and spares live-parent processes.
