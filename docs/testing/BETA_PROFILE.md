# Playwright Beta Profiles

**Status:** Active operational reference

**Updated:** 2026-08-19

Equoria has two Playwright server profiles. They share real authentication,
CSRF, ownership, and database behavior, but they serve different test lanes and
have different Redis expectations.

## Profile contract

| Profile                   | Entry point                                                                 | Test scope                                               | Redis posture                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV=beta`           | `npm run test:e2e` via `playwright.config.ts`                               | Broad Playwright suite, excluding `tests/e2e/readiness/` | Redis is expected. CI provisions Redis; a real outage remains fail-closed for protected economy, breeding, and competition mutations.        |
| `NODE_ENV=beta-readiness` | `npm run test:e2e:beta-readiness` via `playwright.beta-readiness.config.ts` | Dedicated readiness suite only                           | Redis is intentionally absent in the single-process readiness harness. Rate limiters use the tested in-memory path instead of returning 503. |

Neither profile is `NODE_ENV=test`. Both are intended to exercise the real
browser-to-frontend-to-backend path without auth, CSRF, ownership, route, or
rate-limit bypass headers.

The complete readiness signoff is broader than the readiness Playwright suite:

```bash
bash scripts/check-beta-readiness.sh
```

That script runs the current doctrine and readiness gates. Passing one
Playwright command alone is not a beta-readiness signoff.

## Environment precedence

Do not infer configuration from a template or this document. The live loaders
are `playwright.config.ts`, `playwright.beta-readiness.config.ts`, and
`backend/config/config.mjs`.

Current precedence is:

1. Variables already present in the shell or CI environment are inherited by
   Playwright and are not overwritten by the normal `dotenv` calls.
2. Both Playwright configs load the ignored `backend/.env.test` into the
   Playwright process when present.
3. The backend child process starts with the selected `NODE_ENV`:
   - `beta` loads ignored `backend/env.beta`, falling back to
     `backend/env.test` only when `env.beta` is absent;
   - `beta-readiness` loads ignored `backend/env.beta-readiness`.

There is no automatic `.env.beta.local` loader. Do not create one expecting it
to be read. For persistent local configuration, copy the safe example to the
actual ignored filename and replace every placeholder locally:

```powershell
if (-not (Test-Path backend/env.beta)) {
  Copy-Item backend/env.beta.example backend/env.beta
}
if (-not (Test-Path backend/env.beta-readiness)) {
  Copy-Item backend/env.beta-readiness.example backend/env.beta-readiness
}
```

Alternatively, inject overrides through the current shell or CI environment.
Never overwrite an existing ignored environment file without inspecting it,
and never commit the resulting local files.

## Required values and secrets

Backend startup requires:

- `DATABASE_URL`;
- `PORT`;
- `JWT_SECRET`;
- `JWT_REFRESH_SECRET`;
- the selected `NODE_ENV`.

Both JWT secrets must be at least 32 characters. The deployable `beta` profile
also rejects known placeholder and committed test-only values. `SESSION_SECRET`
is recommended by security configuration but is not currently one of the five
backend startup requirements; do not claim that `config.mjs` requires it.

Use a local secret source or CI secret store. Never put a real database URL,
password, token, or signing secret in this document, an example file, a command
committed to Git, or a captured test artifact.

The examples are templates, not proof of the database a run will use. Before a
destructive, migration, cleanup, or readiness operation, resolve the effective
`DATABASE_URL` from the current process without printing its credentials, and
confirm that the target is the intended disposable test database.

## Redis behavior

`backend/middleware/rateLimiting.mjs` is the runtime source of truth.

- Under `beta`, `redisIntentionallyDisabled()` is false. Distributed limiters
  are expected, and an unexpected Redis outage fails closed.
- Under `beta-readiness`, `redisIntentionallyDisabled()` is true by design.
  The readiness CI job does not provision Redis and runs a single backend
  process, so the in-memory limiter is the intended harness behavior.
- This readiness exception is not permission to weaken `production` or `beta`,
  and it does not authorize a bypass header.

## Non-negotiable evidence rules

- Do not add or use test bypass headers.
- Do not enable skipped or focused tests in readiness paths.
- Do not reuse an arbitrary server merely because its health endpoint answers.
- Do not treat a locally relaxed rate-limit value as production configuration.
- Do not claim production parity when required middleware, real persistence, or
  the configured profile is absent.
- Do not edit ignored environment files, databases, Redis state, or CI secrets
  merely because this document describes them; the current task must authorize
  the state change.

## Live source map

- Main E2E orchestration: `playwright.config.ts`
- Readiness orchestration: `playwright.beta-readiness.config.ts`
- Backend environment loading: `backend/config/config.mjs`
- Safe templates: `backend/env.beta.example` and
  `backend/env.beta-readiness.example`
- Redis expectation: `backend/middleware/rateLimiting.mjs`
- Full signoff: `scripts/check-beta-readiness.sh`
- Canonical readiness scan patterns: `scripts/lib/beta-readiness-scans.sh`
- CI wiring: `.github/workflows/test.yml`

Re-read those files before changing this reference. Their current behavior wins
if this document drifts.
