# Equoria Development Guide

**Generated:** 2026-03-19
**Environment:** Node.js 18+, PostgreSQL 12+
**Package Manager:** npm
**Module System:** ES Modules only (`"type": "module"` in all package.json files)

## Quick Start

### Prerequisites

- Node.js 18.x or higher
- PostgreSQL 12+
- Git
- Redis (optional, used for distributed rate limiting and caching)

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd Equoria

# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Install database package dependencies
cd ../packages/database && npm install

# Generate Prisma client
npx prisma generate --schema=prisma/schema.prisma

# Run database migrations
npx prisma migrate deploy --schema=prisma/schema.prisma

# Seed the database (development)
cd ../../backend && npm run seed
```

### Environment Configuration

Copy `backend/.env.example` to `backend/.env` and fill in values:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/equoria"

# JWT Authentication (minimum 32 characters)
JWT_SECRET=your-secure-jwt-secret-min-32-chars

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Redis (optional — rate limiting falls back to in-memory if unavailable)
REDIS_URL=redis://localhost:6379

# Sentry (optional — leave empty to disable)
SENTRY_DSN=

# Cookie domain (leave empty for same-domain, set .yourdomain.com for subdomains)
COOKIE_DOMAIN=
```

For the frontend, create `frontend/.env` if needed:

```env
# API URL (leave empty for relative /api/... URLs in production)
VITE_API_URL=http://localhost:3000
```

See `backend/.env.example` for the full list of environment variables including Redis, feature flags, session management, and security options.

### Running the Application

```bash
# Terminal 1: Start backend (nodemon auto-reload)
cd backend
npm run dev

# Terminal 2: Start frontend (Vite dev server)
cd frontend
npm run dev
```

Access points:

- **Frontend:** http://localhost:5173 (Vite default)
- **Backend API:** http://localhost:3000
- **API Docs (Swagger):** http://localhost:3000/api-docs
- **Health Check:** http://localhost:3000/health

All API endpoints are prefixed with `/api/v1/`.

## Project Structure

```
equoria/
├── backend/                 # Express API server (ES Modules, .mjs files)
│   ├── modules/             # 18 domain modules (auth, horses, breeding, etc.)
│   │   └── <domain>/
│   │       ├── controllers/ # Business logic
│   │       └── routes/      # Express routers
│   ├── controllers/         # Backward-compat shims → modules/*/controllers/
│   ├── routes/              # Backward-compat shims → modules/*/routes/
│   ├── middleware/           # Auth, rate limiting, security, validation
│   ├── models/              # Data models
│   ├── utils/               # Shared utilities
│   ├── logic/               # Core business logic
│   ├── errors/              # Custom error classes
│   ├── seed/                # Database seeders
│   ├── __tests__/           # Jest test suites
│   ├── docs/                # swagger.yaml
│   ├── server.mjs           # Entry point
│   └── app.mjs              # Express app setup
├── frontend/                # React 19 + TypeScript + Vite
│   └── src/
│       ├── components/      # UI components (PascalCase files)
│       ├── pages/           # Route pages
│       ├── hooks/api/       # React Query hooks (useHorses, useForum, etc.)
│       ├── lib/             # api-client.ts, utils
│       ├── styles/          # tokens.css, index.css
│       └── App.tsx          # Router + providers
├── packages/database/       # Prisma ORM + PostgreSQL
│   └── prisma/
│       ├── schema.prisma    # Database schema
│       └── migrations/      # Version-controlled migrations
├── eslint.config.js         # ESLint v9 flat config (root)
├── Dockerfile               # Multi-stage: frontend build → production Express
├── railway.toml             # Railway deploy config
└── .github/workflows/       # CI/CD pipeline
```

### Module Architecture (Epic 20)

Backend code is organized into 18 domain modules under `backend/modules/`:

auth, users, horses, breeding, traits, training, competition, grooms, riders, trainers, community, services, leaderboards, admin, docs, health, labs

Each module contains its own `routes/` and `controllers/` directories. Backward-compatible shims at `backend/routes/` and `backend/controllers/` re-export from the modules, so existing imports and tests continue to work.

## Project Scripts

### Root Level

| Script                  | Description                                                |
| ----------------------- | ---------------------------------------------------------- |
| `npm test`              | Run all backend tests (Jest + `--experimental-vm-modules`) |
| `npm run test:frontend` | Run frontend tests (Vitest)                                |
| `npm run test:e2e`      | Run Playwright E2E tests                                   |
| `npm run lint`          | Lint entire project                                        |
| `npm run lint:fix`      | Auto-fix lint issues                                       |
| `npm run format`        | Format with Prettier                                       |
| `npm run format:check`  | Check formatting                                           |
| `npm run typecheck`     | Run TypeScript type checking                               |

### Backend (`backend/`)

| Script                     | Description                                  |
| -------------------------- | -------------------------------------------- |
| `npm run dev`              | Start development server (nodemon)           |
| `npm start`                | Start production server (`node server.mjs`)  |
| `npm test`                 | Run Jest tests (`--experimental-vm-modules`) |
| `npm run test:watch`       | Run tests in watch mode                      |
| `npm run test:coverage`    | Run tests with coverage report               |
| `npm run test:integration` | Run integration tests                        |
| `npm run test:security`    | Run security test suite                      |
| `npm run test:performance` | Run performance tests                        |
| `npm run lint`             | Run ESLint                                   |
| `npm run lint:fix`         | Auto-fix lint issues                         |
| `npm run format`           | Format with Prettier                         |
| `npm run seed`             | Seed database with sample data               |
| `npm run seed:test`        | Seed test database                           |

### Frontend (`frontend/`)

| Script                  | Description                              |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Start Vite dev server                    |
| `npm run build`         | TypeScript check + Vite production build |
| `npm run preview`       | Preview production build locally         |
| `npm test`              | Run Vitest (watch mode)                  |
| `npm run test:run`      | Run Vitest once (CI mode)                |
| `npm run test:coverage` | Run Vitest with coverage                 |
| `npm run lint`          | Run ESLint                               |

### Database (`packages/database/`)

| Script                   | Description                           |
| ------------------------ | ------------------------------------- |
| `npm run generate`       | Generate Prisma client                |
| `npm run migrate:dev`    | Create new migration (development)    |
| `npm run migrate:deploy` | Apply pending migrations (production) |
| `npm run migrate:reset`  | Reset database (development only)     |
| `npm run migrate:status` | Check migration status                |
| `npm run studio`         | Open Prisma Studio GUI                |

## Code Style and Conventions

### ES Modules Only

All application code uses ES Modules. CommonJS (`require`, `module.exports`) is forbidden in application code.

```javascript
// CORRECT
import express from 'express';
import { myHelper } from '../utils/myHelper.mjs';
export default router;

// WRONG
const express = require('express');
module.exports = router;
```

Backend files use `.mjs` extension. Import paths must include the file extension:

```javascript
import { calculateScore } from '../utils/scoreHelper.mjs'; // .mjs required
```

### Naming Conventions

| Context                          | Convention    | Example                                  |
| -------------------------------- | ------------- | ---------------------------------------- |
| Variables, functions, properties | camelCase     | `horseId`, `calculateScore`              |
| Classes, React components        | PascalCase    | `HorseCard`, `TrainingService`           |
| File names                       | kebab-case    | `horse-routes.mjs`, `score-helper.mjs`   |
| Backend module files             | camelCase.mjs | `horseRoutes.mjs`, `horseController.mjs` |
| Database fields                  | camelCase     | `horseId`, `taskLog` (not `horse_id`)    |

### ESLint Configuration

The project uses ESLint v9 flat config (`eslint.config.js` at root). Key rules:

- `prettier/prettier: error` — Prettier formatting enforced via ESLint
- `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: '^_'` — prefix unused params with `_`
- `no-console: off` — console logging allowed during development
- Test files: `@typescript-eslint/no-explicit-any: off`

### Commit Message Format

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:

```
feat(auth): add email verification flow
fix(groom): correct salary calculation
docs(api): update endpoint documentation
test(horse): add breeding integration tests
```

### Pre-commit Hooks

Husky + lint-staged runs on every commit:

- Prettier formats `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` files
- ESLint auto-fixes those same files
- Prettier formats `.json`, `.md`, `.css`, `.yml`, `.yaml` files

## Testing Strategy

### Backend Testing (Jest)

Jest runs with `--experimental-vm-modules` for ES Module support. Current stats: ~226 suites, 3600+ tests passing.

**Balanced mocking strategy:**

- Mock external dependencies only: database (Prisma), HTTP clients, logger (Winston)
- Test real business logic — no mocking of internal functions
- Pure algorithmic functions tested with zero mocks

```bash
cd backend
npm test                          # All tests
npm test -- --watch               # Watch mode
npm test -- auth                  # Pattern match
npm test -- --detectOpenHandles   # Debug connection leaks
npm run test:coverage             # With coverage
npm run test:integration          # Integration tests only
npm run test:security             # Security test suite
```

### Frontend Testing (Vitest + MSW)

Vitest with React Testing Library and MSW for API mocking.

- `onUnhandledRequest: 'error'` — strict mode, all requests must be handled
- `@testing-library/react` for component testing
- `@testing-library/user-event` for interaction simulation

```bash
cd frontend
npm test                  # Watch mode
npm run test:run          # Single run (CI)
npm run test:coverage     # With coverage
```

### E2E Testing (Playwright)

Playwright tests cover core game flows, authentication, and breeding.

```bash
# From project root
npm run test:e2e

# Or directly
npx playwright test
```

### Testing Patterns

- Use `within()` for scoping queries when a `data-testid` appears multiple times
- Prefix unused test callback parameters with `_`
- Use `screen.getByRole()` over `screen.getByTestId()` when possible

## Database Management

### Schema Location

`packages/database/prisma/schema.prisma`

### Migrations

```bash
cd packages/database

# Create new migration (development)
npx prisma migrate dev --name add_new_field

# Apply migrations (production / CI)
npx prisma migrate deploy

# Reset database (development only — destroys all data)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

After schema changes, always regenerate the Prisma client:

```bash
npx prisma generate
```

For test databases, apply migrations separately:

```bash
DATABASE_URL=postgresql://...equoria_test npx prisma migrate deploy
```

### Prisma Studio

```bash
cd packages/database
npx prisma studio
```

## API Development

### Module Structure (Post-Epic 20)

New endpoints go into the appropriate module under `backend/modules/<domain>/`:

1. **Create Route** (`backend/modules/<domain>/routes/<domain>Routes.mjs`)

```javascript
import express from 'express';
import { authenticate } from '../../../middleware/auth.mjs';
import * as controller from '../controllers/<domain>Controller.mjs';

const router = express.Router();

router.get('/', authenticate, controller.getAll);
router.post('/', authenticate, controller.create);

export default router;
```

2. **Create Controller** (`backend/modules/<domain>/controllers/<domain>Controller.mjs`)

```javascript
import prisma from '../../../../packages/database/prismaClient.mjs';

export const getAll = async (req, res, next) => {
  try {
    const data = await prisma.model.findMany({
      where: { userId: req.user.id },
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
```

3. **Register Route** (in `backend/app.mjs`)

```javascript
import domainRoutes from './modules/<domain>/routes/<domain>Routes.mjs';
apiV1Router.use('/<domain>', domainRoutes);
```

4. **Add backward-compat shim** if needed (`backend/routes/<domain>Routes.mjs`):

```javascript
export { default } from '../modules/<domain>/routes/<domain>Routes.mjs';
```

### API Response Format

Success:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

Error:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [{ "field": "...", "message": "..." }]
}
```

## CI/CD Pipeline

### GitHub Actions

**File:** `.github/workflows/ci-cd.yml`

Pipeline stages:

1. **Code Quality & Linting** — ESLint + Prettier for backend and frontend
2. **Database Setup** — PostgreSQL service, migrations
3. **Backend Tests** — Jest with coverage
4. **Integration Tests** — API integration tests
5. **Performance Tests** — Load and performance benchmarks
6. **Frontend Tests** — Vitest component tests
7. **Build Validation** — Production build verification
8. **Security Scanning** — npm audit
9. **Docker Smoke Test** — Build and run container
10. **Lighthouse CI** — Accessibility and performance checks
11. **Deployment Readiness** — Final validation (master only)

### Branch Strategy

Development happens directly on `master`. CI triggers on push to `master` and on pull requests.

### Deployment

Production deployment targets Railway:

- `Dockerfile` — Multi-stage build: frontend Vite build, then Express production image
- `railway.toml` — Runs `prisma migrate deploy` before starting the server
- Frontend is embedded as static files served by Express in production
- `VITE_API_URL` is left unset so the frontend uses relative `/api/...` URLs

## Security

### Authentication

- JWT tokens with configurable expiration (default 24h access, 7d refresh)
- Bcrypt password hashing (12+ salt rounds in production)
- Secure HTTP-only cookies for token storage
- Role-based access control (User, Moderator, Admin)

### Input Validation

- express-validator on all endpoints
- Prisma parameterized queries (SQL injection prevention)
- XSS sanitization on user inputs

### Rate Limiting

- 100 requests per 15 minutes (general)
- 5 requests per 15 minutes (auth endpoints)
- Redis-backed in production, in-memory fallback for development
- Suspicious activity detection (rapid-fire, multi-IP, error-then-success patterns)

### Security Headers

- Helmet.js security headers
- CORS whitelist via `ALLOWED_ORIGINS`

### Monitoring (Optional)

- Sentry error tracking and performance monitoring (`SENTRY_DSN` env var)
- Winston structured logging
- Comprehensive audit trail for sensitive operations

## Debugging

### Backend

```bash
# Verbose test output
cd backend
npm test -- --verbose myTest.test.mjs

# Debug open handles
npm test -- --detectOpenHandles

# Health check
curl http://localhost:3000/health
```

### Frontend

- React DevTools browser extension
- Vite error overlay in development
- Bundle analysis: `npm run build` generates `dist/bundle-stats.html` (via rollup-plugin-visualizer)

### Database

```bash
cd packages/database
npx prisma studio      # Visual database browser
npx prisma migrate status  # Check migration state
```

## Issue Tracking

Use `bd` commands (beads) for issue tracking:

```bash
bd ready              # Find available work
bd show <id>          # Review issue details
bd create "Task"      # Create new issue
bd update <id> --status=in_progress  # Claim work
bd close <id>         # Mark complete
```

Do not use markdown TODOs or inline task lists for tracking work.

## Troubleshooting

### Common Issues

**Database connection failed:**

- Check `DATABASE_URL` in `backend/.env`
- Ensure PostgreSQL is running
- Verify the database exists (`psql -l`)

**Prisma client errors (`prisma.model is undefined`):**

```bash
cd packages/database
npx prisma generate
```

On Windows, Prisma may show an EPERM error on DLL rename — the JS/TS client is still regenerated successfully.

**Tests failing with timeout or open handles:**

- Use `--detectOpenHandles` to find unclosed connections
- Check for missing `afterAll` cleanup in test files
- Increase Jest timeout if needed

**ESLint not working:**

- Ensure `eslint.config.js` exists at project root (flat config format)
- Restart ESLint server in VSCode: Ctrl+Shift+P → "ESLint: Restart ESLint Server"
- Never create `.eslintrc.js` files (CommonJS format breaks ES Modules)

**Frontend build failures:**

```bash
cd frontend
npx tsc --noEmit       # Check TypeScript errors first
npm run build          # Then full build
```

**Port already in use:**

```bash
# Find and kill the process (Unix/WSL)
lsof -i :3000
kill -9 <PID>

# Windows PowerShell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Import errors in backend:**

- Ensure all import paths include `.mjs` extension
- Verify `"type": "module"` is in `backend/package.json`
- Check relative path depth (modules are 4 levels deep: `../../..` for root utils)
