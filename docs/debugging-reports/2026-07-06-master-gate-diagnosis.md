# Master-Gate Diagnosis — CI-only failures, current blockers, and the --no-verify retirement path

**Date:** 2026-07-06
**Author:** Fable (CI/progression ownership session)
**Scope:** P0-2 (master gate restoration / `--no-verify` retirement, `Equoria-fefh2.20`) and P0-3 (CI-only failures, `Equoria-fefh2.43`)
**Evidence base:** GitHub Actions runs 28731482324 (2026-07-05, HEAD e3373193b), 28658530821 (2026-07-03), full run history to 2026-06-22; local reproductions on this machine (Node v24.14.0, Windows, canonical DB); `bd` issue history fefh2.43 / fefh2.15 / fefh2.20.

---

## TL;DR

1. **The four suites named in P0-3 are already root-caused, fixed, and green in CI.** All five fefh2.43 items landed on master 2026-06-16 (commits `8b33d5b29`, `0b745bb2d`, `8a2532f12`, `a598d1fcf`, `c31b6f497`). CI run 28731482324 shows `PASS` for every one of them. No further work on those four.
2. **The Quality Gate is still red — on two _different_, newer failures**, both root-caused in this session with local reproductions and one-line-class mechanical fixes:
   - `retryableTransactionWrapping.sentinel` — a **stale pinned count**, regressed by commit `28d01bfbc` (2026-07-03). Fails in Shard 3 **and** Security Gate. **Not CI-only — it fails locally too**; it reached master only because pushes bypass the pre-push Jest suite.
   - `prismaCleanupLifecycle.sentinel` — fails **only under `jest.config.security.mjs`** via an ESM self-import cycle in `jest-environment-node` caused by the security config's `mjs`-first `moduleFileExtensions` interacting with the `.js`-stripping `moduleNameMapper`. Reproduced locally; probe-fix verified (7/7 pass with `js`-first ordering).
3. These two are the **only** failures on current master: Shard 3 = `1 failed / 265 passed`, Security Gate = `2 failed / 756 passed`, Shards 1–2 green. Everything downstream (Coverage Gate, E2E, Docker, Beta Readiness, Deployment Gate) has been **skipped for weeks** and is unexercised — expect possible latent failures there once the gate un-blocks.
4. Fix specs + restoration plan below. Filed: `Equoria-3ewqy` (stale pin), `Equoria-ip8kk` (security-config TDZ) — both dep-wired as blockers of `Equoria-fefh2.43`.

---

## 1. What P0-3 actually asked, and what turned out to be true

`Equoria-fefh2.43` named four CI-only failures: `betaReadinessEnvSentinel`, `preflightTimerSentinel`, `traitHistoryLogFkIntegrity.integration`, `breedController`. Investigation shows **all four were diagnosed and fixed on master on 2026-06-16** (fefh2.43 comments record the full evidence chain). This session independently verified:

- `git log` confirms all five fix commits are ancestors of master.
- CI run 28731482324 (current HEAD e3373193b) logs show `PASS` for `betaReadinessEnvSentinel.test.mjs`, `preflightTimerSentinel.test.mjs`, `preflightScriptDepResolution.sentinel.test.mjs`, `traitHistoryLogFkIntegrity.integration.test.mjs`, and `modules/breeding/__tests__/breedController.test.mjs`.

### 1.1 Root causes of the historical four (for the record, one line each)

| Suite                                   | Root cause class                                    | Root cause                                                                                                                                                                                                             | Fix (on master)                                                                                                                                                                |
| --------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| betaReadinessEnvSentinel                | **Env-file availability** (test-design flaw)        | Test read gitignored `backend/env.beta` / `env.beta-readiness` (real DB passwords) — a fresh CI checkout can never have them                                                                                           | `8b33d5b29` — assert against the tracked, secret-free `*.example` templates; sentinel-positive test added                                                                      |
| preflightTimerSentinel                  | **Dependency availability**                         | `scripts/preflight/db-probe.mjs`/`db-health.mjs` bare-imported `pg`/`dotenv`, resolved from repo-root `node_modules` which CI never installs (`npm ci` only in backend/ + packages/database/) → `ERR_MODULE_NOT_FOUND` | `0b745bb2d` — `createRequire` anchored to `backend/package.json`; new `preflightScriptDepResolution.sentinel`                                                                  |
| traitHistoryLogFkIntegrity.integration  | **Fresh-DB vs restored-DB parity**                  | Postgres identifier case-folding: quoted mixed-case FK names + unquoted re-adds coexist on a fresh-migrated CI DB (4 FKs) vs 2 on the restored local DB; test pinned exact lowercase names                             | `8a2532f12` — assert on `pg_get_constraintdef()` semantics (columns + ON DELETE behavior), tolerant of name case and count. Schema dedup tracked separately as `Equoria-zvads` |
| breedController                         | **Collation oracle mismatch**                       | Controller sorts by Postgres collation; test re-sorted with JS `localeCompare` (ICU) — they disagree on the apostrophe in "M'Bayar"; Windows-1252 local collation agreed, CI Linux Postgres didn't                     | `a598d1fcf` — assert API order equals the DB's own `unnest(...) ORDER BY` order (collation-agnostic)                                                                           |
| _(item 5)_ applyEpigeneticTraitsAtBirth | **Statistical flake** (also reddened Security Gate) | 25-iteration `Math.random` appearance loop, false-negative tail ~1.3e-4 per test, doubled exposure via shard overlap                                                                                                   | `c31b6f497` — deterministic seed-sweep through the existing injected-LCG `seed` param                                                                                          |

**Classification answer for the P0-3 mandate:** none of the four were product defects, and none were secret-availability failures in the "missing CI secret" sense. Two were _environment-parity_ test-design flaws (gitignored files; dependency resolution), two were _test-oracle_ flaws (collation; probability). Nothing was fixed by skipping, weakening, or conditionally guarding — every fix strengthened or preserved the assertion (verified in the test sources on master).

The residual fefh2.43 acceptance criterion — **"all backend shards + Security Gate green in CI on two consecutive master commits"** — is what remains open, and it is blocked by the two _new_ failures below, not by the original four.

---

## 2. Current blocker 1 — `retryableTransactionWrapping.sentinel` (stale pin)

### Evidence

- CI run 28731482324, Shard 3 and Security Gate, identical failure:
  ```
  ● Equoria-7x9po — migrated $transaction sites stay wrapped › modules/grooms/controllers/groomMarketplaceController.mjs:
    imports the util, wraps 1 site(s), has 1 total $transaction site(s)
  expect(received).toBe(expected)  // at retryableTransactionWrapping.sentinel.test.mjs:113
  Expected: 1
  Received: 2
  ```
- **Local reproduction (this session):** `Test Suites: 1 failed — Tests: 1 failed, 26 passed` under the default config. **This failure is not CI-only.**
- First red run: 28657339947 (2026-07-03 11:22, HEAD `28d01bfbc`). Every Quality Gate run since fails on it.

### Root cause

Commit `28d01bfbc` ("atomic money debit transactions for marketplace refresh and hiring", Equoria-t7ywe/otii0, 2026-07-03 07:21) added a **second** `prisma.$transaction(` site to `groomMarketplaceController.mjs` (the hire path, line ~297) — **correctly wrapped in `withRetryableTxMapping`** (verified by reading both sites: refresh at 165–166, hire at 297–298, both with the 503-surface catch) — but did not update the sentinel's pinned counts at `backend/__tests__/retryableTransactionWrapping.sentinel.test.mjs:61`, which still say `{ wrapped: 1, totalTx: 1 }`.

The sentinel is doing exactly its documented job ("adding a NEW $transaction … trips the sentinel, forcing a conscious decision: wrap it or move it to KNOWN_UNWRAPPED + bump totalTx"). The conscious decision was simply never made, because the commit was pushed with `--no-verify` and the doctrine suite (the only mandatory pre-push check under the active exception) does not run Jest sentinels. **This blocker is direct, concrete evidence for retiring the exception (§5).**

### Mechanical fix spec (fleet-applicable, one edit)

- File: `backend/__tests__/retryableTransactionWrapping.sentinel.test.mjs`, line 61.
- Change: `['modules/grooms/controllers/groomMarketplaceController.mjs', { wrapped: 1, totalTx: 1 }],` → `{ wrapped: 2, totalTx: 2 }`.
- Justification to carry in the commit message: both sites verified wrapped (refresh `165–166`, hire `297–298`); this is a pin update reflecting a correctly-wrapped new site, not a gate weakening (EDGE_CASE §2 satisfied — the assertion stays exact-count).
- Verification: `node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/retryableTransactionWrapping.sentinel.test.mjs --no-coverage` → 27/27. Run under `--config jest.config.security.mjs` too (same suite executes in the Security Gate).

---

## 3. Current blocker 2 — `prismaCleanupLifecycle.sentinel` under the security config (ESM self-import TDZ)

### Evidence

- CI run 28731482324: suite **PASSES in Shard 3** (default config), **fails to even load in Security Gate**:
  ```
  ● Test suite failed to run
  ReferenceError: Cannot access 'cjsModule' before initialization
    at node_modules/jest-environment-node/build/index.mjs:3:32
  ```
- **Local reproduction (this session):** identical error with `--config jest.config.security.mjs`; suite passes under the default config. Config-deterministic, not flaky, not CI-only.
- Present in every examined run back to at least 2026-07-03; the suite itself landed 2026-06-16 (`18968ac69`, fefh2.15) — the Security Gate has most likely been red on this since then.

### Root cause (mechanism chain, each link verified)

1. `prismaCleanupLifecycle.sentinel.test.mjs:13` imports `jest-environment-node` **inside the Jest sandbox** (to spy on the base class teardown). This is the only suite that does so — which is why only this suite fails.
2. `jest-environment-node/build/index.mjs` (v30.4.1) is a 4-line ESM wrapper: `import cjsModule from './index.js'; export const TestEnvironment = cjsModule.TestEnvironment; …`
3. Both jest configs carry the mapper `'^(\\.{1,2}/.*)\\.js$': '$1'`, which applies to **all** modules including node_modules — it rewrites the wrapper's relative `'./index.js'` to `'./index'` (extension stripped).
4. The **default** config has no `moduleFileExtensions` override → Jest's default order (`js` first) resolves `'./index'` → `index.js` (the CJS implementation). Works.
5. The **security** config sets `moduleFileExtensions: ['mjs', 'js', 'json']` (`jest.config.security.mjs:14`) → `mjs` first resolves `'./index'` → **`index.mjs` — the module imports itself**. During its own evaluation it reads its own not-yet-initialized `cjsModule` binding → the TDZ `ReferenceError` at line 3 col 32.

### Hypothesis test (Phase-3 minimal probe, this session)

A probe config identical to `jest.config.security.mjs` except `moduleFileExtensions: ['js', 'mjs', 'json']` → **`Test Suites: 1 passed, Tests: 7 passed`**. Reverting the order reproduces the failure. Mechanism confirmed.

### Mechanical fix spec (fleet-applicable, one edit)

- File: `backend/jest.config.security.mjs`, line 14.
- Change: `moduleFileExtensions: ['mjs', 'js', 'json']` → `['js', 'mjs', 'json']` (js-first, matching Jest's default relative order and the behavior of the default config that 758 suites already pass under in Shards 2–3).
- Why this is safe: extension order only matters when **both** candidates exist for an extensionless specifier. The app tree is uniformly `.mjs` (never a paired `.js`/`.mjs`), so the only both-exist cases are node_modules dual-package builds — exactly the case being fixed. The same suites all pass under js-first ordering in the default config (Shard 2/3 CI evidence).
- Add a comment on the line: mjs-first + the `.js`-stripping mapper self-resolves dual-package ESM wrappers (jest-environment-node TDZ) — do not reorder.
- Verification: `node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.security.mjs __tests__/prismaCleanupLifecycle.sentinel.test.mjs --coverage=false` → 7/7. Then the full `npm run test:security` for the gate-parity check.
- **Adjacent-locations check (done):** only `jest.config.security.mjs` carries the mjs-first override; `jest.config.mjs`, `jest.config.performance.mjs`, `jest.config.optimized.mjs`, and root `jest.config.js` do not (grep evidence in session log).
- Alternative considered and rejected as primary: rewriting the sentinel to derive the base class via `Object.getPrototypeOf(PrismaCleanupEnvironment)` instead of importing `jest-environment-node`. It would mask the config landmine while leaving it armed for the next dual-package import; the config fix removes the landmine. (The sentinel refactor remains a legitimate optional hardening, not required.)

---

## 4. Current state of the whole gate (run 28731482324, HEAD e3373193b)

| Job                                                               | Status                             | Cause                                 |
| ----------------------------------------------------------------- | ---------------------------------- | ------------------------------------- |
| Lint, DB Preflight, Shards 1–2, Frontend                          | ✅ green                           | —                                     |
| Backend Tests Shard 3                                             | ❌ `1 failed / 265 passed`         | Blocker 1 only                        |
| Security Gate                                                     | ❌ `2 failed / 756 passed`         | Blockers 1 + 2                        |
| Coverage Gate, E2E, Docker Build, Beta Readiness, Deployment Gate | ⬜ skipped                         | starved by upstream since ~2026-06-16 |
| Burn-In (weekly schedule)                                         | ⚠ cancelled (60-min timeout class) | non-gating; observe after restoration |

**Risk to plan for:** the five skipped jobs have produced no signal for weeks of commits. When Blockers 1–2 land, they will execute against ~3 weeks of unexercised changes. Treat the first post-fix run as a triage run, not a guaranteed green.

---

## 5. Restoration plan — master gate + `--no-verify` retirement

Ordered; each step names its owner. Agent steps are fleet-dispatchable; user steps are Constitution §6 gates.

1. **[fleet] Land Blocker-1 fix** (pin update, §2). One commit, push per active exception (doctrine suite first — mandatory).
2. **[fleet] Land Blocker-2 fix** (extension order, §3). Separate commit (separate defect class, EDGE_CASE §7).
3. **[fleet/lead] Observe the next Quality Gate run.** Expected: Shards 1–3 + Security Gate green; Coverage Gate, E2E, Docker, Beta Readiness execute for the first time in weeks. Triage anything red there as NEW bd issues with this doc's evidence discipline (root cause before fix; no skips/weakening).
4. **[lead] Two consecutive green Quality Gate runs on master** → satisfies the fefh2.43 AC and the fefh2.15 "backend CI shards pass twice on same commit" criterion. Post raw run links on both issues; **user closes** (Principle 6).
5. **[lead] Local authoritative-gate proof:** three consecutive `npm run test:backend:full` (8-shard sequential) green runs on the frozen post-fix HEAD — the fefh2.15 exit criterion. (Its historical blocker, the cronDistributedLock flake, was fixed by `ad1559c44`; fefh2.44 is closed.)
6. **[lead] Execute the fefh2.20 WS5 checklist in order:** doctrine suite all-green; backend lint+format; fresh-DB migration replay; full backend authoritative suite; frontend Vitest; Playwright readiness/E2E per doctrine; Evidence Verification; CodeQL + ZAP; full master CI green on the resulting commit, with the Deployment Gate's required jobs **executed, not skipped**.
7. **[lead] Re-enable the pre-push hook path:** verify `.husky/pre-push` runs end-to-end locally (doctrine → `test:backend:full`) on current master and time it. No hook edits are expected — the "infrastructure issue" that justified the exception (the fetchCsrf timeout wave) was resolved by fefh2.15's Phase-C fix (custom env teardown + per-file registry), and the hook already consumes the canonical sharded profile.
8. **[USER] Remove the `--no-verify` active-exception block from CLAUDE.md.** Agents may not do this (the exception text and Principle 6 both reserve it). Suggested removal condition, satisfied by steps 4–7: two consecutive green master CI runs + three green local authoritative runs + a timed successful hook execution.
9. **[USER] P0-4 follows:** re-run beta readiness signoff only after this gate is green (out of scope here; noted for sequencing).

### Why retirement is urgent, in one sentence

Blocker 1 is the proof: a sentinel that fails in 0.4 seconds locally sat red on master for three days because nothing between an agent's keyboard and CI runs Jest anymore — the exception has converted every push into a post-hoc discovery.

**Interim mitigation while the exception is still active (recommendation, not a new rule):** sessions touching files listed in a structural sentinel's pin table (`retryableTransactionWrapping`, `prismaCleanupLifecycle`, shard-exclusivity, file-size ratchet) should run that sentinel before pushing — they are sub-second. The durable fix is step 8, not this.

---

## 6. Filed issues (deferral channel, Principle 5)

| ID              | Title                                                             | Covers                                      |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `Equoria-3ewqy` | retryableTransactionWrapping stale pin                            | §2 fix spec                                 |
| `Equoria-ip8kk` | jest.config.security.mjs mjs-first self-import TDZ                | §3 fix spec                                 |
| `Equoria-xal4m` | (Part-B adjacent) cron executor never updates Horse.totalEarnings | filed from the same session's Part-B design |

`Equoria-3ewqy` and `Equoria-ip8kk` are P1 bugs wired as blockers of `Equoria-fefh2.43` (they block its AC); the restoration umbrella remains `Equoria-fefh2.20`. Existing issues already covering the rest: `Equoria-fefh2.20` (restoration umbrella, steps 5–8), `Equoria-fefh2.15` (authoritative-run criteria), `Equoria-zvads` (duplicate-FK schema dedup).

## 7. What was NOT done (honest scope boundary)

- **No code was changed in this session** — it is a diagnosis deliverable by design; the fleet applies §2/§3.
- The two consecutive green runs (fefh2.43 AC) cannot exist until the fixes land — tracked on fefh2.43.
- Downstream-job latent failures (§4 risk) are unknowable until the gate un-blocks — plan step 3 owns the triage.
- Burn-In cancellation cause not root-caused (non-gating, schedule-only) — will be observable after restoration; if it recurs on a green gate, file then.
