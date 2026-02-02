# Equoria DevOps & CI/CD Documentation

**Generated:** 2025-12-01
**Last Updated:** 2025-12-01 (Full Rescan)

## Overview

Equoria uses GitHub Actions for continuous integration and deployment. The pipeline ensures code quality, security, and reliable deployments.

## CI/CD Pipelines

### 1. Main CI/CD Pipeline (`ci-cd.yml`)

**Triggers:**
- Push to `master` or `develop`
- Pull requests to `master` or `develop`
- Manual dispatch

**Environment:**
- Node.js 18.x
- PostgreSQL 15 (service container)
- Ubuntu latest

#### Pipeline Jobs

```
┌─────────────────┐     ┌─────────────────┐
│  code-quality   │     │ database-setup  │
│  (lint/format)  │     │  (migrations)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
         ┌─────────────────────┐
         │   backend-tests     │
         │  (with coverage)    │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐     ┌─────────────────┐
         │ integration-tests   │     │  frontend-tests │
         └──────────┬──────────┘     └────────┬────────┘
                    ▼                         │
         ┌─────────────────────┐              │
         │ performance-tests   │              │
         └──────────┬──────────┘              │
                    │                         │
                    └────────────┬────────────┘
                                 ▼
                    ┌─────────────────────┐
                    │  build-validation   │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  security-scan  │  │deployment-ready │  │     (end)       │
└─────────────────┘  │ (master only)   │  └─────────────────┘
                     └─────────────────┘
```

#### Job Details

| Job | Description | Dependencies | Time |
|-----|-------------|--------------|------|
| code-quality | ESLint + Prettier for backend/frontend | None | ~2min |
| database-setup | Prisma migrations + validation | None | ~3min |
| backend-tests | Jest tests with coverage | code-quality, database-setup | ~5min |
| frontend-tests | React component tests | code-quality | ~3min |
| integration-tests | API integration tests | backend-tests | ~4min |
| performance-tests | Load/performance tests | integration-tests | ~5min |
| build-validation | Build both projects | backend-tests, frontend-tests | ~3min |
| security-scan | npm audit (moderate) | code-quality | ~2min |
| deployment-readiness | Final validation (master only) | build-validation, security-scan, performance-tests | ~1min |

### 2. CodeQL Analysis (`codeql.yml`)

**Triggers:**
- Push to `master`
- Pull requests to `master`
- Scheduled: Fridays at 19:31 UTC

**Analysis:**
- Language: JavaScript/TypeScript
- Build mode: None (interpreted)
- Security and quality queries

### 3. Auth Cookie Tests (`test-auth-cookies.yml`)

**Triggers:**
- Push/PR to `master` or `develop`
- Path-specific: auth controllers, middleware, API client

**Jobs:**

| Job | Description |
|-----|-------------|
| backend-auth-tests | Cookie authentication tests |
| frontend-auth-tests | API client + useAuth hooks |
| security-audit | Verify httpOnly, sameSite, secure flags |
| integration-test | E2E: Register → Login → Profile → Logout |

**Security Checks:**
- ✅ `httpOnly: true` in cookies
- ✅ `sameSite: 'strict'` flag
- ✅ `secure` flag for production
- ✅ `credentials: 'include'` in frontend
- ✅ No localStorage token storage (XSS protection)

## Environment Variables

### CI Environment

```yaml
NODE_VERSION: '18.x'
DATABASE_URL: 'postgresql://test:test@localhost:5432/equoria_test'
JWT_SECRET: 'test-jwt-secret-for-ci'
JWT_REFRESH_SECRET: 'test-refresh-secret-for-ci'
NODE_ENV: 'test'
```

### PostgreSQL Service

```yaml
postgres:
  image: postgres:15
  env:
    POSTGRES_USER: test
    POSTGRES_PASSWORD: test
    POSTGRES_DB: equoria_test
  ports:
    - 5432:5432
```

## Artifacts

| Artifact | Retention | Contents |
|----------|-----------|----------|
| backend-coverage | 30 days | Coverage reports (lcov) |
| integration-test-results | 30 days | Test results |
| performance-test-results | 30 days | Performance metrics |
| build-artifacts | 7 days | Compiled backend/frontend |

## Quality Gates

### Required Checks (PRs)

- [ ] Code quality passes (lint + format)
- [ ] All backend tests pass
- [ ] All frontend tests pass
- [ ] Integration tests pass
- [ ] Security audit (moderate level)
- [ ] Build validation succeeds

### Deployment Requirements (master)

- [ ] All quality gates pass
- [ ] Performance tests within limits
- [ ] Security scan completed
- [ ] Build artifacts created

## Scripts Reference

### Backend Scripts

```bash
npm run lint              # ESLint
npm run format:check      # Prettier check
npm run test:coverage     # Jest with coverage
npm run test:integration  # Integration tests
npm run test:performance  # Performance tests
npm run build             # Production build
npm run seed:test         # Seed test database
npm run seed:performance  # Seed for performance tests
```

### Frontend Scripts

```bash
npm run lint              # ESLint
npm run format:check      # Prettier check
npm test -- --coverage    # Jest with coverage
npm run build             # Vite production build
```

### Database Scripts

```bash
npx prisma generate       # Generate Prisma client
npx prisma migrate deploy # Run migrations
npx prisma validate       # Validate schema
```

## Codecov Integration

Coverage reports are uploaded to Codecov for both backend and frontend:

```yaml
- uses: codecov/codecov-action@v3
  with:
    file: ./backend/coverage/lcov.info
    flags: backend
    name: backend-coverage
```

## Security Scanning

### npm Audit

Both backend and frontend run `npm audit --audit-level=moderate` to catch:
- Critical vulnerabilities
- High severity issues
- Moderate severity issues

### CodeQL

Weekly security analysis for:
- SQL injection
- XSS vulnerabilities
- Path traversal
- Insecure configurations

## Monitoring & Notifications

### GitHub Step Summary

Deployment readiness creates a summary:
```markdown
## 🚀 Deployment Summary
- **Branch**: master
- **Commit**: abc123
- **Tests**: All passed ✅
- **Build**: Successful ✅
- **Security**: No critical issues ✅
- **Performance**: Within acceptable limits ✅
```

---

*Generated by BMAD document-project workflow*
