/**
 * Bank Routes — Weekly Reward Claim
 *
 * POST /claim       — Claim the weekly 500-coin reward
 * GET  /claim-status — Check if reward is available
 */

import express from 'express';
import {
  claimWeeklyReward,
  getClaimStatus,
  getTransactionHistory,
} from '../controllers/bankController.mjs';
// Equoria-ftjm: dedicated stricter per-user limiter on economy mutations.
// Applied ONLY to the coin-moving POST (claim) — reads stay on apiLimiter.
import { financialRateLimiter } from '../../../middleware/rateLimiting.mjs';
// Equoria-jk9oj.2: declare auth at the router that OWNS these mutations rather
// than inferring it from the authRouter mount comment. Idempotent with the
// mount-level authenticateToken; the guard travels with the file if re-mounted.
import { authenticateToken } from '../../../middleware/auth.mjs';

const router = express.Router();
router.use(authenticateToken);

router.post('/claim', financialRateLimiter, claimWeeklyReward);
router.get('/claim-status', getClaimStatus);
router.get('/transactions', getTransactionHistory);

export default router;
