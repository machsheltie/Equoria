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
import { getStaffLog, getStaffLogActors } from '../controllers/staffLogController.mjs';
import {
  changeTicketStatus,
  createTicket,
  getTicketById,
  getTickets,
  replyToTicket,
} from '../controllers/staffTicketController.mjs';
import { listStaff, lookupUser, setUserRole } from '../controllers/staffRolesController.mjs';
import {
  banAccount,
  banDevice,
  banIp,
  freezePlayer,
  liftAccount,
  liftDevice,
  liftIp,
  getConductRecord,
  lookupPlayer,
  warnPlayer,
} from '../controllers/staffConductController.mjs';
import {
  getFlaggedAddresses,
  getLinkedAccounts,
} from '../controllers/staffLinkedAccountsController.mjs';
import {
  diagnoseShow,
  getQuarantinedShows,
  getShowScoreInputs,
  previewShow,
  runShow,
} from '../controllers/staffShowsController.mjs';
import { runGroomPayroll } from '../controllers/staffPayrollController.mjs';

const router = express.Router();

router.post('/checkin/request', requireStaffRole, requestCheckin);
router.post('/checkin/verify', requireStaffRole, verifyCheckin);
router.get('/me', requireStaffRole, getStaffMe);
// Admin sees every entry; a moderator is forced to their own.
router.get('/log', requireStaffCapability('log.view.own'), getStaffLog);
// Admin only: everyone who has ever written to the log, for the actor filter.
router.get('/log/actors', requireStaffCapability('log.view.all'), getStaffLogActors);
// Owner only (q76). /roles/lookup is registered before the /roles/:userId catch-all.
router.get('/roles', requireStaffCapability('roles.manage'), listStaff);
router.post('/roles/lookup', requireStaffCapability('roles.manage'), lookupUser);
router.post('/roles/:userId', requireStaffCapability('roles.manage'), setUserRole);

// Player conduct (Equoria-w47x7, owner ruling q77): warn, freeze 1/3/7 days, ban the
// account, ban the IP or device. Moderators, admins and the owner; the actor-versus-
// target rules are staffTargetRefusal's, applied under the target's row lock.
// /conduct/lookup is registered before the /conduct/:userId catch-all.
router.post('/conduct/lookup', requireStaffCapability('warn'), lookupPlayer);
router.get('/conduct/:userId', requireStaffCapability('warn'), getConductRecord);
router.post('/conduct/:userId/warn', requireStaffCapability('warn'), warnPlayer);
router.post('/conduct/:userId/freeze', requireStaffCapability('freeze'), freezePlayer);
router.post('/conduct/:userId/ban/account', requireStaffCapability('ban.account'), banAccount);
router.post('/conduct/:userId/ban/ip', requireStaffCapability('ban.ip'), banIp);
router.post('/conduct/:userId/ban/device', requireStaffCapability('ban.device'), banDevice);

// Lifting (owner ruling q101): the Owner and Admins only; a moderator cannot undo.
router.post('/conduct/:userId/lift/account', requireStaffCapability('conduct.lift'), liftAccount);
router.post('/conduct/:userId/lift/ip', requireStaffCapability('conduct.lift'), liftIp);
router.post('/conduct/:userId/lift/device', requireStaffCapability('conduct.lift'), liftDevice);

// Owner and Admins (Equoria-x5n89, owner rulings q123-q125): accounts sharing a device
// with a player, and addresses seen with more than four accounts. Flags never block.
router.get(
  '/conduct/:userId/linked-accounts',
  requireStaffCapability('accounts.linked.view'),
  getLinkedAccounts,
);
router.get(
  '/flagged-addresses',
  requireStaffCapability('accounts.linked.view'),
  getFlaggedAddresses,
);

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

// Owner only (Equoria-ehlbj, rulings q29/q30/q41): shows quarantined after 3 failed
// executions (Equoria-c7mx0.1) or 3 failed payouts (Equoria-o1vns), and the tools to
// resolve them: Diagnose (a downloadable export), then Run Show in two steps.
router.get(
  '/shows/quarantined',
  requireStaffCapability('shows.quarantine.view'),
  getQuarantinedShows,
);
router.get(
  '/shows/quarantined/:showId/diagnose',
  requireStaffCapability('shows.quarantine.resolve'),
  diagnoseShow,
);
router.post(
  '/shows/quarantined/:showId/preview',
  requireStaffCapability('shows.quarantine.resolve'),
  previewShow,
);
router.post(
  '/shows/quarantined/:showId/run',
  requireStaffCapability('shows.quarantine.resolve'),
  runShow,
);

// Owner and admins: the luck roll and score inputs recorded per entry
// (Equoria-4q02c, owner ruling q01). Never moderators or players.
router.get(
  '/shows/:showId/score-inputs',
  requireStaffCapability('results.scoreInputs.view'),
  getShowScoreInputs,
);

// Owner only (Equoria-opdt7, owner ruling q262): run the weekly groom payday by hand.
router.post('/payroll/grooms/run', requireStaffCapability('payroll.run'), runGroomPayroll);

export default router;
