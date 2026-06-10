/**
 * Admin Routes
 *
 * All routes require admin role (enforced by adminRouter in app.mjs via
 * authenticateToken + requireRole('admin') + CSRF protection).
 *
 * Handlers extracted to adminController.mjs — pure structural refactor.
 */

import express from 'express';
import {
  getCronStatus,
  getCronHealth,
  getSseMetrics,
  startCron,
  stopCron,
  evaluateTraits,
  getFoalDevelopment,
  getTraitDefinitions,
  getTraitRevelationAnalyticsHandler,
  manualHorseAging,
  setHorseAge,
  triggerFoaling,
  backfillPruneNotifications,
  refreshUserDocumentation,
  generateApiDocumentation,
  registerApiEndpoint,
  registerApiSchema,
} from '../controllers/adminController.mjs';

const router = express.Router();

// ── Cron ──────────────────────────────────────────────────────────────────────
router.get('/cron/status', getCronStatus);
router.get('/cron/health', getCronHealth); // Equoria-0elk heartbeat/staleness
router.post('/cron/start', startCron);
router.post('/cron/stop', stopCron);

// ── SSE observability (Equoria-fsuys) ───────────────────────────────────────────
router.get('/sse/metrics', getSseMetrics);

// ── Traits ────────────────────────────────────────────────────────────────────
router.post('/traits/evaluate', evaluateTraits);
router.get('/traits/definitions', getTraitDefinitions);
// Equoria-yznve: aggregate trait-revelation analytics from TraitHistoryLog.
// Specific route — no /:id catch-all in this router, but kept grouped with the
// other /traits/* specifics per CONTRIBUTING.md route-ordering convention.
router.get('/traits/analytics', getTraitRevelationAnalyticsHandler);

// ── Foals ─────────────────────────────────────────────────────────────────────
router.get('/foals/development', getFoalDevelopment);

// ── Horses ────────────────────────────────────────────────────────────────────
router.post('/horses/age', manualHorseAging);
router.post('/horses/:id/set-age', setHorseAge);

// ── Foaling ───────────────────────────────────────────────────────────────────
router.post('/foaling/trigger', triggerFoaling);

// ── Notifications ───────────────────────────────────────────────────────────────
// ADR-007 one-time backfill: prune every user's notifications down to the cap.
router.post('/notifications/backfill-prune', backfillPruneNotifications);

// ── Documentation (Equoria-bs6fc) ────────────────────────────────────────────────
// Privileged user-documentation cache refresh. Relocated here from the PUBLIC
// /user-docs router where it was reachable by anonymous callers. Inherits
// authenticateToken + requireRole('admin') + csrfProtection from adminRouter.
router.post('/docs/refresh', refreshUserDocumentation);

// ── API-doc management (Equoria-7osu4) ───────────────────────────────────────────
// Privileged OpenAPI-spec mutations. Relocated here from the PUBLIC /docs router
// (modules/docs/routes/documentationRoutes.mjs) where they carried only a
// per-route authenticateToken (no admin role, no CSRF), letting any
// authenticated non-admin register endpoints/schemas and force a swagger.yaml
// disk write via /generate. Inherits authenticateToken + requireRole('admin')
// + csrfProtection from adminRouter.
router.post('/docs/generate', generateApiDocumentation);
router.post('/docs/endpoints', registerApiEndpoint);
router.post('/docs/schemas', registerApiSchema);

export default router;
