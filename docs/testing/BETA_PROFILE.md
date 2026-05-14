# Beta Profile (`NODE_ENV=beta`)

**Owner:** Backend / QA  
**Last Updated:** 2026-05-14

---

## What is the beta profile?

`NODE_ENV=beta` is a production-parity runtime mode used for Playwright E2E testing.
Unlike `NODE_ENV=test`, beta activates the full middleware stack — CSRF, rate limiting,
audit logging, and security alerts — exactly as they behave in production.

The beta profile was introduced in Story 21S-3 to close the gap where E2E tests
previously relied on bypass headers (`x-test-bypass-rate-limit`, `x-test-skip-csrf`,
etc.) that would never be present in real user sessions.

---

## How DATABASE_URL is inherited

By default `env.beta` points at **equoria_test** — the same database used by unit and
integration tests. This follows the project's "real DB only" policy: all tests, including
E2E, run against real data.

To isolate Playwright runs to a separate database:

```bash
# Option A: shell export (not committed)
export DATABASE_URL="postgresql://postgres:<pass>@localhost:5432/equoria_beta"

# Option B: .env.beta.local (gitignored, loaded by dotenv before env.beta)
echo 'DATABASE_URL="postgresql://postgres:<pass>@localhost:5432/equoria_beta"' \
  >> backend/.env.beta.local
```

Do **not** commit a changed `DATABASE_URL` in `env.beta`.

---

## JWT and session secrets

`config.mjs` throws at startup if `JWT_SECRET` or `JWT_REFRESH_SECRET` are missing.
This is intentional — committed placeholder values would make beta-runtime token
signing predictable and undermine the security posture being tested.

**Never add secret values to `env.beta` or `env.beta.example`.**

Inject secrets at runtime via one of:

| Method | Recommended for |
|--------|----------------|
| CI secrets (`secrets.JWT_SECRET` etc.) | GitHub Actions E2E jobs |
| Shell export before running Playwright | Local developer runs |
| `.env.beta.local` (gitignored) | Persistent local setup |

```bash
# Local developer example
export JWT_SECRET="$(openssl rand -hex 32)"
export JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
export SESSION_SECRET="$(openssl rand -hex 32)"
npx playwright test
```

---

## Forbidden settings

The following vars **must not be set** when running under `NODE_ENV=beta`:

| Variable | Why forbidden |
|----------|--------------|
| `SKIP_AUTH_FOR_TESTING` | Bypasses JWT middleware — defeats production-parity |
| `ENABLE_DEBUG_ROUTES` | Exposes internal debug endpoints not present in production |

If either variable appears in the environment during a beta run, the tests are not
providing production-parity coverage and cannot be used as beta readiness evidence.

---

## Difference from `beta-readiness`

| Term | What it means |
|------|--------------|
| `NODE_ENV=beta` | A runtime mode for the Express server. Activates production-parity middleware. |
| `beta-readiness` | A checklist / CI gate (`scripts/check-beta-readiness.sh`) that verifies the full feature surface works end to end. |

`NODE_ENV=beta` is the environment in which beta-readiness tests run — it is not the
same thing as passing the readiness gate.

---

## Running Playwright under the beta profile

`playwright.config.ts` loads `backend/env.beta` via dotenv before spawning the backend
server. No manual env-file switching is needed for standard E2E runs.

```bash
# From the project root — runs all Playwright specs against the beta-profile server
npx playwright test

# With a separate beta DB (inject DATABASE_URL first)
DATABASE_URL="postgresql://postgres:<pass>@localhost:5432/equoria_beta" \
  npx playwright test
```

For CI, add `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `SESSION_SECRET` as repository
secrets and reference them in the workflow:

```yaml
env:
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  JWT_REFRESH_SECRET: ${{ secrets.JWT_REFRESH_SECRET }}
  SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
```

---

## See also

- `backend/env.beta` — actual beta config loaded at runtime (secrets intentionally absent)
- `backend/env.beta.example` — safe template for local developer setup
- `scripts/check-beta-readiness.sh` — full beta readiness gate
