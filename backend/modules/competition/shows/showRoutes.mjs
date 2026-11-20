/**
 * Show Routes (Epic BACKEND-A)
 *
 * BA-2: POST /api/v1/shows/create     — create a player-run show
 * BA-3: GET  /api/v1/shows            — browse shows (paginated)
 * BA-3: POST /api/v1/shows/:id/enter  — enter a horse in a show
 * BA-4: POST /api/v1/shows/execute    — ADMIN-ONLY overnight execution (or cron)
 *
 * Auth (authenticateToken + csrfProtection) is applied at authRouter level in
 * app.mjs for every route here.
 */

import express from 'express';
import { authenticateToken, requireRole, requireStaffCheckin } from '../../../middleware/auth.mjs';
import { csrfProtection } from '../../../middleware/csrf.mjs';
import { createShow, getShows, enterShow, getHostingStatus } from './showController.mjs';
import { executeClosedShows } from './showExecutionService.mjs';
import { withAdmission } from '../../../utils/cronLock.mjs';
import { takeJobBarrierSharedTx } from '../../staff/index.mjs';

const router = express.Router();

/**
 * The admin's run of every due show settles them as the nightly show job does,
 * so it runs the way that job runs (Equoria-puj1e.5.3): inside a transaction
 * that holds the nightly-job barrier in shared mode for the whole run, taken
 * before any row lock. A time-back apply, undo or hold change that holds the
 * barrier is waited out first (the shows due are read after it, on the dates it
 * left), and waits for this run in turn. Without it a conformation settlement
 * could claim a show and wait for a horse the apply held while the apply waited
 * to move that show's dates: a deadlock. It does not read the hold.
 */
async function executeClosedShowsUnderBarrier(req, res, next) {
  try {
    await withAdmission(() => executeClosedShows(req, res), {
      admit: async tx => {
        await takeJobBarrierSharedTx(tx);
        return true;
      },
    });
  } catch (error) {
    next(error);
  }
}

// Static routes before :id parameterised routes
router.post('/create', createShow);

/**
 * SECURITY (Equoria-619ik): show execution scores ALL due closed shows,
 * pays out every prize, and burns escrow — an administrative / overnight-cron
 * operation, NOT a per-player action. The controller's own doc-comment calls
 * it "admin/cron overnight execution". This router rides the authRouter, which
 * applies `authenticateToken` + `csrfProtection`, so the route was reachable by
 * ANY authenticated user — letting a normal player force-execute every due show
 * on demand (a game-economy integrity / DoS surface).
 *
 * The `requireRole('admin')` below restricts the HTTP surface to admins (403
 * for an authenticated non-admin). `authenticateToken` + `csrfProtection` are
 * repeated for defense-in-depth — idempotent when this router rides the
 * authRouter, but they keep the write fail-closed if it is ever re-mounted onto
 * a less-protected router. This mirrors the established per-route admin-gate
 * pattern in `modules/horses/routes/breedRoutes.mjs` (breed creation).
 *
 * The nightly cron path is UNAFFECTED: it calls `executeClosedShows()`
 * directly in-process (see `backend/services/jobs/nightlyShowExecutionJob.mjs`),
 * NOT over HTTP — so it never passes through this middleware chain.
 */
router.post(
  '/execute',
  authenticateToken,
  requireRole('admin'),
  requireStaffCheckin('admin'),
  csrfProtection,
  executeClosedShowsUnderBarrier,
);

router.get('/hosting', getHostingStatus);
router.get('/', getShows);
router.post('/:id/enter', enterShow);

export default router;
