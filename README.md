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
# Use frontend/.env.example for frontend-owned variables. Verify test/CI-only
# values against the live test configuration and workflows.

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
├── docs/                Governed contracts, decisions, and runbooks
├── config, services,    Exact-path compatibility code; do not add new domains
│   utils, samples/      here without first migrating their current consumers
├── .claude, .agents,    Installed agent/harness integrations; never product or
│   .agent, .codex/      design authority merely because they are present
└── .github/workflows/   CI/CD pipelines (see badges above)
```

The repository root is reserved for the five project authority/readme files,
live manifests and tool/deployment configuration, and exact-path local runtime
state such as `storageState.json`. Scripts belong in `scripts/`,
runtime data belongs with its owning subsystem, and generated evidence does not
become root-level project documentation. See the documentation creation and
retirement rules before adding another Markdown file. Use
[`docs/REPOSITORY_MAP.md`](docs/REPOSITORY_MAP.md) before creating, moving, or
retiring a repository path.

## Documentation

| Topic                       | Path                                                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentation governance    | [`docs/README.md`](docs/README.md)                                                                                                                   |
| Repository file routing     | [`docs/REPOSITORY_MAP.md`](docs/REPOSITORY_MAP.md)                                                                                                   |
| Development guide           | [`docs/development-guide.md`](docs/development-guide.md)                                                                                             |
| Architecture decisions      | [`docs/architecture/README.md`](docs/architecture/README.md)                                                                                         |
| DevOps / CI/CD              | [`docs/devops-cicd.md`](docs/devops-cicd.md)                                                                                                         |
| Deployment (Railway)        | [`railway.toml`](railway.toml), [`Dockerfile`](Dockerfile)                                                                                           |
| Security rules and testing  | [`docs/SECURITY_TESTING.md`](docs/SECURITY_TESTING.md), [`docs/api-contracts-backend/rate-limiting.md`](docs/api-contracts-backend/rate-limiting.md) |
| Database schema             | [`packages/database/prisma/schema.prisma`](packages/database/prisma/schema.prisma)                                                                   |
| Beta route projection       | [`docs/beta-route-truth-table.md`](docs/beta-route-truth-table.md)                                                                                   |
| Contributor naming + rules  | [`.claude/rules/CONTRIBUTING.md`](.claude/rules/CONTRIBUTING.md)                                                                                     |
| Project-level Claude config | [`CLAUDE.md`](CLAUDE.md)                                                                                                                             |

## Contributing

Project-wide conduct and the ESM requirement live in [`AGENTS.md`](AGENTS.md)
and [`CLAUDE.md`](CLAUDE.md). The path-scoped
[backend/test guardrails](.claude/rules/CONTRIBUTING.md) load only for matching
implementation files. Issues are tracked with `bd` (beads).

## License

The package manifests currently declare ISC, but the repository has no
owner-approved root license file. Do not infer or publish a license until the
owner resolves that mismatch.
