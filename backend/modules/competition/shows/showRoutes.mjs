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
import { authenticateToken, requireRole, requireAdminMfa } from '../../../middleware/auth.mjs';
import { csrfProtection } from '../../../middleware/csrf.mjs';
import { createShow, getShows, enterShow, executeClosedShows } from './showController.mjs';

const router = express.Router();

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
 * Equoria-l432a: this router rides the AUTH router (see backend/app/routers.mjs
 * — `authRouter.use('/shows', showRoutes)`), NOT the adminRouter. The global
 * `requireAdminMfa` mounted on the adminRouter (Equoria-te21j) therefore does
 * NOT cover this route. Because show execution is a high-impact admin action
 * (scores all due shows, pays every prize, settles/burns escrow), we add
 * `requireAdminMfa` directly AFTER `requireRole('admin')` so the optional
 * ADMIN_MFA_REQUIRED policy gates it too. With the flag off (default) this is a
 * no-op — behavior is unchanged; with the flag on, an admin without MFA enrolled
 * gets a 403 here just like on the adminRouter routes. requireRole runs first so
 * a non-admin is rejected before requireAdminMfa ever runs (no MFA-message leak
 * to non-admins).
 *
 * The scheduled cron / showScheduler path is UNAFFECTED: it calls
 * `executeClosedShows()` directly in-process (see
 * `backend/services/cronJobs.mjs` and `backend/utils/showScheduler.mjs`),
 * NOT over HTTP — so it never passes through this middleware chain.
 */
router.post(
  '/execute',
  authenticateToken,
  requireRole('admin'),
  requireAdminMfa,
  csrfProtection,
  executeClosedShows,
);

router.get('/', getShows);
router.post('/:id/enter', enterShow);

export default router;
