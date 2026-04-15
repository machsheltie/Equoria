# TEA:CI — CI/CD Pipeline Quality Gate Audit

**Author:** Murat (TEA — Test Excellence Advisor)
**Date:** 2026-04-07
**Capability:** CI — Continuous Integration Pipeline Audit
**Workflows audited:**
- `.github/workflows/ci-cd.yml` (11 jobs)
- `.github/workflows/security-scan.yml` (dependency scan + OWASP ZAP)
- `.github/workflows/codeql.yml`
- `.github/workflows/test-auth-cookies.yml`

**Config files audited:**
- `backend/jest.config.mjs`
- `backend/jest.config.performance.mjs`
- `backend/jest.config.security.mjs`
- `backend/jest.config.optimized.mjs`
- `backend/package.json` (test scripts)

---

## Executive Summary

The pipeline has strong bones — linting, build validation, security scanning (ZAP + CodeQL + Dependabot), and Docker smoke tests are all present. However, **5 structural gaps** degrade the pipeline's actual quality signal:

1. **Playwright E2E tests never run in CI** — 7 specs exist, zero CI job executes them
2. **No coverage threshold gate** — coverage is reported but never enforces a floor
3. **Performance tests run in the wrong job** — `databaseOptimization.test.mjs` runs in the main suite, not the performance job
4. **No module-level test path validation** — CI won't know when new `modules/<domain>/__tests__/` tests are added (passive gap; resolves once Epic 21-1 ships)
5. **ZAP scan does not fail PRs** — `fail_action` only activates on push to master, not on PR

These are all addressable within Epic 21 scope (Stories 21-7 and 21-8 directly, with scaffolding changes needed for the others).

---

## 1. Pipeline Inventory

| Job | Workflow | Trigger | Blocks Deploy? |
|---|---|---|---|
| code-quality | ci-cd.yml | push/PR | Yes (backend-tests depends on it) |
| database-setup | ci-cd.yml | push/PR | No (parallel with code-quality) |
| backend-tests | ci-cd.yml | push/PR | Yes (integration-tests depends on it) |
| integration-tests | ci-cd.yml | push/PR | Yes (performance-tests depends on it) |
| performance-tests | ci-cd.yml | push/PR | Yes (deployment-readiness depends on it) |
| frontend-tests | ci-cd.yml | push/PR | Yes (build-validation depends on it) |
| build-validation | ci-cd.yml | push/PR | Yes (deployment-readiness depends on it) |
| security-scan | ci-cd.yml | push/PR | Yes (deployment-readiness depends on it) |
| deployment-readiness | ci-cd.yml | push to master only | Gate step |
| build-docker | ci-cd.yml | push to master only | Parallel |
| lighthouse | ci-cd.yml | push to master only | Parallel |
| dependency-scan | security-scan.yml | push/PR + weekly | No (separate workflow) |
| zap-scan | security-scan.yml | push/PR + weekly | No (separate workflow) |
| codeql | codeql.yml | push/PR + weekly | No (separate workflow) |
| auth-cookie-tests | test-auth-cookies.yml | path-filtered push/PR | No (separate workflow) |

---

## 2. Gap Analysis

### CI-GAP-01 — Playwright E2E Tests Not Executed in CI (CRITICAL)

**Severity:** HIGH | **Risk ID from TD:** R-03, R-10 | **Epic 21 Story:** 21-9 scaffolding

**Finding:** `ci-cd.yml` has 11 jobs. Zero of them run Playwright. The 7 E2E specs in `tests/e2e/` (core-game-flows, auth, breeding, and any new specs) **never execute in CI**.

```
# What exists in ci-cd.yml: NONE
# What's needed:
jobs:
  e2e-tests:
    name: 'E2E Tests (Playwright)'
    needs: [build-validation]
    ...
    run: npx playwright test
```

**Impact:** A broken user flow (auth, breeding, competition) can merge to master undetected. The E2E suite that exists is silent in CI.

**Recommendation:** Add a `test-e2e` job to `ci-cd.yml` that:
1. Spins up Postgres + starts the Express server
2. Runs `npx playwright test --reporter=github`
3. Uploads Playwright traces as artifacts on failure
4. Is required for `deployment-readiness` on master

---

### CI-GAP-02 — No Coverage Threshold Gate (HIGH)

**Severity:** HIGH | **Story:** New story or add to 21-7

**Finding:** `backend/jest.config.mjs` has no `coverageThreshold` key. The CI job calls `npm run test:coverage` (not `npm run test:coverage:threshold`). A `test:coverage:threshold` script exists in `package.json` but is unused in CI.

```json
// backend/package.json — exists but never called in CI:
"test:coverage:threshold": "node --experimental-vm-modules ... --passWithNoTests=false"
```

Coverage is uploaded to Codecov with `fail_ci_if_error: false` — even Codecov outages don't block the build. **Coverage can drop to 0% and CI still passes.**

**Recommendation:** Add `coverageThreshold` to `jest.config.mjs`:

```javascript
coverageThreshold: {
  global: {
    branches: 60,
    functions: 70,
    lines: 70,
    statements: 70,
  },
},
```

And switch the CI job from `npm run test:coverage` to `npm run test:coverage:ci` (which already has the `--ci` flag). Start conservative (60/70/70/70) and ratchet upward as Epic 21 improves coverage.

---

### CI-GAP-03 — Performance Tests in Wrong Execution Context (HIGH)

**Severity:** HIGH | **Risk ID from TD:** R-07 | **Epic 21 Story:** 21-7

**Finding:** `jest.config.performance.mjs` targets `['**/__tests__/performance/**/*.test.mjs']` — a `performance/` subdirectory. But `databaseOptimization.test.mjs` lives at `backend/__tests__/databaseOptimization.test.mjs` (root, not in a `performance/` subdirectory).

Result:
- `npm run test:performance` → does **NOT** run `databaseOptimization.test.mjs` (path doesn't match)
- `npm test` → **DOES** run `databaseOptimization.test.mjs` (matches `**/*.test.mjs`)

The performance test runs in the main suite (60s timeout, parallel workers) instead of the dedicated performance job (120s timeout, sequential). The dedicated performance CI job is effectively a no-op.

**Recommendation (two options):**

Option A (preferred — move the test file):
```bash
mkdir -p backend/__tests__/performance
mv backend/__tests__/databaseOptimization.test.mjs backend/__tests__/performance/
```

Then add to `jest.config.mjs` testPathIgnorePatterns:
```javascript
testPathIgnorePatterns: [
  '/node_modules/', '/coverage/', '/dist/', '/build/', '/tests/load/',
  '/__tests__/performance/', // NEW: exclude from main suite
],
```

Option B (change the performance config pattern):
```javascript
// jest.config.performance.mjs
testMatch: ['**/__tests__/**/*.performance.test.mjs', '**/databaseOptimization.test.mjs'],
```

Either way: add an explicit SLA assertion in the CI performance job step:

```yaml
- name: 'Run Performance Tests with SLA Gate'
  working-directory: ./backend
  run: |
    npm run test:performance
    echo "✅ Performance tests passed SLA gate"
```

The test file itself should `expect(responseTime).toBeLessThan(100)` — verify this is actually present in the test (if not, add assertions in Story 21-7).

---

### CI-GAP-04 — ZAP Scan Does Not Fail PRs (MEDIUM)

**Severity:** MEDIUM | **Workflow:** security-scan.yml

**Finding:** ZAP scan `fail_action` is conditionally set:

```yaml
fail_action: ${{ github.event_name == 'push' && 'true' || 'false' }}
```

On **push to master** → fails. On **PR** → does not fail. A PR introducing an OWASP vulnerability passes CI and can be merged.

**Recommendation:**
```yaml
# Change both ZAP steps to:
fail_action: true
```

Or at minimum:
```yaml
fail_action: ${{ github.event_name == 'push' || github.event_name == 'pull_request' }}
```

---

### CI-GAP-05 — Frontend Coverage Not Gated (MEDIUM)

**Severity:** MEDIUM

**Finding:** Same as CI-GAP-02 for frontend. `npm run test:coverage` runs, uploads to Codecov with `fail_ci_if_error: false`, no threshold enforced.

Frontend has 220 Vitest test files but zero hook-level tests for 47 React Query hooks (R-06). After Epic 21-5 adds them, a threshold would catch regressions.

**Recommendation:** Add `vitest.config.ts` coverage threshold:
```typescript
coverage: {
  thresholds: {
    lines: 60,
    functions: 60,
    branches: 50,
  },
}
```

Start low, increase as hook tests land.

---

### CI-GAP-06 — Integration Test Job Runs Misclassified Tests (MEDIUM)

**Severity:** MEDIUM | **Risk ID from TD:** R-05 | **Epic 21 Story:** 21-6

**Finding:** Job 4 runs `npm run test:integration` which uses `--testPathPattern=integration`. This matches:
- `systemWideIntegration.test.mjs` ✓ (correct — integration)
- `crossSystemValidation.test.mjs` ✓ (correct — integration)
- `redis-circuit-breaker.test.mjs` ✓ (in `integration/` folder)
- `auth-cookies.test.mjs` ✓ (in `integration/` folder)

Post-Story-21-6 (reclassification), `systemWideIntegration` and `crossSystemValidation` will be slimmed to 3–5 assertions each. The CI job still works, but the pattern-based approach means any file with "integration" in the path is included — including tests that shouldn't be there.

**Recommendation:** After 21-6 ships, consider switching to an explicit testPathPattern:
```
--testPathPattern=__tests__/integration/
```
(Current `--testPathPattern=integration` is substring-match; could accidentally include files in paths like `backend/modules/competition/...` if a file ever contains "integration" in its name.)

---

### CI-GAP-07 — `sleep 5` in test-auth-cookies.yml (LOW)

**Severity:** LOW | **Workflow:** test-auth-cookies.yml

**Finding:** Server startup uses `sleep 5` which is a flakiness risk on slow CI runners:
```yaml
run: |
  npm start &
  sleep 5
  curl http://localhost:3000/health || exit 1
```

**Recommendation:** Replace `sleep 5` with `npx wait-on`:
```yaml
run: |
  npm start &
  npx wait-on http://localhost:3000/health --timeout 30000
```

The `zap-scan` job in `security-scan.yml` already does this correctly (`npx wait-on http://localhost:3000/health -t 30000`). Apply the same pattern here.

---

### CI-GAP-08 — No Test Report Annotations on PR Failure (LOW)

**Severity:** LOW

**Finding:** Backend and integration test jobs upload JUnit-style artifacts but don't use `dorny/test-reporter` or similar to annotate failing tests directly on the PR. Developers must download artifacts to see which test failed.

**Recommendation (optional, nice-to-have):**
```yaml
- name: 'Publish Test Results'
  uses: dorny/test-reporter@v1
  if: always()
  with:
    name: 'Jest Test Results'
    path: './backend/test-results/*.xml'
    reporter: 'jest-junit'
```

---

## 3. Pipeline Dependency Graph (Current State)

```
push/PR
  │
  ├─ code-quality ─────────────────────────────────┐
  │                                                 │
  ├─ database-setup                                 │
  │                                                 ▼
  └──────────────────────────── backend-tests ─────────────────────┐
                                      │                             │
                                integration-tests                   │
                                      │                             │
                               performance-tests                    │
                                      │                             │
                               ╔══════╧══════╗              frontend-tests
                               ║ DEAD END:   ║                     │
                               ║ E2E NEVER   ║              build-validation
                               ║ RUNS IN CI  ║                     │
                               ╚═════════════╝          deployment-readiness (master only)
                                                               │
                                                     build-docker + lighthouse
```

---

## 4. Pipeline Dependency Graph (Target State After Epic 21)

```
push/PR
  │
  ├─ code-quality
  │      │
  │      ├─ backend-tests (with coverage threshold)
  │      │      │
  │      │      ├─ integration-tests (slimmed — post 21-6)
  │      │      │
  │      │      └─ test-performance (separated — post 21-7)
  │      │             └─ SLA gate enforced
  │      │
  │      └─ frontend-tests (with coverage threshold — post 21-5)
  │
  ├─ build-validation
  │      │
  │      └─ e2e-tests ← NEW (Playwright, post 21-9)
  │             └─ storageState auth (post 21-8)
  │
  └─ deployment-readiness (master only)
         needs: [backend-tests, frontend-tests, e2e-tests, build-validation, security-scan, test-performance]
```

---

## 5. Scaffolding Checklist (What Epic 21 Must Deliver)

| Item | Story | File to Change | Change |
|---|---|---|---|
| Add `test-e2e` job to ci-cd.yml | 21-9 | `.github/workflows/ci-cd.yml` | New job running `npx playwright test` |
| Add E2E job to deployment-readiness `needs:` | 21-9 | `.github/workflows/ci-cd.yml` | Add `e2e-tests` to needs array |
| Move `databaseOptimization.test.mjs` to `__tests__/performance/` | 21-7 | File move | Matches performance config pattern |
| Add performance path to main config ignore list | 21-7 | `backend/jest.config.mjs` | `testPathIgnorePatterns` update |
| Add coverage threshold to jest.config.mjs | 21-7 | `backend/jest.config.mjs` | `coverageThreshold` key |
| Switch CI backend coverage to `test:coverage:ci` | 21-7 | `.github/workflows/ci-cd.yml` | Script name in step |
| Add Vitest coverage threshold | 21-5 | `frontend/vitest.config.ts` | `coverage.thresholds` |
| Fix ZAP `fail_action` to block PRs | 21-7 | `.github/workflows/security-scan.yml` | Change conditional |
| Fix `sleep 5` → `wait-on` | Any | `.github/workflows/test-auth-cookies.yml` | Replace sleep |

---

## 6. Gate Decision

| Gate | Status | Gap |
|---|---|---|
| All critical tests run in CI | ❌ FAIL | Playwright E2E absent from CI |
| Coverage threshold enforced | ❌ FAIL | No `coverageThreshold` in jest config |
| Performance tests separated + gated | ❌ FAIL | databaseOptimization.test.mjs in wrong job |
| Security scans block PRs | ⚠️ PARTIAL | ZAP doesn't fail PRs (only pushes) |
| Build → Test → Deploy chain complete | ⚠️ PARTIAL | E2E not in chain |
| No flaky CI anti-patterns | ⚠️ PARTIAL | `sleep 5` in test-auth-cookies.yml |

**Overall CI Quality Gate: NEEDS WORK**

The pipeline will reach PASS after the 5 items in Section 5's scaffolding checklist are completed — all achievable within Epic 21 stories 21-7, 21-8, and 21-9.

---

## 7. What's Working Well (Don't Change)

- Code quality job (ESLint + format check) correctly blocks backend-tests — good gate placement
- PostgreSQL service container correctly uses health checks before test jobs start
- Docker smoke test validates container startup + frontend embedding (Jobs 10)
- Lighthouse CI on master is a solid UX quality gate
- CodeQL on push/PR provides static analysis
- OWASP ZAP full scan on weekly schedule is thorough
- Dependabot security scanning is active
- `wait-on` used correctly in ZAP job (not `sleep`) — use as the template for fixing test-auth-cookies.yml
- `test:coverage:ci` script exists with `--ci` flag — just needs to be wired into the workflow

---

*Report generated: 2026-04-07 | Author: Murat (TEA) | Next action: TEA:AT — Story 21-1 failing acceptance tests*
