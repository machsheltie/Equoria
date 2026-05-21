# Equoria

Web browser-based horse breeding and competition simulation game.

[![Equoria Quality Gate](https://github.com/machsheltie/Equoria/actions/workflows/test.yml/badge.svg?branch=master)](https://github.com/machsheltie/Equoria/actions/workflows/test.yml)
[![Equoria CI/CD Pipeline](https://github.com/machsheltie/Equoria/actions/workflows/ci-cd.yml/badge.svg?branch=master)](https://github.com/machsheltie/Equoria/actions/workflows/ci-cd.yml)
[![OWASP ZAP Security Scan](https://github.com/machsheltie/Equoria/actions/workflows/security-scan.yml/badge.svg?branch=master)](https://github.com/machsheltie/Equoria/actions/workflows/security-scan.yml)
[![HttpOnly Cookie Authentication Tests](https://github.com/machsheltie/Equoria/actions/workflows/test-auth-cookies.yml/badge.svg?branch=master)](https://github.com/machsheltie/Equoria/actions/workflows/test-auth-cookies.yml)
[![Doctrine Gate](https://github.com/machsheltie/Equoria/actions/workflows/doctrine-gate.yml/badge.svg?branch=master)](https://github.com/machsheltie/Equoria/actions/workflows/doctrine-gate.yml)

## What this is

Equoria is a strategic horse-breeding simulation focused on realistic genetics, training, and competition. Players manage stables, hire grooms and trainers, breed horses across multi-locus coat-color genetics, train across multiple disciplines, and compete in shows. The codebase is a monorepo deployed as a single Express server that serves both the API and the built React SPA.

## Tech stack

| Layer       | Stack                                                                                |
| ----------- | ------------------------------------------------------------------------------------ |
| Backend     | Node.js 22 (ES modules), Express 4, Prisma ORM, PostgreSQL, Redis (rate-limit store) |
| Frontend    | React 19, Vite, TypeScript, TailwindCSS, React Query (`@tanstack/react-query`)       |
| Tests       | Jest (backend, real DB), Vitest + Testing Library (frontend), Playwright (E2E)       |
| Infra       | Railway (single-service deploy), Sentry (errors), GitHub Actions (CI/CD)             |
| Issue track | [beads](https://github.com/charlespierce/beads) (`bd ready`, `bd show <id>`)         |

## Quick start

### Prerequisites

- Node.js 22.x
- PostgreSQL 14+ (running locally with a database called `equoria`)
- Redis (optional locally; required for rate-limiting in CI/production)

### Install + first run

```bash
# 1. Install dependencies
npm install
npm --prefix backend install
npm --prefix frontend install

# 2. Backend env
cp backend/.env.example backend/.env
# Edit backend/.env: set DATABASE_URL + JWT_SECRET
#
# For the COMPLETE, canonical list of every environment variable the codebase
# reads (backend + frontend + test/CI), grouped required vs optional with a
# safe placeholder and one-line comment each, see `.env.example` at the repo
# root. Component-scoped copies live at backend/.env.example and
# frontend/.env.example.

# 3. Apply migrations
npm --prefix packages/database run migrate:deploy

# 4. Run backend (port 3000)
npm run dev-backend

# 5. Run frontend (separate terminal, port 5173 by default)
npm --prefix frontend run dev
```

### Test commands

```bash
npm run test-backend          # Jest, real test DB
npm run test:frontend         # Vitest
npm run test:e2e              # Playwright
```

## Repository layout

```
equoria/
├── backend/             Express server, modules, controllers, routes (ESM only)
├── frontend/            React 19 SPA (Vite, TypeScript)
├── packages/database/   Prisma schema + migrations
├── tests/e2e/           Playwright specs, fixtures, helpers
├── scripts/             Build, doctrine, beta-readiness scripts
├── docs/                Architecture, API, deployment, security docs
└── .github/workflows/   CI/CD pipelines (see badges above)
```

## Documentation

| Topic                       | Path                                                                              |
| --------------------------- | --------------------------------------------------------------------------------- |
| Development guide           | [`docs/development-guide.md`](docs/development-guide.md)                          |
| Architecture (overview)     | [`docs/architecture.md`](docs/architecture.md)                                    |
| Architecture (backend)      | [`docs/architecture-backend.md`](docs/architecture-backend.md)                    |
| Architecture (frontend)     | [`docs/architecture-frontend.md`](docs/architecture-frontend.md)                  |
| DevOps / CI/CD              | [`docs/devops-cicd.md`](docs/devops-cicd.md)                                      |
| Deployment (Railway)        | [`docs/deployment/RAILWAY_SETUP.md`](docs/deployment/RAILWAY_SETUP.md)            |
| Security guide              | [`.claude/rules/SECURITY.md`](.claude/rules/SECURITY.md)                          |
| Data models                 | [`docs/data-models.md`](docs/data-models.md)                                      |
| Beta readiness signoff      | [`docs/beta-signoff.yaml`](docs/beta-signoff.yaml)                                |
| Contributor naming + rules  | [`.claude/rules/CONTRIBUTING.md`](.claude/rules/CONTRIBUTING.md)                  |
| Project-level Claude config | [`CLAUDE.md`](CLAUDE.md)                                                          |

## Contributing

Please read [`.claude/rules/CONTRIBUTING.md`](.claude/rules/CONTRIBUTING.md) for naming standards (camelCase, PascalCase, kebab-case file names) and [`.claude/rules/ES_MODULES_REQUIREMENTS.md`](.claude/rules/ES_MODULES_REQUIREMENTS.md) for the strict ESM-only policy. Issues are tracked with `bd` (beads) — run `bd ready` to find available work.

## License

MIT — see [`.claude/rules/LICENSE.md`](.claude/rules/LICENSE.md).
