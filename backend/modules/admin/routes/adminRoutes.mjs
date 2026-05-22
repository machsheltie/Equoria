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
  manualHorseAging,
  setHorseAge,
  triggerFoaling,
  backfillPruneNotifications,
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

export default router;
