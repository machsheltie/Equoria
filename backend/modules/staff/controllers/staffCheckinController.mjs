/**
 * Staff check-in controller (Equoria-puj1e.1, Task 3)
 *
 * Runs behind requireStaffRole (check-in, /me) or requireStaffCapability, so
 * `req.staffAccount` is the freshly loaded staff account.
 */

import logger from '../../../utils/logger.mjs';
import { ACCESS_TOKEN_COOKIE_OPTIONS } from '../../../utils/cookieConfig.mjs';
import { capabilitiesFor } from '../capabilities.mjs';
import {
  StaffCheckinError,
  isTrustedDevice,
  requestCheckinCode,
  staffDeviceCookie,
  trustedDeviceTtlMs,
  verifyCheckinCode,
} from '../services/staffCheckinService.mjs';

/** The attributes both device cookies share, from the auth cookie policy. */
const deviceCookieAttributes = Object.freeze({
  httpOnly: true,
  secure: ACCESS_TOKEN_COOKIE_OPTIONS.secure,
  sameSite: ACCESS_TOKEN_COOKIE_OPTIONS.sameSite,
  domain: ACCESS_TOKEN_COOKIE_OPTIONS.domain,
});

/**
 * staff_device cookie: secure/sameSite/domain from the same policy as the
 * auth cookies (cookieConfig.mjs), 30 days. Scoped to the whole API since
 * Equoria-n256i (owner ruling q289): the admin routes (/api/v1/admin and the
 * per-route admin gates) ask for the same check-in, so the browser must send
 * it to them too. It was scoped to /api/v1/staff before.
 */
export const STAFF_DEVICE_COOKIE_OPTIONS = Object.freeze({
  ...deviceCookieAttributes,
  maxAge: trustedDeviceTtlMs,
  path: '/api/v1',
});

/** Where the cookie lived before Equoria-n256i; cleared on check-in so it cannot shadow the new one. */
const legacyDeviceCookieOptions = Object.freeze({
  ...deviceCookieAttributes,
  path: '/api/v1/staff',
});

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

/** POST /api/v1/staff/checkin/verify { code } → 200, sets staff_device */
export async function verifyCheckin(req, res, next) {
  try {
    const { rawToken } = await verifyCheckinCode(req.staffAccount, req.body?.code);
    res.cookie(staffDeviceCookie, rawToken, STAFF_DEVICE_COOKIE_OPTIONS);
    // A browser checked in before the path widened still holds the old cookie;
    // sent first on staff paths (longer path), a stale one would shadow this one.
    res.clearCookie(staffDeviceCookie, legacyDeviceCookieOptions);
    return res.status(200).json({ trusted: true });
  } catch (error) {
    return handleError(res, next, error);
  }
}

/** GET /api/v1/staff/me → { role, capabilities, trusted } */
export async function getStaffMe(req, res, next) {
  try {
    const account = req.staffAccount;
    const device = await isTrustedDevice(account, req.cookies?.[staffDeviceCookie]);
    return res.status(200).json({
      role: account.role,
      capabilities: [...capabilitiesFor(account.role)],
      trusted: account.emailVerified === true && device,
    });
  } catch (error) {
    return handleError(res, next, error);
  }
}
