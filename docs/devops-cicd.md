# Equoria DevOps & CI/CD Documentation

**Generated:** 2025-12-01
**Last Updated:** 2026-05-15 (post-Epic 21R refactor — Equoria-wj8m, Equoria-1mpp, Equoria-tic2, Equoria-rh32)

## Overview

Equoria uses GitHub Actions for continuous integration, security scanning, and
adversarial-review gating, Docker multi-stage builds for packaging, Railway for
production deployment, and Husky for local git hooks. The pipeline is split
across **eleven workflows** which together exercise lint, doctrine compliance,
backend Jest (sharded), frontend Vitest, Playwright E2E, Lighthouse, OWASP ZAP,
performance, security, beta-readiness, deployment-gate, burn-in, and a set of
adversarial review gates (Blind Hunter, Evidence Verification, PR Body Evidence).

The canonical source of truth for backend / frontend / E2E test execution is
`.github/workflows/test.yml` (**"Equoria Quality Gate"**). The legacy
`ci-cd.yml` was demoted to a 3-job sidecar by Equoria-wj8m / 1mpp / tic2 on
2026-05-15 and now runs only build-validation, Lighthouse, and the nightly
session-lifetime cron.

Node is pinned at **22.x** in every workflow (raised from 18.x in the 2026-05-15
refactor). All workflows pin `JWT_SECRET` / `JWT_REFRESH_SECRET` to length-32+
synthetic test secrets that satisfy `validate-environment.mjs`.

---

## Workflow Index (twelve workflows, 2026-05-15)

| Workflow | File | Purpose | Blocks merge? |
| --- | --- | --- | --- |
| **Equoria Quality Gate** | `test.yml` | Canonical pipeline: lint → db-preflight → backend (sharded) → coverage gate → frontend → E2E → performance → security → docker → beta-readiness → deployment-gate → burn-in | yes (required) |
| **Equoria CI/CD Pipeline** | `ci-cd.yml` | Build-validation smoke + Lighthouse + nightly session-lifetime cron | partial |
| **Doctrine Gate** | `doctrine-gate.yml` | Runs `scripts/doctrine-checks/run-all.sh` against PRs and master | yes (when branch protection enabled) |
| **Blind Hunter Gate** | `blind-hunter-gate.yml` | Adversarial Claude review on PRs touching CI / request-pipeline / doctrine paths | yes (when branch protection enabled) |
| **Evidence Verification** | `evidence-verification.yml` | Re-runs every `_bmad-output/test-artifacts/evidence/*.md` verification command and asserts expected-output markers still appear | yes |
| **PR Body Evidence** | `pr-body-evidence.yml` | Parses PR description against `.github/pull_request_template.md` and fails on placeholder / unticked checkboxes | yes |
| **OWASP ZAP Security Scan** | `security-scan.yml` | Baseline + API + scheduled full ZAP scans, SARIF upload | informational + scheduled |
| **CodeQL** | `codeql.yml` | GitHub CodeQL JS/TS SAST on push, PR, and weekly cron — security-extended + security-and-quality query suites, SARIF upload to Security tab | informational + scheduled |
| **HttpOnly Cookie Auth Tests** | `test-auth-cookies.yml` | Path-filtered auth-cookie regression suite for `authController` / middleware / hooks | yes (auth-touching PRs) |
| **Claude Code Review** | `claude-code-review.yml` | On-PR Claude review for non-draft PRs | informational |
| **Claude Code** | `claude.yml` | Triggered by `@claude` mention in PR / issue comments | manual |
| **Update Visual Baselines** | `update-visual-baselines.yml` | Manual `workflow_dispatch` for regenerating Playwright `toHaveScreenshot` baselines on Linux + Chromium | manual |

---

## 1. Equoria Quality Gate (`test.yml`) — Canonical Pipeline

`.github/workflows/test.yml` is the BMad-TEA-generated quality pipeline.
1194 lines, ~13 jobs. All other workflows are supplementary.

### Triggers

- `push` to `master` or `develop`
- `pull_request` to `master` or `develop`
- `schedule: '0 2 * * 0'` (Sundays 02:00 UTC) — runs the **burn-in** job
- `workflow_dispatch`

### Concurrency

```yaml
group: ${{ github.workflow }}-${{ github.ref }}-${{ github.sha }}
cancel-in-progress: true
```

**Per-SHA grouping** (Equoria-sv0b): every commit gets its own concurrency
group so each push runs to completion. The cancel-in-progress flag only fires
when the same SHA is re-pushed (rebase + force-push, webhook duplication, or
manual `workflow_dispatch` on an existing commit).

### Global Environment

```yaml
NODE_VERSION: '22.x'
DATABASE_URL: 'postgresql://test:test@localhost:5432/equoria_test'
JWT_SECRET: 'Test-JWT-Secret-For-CI-Minimum-32-Chars-Long-A1'
JWT_REFRESH_SECRET: 'Test-Refresh-Secret-For-CI-Minimum-32-Chars-B2'
NODE_ENV: 'test'
REDIS_URL: 'redis://localhost:6379'  # ioredis is mocked in jest tests; URL kept for CI parity
```

### Job Graph

```
   lint ──────────────┐
                      ├──> backend-tests (matrix: shard 1/2/3)
   db-preflight ──────┤        │
                      │        ▼
                      │   coverage-gate (70% line/branch)
                      │
                      ├──> frontend-tests (Vitest + coverage)
                      │
                      ├──> e2e-tests (Playwright + DB + Redis)
                      │
                      ├──> performance-tests
                      │
                      ├──> security-gate (audit-allowlist + sentinel tests)
                      │
                      ▼
              docker-build (multi-stage Dockerfile smoke)
                      │
                      ▼
              beta-readiness-gate (NODE_ENV=beta-readiness)
                      │
                      ▼
              deployment-gate (aggregated required checks)

   burn-in (Sunday cron) — parallel; not part of merge gate
```

### Key jobs

#### 1.1 `lint` — Lint & Format

Installs root `npm ci` (eslint flat-config imports `@eslint/js` and
`typescript-eslint` from root `node_modules`), then runs:

- ESLint backend (`backend && npm run lint`)
- ESLint frontend (`frontend && npm run lint`) — hard-required since commit
  4ffa8316 added eslint to `frontend/devDependencies`
- Prettier check, backend + frontend

#### 1.2 `db-preflight` — Database Migration Check

Spins up the Postgres service, runs `prisma migrate deploy` against the test
DB, and asserts there are no pending migrations. Mirrors the local
`scripts/preflight/db-health.mjs` check (Equoria-urld).

#### 1.3 `backend-tests` — Sharded Backend Suite

`strategy.matrix.shard: [1, 2, 3]` — Jest splits the suite by file count. Each
shard runs:

```
node --experimental-vm-modules --max-old-space-size=8192 \
  node_modules/jest/bin/jest.js \
  --shard=${{ matrix.shard }}/3 \
  --coverage \
  --coverageReporters=json
```

Coverage JSON from each shard is uploaded as an artifact for `coverage-gate`
to merge. The shard outputs are also uploaded individually so a failing shard
keeps its console log even when other shards green.

**Per Epic 21R doctrine**: no `test.skip`, no `continue-on-error`, no bypass
headers in any beta-relevant suite (enforced by the doctrine-gate workflow).

#### 1.4 `coverage-gate` — 70% Line/Branch Threshold

`needs: [backend-tests]`. Downloads `coverage-shard-1|2|3` artifacts, merges
them via `nyc merge`, and asserts the merged report meets the line + branch
threshold (currently 70%). Fails the merge if coverage drops.

#### 1.5 `frontend-tests` — Vitest

`needs: [lint]`. Runs `vitest run --coverage` in `frontend/`. The
`continue-on-error: true` bypass that historically lived on this job was
removed in Equoria-zzlh (2026-05-04) and cannot be reintroduced — the
`check-no-continue-on-error.sh` doctrine check fails the gate if it returns.

#### 1.6 `e2e-tests` — Playwright

`needs: [db-preflight, lint]`. Boots the backend (`backend && npm run start`)
and the Vite frontend, then runs `npx playwright test`. Reads
storageState seeded by `tests/e2e/global-setup.ts` so specs use the same
real-credential path as local runs (no `x-test-user` / `x-test-skip-csrf`
bypass headers — Equoria-iswu / 21R-CI-1). Uploads `playwright-report` HTML
on success or failure.

Active spec list (22 files, 2026-05-15):
`auth-page-chrome`, `auth`, `beta-critical-path`, `breeding`,
`celestial-night-features`, `celestial-night-navigation`, `community`,
`conformation-shows`, `core-game-flows`, `feed-stat-gain-notifications`,
`feed-system-phase-a`, `feed-system-phase-b`, `font-migration`,
`glass-panel-surface`, `groom-lifecycle`, `horse-detail-coat-genetics`,
`inventory`, `navigation-structure`, `onboarding-flow`, `session-lifetime`,
`settings-persistence`, `smoke`.

#### 1.7 `performance-tests` — Non-blocking

Runs the backend performance suite (`/metrics` warm-latency SLA, etc.). Not
gated for merge — surfaces regressions to the PR comment without blocking.

#### 1.8 `security-gate` — Audit-Allowlist + Sentinel Tests

Runs `npm audit --audit-level=high` against an allowlist
(`scripts/doctrine-checks/gates-allowlist.txt`), executes the
sentinel-positive security test suite (request-body, parameter-pollution,
rate-limit), and asserts no `continue-on-error` markers exist in any
workflow file.

#### 1.9 `docker-build` — Multi-stage Smoke

Builds the production Dockerfile (Vite frontend → Express + embedded SPA),
loads the image, and runs `prisma migrate status` against the test DB inside
the container to confirm the multi-stage build wiring still works.

#### 1.10 `beta-readiness-gate` — `bash scripts/check-beta-readiness.sh`

`NODE_ENV=beta-readiness`. Runs the canonical end-to-end readiness gate. Per
21R doctrine, this script must run with all sub-gates enabled and no skip
flags. Output is uploaded as `beta-readiness-artifacts`.

#### 1.11 `deployment-gate` — Aggregated Required Status

Acts as the single required check for branch protection. Depends on all
preceding jobs (`needs: [lint, db-preflight, backend-tests, coverage-gate,
frontend-tests, e2e-tests, security-gate, docker-build,
beta-readiness-gate]`). When all of those green, deployment-gate succeeds.

#### 1.12 `burn-in` — Weekly Flaky Detection (cron only)

Sunday 02:00 UTC. Runs the full backend Jest suite **10×** to surface
flakes. Failures upload as `burn-in-failures-<run_id>`. Does not block
merge — runs on a schedule for trend monitoring.

---

## 2. CI/CD Pipeline (`ci-cd.yml`) — 3-Job Sidecar

After Equoria-wj8m / 1mpp / tic2 (2026-05-15) this workflow was demoted from
the canonical 11-job pipeline to a 3-job sidecar that only carries the jobs
unique to ci-cd.yml.

### Triggers

- `push` to `master` or `develop`
- `pull_request` to `master` or `develop`
- `workflow_dispatch`
- `schedule: '0 2 * * *'` — daily 02:00 UTC for `session-lifetime-nightly`

### Jobs

| Job | Purpose |
| --- | --- |
| `build-validation` | Vite production build + backend ESM `node --check` smoke. Catches TypeScript / Vite compilation regressions even when test.yml is red. |
| `lighthouse` | Master-only Lighthouse CI run gated by `build-validation`. Thresholds: a11y error ≥0.85, performance warn ≥0.6 (`.lighthouserc.yml`). |
| `session-lifetime-nightly` | Cron-only auth-regression spec for 21R-AUTH-6 — re-runs `tests/e2e/session-lifetime.spec.ts` against a fresh backend to detect 14-day refresh-token drift. |

**Removed from this workflow (now in `test.yml`):**
`code-quality`, `database-setup`, `backend-tests`, `integration-tests`,
`performance-tests`, `frontend-tests`, `security-gate`, `beta-readiness-gate`,
`build-docker`, `deployment-gate`.

---

## 3. Doctrine Gate (`doctrine-gate.yml`)

**Purpose:** machine-checked enforcement of the rules in `CLAUDE.md`,
`.claude/rules/EDGE_CASE_FIX_DISCIPLINE.md`, and the 21R Beta Readiness
Doctrine. Each rule has a script in `scripts/doctrine-checks/check-*.{sh,mjs}`.
Failure of any script fails the gate.

The full check list (auto-discovered via `scripts/doctrine-checks/run-all.sh`):

- `check-audit-level.sh` — no `--audit-level=low/moderate` weakening
- `check-gates-run-on-prs.mjs` — every required gate runs on `pull_request`
- `check-husky-hooks-no-heredoc-cmdsub.sh` — pre-push avoids fragile heredoc / `$(...)` patterns
- `check-husky-hooks-parse.sh` — husky scripts parse cleanly under bash
- `check-needs-references.mjs` — workflow `needs:` references are valid
- `check-no-bypass-headers.sh` — no `x-test-skip-csrf` / `x-test-bypass-auth` / `x-test-bypass-rate-limit` / `x-test-user` / `x-test-bypass-ownership` in beta-relevant code
- `check-no-cleanup-routes.mjs` — no `/__test__/cleanup` style routes in production paths
- `check-no-continue-on-error.sh` — zero `continue-on-error: true` in CI workflows
- `check-no-db-mocks.mjs` — no Prisma client mocks in backend tests (`vi.mock` / `jest.mock` of `prisma`)
- `check-no-frontend-mocks.mjs` — no new `vi.mock` of `api-client`
- `check-no-skips-in-readiness.sh` — no `test.skip` / `it.skip` / `describe.skip` / `test.fixme` in readiness-relevant specs
- `check-no-stale-js-extensions.sh` — no `.js` extensions on `.mjs` files
- `check-no-test-only-imports.mjs` — no `import` of test-only fixtures from production code
- `check-playwright-orchestration.mjs` — Playwright config has correct `webServer` orchestration
- `check-security-middleware-tested.mjs` — every middleware in `backend/middleware/*Security*` has a sentinel-positive test
- `check-workflow-concurrency-per-sha.mjs` — every workflow has per-SHA concurrency

The gate runs and reports on every PR today; it becomes a hard merge blocker
when the branch-protection toggle for "Require Doctrine Gate" is enabled in
GitHub Settings.

---

## 4. Adversarial Review Gates

### 4.1 Blind Hunter Gate (`blind-hunter-gate.yml`)

Calls Claude with the Blind Hunter prompt against the PR diff for PRs that
touch high-risk paths (`.github/workflows/`, `backend/middleware/request*`,
`scripts/doctrine-checks/`). Parses the output for P0/P1 findings; applies
the `blind-hunter-passed` label only when zero blocking findings are
reported. The label is removed on every push so the gate cannot be bypassed
by labelling and then sneaking in another commit.

### 4.2 Evidence Verification (`evidence-verification.yml`)

Re-runs the verification command from every
`_bmad-output/test-artifacts/evidence/*.md` file on every PR and on pushes
to master. Fails the gate if any verified command's output is missing one
of its declared expected-output markers, or if any evidence file is
malformed. Per the rule in `COMPLETION_VERIFICATION_POLICY.md`, this gate
exists because the 21R audit found 4-of-6 stories falsely marked `done`
without runnable verification.

### 4.3 PR Body Evidence (`pr-body-evidence.yml`)

Parses every PR description against `.github/pull_request_template.md`.
Fails the gate if:
- the doctrine-gate exit code / output block is still the template placeholder
- any "No new bypass mechanisms" checkbox is unticked
- the "Gate enforcement" or "Middleware test coverage" sections are not
  marked N/A AND have empty fields

A sentinel self-test step runs the parser against three known-good /
known-bad fixtures so a parser regression fails the gate immediately.

---

## 5. Security & Auth Workflows

### 5.1 OWASP ZAP Security Scan (`security-scan.yml`)

- Baseline scan on every push to `master` / `develop`
- API scan using `backend/docs/swagger.yaml` as the OpenAPI specification
- Full scan on the weekly Monday 02:00 UTC schedule
- SARIF format upload for GitHub Security tab integration
- `permissions: contents: read, security-events: write`

### 5.2 CodeQL (`codeql.yml`)

GitHub CodeQL static-analysis security testing for JavaScript and TypeScript.
Added by Equoria-2njt (2026-05-15) alongside the existing OWASP ZAP runtime
scans. Why both: ZAP catches issues by exercising the running app (XSS
reflection, auth-redirect chains, header misconfig); CodeQL catches issues
by tracing data flow through compiled JS/TS (taint flow from request input
to Prisma queries, prototype-pollution sinks, unsafe-eval / unsafe-dynamic-
method patterns).

- **Triggers**: push to `master` / `develop`, `pull_request`, weekly Tuesday
  03:00 UTC cron (offset from ZAP's Monday cron to avoid scan congestion),
  `workflow_dispatch`.
- **Languages**: `javascript-typescript` (CodeQL v3 combined language).
- **Query suites**: `security-extended` + `security-and-quality`.
- **Path scope**: `backend/`, `frontend/src/`, `scripts/`. Excludes
  `node_modules/`, `dist/`, `build/`, `coverage/`, `playwright-report/`,
  `test-results/`, `__tests__/**/*fixture*`, `frontend/storybook-static/`.
  Fixture exclusion is intentional: integration tests contain intentional
  bad-pattern strings (e.g. polluted-key fixtures) that would produce false
  positives.
- **Upload behavior**: `upload: always` so partial results from a timed-out
  scan still reach the Security tab.

### 5.3 HttpOnly Cookie Authentication Tests (`test-auth-cookies.yml`)

Path-filtered regression suite. Runs only when the PR touches:
- `backend/modules/auth/controllers/authController.mjs`
- `backend/middleware/auth.mjs`
- `backend/app.mjs`
- `frontend/src/lib/api-client.ts`
- `frontend/src/hooks/useAuth.ts`
- `backend/modules/auth/__tests__/auth-cookies.test.mjs`
- `frontend/src/**/__tests__/**`
- `.github/workflows/test-auth-cookies.yml` itself

---

## 6. Claude-Operated Workflows

### 6.1 Claude Code Review (`claude-code-review.yml`)

Runs Claude review on every PR `opened` / `synchronize` / `ready_for_review` /
`reopened` event. Informational — not a merge blocker. Optional author / path
filters are commented out in the file for future enablement.

### 6.2 Claude Code (`claude.yml`)

Triggers on `@claude` mention in PR / issue / review comments and on
`issues: assigned`. Used for interactive Claude commands on bd issues.

---

## 7. Manual Workflows

### 7.1 Update Visual Baselines (`update-visual-baselines.yml`)

`workflow_dispatch` only — regenerates Playwright `toHaveScreenshot`
baselines on the ubuntu-latest + chromium stack that matches normal CI.
Optional `spec` input targets a single spec file. After the job pushes the
snapshots, the consumer is expected to remove any `test.fixme` guards from
the spec and commit that separately so the test becomes a first-class CI
check.

---

## 8. Local Git Hooks (Husky)

### 8.1 pre-push (`.husky/pre-push`)

The pre-push hook runs the full backend Jest suite locally before allowing
a push. It is the canonical proof that the code on the branch is in a
working state. Three preflight gates run before the suite:

1. **Doctrine checks** (`scripts/doctrine-checks/run-all.sh`, Equoria-ocy3 B2)
   — runs all `check-*.{sh,mjs}` scripts. Fast (~2-5s). Mirrors what the
   doctrine-gate workflow runs on the merge commit, so a `--no-verify`
   push still gets caught at CI.
2. **DB reachability** (`scripts/preflight/db-probe.mjs`, Equoria-wnsc) —
   probes the `DATABASE_URL` in `backend/.env.test` with the same pg
   client the suite uses. Fails fast with a clear error message if
   Postgres is unreachable.
3. **DB structural health** (`scripts/preflight/db-health.mjs`, Equoria-urld)
   — checks for pending migrations and orphan FK rows before spending
   ~10 min on Jest.

The Jest command itself:

```bash
node \
  --max-old-space-size=12288 \
  --experimental-vm-modules \
  node_modules/jest/bin/jest.js \
  --runInBand \
  --retryTimes=1
```

Key flags (do not simplify without re-reading `.husky/pre-push` comments):

- `--max-old-space-size=12288` is passed **directly to node** on argv (not
  via `NODE_OPTIONS`) because `NODE_OPTIONS` is silently dropped in the
  `git push` hook environment. Three earlier attempts via `NODE_OPTIONS`
  OOM'd at ~4 GB. 12 GB single-process heap is verified sufficient (peak
  observed RSS under `--runInBand`: ~3.8 GB across the full 4830-test
  suite).
- `--runInBand` runs all tests sequentially in the same Node process.
  Restored 2026-04-29 after `--maxWorkers=1 --workerIdleMemoryLimit=2048MB`
  produced a non-deterministic FK / test-isolation flake that cost 4 push
  attempts across PR #105 and PR #106.
- `--retryTimes=1` handles flaky order-dependent tests. With `--runInBand`,
  the retry happens in the same process — order-dependent state
  (rate-limit buckets, in-memory caches) is preserved, so a retry that
  "shouldn't" pass usually doesn't. That is the desired behavior.

**Current authorized bypass** (CLAUDE.md TEMPORARY EXCEPTION, 2026-05-12):
`git push origin master --no-verify` is allowed on every push while the
hook itself is being investigated for an infrastructure issue. This
exception is time-boxed; when the user removes the exception section from
`CLAUDE.md`, Rule 4 (the full pre-push hook must run) returns to force.

---

## 9. Beta-Readiness Gate — `scripts/check-beta-readiness.sh`

Per the 21R doctrine in `CLAUDE.md`, the final signoff command is:

```bash
bash scripts/check-beta-readiness.sh
```

The script must run with all gates enabled. It must not accept skip flags.
Any environment that cannot run the full gate cannot produce
beta-readiness signoff. The script is invoked by the `beta-readiness-gate`
job in `test.yml` with `NODE_ENV=beta-readiness`.

---

## 10. Sentinel-Positive Test Pattern

Per `.claude/rules/OPTIMAL_FIX_DISCIPLINE.md §2`, every check / gate / scan
/ validator that this pipeline adds must ship with a **sentinel-positive
test** — a test that proves the check fires on a real violation, not just
that the check passes when nothing is wrong.

Examples in the codebase:

- `check-security-middleware-tested.mjs` enforces that every file in
  `backend/middleware/*Security*` has at least one sentinel-positive test
  asserting the middleware rejects a polluted payload.
- The doctrine-gate scripts themselves each have a known-bad fixture
  (e.g. `pr-body-evidence.yml` runs the parser against three fixtures —
  one good, two malformed — before parsing the real PR body).

This pattern is the difference between "the gate currently passes" and
"the gate will fire when it should." Without a sentinel, a check is a
placebo.

---

## 11. Node / Tooling Versions

- **Node.js**: `22.x` across all workflows and `Dockerfile` (raised from
  18.x in the 2026-05-15 refactor)
- **PostgreSQL service**: 15 (CI service container)
- **Playwright**: pinned via `frontend/package.json` — see
  `playwright.config.ts` and `playwright.beta-readiness.config.ts` for
  CI- vs readiness-tier configuration
- **Jest**: 29.x (backend) — upgrade to 30 is tracked in
  `.claude/DEPENDENCY_MAINTENANCE.md`

---

## 12. Future Work

Issues tracked against this pipeline:

- **Equoria-pwl9** — audit ZAP scan `continue-on-error` flags for
  legitimacy vs gate-weakening.
- Burn-in flake threshold tuning (currently informational only).

Recent additions:

- **Equoria-2njt** (landed 2026-05-15) — `.github/workflows/codeql.yml`
  added for JavaScript/TypeScript SAST. See § 5.2 above.
