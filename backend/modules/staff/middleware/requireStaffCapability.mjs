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
 */

import logger from '../../../utils/logger.mjs';
import { createNotFoundHandler } from '../../../middleware/notFoundHandler.mjs';
import { hasCapability, isStaffRole } from '../capabilities.mjs';
import {
  STAFF_DEVICE_COOKIE,
  isTrustedDevice,
  loadStaffAccount,
} from '../services/staffCheckinService.mjs';

// Same handler app.mjs mounts as its catch-all; staff paths are under /api so
// it always answers with the JSON 404, never SPA html.
const respondNotFound = createNotFoundHandler({ spaHtml: null, logger });

/** The refusal code a capability guard answers with when the role lacks the tool. */
export const capabilityRequiredCode = 'STAFF_CAPABILITY_REQUIRED';

/** The refusal code a capability guard answers with when this browser is not checked in. */
export const checkinRequiredCode = 'STAFF_CHECKIN_REQUIRED';

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
          code: 'STAFF_EMAIL_UNVERIFIED',
          message: 'Staff tools need a verified email address.',
        });
      }
      const trusted = await isTrustedDevice(account, req.cookies?.[STAFF_DEVICE_COOKIE]);
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
