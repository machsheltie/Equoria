# Dependency Maintenance Schedule

**Project:** Equoria Monorepo (root / backend / frontend / packages/database)  
**Last Full Audit:** 2026-05-06 — **✅ 0 vulnerabilities** across all packages  
**Next Scheduled Audit:** Run `npm audit` in root + backend + frontend at the start of any session where no other P0 work is pending.

---

## How to Run an Audit

```bash
# Root
npm audit

# Backend
cd backend && npm audit

# Frontend
cd frontend && npm audit  # (run from project root via PowerShell)

# Or use the skill for a full report:
# /tools:deps-audit
```

---

## Audit History

| Date | Critical | High | Moderate | Low | Notes |
|------|----------|------|----------|-----|-------|
| 2026-05-06 | 0 | 0 | 0 | 0 | First formal audit. All packages clean. |

---

## Pending Action Items

### Tier 1 — Patch Now (safe, no breaking changes)
These are pure patch/minor version bumps. Safe to apply any session; tests will confirm.

```bash
# From project root:
npm update react@^19.2.5 react-dom@^19.2.5                # frontend (patch)
npm update react-test-renderer@^19.2.5                    # root
npm update pg@^8.20.0                                     # root + backend

# From backend/:
npm update @sentry/node@^10.51.0 @sentry/profiling-node@^10.51.0
npm update cors@^2.8.6
npm update express-validator@^7.3.2
npm update jsonwebtoken@^9.0.3
npm update ioredis@^5.10.1
npm update redis@^5.12.1
npm update winston@^3.19.0
npm update nodemon@^3.1.14
npm update supertest@^7.2.2

# From frontend/:
npm update @sentry/react@^10.51.0
npm update @tanstack/react-query@^5.100.9
npm update @testing-library/react@^16.3.2
npm update recharts@^3.8.1
npm update zod@^4.4.3
npm update vitest@^4.1.5 @vitest/coverage-v8@^4.1.5
npm update msw@^2.14.3
npm update autoprefixer@^10.5.0
npm update postcss@^8.5.14
```

**After each package group:** run `npm test` (root) and `cd frontend && npm run test:run`.

**Estimated effort:** 1 session, 15–20 min.

---

### Tier 2 — Minor Migrations (require config review, low breaking risk)

These ship new features and may require small config tweaks but are generally backward-compatible within their semver range.

#### eslint v9 → v10 (root, backend, frontend)

- **Current:** 8.57.x (all) / 9.39.x (root @eslint/js)
- **Target:** eslint@10.3.0, @eslint/js@10.0.1
- **What changes:** Flat config (`eslint.config.js`) is now the only supported format. The legacy `.eslintrc.*` format is removed.
- **Status of this project:** Root already uses `eslint.config.js` (checked 2026-05-06). Backend may still use `.eslintrc` — verify before upgrading.
- **Pre-upgrade check:**
  ```bash
  ls backend/.eslintrc* 2>/dev/null && echo "NEEDS MIGRATION" || echo "OK"
  ls frontend/.eslintrc* 2>/dev/null && echo "NEEDS MIGRATION" || echo "OK"
  ```
- **Migration guide:** https://eslint.org/docs/latest/use/migrate-to-flat-config
- **Effort:** ~1 session

#### express-rate-limit v7 → v8

- **Current:** 7.5.x
- **Target:** 8.5.0
- **What changes:** Constructor API cleaned up; some options renamed.
- **Check:** Search `express-rate-limit` usages in `backend/middleware/` and `backend/app.mjs`.
  ```bash
  grep -r "express-rate-limit\|rateLimit\|rateLimiter" backend/ --include="*.mjs" -l
  ```
- **Effort:** ~1 session (read changelog, test all rate-limited routes)

#### husky v8 → v9 (backend)

- **Current (backend):** 8.0.3
- **Target:** 9.1.7 (root already on v9)
- **Issue:** Backend has its own husky devDependency pointing to v8, while root uses v9. This is fragmented. The root-level husky should handle all hooks.
- **Recommendation:** Remove `husky` from `backend/package.json` devDependencies entirely — the root-level install already covers it.
  ```bash
  cd backend && npm uninstall husky
  ```
- **Effort:** ~15 min

#### jest-junit v16 → v17 (backend)

- **Current:** 16.0.0 (backend)
- **Target:** 17.0.0
- **Risk:** Low — output format may have minor changes.
- **Effort:** ~10 min

---

### Tier 3 — Major Migrations (plan before starting, multiple sessions)

These are major version bumps with real breaking changes. Do NOT upgrade impulsively — plan each one as a dedicated beads issue.

#### TypeScript v5 → v6

- **Current:** 5.9.x (root, frontend); 5.3.x (frontend types)
- **Target:** 6.0.3
- **Breaking changes:** Stricter type inference in several edge cases; some deprecated APIs removed.
- **Impact assessment needed:**
  ```bash
  npx typescript@6 --version
  npx tsc -p tsconfig.json --noEmit 2>&1 | head -50  # dry-run
  ```
- **Plan:** Create a beads issue. Run dry-run first. Fix type errors. Then upgrade.
- **Effort:** 1–2 sessions depending on type errors found

#### Express v4 → v5

- **Current:** 4.22.x (root + backend)
- **Target:** 5.2.1
- **Breaking changes (v4→v5):**
  - `res.sendfile()` removed → use `res.sendFile()`
  - `req.param()` removed → use `req.params`, `req.body`, `req.query`
  - Router path params stricter
  - Promise rejection auto-forwarding (changes how async errors propagate)
  - `app.router` removed
- **Impact assessment:**
  ```bash
  grep -r "res\.sendfile\|req\.param(" backend/ --include="*.mjs"
  ```
- **Recommendation:** Wait for ecosystem stability. Express v5 released May 2024; middleware ecosystem (cors, helmet, etc.) may still have compatibility notes. Re-evaluate Q3 2026.
- **Effort:** 2–3 sessions minimum

#### Vite v7 → v8 (frontend)

- **Current:** 7.3.x
- **Target:** 8.0.10
- **Breaking changes:** Rollup v4→v5 upgrade bundled; some plugin API changes.
- **Check plugins in vite.config.ts before upgrading.**
- **Effort:** ~1 session

#### React Router v6 → v7 (frontend)

- **Current:** 6.30.x
- **Target:** 7.15.0
- **Breaking changes:** Significant — v7 is a near-total rewrite with a new "framework mode". Data APIs changed.
- **Recommendation:** Treat as a full migration project. File a dedicated epic-level beads issue. Do NOT upgrade with a patch command.
- **Effort:** 1 full sprint minimum

#### lucide-react v0.x → v1.x (frontend)

- **Current:** 0.460.0
- **Target:** 1.14.0
- **Breaking changes:** Icon API renamed in v1; some icons removed or renamed.
- **Check:**
  ```bash
  grep -r "lucide-react" frontend/src --include="*.tsx" | head -20
  ```
- **Effort:** ~1 session (bulk rename if needed)

#### jest v29 → v30 (root + backend)

- **Current:** 29.7.0
- **Target:** 30.3.0
- **Breaking changes:** Requires Node 20+; some matchers tightened; snapshot format changed.
- **Pre-check:** Ensure CI uses Node 20. Run `node --version`.
- **Effort:** ~1 session + snapshot regeneration if needed

---

## Automation Recommendations

### 1. Enable Dependabot (not yet configured)

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    labels:
      - "deps"
    ignore:
      # Hold major versions pending explicit migration planning
      - dependency-name: "express"
        update-types: ["version-update:semver-major"]
      - dependency-name: "react-router-dom"
        update-types: ["version-update:semver-major"]
      - dependency-name: "typescript"
        update-types: ["version-update:semver-major"]
      - dependency-name: "vite"
        update-types: ["version-update:semver-major"]

  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    labels:
      - "deps"
      - "backend"

  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    labels:
      - "deps"
      - "frontend"

  - package-ecosystem: "npm"
    directory: "/packages/database"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 3
    labels:
      - "deps"
      - "database"
```

### 2. Add audit step to CI

In `.github/workflows/ci-cd.yml`, add a job that runs before tests:

```yaml
audit:
  name: Security Audit
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm ci --ignore-scripts
    - run: npm audit --audit-level=high
    - run: cd backend && npm audit --audit-level=high
    - run: cd frontend && npm audit --audit-level=high
```

---

## Notes & Observations (2026-05-06)

- **Version fragmentation:** `dotenv` is on `^17.x` in root but `^16.x` in backend. These should be aligned. No vulnerability, but a confusing discrepancy. Normalize to `^17.x` when doing the Tier 1 updates.
- **duplicate husky:** Root uses husky v9, backend declares husky v8 as a devDependency. Backend's `prepare` script tries to call `require('husky').install()` using the old API — this is dead code now that root husky handles hooks. Safe to remove.
- **tailwindcss version split:** Root has Tailwind v4 (`@tailwindcss/postcss` 4.x), frontend has Tailwind v3 (`tailwindcss` 3.4.x). This is intentional — Tailwind v4 uses a PostCSS plugin approach; v3 uses the traditional CLI. Do not blindly unify; the configs differ significantly.
- **bcryptjs v2 → v3:** `bcryptjs` is on 2.4.3; v3.0.3 is available. The jump introduces async-only API changes. Password hashing is security-critical — plan this as a dedicated fix to verify no sync-`hash` calls exist in the backend.
  ```bash
  grep -r "bcrypt\.hash\b\|bcrypt\.compare\b" backend/ --include="*.mjs"
  ```
