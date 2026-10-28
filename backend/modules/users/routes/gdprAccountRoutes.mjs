/**
 * gdprAccountRoutes.mjs
 *
 * Authenticated account routes (Equoria-s3rf). Mounted on `authRouter` at
 * `/account` (see backend/app.mjs), so every request here already passes
 * `authenticateToken` + `csrfProtection`.
 *
 *   POST /api/v1/account/delete  — CLOSED: players cannot delete their
 *                                  accounts (owner ruling, Equoria-gfany)
 *
 * GET /api/v1/account/export (the account data download) was removed by owner
 * ruling 2026-10-28 (q157, Equoria-a7f1p): "Remove it".
 *
 * The closed delete keeps its mutation rate limit and is captured by the
 * global `globalAuditTrail` middleware via the `account` sensitive prefix
 * (see backend/middleware/auditLog.mjs).
 */

import express from 'express';
import { mutationRateLimiter } from '../../../middleware/rateLimiting.mjs';
import { refuseAccountDeletion } from '../controllers/gdprAccountController.mjs';

const router = express.Router();

/** POST /api/v1/account/delete — closed; answers 403 for every caller */
router.post('/delete', mutationRateLimiter, refuseAccountDeletion);

export default router;
