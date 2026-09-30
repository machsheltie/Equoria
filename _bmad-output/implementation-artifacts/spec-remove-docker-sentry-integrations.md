---
title: 'Remove repository-managed Docker and Sentry integrations'
type: 'chore'
created: '2026-09-17'
status: 'implemented'
review_loop_iteration: 0
context:
  - '{project-root}/docs/devops-cicd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Equoria's documented operating model excludes Docker-managed application builds and hosted Sentry telemetry, but the repository still forces Railway through `Dockerfile` and makes a Docker image build a required CI gate. Sentry has already been removed in the current baseline and must remain absent.

**Approach:** Replace the application Dockerfile path with one deterministic native production-build command shared by Railway Railpack and GitHub Actions. Preserve the existing Railway migration-before-start invariant, asset validation, and deployment gate while deleting Docker-specific application configuration and confirming no executable Sentry integration remains.

## Boundaries & Constraints

**Always:** Keep the Railway service root at repository root; install the independent backend, database, and frontend package-lock roots; generate Prisma before runtime; build and validate `frontend/dist`; retain fail-fast `prisma migrate deploy && server` startup; preserve `/health`; keep CI deployment and critical-job gates internally consistent.

**Ask First:** Any Railway dashboard/environment mutation, production or preview deployment, change to the service root, database schema/data change, or decision to remove container-based Postgres/Redis used only as CI infrastructure.

**Never:** Reintroduce Sentry or another hosted telemetry service; edit test files; weaken doctrine or deployment gates; remove the migration gate; treat Railway's internal Railpack containerization as a forbidden app Docker integration; delete `.dockerignore` while Railpack still consumes it.

## I/O & Edge-Case Matrix

| Scenario         | Input / State                               | Expected Output / Behavior                                                                      | Error Handling                                                  |
| ---------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Production build | Clean checkout with four npm lockfile roots | Installs required dependencies, generates Prisma, builds frontend, and verifies required assets | Any install, generation, build, or asset failure exits non-zero |
| Railway startup  | Migration succeeds                          | Backend starts from the repository-root Railpack output                                         | Migration failure aborts before `server.mjs`                    |
| CI master gate   | Native production build succeeds            | Deployment gate and skip sentinel report the replacement build job as passed                    | Skipped, cancelled, or failed required build remains blocking   |

</frozen-after-approval>

## Code Map

- `Dockerfile:1` -- delete the repository-managed multi-stage application image definition.
- `package.json:scripts` -- add the canonical production-build command for all package roots, Prisma generation, frontend build, and asset verification.
- `railway.toml:4-23` -- switch `DOCKERFILE` to `RAILPACK`, call the canonical build command, and keep migration/start/health policy with portable repository-relative paths.
- `.dockerignore:1-103` -- retain as Railpack's exclusion input, update its purpose, and remove stale self/Dockerfile exclusions.
- `.github/workflows/test.yml:60-65,1103-1153,1308-1335,1475-1562` -- replace `docker-build` with native production-build validation and update every gate, summary, and skip-sentinel reference.
- `backend/config/staticAssets.mjs:24-59` -- read-only evidence that `frontend/dist` is served directly without copying into `backend/public`.
- `backend/app.mjs:355-357` and `backend/modules/horses/routes/horseBreedingRoutes.mjs:230-236` -- remove stale Docker-specific production commentary without changing behavior.
- `docs/devops-cicd.md:24-34,128-141,268-276` -- document Railpack/native build ownership and verification.
- `backend/package.json`, `frontend/package.json`, `packages/database/package.json` -- independent install/build contracts; Sentry dependencies are already absent.

## Tasks & Acceptance

**Execution:**

- [x] `package.json` -- `build:production` runs `scripts/build-production.mjs`, a fail-fast stage runner (backend/database/frontend `npm ci`, Prisma generate, Vite build, asset verification; `--dry-run` prints the stages).
- [x] `.railway/railway.ts`, `Dockerfile`, `.dockerignore` -- Dockerfile and `.dockerignore` deleted (Railway's source ignore files are `.gitignore` / `.railwayignore`; `.dockerignore` had no consumer without the Dockerfile). Builder `RAILPACK` with `buildCommand: 'npm run build:production'`; start command kept `migrate deploy && node server.mjs` with repository-relative paths (Railpack runs from `/app`, per railpack.com/config/file).
- [x] `.github/workflows/test.yml` -- `docker-build` replaced by `production-build` (master only, same `if:`), wired into `deployment-gate`, the skip sentinel (`R_PRODUCTION_BUILD`, `EXPECT_MASTER_ONLY`), the header map and the gate summary.
- [x] `backend/app.mjs`, `backend/modules/horses/routes/horseBreedingRoutes.mjs`, `backend/utils/healthCheck.mjs`, `docs/devops-cicd.md` -- stale Docker commentary removed; docs record the Railpack/native build path.
- [x] Repository runtime/config scan -- Sentry rg matches only historical comments in tests/helpers and `showExecutionReaper.mjs`; no packages, DSNs, initialization or capture calls.

**Acceptance Criteria:**

- Given a clean checkout, when `npm run build:production` runs, then all required package roots install deterministically, Prisma generates, the frontend builds, required assets exist, and any failed stage stops the command.
- Given Railway reads `railway.toml`, when it builds and starts Equoria, then it uses Railpack without a repository Dockerfile and still refuses to start after a failed migration.
- Given the master workflow runs, when the replacement build job fails or is unexpectedly skipped, then deployment remains blocked and the critical-job sentinel reports it.
- Given repository source and manifests are scanned, when Sentry runtime identifiers and dependencies are queried, then no executable integration or environment contract is found.

## Spec Change Log

- 2026-09-30 (Equoria-6q7cf): implemented. Code Map re-derived from live files: `railway.toml` no longer exists (migrated to `.railway/railway.ts` on 2026-09-22), so the Railpack switch and start-command change landed there. `.dockerignore` was deleted rather than retained because no evidence shows Railpack consuming it. `railway config apply` and the first Railpack deploy remain owner actions.

## Design Notes

Railpack sets `NODE_ENV=production`; that activates the production SPA fallback and cron initialization already present in `backend/app.mjs` and `backend/server.mjs`. The repository change should preserve that intended production behavior. Runtime rollout still requires checking Railway's configured variables and repository-root setting before deployment; this task does not mutate the live service.

## Verification

**Commands:**

- `npm run build:production` -- expected: dependency installs, Prisma generation, frontend build, and asset validation all succeed.
- `node scripts/doctrine-checks/check-railway-migrate-failfast.mjs` -- expected: migration startup remains fail-fast.
- `node scripts/doctrine-checks/check-critical-jobs-mirrors.mjs` -- expected: renamed critical job and mirrors are consistent.
- `bash scripts/doctrine-checks/check-workflows-lint.sh` -- expected: workflow syntax and references pass.
- `bash scripts/doctrine-checks/run-all.sh` -- expected: every doctrine gate passes.
- `npm run typecheck` and `npm run lint` -- expected: both pass, or any pre-existing unrelated blocker is reported with evidence.
- `rg -n -i "SENTRY_DSN|SENTRY_RELEASE|@sentry|captureException|captureMessage|setupExpressErrorHandler" backend frontend package*.json` -- expected: no executable/configuration matches.
