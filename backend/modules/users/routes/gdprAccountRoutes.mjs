/**
 * gdprAccountRoutes.mjs
 *
 * Authenticated, self-only GDPR account routes (Equoria-s3rf). Mounted on
 * `authRouter` at `/account` (see backend/app.mjs), so every request here
 * already passes `authenticateToken` + `csrfProtection`. Both routes act
 * solely on `req.user.id` — there is no user-id parameter, so the
 * requireSelfAccess pattern is satisfied by construction (a token can only
 * ever reach its own data).
 *
 *   GET  /api/v1/account/export  — Right to Access / Data Portability
 *   POST /api/v1/account/delete  — Right to Erasure ("delete my account")
 *
 * Sensitive operations: the export is rate-limited (data-scraping guard)
 * and the deletion is mutation-rate-limited. Both are captured by the
 * global `globalAuditTrail` middleware via the `account` sensitive prefix
 * (see backend/middleware/auditLog.mjs).
 */

import express from 'express';
import { queryRateLimiter, mutationRateLimiter } from '../../../middleware/rateLimiting.mjs';
import { exportAccountData, deleteAccount } from '../controllers/gdprAccountController.mjs';

const router = express.Router();

/** GET /api/v1/account/export — full machine-readable personal-data export */
router.get('/export', queryRateLimiter, exportAccountData);

/** POST /api/v1/account/delete — permanent erasure, password-confirmed */
router.post('/delete', mutationRateLimiter, deleteAccount);

export default router;
