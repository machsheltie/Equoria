/**
 * Admin tools need the emailed staff check-in (Equoria-n256i, owner ruling
 * 2026-10-29, q289): every admin route asks for the same email-code check-in
 * the Steward's Office uses. No second mechanism: the trusted-device record
 * that POST /api/v1/staff/checkin/verify creates is the proof, read through
 * the same staffCheckinService the staff guards use, so a password or email
 * change (q261) ends it for admin tools exactly as it does for the office.
 *
 * Mounted directly after requireRole(<staff role>) on every admin mount and
 * per-route admin gate. requireRole answers the token's role; this guard
 * re-reads the account, so losing staff access closes the admin tools at once
 * even while an older access token still names the role.
 *
 * - The account's fresh role must still satisfy the required role, else the
 *   same 403 requireRole gives.
 * - A verified email is required (staffEmailUnverified).
 * - A valid trusted-device cookie for this account is required
 *   (staffCheckinRequired, the code the Steward's Office returns to check-in on).
 * - A failed lookup fails closed with 500, never a pass.
 */

import logger from '../../../utils/logger.mjs';
import { satisfiesRole } from '../capabilities.mjs';
import {
  isTrustedDevice,
  loadStaffAccount,
  staffDeviceCookie,
} from '../services/staffCheckinService.mjs';

/** Marks the guard so the admin-route sentinel can recognise it. */
export const staffCheckinGuardMarker = Symbol.for('equoria.staffCheckinGuard');

/**
 * Where an account stands against an admin tool: 'role' (its fresh role no
 * longer satisfies the required one), 'emailUnverified', 'checkinRequired', or
 * 'checkedIn'. Lookup errors propagate, so callers fail closed.
 * @param {import('express').Request} req
 * @param {string} requiredRole
 * @returns {Promise<{ state: 'role'|'emailUnverified'|'checkinRequired'|'checkedIn', account: object|null }>}
 */
async function staffCheckinState(req, requiredRole) {
  const account = await loadStaffAccount(req.user?.id);
  if (!account || !satisfiesRole(account.role, requiredRole)) {
    return { state: 'role', account: null };
  }
  if (account.emailVerified !== true) {
    return { state: 'emailUnverified', account };
  }
  const trusted = await isTrustedDevice(account, req.cookies?.[staffDeviceCookie]);
  return { state: trusted ? 'checkedIn' : 'checkinRequired', account };
}

/**
 * For an admin power exercised inside an ordinary route (GET /horses?userId=):
 * true only when the caller's fresh role satisfies `requiredRole` and this
 * browser holds a valid check-in. Lookup errors propagate (fail closed).
 * @param {import('express').Request} req
 * @param {string} requiredRole
 * @returns {Promise<boolean>}
 */
export async function hasStaffCheckin(req, requiredRole) {
  return (await staffCheckinState(req, requiredRole)).state === 'checkedIn';
}

const refusals = Object.freeze({
  role: Object.freeze({ success: false, message: 'Insufficient permissions', status: 'fail' }),
  emailUnverified: Object.freeze({
    success: false,
    code: 'staffEmailUnverified',
    message: 'Staff tools need a verified email address.',
  }),
  checkinRequired: Object.freeze({
    success: false,
    code: 'staffCheckinRequired',
    message: 'Check in with your emailed code on this browser first.',
  }),
});

/**
 * @param {string} requiredRole the staff role the route's requireRole names
 * @returns {import('express').RequestHandler}
 */
export function requireStaffCheckin(requiredRole) {
  const guard = async (req, res, next) => {
    let outcome;
    try {
      outcome = await staffCheckinState(req, requiredRole);
    } catch (error) {
      logger.error(`[staff] admin check-in lookup failed: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Staff verification unavailable. Please retry.',
      });
    }
    if (outcome.state !== 'checkedIn') {
      return res.status(403).json(refusals[outcome.state]);
    }
    // The fresh role, not the token's, for whatever the route decides next.
    req.user.role = outcome.account.role;
    return next();
  };
  guard[staffCheckinGuardMarker] = requiredRole;
  return guard;
}
