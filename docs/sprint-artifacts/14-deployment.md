# Epic 14: Deployment & Production

**Status:** Complete
**Completed:** 2026-02-23
**Platform:** Railway
**Architecture:** Monolithic — Express serves the Vite SPA as static files

---

## Summary

Epic 14 makes Equoria deployable to production. A single `git push` to `master` now
triggers a full build, test, and deploy pipeline that produces a running Railway service
serving both the API and the React frontend from one Docker container.

---

## Stories Completed

| Story | Title                                        | Status      |
| ----- | -------------------------------------------- | ----------- |
| 14-1  | CI/CD — Docker Build Validation              | ✅ Complete |
| 14-2  | Railway Configuration (Staging + Production) | ✅ Complete |
| 14-3  | Production Environment                       | ✅ Complete |
| 14-4  | Database Migration Pipeline                  | ✅ Complete |
| 14-5  | Monitoring + Error Tracking (Sentry)         | ✅ Complete |
| 14-6  | Performance Audit (Lighthouse + Bundle)      | ✅ Complete |

---

## Files Changed

| File                               | Action   | Notes                                          |
| ---------------------------------- | -------- | ---------------------------------------------- |
| `Dockerfile`                       | Modified | Multi-stage: `frontend-builder` → `production` |
| `railway.toml`                     | Created  | Build + deploy config for Railway              |
| `backend/app.mjs`                  | Modified | `express.static` + SPA fallback in production  |
| `frontend/src/lib/api-client.ts`   | Modified | `??` for relative URLs (monolithic)            |
| `frontend/src/lib/sentry.ts`       | Created  | `initSentry()` + `SentryErrorBoundary`         |
| `frontend/src/App.tsx`             | Modified | Sentry init + ErrorBoundary wrapper            |
| `frontend/vite.config.ts`          | Modified | `rollup-plugin-visualizer` added               |
| `frontend/package.json`            | Modified | `@sentry/react`, `rollup-plugin-visualizer`    |
| `backend/package.json`             | Modified | `migrate:production` script                    |
| `backend/.env.example`             | Modified | `SENTRY_DSN` documented                        |
| `frontend/.env.example`            | Modified | `VITE_SENTRY_DSN` documented                   |
| `.github/workflows/ci-cd.yml`      | Modified | Jobs 10 (Docker) + 11 (Lighthouse)             |
| `.lighthouserc.yml`                | Created  | Lighthouse CI thresholds                       |
| `docs/deployment/RAILWAY_SETUP.md` | Created  | Step-by-step Railway setup guide               |

---

## Architecture Decisions

### Monolithic Deploy

Express serves the Vite build as static files in production:

- `/api/*` → Express routes (JSON API)
- `/*` → `express.static(public/)` → `index.html` SPA fallback
- No separate CDN or frontend hosting needed
- Single Railway service, single `DATABASE_URL`

### Relative API URLs

`VITE_API_URL ?? ''` (nullish coalescing) means:

- `VITE_API_URL` unset → empty string → `/api/...` (relative, correct for monolithic)
- `VITE_API_URL` set → explicit URL (for split deploy if ever needed)
- Dev: Vite proxy forwards `/api/*` to `localhost:3001`

### Multi-Stage Dockerfile

- **Stage 1 `frontend-builder`**: `npm ci` + `npx vite build` → produces `dist/`
- **Stage 2 `production`**: backend deps only, `prisma generate`, copies `dist/` to `public/`
- Uses `npx vite build` directly (not `npm run build`) to skip `tsc` — TypeScript
  type-checking runs separately in CI's `code-quality` job

### Zero-Downtime Migrations

`railway.toml` `startCommand` runs `prisma migrate deploy` before `node server.mjs`:

- Idempotent — safe on every deploy even with no new migrations
- Fails fast if migration fails (prevents broken server start)
- `migrate deploy` (not `migrate dev`) — no prompts, no shadow database

### Sentry

- **Backend**: Already fully implemented (`config/sentry.mjs`, `initializeSentry(app)`)
- **Frontend**: `@sentry/react` with `initSentry()` guard (no-op if `VITE_SENTRY_DSN` unset)
- Both disabled by default — opt-in via env var

---

## Verification Checklist

- [x] `npx vite build` in `frontend/` — 2836 modules, `dist/` produced
- [x] ESLint: 0 errors on all modified files
- [x] `Dockerfile` reviewed — multi-stage, non-root user, health check
- [x] `railway.toml` — migrate + start command correct
- [x] `app.mjs` — static serving + SPA fallback behind `NODE_ENV=production` guard
- [x] `api-client.ts` — relative URL fallback (`??`)
- [x] `ci-cd.yml` — Docker + Lighthouse jobs added (master only)
- [x] `RAILWAY_SETUP.md` — full setup guide with troubleshooting table

---

## Dependencies Installed

```
frontend:
  @sentry/react              (production)
  @radix-ui/react-progress   (pre-existing missing dep, now resolved)
  rollup-plugin-visualizer   (devDependency)
```

---

## Known Issues / Backlog

- Bundle size warning: `index-*.js` at ~1.6 MB (expected for a feature-rich game)
  - `dist/bundle-stats.html` generated on every build for inspection
  - Code-splitting or lazy routes would reduce initial load — future optimization
- Story 13-5 (Trainer API wire-up) remains in backlog pending backend trainer routes
