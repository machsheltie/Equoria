/**
 * Staff check-in controller (Equoria-puj1e.1, Task 3)
 *
 * Runs behind requireStaffRole (check-in, /me) or requireStaffCapability, so
 * `req.staffAccount` is the freshly loaded staff account.
 */

import logger from '../../../utils/logger.mjs';
import { accessTokenCookieOptions } from '../../../utils/cookieConfig.mjs';
import { capabilitiesFor } from '../capabilities.mjs';
import {
  StaffCheckinError,
  isTrustedDevice,
  legacyStaffDeviceCookie,
  requestCheckinCode,
  staffDeviceCookie,
  staffDeviceTokenFrom,
  trustedDeviceTtlMs,
  verifyCheckinCode,
} from '../services/staffCheckinService.mjs';

/** The attributes both device cookies share, from the auth cookie policy. */
const deviceCookieAttributes = Object.freeze({
  httpOnly: true,
  secure: accessTokenCookieOptions.secure,
  sameSite: accessTokenCookieOptions.sameSite,
  domain: accessTokenCookieOptions.domain,
});

/**
 * staffDevice cookie: secure/sameSite/domain from the same policy as the
 * auth cookies (cookieConfig.mjs), 30 days. Scoped to the whole API since
 * Equoria-n256i (owner ruling q289): the admin routes (/api/v1/admin and the
 * per-route admin gates) ask for the same check-in, so the browser must send
 * it to them too. It was scoped to /api/v1/staff before.
 */
export const staffDeviceCookieOptions = Object.freeze({
  ...deviceCookieAttributes,
  maxAge: trustedDeviceTtlMs,
  path: '/api/v1',
});

/** The two paths the old-name cookie lived on (/api/v1/staff before Equoria-n256i), for clearing it. */
const legacyDeviceCookiePaths = Object.freeze(['/api/v1', '/api/v1/staff']);

const REFUSALS = {
  emailUnverified: {
    status: 409,
    code: 'staffEmailUnverified',
    message: 'Verify your email address before checking in to the Steward’s Office.',
  },
  rateLimited: {
    status: 429,
    code: 'staffCheckinRateLimited',
    message: 'Too many codes requested. Wait a few minutes and try again.',
  },
  codeInvalid: {
    status: 400,
    code: 'staffCheckinCodeInvalid',
    message: 'That code is not valid. Request a new one if it has expired.',
  },
};

function handleError(res, next, error) {
  if (error instanceof StaffCheckinError && REFUSALS[error.reason]) {
    const { status, code, message } = REFUSALS[error.reason];
    return res.status(status).json({ success: false, code, message });
  }
  logger.error(`[staff] check-in failed: ${error.message}`);
  return next(error);
}

/** POST /api/v1/staff/checkin/request → 202 { sent: true } */
export async function requestCheckin(req, res, next) {
  try {
    await requestCheckinCode(req.staffAccount);
    return res.status(202).json({ sent: true });
  } catch (error) {
    return handleError(res, next, error);
  }
}

/** POST /api/v1/staff/checkin/verify { code } → 200, sets staffDevice */
export async function verifyCheckin(req, res, next) {
  try {
    const { rawToken } = await verifyCheckinCode(req.staffAccount, req.body?.code);
    res.cookie(staffDeviceCookie, rawToken, staffDeviceCookieOptions);
    // This browser now holds the new name, so its old-name cookie goes, from
    // both paths it ever lived on (/api/v1/staff before Equoria-n256i).
    for (const path of legacyDeviceCookiePaths) {
      res.clearCookie(legacyStaffDeviceCookie, { ...deviceCookieAttributes, path });
    }
    return res.status(200).json({ trusted: true });
  } catch (error) {
    return handleError(res, next, error);
  }
}

/** GET /api/v1/staff/me → { role, capabilities, trusted } */
export async function getStaffMe(req, res, next) {
  try {
    const account = req.staffAccount;
    const device = await isTrustedDevice(account, staffDeviceTokenFrom(req.cookies));
    return res.status(200).json({
      role: account.role,
      capabilities: [...capabilitiesFor(account.role)],
      trusted: account.emailVerified === true && device,
    });
  } catch (error) {
    return handleError(res, next, error);
  }
}
