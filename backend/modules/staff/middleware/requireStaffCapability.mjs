/**
 * Staff route guards (Equoria-puj1e.1, Task 3)
 *
 * Mounted after authenticateToken + csrfProtection on the staff router.
 *
 * Both guards re-read the account from the database on every request: the
 * role inside an access token goes stale the moment staff access is revoked.
 *
 * - Non-staff receive the app's ordinary unknown-route 404, so the staff
 *   surface's existence is not disclosed.
 * - requireStaffRole (check-in request/verify and GET /me only): staff role.
 * - requireStaffCapability(cap) / requireAnyStaffCapability([caps]) (every other staff route): staff role, a
 *   verified email, a valid trusted-device cookie for this account, and cap.
 *
 * Attaches `req.staff = { id, role }`.
 *
 * - requireFreshStaffProof(purpose) (Equoria-puj1e.5, STAFF-CR-06): placed right
 *   after a capability guard on an action that needs a fresh emailed code each
 *   time (outage time-back apply and undo, owner ruling q378). It checks the
 *   typed code (`req.body.code`) against the newest code of that purpose and
 *   attaches `req.freshProof`; the action consumes it in its own transaction.
 */

import logger from '../../../utils/logger.mjs';
import { createNotFoundHandler } from '../../../middleware/notFoundHandler.mjs';
import { hasCapability, isStaffRole } from '../capabilities.mjs';
import {
  isTrustedDevice,
  loadStaffAccount,
  staffDeviceTokenFrom,
  StaffCheckinError,
} from '../services/staffCheckinService.mjs';
import { checkFreshCode } from '../services/staffFreshCodeService.mjs';

// Same handler app.mjs mounts as its catch-all; staff paths are under /api so
// it always answers with the JSON 404, never SPA html.
const respondNotFound = createNotFoundHandler({ spaHtml: null, logger });

/** The refusal code a capability guard answers with when the role lacks the tool. */
export const capabilityRequiredCode = 'staffCapabilityRequired';

/** The refusal code a capability guard answers with when this browser is not checked in. */
export const checkinRequiredCode = 'staffCheckinRequired';

const respondGuardFailure = (res, error) => {
  logger.error(`[staff] guard lookup failed: ${error.message}`);
  return res.status(500).json({
    success: false,
    message: 'Staff verification unavailable. Please retry.',
  });
};

/**
 * Staff role only, read fresh. For the check-in routes and GET /me.
 */
export const requireStaffRole = async (req, res, next) => {
  try {
    const account = await loadStaffAccount(req.user?.id);
    if (!account || !isStaffRole(account.role)) {
      return respondNotFound(req, res);
    }
    req.staff = { id: account.id, role: account.role };
    req.staffAccount = account;
    return next();
  } catch (error) {
    return respondGuardFailure(res, error);
  }
};

function buildCapabilityGuard(capabilities) {
  return async (req, res, next) => {
    try {
      const account = await loadStaffAccount(req.user?.id);
      if (!account || !isStaffRole(account.role)) {
        return respondNotFound(req, res);
      }
      if (account.emailVerified !== true) {
        return res.status(403).json({
          success: false,
          code: 'staffEmailUnverified',
          message: 'Staff tools need a verified email address.',
        });
      }
      const trusted = await isTrustedDevice(account, staffDeviceTokenFrom(req.cookies));
      if (!trusted) {
        return res.status(403).json({
          success: false,
          code: checkinRequiredCode,
          message: "Check in to the Steward's Office on this browser first.",
        });
      }
      if (!capabilities.some(capability => hasCapability(account.role, capability))) {
        return res.status(403).json({
          success: false,
          code: capabilityRequiredCode,
          message: 'Your staff role does not include this tool.',
        });
      }
      req.staff = { id: account.id, role: account.role };
      req.staffAccount = account;
      return next();
    } catch (error) {
      return respondGuardFailure(res, error);
    }
  };
}

/**
 * Full staff guard for one named capability.
 * @param {string} capability
 */
export function requireStaffCapability(capability) {
  return buildCapabilityGuard([capability]);
}

/**
 * Same guard, satisfied by holding ANY of the named capabilities (a route both
 * roles use, e.g. ticket threads). Identical fresh-role, verified-email and
 * trusted-device checks.
 * @param {string[]} capabilities
 */
export function requireAnyStaffCapability(capabilities) {
  return buildCapabilityGuard(capabilities);
}

/** The refusal code for a missing, wrong, used or expired fresh code. */
export const freshCodeInvalidCode = 'staffFreshCodeInvalid';

/**
 * Fresh one-time code for one action. Mount only after a capability guard
 * (it reads `req.staffAccount`); the doctrine check pins that order.
 * @param {string} purpose e.g. 'timeBackApply'
 */
export function requireFreshStaffProof(purpose) {
  return async (req, res, next) => {
    try {
      req.freshProof = await checkFreshCode(req.staffAccount, purpose, req.body?.code);
      return next();
    } catch (error) {
      if (error instanceof StaffCheckinError) {
        return res.status(403).json({
          success: false,
          code: freshCodeInvalidCode,
          message: 'That code is not right, or it has run out. Send a new code and try again.',
        });
      }
      return respondGuardFailure(res, error);
    }
  };
}
