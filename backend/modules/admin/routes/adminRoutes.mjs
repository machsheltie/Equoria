/**
 * Admin Routes
 *
 * All routes require admin role (enforced by adminRouter in app.mjs via
 * authenticateToken + requireRole('admin') + CSRF protection).
 *
 * Handlers extracted to adminController.mjs — pure structural refactor.
 */

import express from 'express';
import { requireRole, requireStaffCheckin } from '../../../middleware/auth.mjs';
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
// Owner only (owner ruling q341, 2026-11-03): an admin passes the router's admin
// gate but not this one. The Steward's Office shows them under horses.age.set.
const ownerOnly = [requireRole('owner'), requireStaffCheckin('owner')];
router.post('/horses/age', ...ownerOnly, manualHorseAging);
router.post('/horses/:id/set-age', ...ownerOnly, setHorseAge);

// ── Foaling ───────────────────────────────────────────────────────────────────
router.post('/foaling/trigger', triggerFoaling);

// ── Notifications ───────────────────────────────────────────────────────────────
// ADR-007 one-time backfill: prune every user's notifications down to the cap.
router.post('/notifications/backfill-prune', backfillPruneNotifications);

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
