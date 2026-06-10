/**
 * 🏇 EQUORIA BACKEND - Express Application Composition Root
 *
 * Main Express application for the Equoria horse breeding and competition game.
 * This file is the COMPOSITION ROOT: it reads as a clear assembly of already-
 * tested modules — create the app, initialize monitoring, apply middleware
 * groups in a fixed order, mount the security routers, apply the static
 * fallback, apply the error pipeline, and export the app.
 *
 * The implementation details have been factored into focused modules
 * (Equoria-515lv) so this file stays scannable:
 *   - backend/config/staticAssets.mjs   — static dir selection + cache headers
 *   - backend/config/corsPolicy.mjs     — no-origin gate + CORS delegate
 *   - backend/config/healthHandlers.mjs — /health, /ready, /api-info handlers
 *   - backend/app/routers.mjs           — public/auth/admin router composition
 *
 * 🔧 MIDDLEWARE STACK (ORDER IS BEHAVIOR — DO NOT REORDER CASUALLY):
 *   1. Sentry init (before any other middleware)
 *   2. trust proxy
 *   3. addSecurityHeaders → helmet (headers before helmet's CSP/COEP/HSTS)
 *   4. enforceNoOriginPolicy → cors (no-origin gate before CORS value check)
 *   5. apiLimiter on /api/
 *   6. body parsing (json/urlencoded) → polluted-body → polluted-query guards
 *   7. cookieParser
 *   8. requestLogger → globalAuditTrail (audit after logging, before routes)
 *   9. doc headers → response optimization → resource/memory management
 *  10. routers (public → /api/v1/breeds → /api/v1/performance [admin-only] → admin → auth)
 *  11. static asset dirs → SPA/404 fallback
 *  12. errorRequestLogger → Sentry error handler → CSRF/body-security/global
 *      error handlers
 *
 * 🚀 API ROUTES: see backend/app/routers.mjs for the full route map.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { readFileSync } from 'fs';
import { join } from 'path';

import logger from './utils/logger.mjs';

// Static asset configuration (dir selection + cache headers)
import { staticAssetDirs, spaPublicDir, setStaticCacheHeaders } from './config/staticAssets.mjs';

// CORS + no-origin policy
import { enforceNoOriginPolicy, corsOptionsDelegate } from './config/corsPolicy.mjs';

// Security router composition (public / authenticated / admin)
import { buildRouters, breedRoutes } from './app/routers.mjs';

import performanceMetricsRouter from './utils/performanceMonitor.mjs';

// Equoria-xfqy4 (SECURITY P1): authenticateToken + requireRole gate the
// detailed performance-metrics mount admin-only (see mount below).
import { authenticateToken, requireRole } from './middleware/auth.mjs';

// CSRF protection error handler
import { csrfErrorHandler } from './middleware/csrf.mjs';
import {
  verifyJsonBody,
  verifyUrlEncodedBody,
  rejectPollutedRequestBody,
  rejectPollutedRequestQuery,
  requestBodySecurityErrorHandler,
} from './middleware/requestBodySecurity.mjs';

// Redis rate limiting (createRateLimiter for the global API limiter)
import { createRateLimiter } from './middleware/rateLimiting.mjs';

// Shared security configuration (helmet CSP/COEP + response headers)
import { helmetConfig, addSecurityHeaders } from './middleware/security.mjs';

// Middleware imports
import errorHandler from './middleware/errorHandler.mjs';
import { requestLogger, errorRequestLogger } from './middleware/requestLogger.mjs';
// Equoria-jw10w: global, enforced-by-construction DB audit trail (OWASP A09).
import { globalAuditTrail } from './middleware/auditLog.mjs';
import { setupSwaggerDocs, addDocumentationHeaders } from './middleware/swaggerSetup.mjs';
import {
  responseOptimization,
  paginationMiddleware,
  performanceMonitoring,
} from './middleware/responseOptimization.mjs';
import { createCompressionMiddleware } from './services/apiResponseOptimizationService.mjs';
import {
  createResourceManagementMiddleware,
  memoryMonitoringMiddleware,
  databaseConnectionMiddleware,
  requestTimeoutMiddleware,
} from './middleware/resourceManagement.mjs';

// Service imports
import prisma from '../packages/database/prismaClient.mjs';

// Sentry error tracking and monitoring
import { initializeSentry, attachSentryErrorHandler } from './config/sentry.mjs';

const app = express();

// Initialize Sentry (must be before any other middleware)
initializeSentry(app);

// Trust proxy for accurate IP addresses behind reverse proxies
app.set('trust proxy', 1);

// Security middleware
// Order: addSecurityHeaders runs first and only sets headers helmet does NOT
// emit (Permissions-Policy; plus an X-XSS-Protection value helmet leaves
// alone) — because helmet runs AFTER it and overwrites any header it also
// sets. Helmet is therefore the authoritative source for the headers it
// owns: CSP + COEP + HSTS, and (since Equoria-kckix) X-Frame-Options=DENY +
// Referrer-Policy=strict-origin-when-cross-origin, declared in helmetConfig
// so the EMITTED value matches the intended stricter policy.
app.use(addSecurityHeaders);
app.use(helmet(helmetConfig));

// CORS + no-origin policy — single authoritative source (config/corsPolicy.mjs).
// Two layers in order:
//   1. enforceNoOriginPolicy — hard-rejects no-origin mutations on API paths.
//   2. cors(corsOptionsDelegate) — validates the Origin value when present.
app.use(enforceNoOriginPolicy);
app.use(cors(corsOptionsDelegate));

// Rate limiting - using factory for consistency and test support
// ⚠️ DEV WORKFLOW NOTE: Limits are intentionally high for local development.
// DO NOT reduce the development/test/beta/beta-readiness limits — they exist
// to prevent lockouts during active dev and testing sessions.
// Production: 100 req / 15 min | Beta: 500 req / 15 min | Development: 500 req / 15 min |
// Test / beta-readiness: 1000 req / 15 min
//
// Story 21S-3: NODE_ENV=beta (Playwright) sits between dev and prod — high
// enough that E2E without bypass headers does not 429, low enough that an
// abusive client would still be throttled.
//
// beta-readiness runs the full Playwright readiness suite against production
// middleware; at production's 100-req cap the suite self-rate-limits before
// reaching the end of a single flow. Treating beta-readiness like test for
// this limit keeps production parity where it matters (auth, CSRF, ownership,
// email delivery) without turning the gate into a rate-limiter test.
const RATE_LIMIT_MAX_BY_ENV = {
  // Test suite runs several hundred requests across many files in one
  // --runInBand session. 1000 was the old cap when bypass headers reset
  // the counter between suites; with bypasses removed in WS4 the counter
  // accumulates for the whole run, so we set the cap well above what any
  // realistic suite run consumes.
  test: 20000,
  'beta-readiness': 1000,
  // Equoria-obwp follow-up: bumped from 500 → 3000.
  // The Playwright E2E suite issues ~7 minutes of sequential requests from
  // a single source IP (::1 in CI). Each spec triggers register/login plus
  // a handful of API calls; the full suite easily exceeds 500 requests in
  // one 15-min window. Even with Redis-backed distributed rate limiting
  // (now correctly wired by the boot-race fix in middleware/rateLimiting.mjs),
  // the per-IP counter is identical — `ip:::1` is a single key. 3000 is
  // still well below what a real abusive client could trip while leaving
  // headroom for the suite to grow without re-tripping. A 15-min window of
  // 3000 reqs = 3.3 req/sec sustained, which is consistent with a human
  // beta tester pattern and easily exceeded by automated scraping.
  beta: 3000,
  development: 500,
};
//
// ─── Per-environment cap divergence rationale (Equoria-aih8) ─────────────────
// There are THREE distinct rate limiters with intentionally different
// per-env caps. They are NOT redundant — each governs a different abuse
// surface over a different window. This block + the sentinel
// `backend/__tests__/betaReadinessEnvSentinel.test.mjs` pin the divergence
// so it cannot silently drift or collapse into a bypass.
//
//   Limiter            Source                              Window  beta  beta-readiness  production
//   apiLimiter         app.mjs RATE_LIMIT_MAX_BY_ENV        15min  3000  1000            100
//   mutationRateLimiter rateLimiting.mjs                     1min  120   (none → 30)     30
//   authRateLimiter    rateLimiting.mjs                     15min  200f  200f            200f
//
// Why they diverge:
//  - beta apiLimiter 3000/15min: the Playwright E2E suite runs ~7 min of
//    sequential requests from one source IP (::1 in CI); register+login+
//    per-spec calls exceed 500/window. Bumped 500→3000 (Equoria-obwp) so
//    the suite never self-429s while staying far below an abusive rate.
//    `beta` is selected by the deployment env, never a per-request header.
//  - beta-readiness apiLimiter 1000/15min: the readiness gate runs the full
//    suite against PRODUCTION middleware for parity (auth/CSRF/ownership/
//    email). Production's 100-cap self-rate-limits before one flow finishes;
//    1000 lets the gate complete without becoming a rate-limiter test, yet
//    is an order of magnitude tighter than beta (gate = fewer flows than
//    the full exploratory E2E pass).
//  - mutation beta 120/1min: a SEPARATE, narrower surface — back-to-back
//    stallion/mare/create/feed/breed mutations trip the 30/min prod cap and
//    cascade fixture failures (Equoria-st9u). 120 = 2 mut/sec, abuse-safe.
//    `beta-readiness` is deliberately ABSENT from
//    MUTATION_RATE_LIMIT_MAX_BY_ENV so it inherits production 30/min — the
//    readiness gate MUST exercise the real mutation cap.
//  - Global (15min) vs mutation (1min) windows differ, so their numeric
//    caps are not comparable: 3000/15min ≈ 3.3 req/s aggregate vs
//    120/1min = 2 mutations/s burst — they measure different things.
//
// Bypass-safety invariant: none of these env NAMES enable a header /
// isTestEnv bypass. Only NODE_ENV=test (or a live Jest worker) short-
// circuits limiting via TEST_RATE_LIMIT_*. beta / beta-readiness get a
// HIGHER CAP, never a BYPASS — enforced by the sentinel above.
// ────────────────────────────────────────────────────────────────────────────
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: RATE_LIMIT_MAX_BY_ENV[process.env.NODE_ENV] ?? 100,
  keyPrefix: 'rl:global',
  useEnvOverride: false, // Don't let tests override the global limit
});

app.use('/api/', apiLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb', verify: verifyJsonBody }));
app.use(express.urlencoded({ extended: true, limit: '10mb', verify: verifyUrlEncodedBody }));
app.use(rejectPollutedRequestBody);
// 21R-SEC-4 (Equoria-iq84): query-side companion to rejectPollutedRequestBody.
// Express's qs parser turns `?__proto__[isAdmin]=1` into a polluting nested
// object on req.query; this guard rejects it before any handler runs.
app.use(rejectPollutedRequestQuery);

// Cookie parsing middleware for httpOnly cookies
app.use(cookieParser());

// Request logging
app.use(requestLogger);

// Equoria-jw10w (OWASP A09): global DB-backed audit trail. Mounted ONCE here
// so coverage of sensitive mutating routes (auth, financial, breeding,
// training, admin, grooms) is enforced by construction — not opt-in per
// route. Reads are not persisted (mutation-scoped by design). The persist
// callback fires on res 'finish'/'close', after route auth has populated
// req.user, so authenticated mutations record the acting userId. Fail-soft:
// an audit-write error never breaks the request.
app.use(globalAuditTrail);

// Documentation headers
app.use(addDocumentationHeaders());

// Response optimization middleware
app.use(createCompressionMiddleware());
app.use(responseOptimization());
app.use(paginationMiddleware());
app.use(performanceMonitoring());

// Memory and resource management middleware
app.use(
  createResourceManagementMiddleware({
    trackMemoryUsage: true,
    trackPerformance: true,
    enableCleanup: true,
    memoryThreshold: 100 * 1024 * 1024, // 100MB
    performanceThreshold: 5000, // 5 seconds
  }),
);
app.use(
  memoryMonitoringMiddleware({
    threshold: 500 * 1024 * 1024, // 500MB
    enableGC: process.env.NODE_ENV === 'production',
  }),
);
app.use(databaseConnectionMiddleware(prisma));
app.use(requestTimeoutMiddleware(30000)); // 30 second timeout

/**
 * 🔒 MOUNT SECURITY ROUTERS
 *
 * Router mounting order (CRITICAL - DO NOT CHANGE):
 * 1. Public routes first (no auth) — includes /health, /ready, /ping, /api-info
 * 2. Public breed routes (onboarding before login)
 * 3. Performance metrics route (admin-only — Equoria-xfqy4; detailed process
 *    telemetry is reconnaissance data, not a public health signal)
 * 4. Admin routes (highest security)
 * 5. Authenticated routes (standard auth)
 */
const { publicRouter, authRouter, adminRouter } = buildRouters();

// Setup Swagger documentation (public) — registers before the routers below.
setupSwaggerDocs(app);

// MOUNT ROUTERS
// Public routes (health, ping, auth, docs)
app.use('/', publicRouter);

// Equoria-4bs3s: unversioned `/api/*` mounts removed. /api/v1/* is the
// canonical surface; legacy callers MUST migrate. The doctrine check at
// scripts/doctrine-checks/check-no-unversioned-api.mjs prevents new
// frontend code from re-introducing the unversioned path.
// Public breed routes (no auth — needed for onboarding before login)
app.use('/api/v1/breeds', breedRoutes);

// Equoria-xfqy4 (SECURITY P1): GET /api/v1/performance/metrics exposes
// process uptime, node version, platform, arch, PID, memory usage, and cache
// stats — operational/reconnaissance data, NOT a player feature and NOT a
// liveness probe. It was mounted at app level with NO authentication, so any
// anonymous caller could read process-internal diagnostics. Mirror the
// Equoria-rvmse fix for /optimization + /memory: gate the WHOLE mount behind
// authenticateToken + requireRole('admin') so every current and future
// sub-route is admin-only by construction. The mount is at app level (not on
// authRouter), so unlike rvmse it needs authenticateToken too. Lightweight
// PUBLIC health/readiness signals remain on the publicRouter: /health (no DB),
// /ready (real DB ping) — those are intentionally unauthenticated and are NOT
// touched here. URL is unchanged (/api/v1/performance/metrics) — admin-only,
// not moved.
app.use('/api/v1/performance', authenticateToken, requireRole('admin'), performanceMetricsRouter);

// Admin routes (requires auth + admin role)
app.use('/api/v1/admin', adminRouter);

// Authenticated routes (requires auth)
app.use('/api/v1', authRouter);

// Serve frontend static assets in every environment so direct backend-port
// image requests work for local development, non-Docker production, and Docker.
// Must come before the 404 handler so asset requests are served, not rejected.
// Cache-Control policy lives in config/staticAssets.mjs (ZAP rule 10049).
for (const staticAssetDir of staticAssetDirs) {
  app.use(express.static(staticAssetDir, { setHeaders: setStaticCacheHeaders }));
}

// Cache index.html in memory at startup to avoid sendFile streaming issues
let spaHtml = null;
if (process.env.NODE_ENV === 'production' && spaPublicDir) {
  try {
    spaHtml = readFileSync(join(spaPublicDir, 'index.html'), 'utf-8');
  } catch {
    logger.warn('[SPA] Could not read index.html — SPA fallback disabled');
  }
}

// 404 handler for undefined routes
// In production: serve index.html for non-API routes (SPA client-side routing)
// In development: return JSON 404 so API callers get useful errors
app.use('*', (req, res) => {
  if (
    spaHtml &&
    process.env.NODE_ENV === 'production' &&
    !req.path.startsWith('/api') &&
    !req.path.startsWith('/health') &&
    !req.path.startsWith('/api-docs')
  ) {
    // SPA HTML pins the current bundle hash — it must never be served from
    // a stale cache, otherwise users boot an old bundle whose chunks no
    // longer exist on the server (ZAP rule 10049).
    res.setHeader('Cache-Control', 'no-store');
    return res.type('html').send(spaHtml);
  }

  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl} from ${req.ip}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Error request logging
app.use(errorRequestLogger);

// Sentry error handler (must be after routes, before other error handlers)
attachSentryErrorHandler(app);

// CSRF error handler (must be before global error handler)
app.use(csrfErrorHandler);
app.use(requestBodySecurityErrorHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown handling is managed by server.mjs so that background services
// like cron jobs and memory monitoring only run in production environments.

// Process-level error handlers. Guarded out of the test environment:
// under Jest each test file re-imports app.mjs in a fresh module registry,
// and an unguarded process.on(...) here registers a NEW listener per suite
// whose closure pins this module's entire (freshly-built) graph on the
// global `process` object — preventing GC and leaking ~20MB/suite, which
// compounds to multi-GB under the serial pre-push run (Equoria-l052p).
// Production graceful shutdown + these handlers are owned by server.mjs.
if (process.env.NODE_ENV !== 'test') {
  // Unhandled promise rejection handler
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  // Uncaught exception handler
  process.on('uncaughtException', error => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
}

export default app;
