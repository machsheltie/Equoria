# Equoria DevOps & CI/CD Documentation

**Generated:** 2025-12-01
**Last Updated:** 2026-03-19 (Full Rescan)

## Overview

Equoria uses GitHub Actions for continuous integration and security scanning, Docker multi-stage builds for packaging, Railway for production deployment, and Husky + lint-staged for local git hooks. The test pipeline covers Jest (backend), Vitest (frontend), and Playwright (E2E).

---

## CI/CD Pipelines

### 1. Main CI/CD Pipeline (`ci-cd.yml`)

**File:** `.github/workflows/ci-cd.yml`

**Triggers:**

- Push to `master` or `develop`
- Pull requests to `master` or `develop`
- Manual dispatch (`workflow_dispatch`)

**Global Environment:**

```yaml
NODE_VERSION: '18.x'
DATABASE_URL: 'postgresql://test:test@localhost:5432/equoria_test'
JWT_SECRET: 'test-jwt-secret-for-ci'
JWT_REFRESH_SECRET: 'test-refresh-secret-for-ci'
NODE_ENV: 'test'
```

**PostgreSQL Service:** Postgres 15 with health checks on all jobs that need a database.

#### Pipeline Job Graph

```
                  code-quality ─────────────────────────┐
                  (lint + format)                        │
                        │                                │
                        ├───────────────┐                │
                        ▼               │                ▼
               backend-tests            │         frontend-tests
               (coverage)               │         (Vitest + coverage)
                    │                   │                │
                    ▼                   │                │
             integration-tests          │                │
                    │                   │                │
                    ▼                   │                │
            performance-tests           │                │
                    │                   │                │
                    │       ┌───────────┘                │
                    │       ▼                            │
                    │  security-scan                     │
                    │  (npm audit)                       │
                    │       │                            │
                    │       │     build-validation ◄─────┘
                    │       │          │
                    │       │          ├── build-docker (master only)
                    │       │          └── lighthouse (master only)
                    │       │
                    └───┬───┘
                        ▼
               deployment-readiness
                  (master only)
```

#### Job Details

| #   | Job                      | Description                                                               | Depends On                                         | Runs On     |
| --- | ------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------- | ----------- |
| 1   | **code-quality**         | ESLint + Prettier check for backend and frontend                          | None                                               | Always      |
| 2   | **database-setup**       | Prisma generate, migrate deploy, validate, verify migration, seed test DB | None                                               | Always      |
| 3   | **backend-tests**        | `npm run test:coverage` + Codecov upload + artifact upload                | code-quality, database-setup                       | Always      |
| 4   | **integration-tests**    | `npm run test:integration`                                                | backend-tests                                      | Always      |
| 5   | **performance-tests**    | `npm run test:performance` with performance seed data                     | integration-tests                                  | Always      |
| 6   | **frontend-tests**       | `npm test -- --coverage --watchAll=false` + Codecov upload                | code-quality                                       | Always      |
| 7   | **build-validation**     | Build backend + frontend, upload build artifacts                          | backend-tests, frontend-tests                      | Always      |
| 8   | **security-scan**        | `npm audit --audit-level=moderate` for backend and frontend               | code-quality                                       | Always      |
| 9   | **deployment-readiness** | Download artifacts + create deployment summary                            | build-validation, security-scan, performance-tests | master only |
| 10  | **build-docker**         | Multi-stage Docker build + smoke test + verify embedded frontend          | build-validation                                   | master only |
| 11  | **lighthouse**           | Lighthouse CI against static Vite build                                   | build-validation                                   | master only |

#### Job 10: Docker Build Validation (master only)

Builds the multi-stage Docker image, runs a smoke test container with `docker run`, hits `/health`, and verifies `/app/backend/public/index.html` exists (frontend embedded).

#### Job 11: Lighthouse Performance Audit (master only)

Uses `treosh/lighthouse-ci-action@v11` with `.lighthouserc.yml`:

| Category       | Level             | Min Score |
| -------------- | ----------------- | --------- |
| Accessibility  | Error (blocks CI) | 0.85      |
| Performance    | Warn              | 0.65      |
| Best Practices | Warn              | 0.80      |
| SEO            | Warn              | 0.50      |

Runs against the static `frontend/dist` build (no server needed). Results uploaded to temporary public storage.

---

### 2. CI Workflow (`ci.yml`)

**File:** `.github/workflows/ci.yml`

**Triggers:**

- Push to `main`, `master`, or `develop`
- Pull requests to `main`, `master`, or `develop`

A lighter-weight pipeline with four jobs:

| Job             | Description                                        | Depends On  |
| --------------- | -------------------------------------------------- | ----------- |
| **setup**       | Checkout + install root dependencies               | None        |
| **lint_format** | Prettier check + ESLint (root workspace)           | setup       |
| **tests**       | `npm test -- --runInBand` with Postgres 15 service | lint_format |
| **typecheck**   | `npm run typecheck` (TypeScript compiler check)    | setup       |

Environment: `DATABASE_URL` and `NODE_ENV=test` set at job level for the tests job.

---

### 3. OWASP ZAP Security Scan (`security-scan.yml`)

**File:** `.github/workflows/security-scan.yml`

**Triggers:**

- Push to `master` or `develop`
- Pull requests to `master` or `develop`
- Scheduled: Every Monday at 02:00 UTC
- Manual dispatch

**Permissions:** `contents: read`, `security-events: write`, `issues: write`, `pull-requests: write`

#### Jobs

**dependency-scan** - Dependency Vulnerability Scan:

- Runs `npm audit --json` for both backend and frontend
- Parses critical/high/moderate/low counts with `jq`
- Fails if critical or high vulnerabilities found
- Comments on PRs with vulnerability table if failures detected
- Uploads audit JSON reports (90-day retention)

**zap-scan** - OWASP ZAP API Security Scan:

- Services: Postgres 14 + Redis 7-alpine
- Starts the backend API server, exports OpenAPI spec from `/api-docs/swagger.json`
- **ZAP Baseline Scan** (`zaproxy/action-baseline@v0.10.0`): Runs on every push/PR
- **ZAP API Scan** (`zaproxy/action-api-scan@v0.6.0`): OpenAPI-driven scan
- **ZAP Full Scan** (`zaproxy/action-full-scan@v0.9.0`): Weekly (schedule trigger only)
- Fails on high-severity findings for push events
- Creates GitHub issues automatically for high-severity findings
- Uploads SARIF to GitHub Security tab via `github/codeql-action/upload-sarif@v3`
- Uploads HTML and JSON reports as artifacts

---

### 4. CodeQL Advanced (`codeql.yml`)

**File:** `.github/workflows/codeql.yml`

**Triggers:**

- Push to `master`
- Pull requests to `master`
- Scheduled: Fridays at 19:31 UTC

**Configuration:**

- Language: `javascript-typescript`
- Build mode: `none` (interpreted language, no build step)
- Uses `github/codeql-action/init@v3` and `github/codeql-action/analyze@v3`

Detects SQL injection, XSS, path traversal, insecure configurations, and other security patterns.

---

### 5. HttpOnly Cookie Authentication Tests (`test-auth-cookies.yml`)

**File:** `.github/workflows/test-auth-cookies.yml`

**Triggers:**

- Push to `master` or `develop` (path-filtered: auth controllers, middleware, API client, auth test files)
- Pull requests to `master` or `develop`

#### Jobs

| Job                     | Description                                                      | Depends On               |
| ----------------------- | ---------------------------------------------------------------- | ------------------------ |
| **backend-auth-tests**  | Runs `auth-cookies.test.mjs` with Postgres 14                    | None                     |
| **frontend-auth-tests** | Runs `api-client.test.ts` + `useAuth.test.ts`                    | None                     |
| **security-audit**      | Grep-based verification of cookie security flags                 | backend + frontend tests |
| **integration-test**    | curl-based E2E: Register, Login, Profile, Logout with cookie jar | backend + frontend tests |

**Security Audit Checks:**

- `httpOnly: true` present in authController
- `sameSite: 'strict'` flag present
- `secure: process.env.NODE_ENV === 'production'` configured
- `credentials: 'include'` in frontend API client
- No `localStorage` token storage (XSS protection)

---

## Docker Multi-Stage Build

**File:** `Dockerfile`

### Stage 1: `frontend-builder`

```dockerfile
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
```

Builds the Vite frontend. `VITE_API_URL` is left unset so the frontend uses relative `/api/...` URLs in production.

### Stage 2: `production`

```dockerfile
FROM node:18-alpine AS production
```

- Installs `curl` for health checks
- Installs backend production dependencies (`npm ci --only=production`)
- Installs database package production dependencies
- Copies backend + packages source
- Runs `npx prisma generate` to create Prisma client
- Copies built frontend from Stage 1 into `/app/backend/public` (Express serves these as static assets)
- Creates non-root `nodejs` user (UID 1001) for security
- Exposes port 3000
- Health check: `curl -f http://localhost:3000/health` (30s interval, 30s start period, 3 retries)
- Entry point: `node server.mjs`

---

## Railway Deployment

**File:** `railway.toml`

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "sh -c 'cd /app/packages/database && npx prisma migrate deploy && cd /app/backend && node server.mjs'"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

**Key behavior:**

- Uses the multi-stage Dockerfile for builds
- Start command runs `prisma migrate deploy` before starting the server on every deploy (idempotent -- safe with no new migrations)
- Health check on `/health` with 300-second timeout
- Auto-restart on failure, up to 10 retries

**Deployment flow:** `git push master` triggers Railway auto-deploy via the Dockerfile pipeline.

---

## Dependabot Configuration

**File:** `.github/dependabot.yml`

| Ecosystem      | Directory   | Schedule                  | PR Limit | Labels                              |
| -------------- | ----------- | ------------------------- | -------- | ----------------------------------- |
| npm            | `/backend`  | Daily 09:00 UTC           | 10       | dependencies, backend, security     |
| npm            | `/frontend` | Daily 09:00 UTC           | 10       | dependencies, frontend, security    |
| npm            | `/` (root)  | Daily 09:00 UTC           | 5        | dependencies, root, security        |
| github-actions | `/`         | Weekly (Monday) 09:00 UTC | 5        | dependencies, github-actions, ci/cd |

**Grouping:**

- Development dependencies: minor + patch updates grouped
- Production dependencies: patch updates only grouped
- Commit prefix: `deps(backend)`, `deps(frontend)`, `deps(root)`, `ci`
- Reviewer: `Hopeful4ky`
- `insecure-external-code-execution: deny` on all npm ecosystems

---

## Git Hooks (Husky + lint-staged)

**Directory:** `.husky/`

### Pre-commit Hook

**File:** `.husky/pre-commit`

Runs `lint-staged` which is configured in root `package.json`:

```json
{
  "lint-staged": {
    "**/*.{js,jsx,ts,tsx,mjs,cjs}": ["prettier --write", "eslint --fix"],
    "**/*.{json,md,css,scss,html,yml,yaml}": ["prettier --write"]
  }
}
```

Auto-formats and lints all staged files before every commit.

### Pre-push Hook

**File:** `.husky/pre-push`

```sh
cd backend
npm test
```

Runs the full backend Jest test suite before every push. Blocks the push if any test fails.

---

## Test Pipeline

### Backend Tests (Jest)

- **Framework:** Jest with ES modules support
- **Count:** 226+ suites, 3617+ tests passing
- **CI command:** `npm run test:coverage` (with lcov output)
- **Integration tests:** `npm run test:integration` (separate job in CI)
- **Performance tests:** `npm run test:performance` (requires performance seed data)
- **Coverage:** Uploaded to Codecov (`backend` flag) and as GitHub Actions artifact (30-day retention)

### Frontend Tests (Vitest)

- **Framework:** Vitest + React Testing Library + MSW (`onUnhandledRequest: 'error'` strict mode)
- **CI command:** `npm test -- --coverage --watchAll=false`
- **Coverage:** Uploaded to Codecov (`frontend` flag)

### E2E Tests (Playwright)

- **Framework:** Playwright (Chromium, Firefox, WebKit)
- **Config:** `playwright.config.ts`
- **Test directory:** `tests/e2e/`
- **Test files:**
  - `smoke.spec.ts` -- Basic smoke tests
  - `auth.spec.ts` -- Authentication flows
  - `core-game-flows.spec.ts` -- Core game mechanics
  - `breeding.spec.ts` -- Breeding system
  - `onboarding-flow.spec.ts` -- New player onboarding
  - `celestial-night-navigation.spec.ts` -- Theme navigation
  - `celestial-night-features.spec.ts` -- Theme features
- **Global setup:** `tests/e2e/global-setup.ts`
- **Web servers:** Backend on port 3001 + Vite dev server on port 3000 (auto-started)
- **CI settings:** `forbidOnly: true`, `retries: 2`, `workers: 1`
- **Tracing:** `on-first-retry`

---

## Environment Configuration

### Required Environment Variables

| Variable             | CI Value                                             | Production              | Description                  |
| -------------------- | ---------------------------------------------------- | ----------------------- | ---------------------------- |
| `NODE_ENV`           | `test`                                               | `production`            | Environment mode             |
| `DATABASE_URL`       | `postgresql://test:test@localhost:5432/equoria_test` | Railway-provided        | PostgreSQL connection string |
| `JWT_SECRET`         | `test-jwt-secret-for-ci`                             | Secret (32+ chars)      | JWT signing key              |
| `JWT_REFRESH_SECRET` | `test-refresh-secret-for-ci`                         | Secret (32+ chars)      | Refresh token signing key    |
| `PORT`               | 3000                                                 | Railway-assigned        | Server port                  |
| `VITE_API_URL`       | Not set                                              | Not set (relative URLs) | Frontend API base URL        |

### ZAP Scan Additional Variables

| Variable               | Value                   | Description                 |
| ---------------------- | ----------------------- | --------------------------- |
| `REFRESH_SECRET`       | test value              | Refresh secret for ZAP scan |
| `REDIS_HOST`           | localhost               | Redis for ZAP test env      |
| `SESSION_SECRET`       | test value              | Session secret              |
| `COOKIE_SECRET`        | test value              | Cookie signing secret       |
| `CSRF_SECRET`          | test value              | CSRF token secret           |
| `FRONTEND_URL`         | `http://localhost:5173` | CORS origin                 |
| `ENABLE_RATE_LIMITING` | true                    | Rate limiting toggle        |
| `ENABLE_CSRF`          | true                    | CSRF protection toggle      |

---

## CI Artifacts

| Artifact                     | Retention | Source                              |
| ---------------------------- | --------- | ----------------------------------- |
| `backend-coverage`           | 30 days   | `backend/coverage/` (lcov + HTML)   |
| `integration-test-results`   | 30 days   | `backend/test-results/`             |
| `performance-test-results`   | 30 days   | `backend/performance-results/`      |
| `build-artifacts`            | 7 days    | `backend/dist/` + `frontend/build/` |
| `security-audit-reports`     | 90 days   | Backend/frontend npm audit JSON     |
| `zap-baseline-report`        | Default   | ZAP HTML report                     |
| `zap-api-report`             | Default   | ZAP JSON report                     |
| `backend-auth-test-results`  | Default   | Backend auth test coverage          |
| `frontend-auth-test-results` | Default   | Frontend auth test coverage         |

---

## Codecov Integration

Coverage reports uploaded for both backend and frontend:

```yaml
- uses: codecov/codecov-action@v3
  with:
    file: ./backend/coverage/lcov.info # or frontend
    flags: backend # or frontend
    name: backend-coverage
    fail_ci_if_error: false
```

---

## Quality Gates

### Required for All PRs

- Code quality passes (ESLint + Prettier for backend and frontend)
- TypeScript type check passes (`npm run typecheck`)
- All backend tests pass
- All frontend tests pass
- Integration tests pass
- Security audit at moderate level
- Build validation succeeds

### Required for master Deployment

- All PR quality gates pass
- Performance tests within limits
- Docker image builds and smoke test passes
- Frontend assets embedded in Docker image
- Lighthouse accessibility score >= 0.85
- Deployment readiness check passes

---

## Scripts Reference

### Backend

```bash
npm run lint              # ESLint
npm run format:check      # Prettier check
npm run test:coverage     # Jest with coverage
npm run test:integration  # Integration tests only
npm run test:performance  # Performance tests only
npm run build             # Production build
npm run seed:test         # Seed test database
npm run seed:performance  # Seed for performance tests
npm start                 # Start production server
npm run dev               # Start development server (nodemon)
```

### Frontend

```bash
npm run lint              # ESLint
npm run format:check      # Prettier check
npm test                  # Vitest
npm run build             # Vite production build
npm run dev               # Vite dev server
```

### Database

```bash
npx prisma generate       # Generate Prisma client
npx prisma migrate deploy # Run migrations (idempotent)
npx prisma validate       # Validate schema
npx prisma migrate dev    # Create + apply new migration (development)
```

### E2E

```bash
npx playwright test       # Run all E2E tests
npx playwright test --project=chromium  # Single browser
npx playwright show-report               # View HTML report
```

---

_Generated by BMAD document-project workflow_
