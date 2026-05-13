/**
 * NextActions Routes (Task 23-4)
 *
 * GET /api/v1/next-actions — returns prioritized action list for authenticated user
 */

import express from 'express';
import { getNextActions } from '../controllers/nextActionsController.mjs';

const router = express.Router();

// Authentication is applied at the authRouter level in app.mjs
router.get('/', getNextActions);

export default router;
