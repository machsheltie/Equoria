/**
 * Help routes (Equoria-vc5x1) under /api/v1/help. Any signed-in player may read
 * the team list; messaging a staff member goes through POST /api/v1/messages.
 */

import express from 'express';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { getHelpStaff } from '../controllers/helpController.mjs';

const router = express.Router();
router.use(authenticateToken);

router.get('/staff', getHelpStaff);

export default router;
