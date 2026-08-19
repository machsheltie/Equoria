# Equoria CI, Deployment, and Operations Map

**Status:** Active source-first runbook
**Owner:** Runtime and deployment configuration
**Last verified:** 2026-08-19
**Load only when:** changing or diagnosing CI, hooks, Docker, Railway, deployment gates, release operations, database-pool sizing, process/replica count, or cross-process runtime behavior
**Do not load for:** ordinary feature implementation or testing command discovery

Equoria uses GitHub Actions, repository doctrine checks, Husky hooks, a Docker build, and Railway deployment. This file routes operators to live configuration; it does not copy workflow status, job counts, issue state, or historical incident conclusions.

## Loading rule

Load this file only when changing or diagnosing CI workflows, hooks, Docker packaging, Railway configuration, deployment gates, or release operations. For ordinary implementation and testing, use the commands in `AGENTS.md` without loading this file.

## Live sources

| Concern                           | Authority                                                             |
| --------------------------------- | --------------------------------------------------------------------- |
| CI and scheduled automation       | `.github/workflows/*.yml`                                             |
| Workflow dependency actions       | `.github/dependabot.yml`                                              |
| Doctrine enforcement              | `scripts/doctrine-checks/run-all.sh` and its scripts                  |
| Local Git hooks                   | `.husky/`                                                             |
| Build image                       | `Dockerfile` and `.dockerignore`                                      |
| Railway build/start/health policy | `railway.toml`                                                        |
| Commands and runtime floor        | root and package `package.json` files                                 |
| Beta E2E orchestration            | `playwright.beta-readiness.config.ts`, `docs/testing/BETA_PROFILE.md` |
| Database-pool behavior            | `packages/database/dbPoolConfig.mjs` and focused tests                |
| Process and SSE behavior          | `backend/server.mjs`, cluster/SSE guards, ADR-011                     |
| Secrets/environment contract      | tracked `.env.example` files and workflow environment blocks          |

Enumerate `.github/workflows/` before making a claim about workflow ownership. Do not rely on a prose list or an old incident report; workflows are added, renamed, and consolidated over time.

## Required local gates

The repository-level baseline is:

```bash
npm run test:backend
npm run test:frontend
npm run typecheck
npm run lint
npm run test:e2e:beta-readiness
bash scripts/doctrine-checks/run-all.sh
```

Select additional focused checks from the touched workflow/configuration and current package scripts. Never introduce `continue-on-error`, skip flags, bypass headers, failure-swallowing shell syntax, or relaxed assertions to manufacture a passing gate.

## Railway invariant

`railway.toml` owns the production start command. Prisma migration deployment must succeed before the backend starts; a non-zero migration exit must abort deployment. Preserve the direct/pooler URL behavior already encoded there and verify changes against the doctrine check that enforces fail-fast migration startup.

No document authorizes production deployment, rollback, secret changes, database mutation, branch-protection changes, or external service changes. Those actions require the authority implied by the user's request and must target the exact environment.

## Workflow-change checklist

1. Read every trigger, path filter, permission, environment, dependency, and downstream consumer in the live workflow.
2. Confirm which workflow owns the check; avoid duplicate owners and contradictory gates.
3. Preserve least-privilege permissions and pinned/approved action versions.
4. Use synthetic test secrets only; never print, persist, or upload real secrets.
5. Ensure failures propagate and required artifacts remain available for diagnosis.
6. Run YAML/static validation plus the affected local command and doctrine suite.
7. Re-check branch-protection or platform configuration separately when it is part of the authorized scope; repository YAML cannot prove external settings.

## Deployment-change checklist

1. Read `Dockerfile`, `railway.toml`, health/readiness routes, and affected environment templates.
2. Determine whether the change is backward compatible across old/new application instances and database schema.
3. Apply `docs/migration-deploy-checklist.md` for every dependency-major,
   schema, or data migration, including its additional authentication-sensitive
   checks when that trigger matches.
4. Define an explicit failure/rollback observation before deployment; do not invent unimplemented feature-flag or rollback services.
5. Verify the built artifact and startup path, not only a development server.

Historical CI recovery proposals, readiness reports, generated workflow inventories, and fleet handoffs are evidence only in the archive. They never override live configuration.

## Runtime scaling guardrails

Railway currently starts `node server.mjs` directly; the startup path does not
fork Node cluster workers. `CLUSTER_ENABLED` and `WEB_CONCURRENCY` are signals
consumed by guards, not a complete launcher. Confirm the live startup path
before claiming otherwise.

`packages/database/dbPoolConfig.mjs` currently owns Prisma pool defaults and
environment overrides. Every backend process has its own pool, so potential
connections grow with replicas, workers, overlapping deploys, tests,
migrations, administration, and other services. Never derive a safe pool or
replica count from a generic formula or an assumed PostgreSQL maximum.

The SSE event bus is process-local. Multiple serving processes can delay live
events until polling catches up. Cross-process fan-out must be implemented and
verified before multi-process deployment is treated as safe. Also review cron
uniqueness, schedulers, caches, rate limiting, graceful shutdown, and startup
preloads for multi-process semantics.

Before any production capacity change:

1. Measure concurrent demand, transaction duration, pool wait/P2024 errors,
   CPU, memory, and database activity.
2. Confirm the actual database/pooler mode, plan limits, reserved capacity,
   deploy overlap, and operational consumers.
3. Budget connections across every simultaneous process with recovery
   headroom.
4. Resolve or explicitly gate every process-local subsystem, especially SSE.
5. Load-test the proposed topology and verify shutdown, scheduler uniqueness,
   limiting, caches, and saturation behavior.
6. Change configuration, tests, deployment guidance, observability, and the
   rollback value together.

Increasing a timeout does not create capacity. Source, current platform limits,
and measured telemetry outrank every number in prose.
