/**
 * Staff routes (Equoria-puj1e.1)
 *
 * Mounted at /api/v1/staff on the staff router, which applies
 * authenticateToken + csrfProtection. Every route names its guard inline:
 * requireStaffRole for the two check-in paths and GET /me, and
 * requireStaffCapability(cap) for everything else. A doctrine check parses
 * `router.<method>(path, ...middleware, handler)` here — keep that shape and
 * keep the Router named `router`.
 */

import express from 'express';
import { requireStaffCapability, requireStaffRole } from '../middleware/requireStaffCapability.mjs';
import {
  getStaffMe,
  requestCheckin,
  verifyCheckin,
} from '../controllers/staffCheckinController.mjs';
import { getStaffLog } from '../controllers/staffLogController.mjs';

const router = express.Router();

router.post('/checkin/request', requireStaffRole, requestCheckin);
router.post('/checkin/verify', requireStaffRole, verifyCheckin);
router.get('/me', requireStaffRole, getStaffMe);
// Admin sees every entry; a moderator is forced to their own.
router.get('/log', requireStaffCapability('log.view.own'), getStaffLog);

export default router;
