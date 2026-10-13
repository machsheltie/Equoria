/**
 * Staff routes (Equoria-puj1e.1)
 *
 * Mounted at /api/v1/staff on the staff router, which applies
 * authenticateToken + csrfProtection. Every route names its guard inline:
 * requireStaffRole for the two check-in paths and GET /me, and
 * requireStaffCapability(cap) for everything else. The doctrine check
 * (scripts/doctrine-checks/check-staff-routes-guarded.mjs) parses this file:
 * keep each route a plain `router.<method>('<path>', ...middleware, handler)`
 * statement whose guard is a direct argument with literal capability names.
 */

import express from 'express';
import {
  requireAnyStaffCapability,
  requireStaffCapability,
  requireStaffRole,
} from '../middleware/requireStaffCapability.mjs';
import {
  getStaffMe,
  requestCheckin,
  verifyCheckin,
} from '../controllers/staffCheckinController.mjs';
import { getStaffLog } from '../controllers/staffLogController.mjs';
import {
  changeTicketStatus,
  createTicket,
  getTicketById,
  getTickets,
  replyToTicket,
} from '../controllers/staffTicketController.mjs';
import { listStaff, lookupUser, setUserRole } from '../controllers/staffRolesController.mjs';

const router = express.Router();

router.post('/checkin/request', requireStaffRole, requestCheckin);
router.post('/checkin/verify', requireStaffRole, verifyCheckin);
router.get('/me', requireStaffRole, getStaffMe);
// Admin sees every entry; a moderator is forced to their own.
router.get('/log', requireStaffCapability('log.view.own'), getStaffLog);
// Admin only. /roles/lookup is registered before the /roles/:userId catch-all.
router.get('/roles', requireStaffCapability('roles.manage'), listStaff);
router.post('/roles/lookup', requireStaffCapability('roles.manage'), lookupUser);
router.post('/roles/:userId', requireStaffCapability('roles.manage'), setUserRole);

// Tickets: moderators file; both roles read and reply (a moderator only on
// their own); only the admin changes status. Capability lists stay inline
// literals so the doctrine check can read them.
router.post('/tickets', requireStaffCapability('ticket.file'), createTicket);
router.get('/tickets', requireAnyStaffCapability(['ticket.file', 'ticket.resolve']), getTickets);
router.get(
  '/tickets/:id',
  requireAnyStaffCapability(['ticket.file', 'ticket.resolve']),
  getTicketById,
);
router.post(
  '/tickets/:id/replies',
  requireAnyStaffCapability(['ticket.file', 'ticket.resolve']),
  replyToTicket,
);
router.post('/tickets/:id/status', requireStaffCapability('ticket.resolve'), changeTicketStatus);

export default router;
