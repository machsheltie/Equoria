/**
 * Bank Routes — Weekly Reward Claim
 *
 * POST /claim       — Claim the weekly 500-coin reward
 * GET  /claim-status — Check if reward is available
 */

import express from 'express';
import { claimWeeklyReward, getClaimStatus } from '../controllers/bankController.mjs';

const router = express.Router();

router.post('/claim', claimWeeklyReward);
router.get('/claim-status', getClaimStatus);

export default router;
