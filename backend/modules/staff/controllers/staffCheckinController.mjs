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
  STAFF_DEVICE_COOKIE,
  StaffCheckinError,
  TRUSTED_DEVICE_TTL_MS,
  isTrustedDevice,
  requestCheckinCode,
  verifyCheckinCode,
} from '../services/staffCheckinService.mjs';

/**
 * staff_device cookie: secure/sameSite/domain from the same policy as the
 * auth cookies (cookieConfig.mjs), scoped to the staff API, 30 days.
 */
export const STAFF_DEVICE_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  secure: ACCESS_TOKEN_COOKIE_OPTIONS.secure,
  sameSite: ACCESS_TOKEN_COOKIE_OPTIONS.sameSite,
  domain: ACCESS_TOKEN_COOKIE_OPTIONS.domain,
  maxAge: TRUSTED_DEVICE_TTL_MS,
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
    res.cookie(STAFF_DEVICE_COOKIE, rawToken, STAFF_DEVICE_COOKIE_OPTIONS);
    return res.status(200).json({ trusted: true });
  } catch (error) {
    return handleError(res, next, error);
  }
}

/** GET /api/v1/staff/me → { role, capabilities, trusted } */
export async function getStaffMe(req, res, next) {
  try {
    const account = req.staffAccount;
    const device = await isTrustedDevice(account, req.cookies?.[STAFF_DEVICE_COOKIE]);
    return res.status(200).json({
      role: account.role,
      capabilities: [...capabilitiesFor(account.role)],
      trusted: account.emailVerified === true && device,
    });
  } catch (error) {
    return handleError(res, next, error);
  }
}
