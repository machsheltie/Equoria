/**
 * WhileYouWereGone Routes (Task 24-1)
 *
 * GET /api/v1/while-you-were-gone?since=<ISO-timestamp>
 */

import express from 'express';
import { getWhileYouWereGone } from '../controllers/wyagController.mjs';

const router = express.Router();

// Authentication is applied at the authRouter level in app.mjs
router.get('/', getWhileYouWereGone);

export default router;
