/**
 * Staff check-in service (Equoria-puj1e.1, Task 3)
 *
 * Email-code second factor for the Steward's Office, and the trusted-device
 * record it produces.
 *
 * - A code is 6 digits from crypto.randomInt, stored only as a bcrypt hash,
 *   valid 10 minutes, single use, at most 5 guesses. Only the newest code for
 *   an account is ever checked, and issuing a new code retires the old one.
 * - A code is bound to the security state it was issued under (STAFF-CR-01):
 *   it is void once the password or the verified email changes after it was
 *   issued, or the account stops being staff with a verified email. Password,
 *   email and role changes also retire outstanding codes in their own
 *   transactions (staffChallengeRetirement.mjs), and a retired code is refused
 *   even if the server clock is later set back (q261, Equoria-8pzlg).
 * - Issuance and both verification steps run under a row lock on the account
 *   (`SELECT … FOR UPDATE`) and re-read it there; the middleware snapshot is
 *   never the final authority. So two parallel requests cannot both take the
 *   last of the 3-per-15-minutes slots, a resend cannot interleave with a
 *   verify, and parallel guesses can never exceed the 5-attempt cap.
 * - A verified browser gets a random 32-byte token; only its sha256 is stored.
 *   A device is valid for its own account only, while not revoked, not
 *   expired, and created after the account's last password change.
 *
 * Codes and tokens are never logged.
 */

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { sendStaffCheckinCodeEmail } from '../../../utils/emailService.mjs';
import { isStaffRole } from '../capabilities.mjs';
import { recordStaffActionTx } from './staffActionLogService.mjs';
import { retireStaffCheckinCodesTx } from './staffChallengeRetirement.mjs';

export const CHECKIN_CODE_TTL_MS = 10 * 60 * 1000;
export const CHECKIN_MAX_ATTEMPTS = 5;
export const CHECKIN_REQUEST_LIMIT = 3;
export const CHECKIN_REQUEST_WINDOW_MS = 15 * 60 * 1000;
export const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const STAFF_DEVICE_COOKIE = 'staff_device';

// bcrypt cost for a 10-minute, 5-guess code: the attempt cap is the real
// brute-force limit, so the hash only has to keep a leaked row from being
// read back instantly.
const CODE_HASH_ROUNDS = 10;

/** Outcome of a refused check-in step; the controller maps `reason` to HTTP. */
export class StaffCheckinError extends Error {
  /** @param {'EMAIL_UNVERIFIED'|'RATE_LIMITED'|'CODE_INVALID'} reason */
  constructor(reason) {
    super(reason);
    this.name = 'StaffCheckinError';
    this.reason = reason;
  }
}

/** sha256 hex of a raw device token — the only form stored. */
export function hashDeviceToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/**
 * Fresh staff-relevant fields for an account, or null when it does not exist.
 * @param {string} userId
 */
export function loadStaffAccount(userId) {
  if (typeof userId !== 'string' || userId.length === 0) {
    return Promise.resolve(null);
  }
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerified: true,
      emailVerifiedAt: true,
      passwordChangedAt: true,
    },
  });
}

/**
 * Whether the raw device token is a valid trusted device for this account.
 * @param {{ id: string, passwordChangedAt: Date|null }} account
 * @param {unknown} rawToken
 * @param {Date} [now]
 * @returns {Promise<boolean>}
 */
export async function isTrustedDevice(account, rawToken, now = new Date()) {
  if (!account || typeof rawToken !== 'string' || rawToken.length === 0) {
    return false;
  }
  const device = await prisma.staffTrustedDevice.findUnique({
    where: { tokenHash: hashDeviceToken(rawToken) },
    select: { userId: true, expiresAt: true, revokedAt: true, createdAt: true },
  });
  if (!device || device.userId !== account.id) {
    return false;
  }
  if (device.revokedAt !== null || device.expiresAt <= now) {
    return false;
  }
  if (account.passwordChangedAt && device.createdAt <= account.passwordChangedAt) {
    return false;
  }
  return true;
}

/**
 * Lock the account row and re-read the security state a code is bound to.
 * Every check-in step that reads or writes codes runs under this lock, and
 * every path that changes the state retires codes after writing the same row
 * (staffChallengeRetirement.mjs), so the two serialize.
 * @returns {Promise<object|null>} fresh account, or null when it is gone
 */
async function lockAccountTx(tx, userId) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  return tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerified: true,
      emailVerifiedAt: true,
      passwordChangedAt: true,
    },
  });
}

/** Whether the locked account may still check in at all. */
const mayCheckIn = account =>
  Boolean(account) && isStaffRole(account.role) && account.emailVerified === true;

/** A code issued at or before the last password or email change is void. */
function issuedUnderCurrentState(account, code) {
  const issued = code.createdAt.getTime();
  return [account.passwordChangedAt, account.emailVerifiedAt].every(
    at => !at || issued > at.getTime(),
  );
}

/**
 * The account's newest code, when it can still be used: unused, unexpired,
 * issued under the current security state and, with `requireAttemptLeft`,
 * below the guess cap. Only the newest code ever counts.
 */
async function newestLiveCodeTx(tx, account, now, { requireAttemptLeft }) {
  const newest = await tx.staffCheckinCode.findFirst({
    where: { userId: account.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  // A retired code is dead whatever the clock says (q261, Equoria-8pzlg).
  if (!newest || newest.usedAt !== null || newest.retiredAt !== null || newest.expiresAt <= now) {
    return null;
  }
  if (requireAttemptLeft && newest.attempts >= CHECKIN_MAX_ATTEMPTS) {
    return null;
  }
  return issuedUnderCurrentState(account, newest) ? newest : null;
}

/**
 * Issue a check-in code and email it to the account's verified address.
 * The account is re-read under its row lock; the middleware snapshot only
 * names which account is asking.
 * @param {{ id: string }} account
 * @returns {Promise<void>}
 */
export async function requestCheckinCode(account) {
  if (!account || !isStaffRole(account.role)) {
    throw new StaffCheckinError('CODE_INVALID');
  }
  if (account.emailVerified !== true) {
    throw new StaffCheckinError('EMAIL_UNVERIFIED');
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const codeHash = await bcrypt.hash(code, CODE_HASH_ROUNDS);

  const sendTo = await prisma.$transaction(async tx => {
    // Serialize issuance and verification per account so the window count is
    // exact and a resend can never interleave with a verify.
    const fresh = await lockAccountTx(tx, account.id);
    if (!fresh || !isStaffRole(fresh.role)) {
      throw new StaffCheckinError('CODE_INVALID');
    }
    if (fresh.emailVerified !== true) {
      throw new StaffCheckinError('EMAIL_UNVERIFIED');
    }
    const now = new Date();
    const recent = await tx.staffCheckinCode.count({
      where: {
        userId: fresh.id,
        createdAt: { gt: new Date(now.getTime() - CHECKIN_REQUEST_WINDOW_MS) },
      },
    });
    if (recent >= CHECKIN_REQUEST_LIMIT) {
      throw new StaffCheckinError('RATE_LIMITED');
    }
    await retireStaffCheckinCodesTx(tx, fresh.id, now);
    // createdAt from the same clock as passwordChangedAt/emailVerifiedAt, which
    // issuedUnderCurrentState compares it with.
    await tx.staffCheckinCode.create({
      data: {
        userId: fresh.id,
        codeHash,
        createdAt: now,
        expiresAt: new Date(now.getTime() + CHECKIN_CODE_TTL_MS),
      },
    });
    return fresh.email;
  });

  await sendStaffCheckinCodeEmail(sendTo, code);
}

/**
 * Check a code against the account's newest code. On success, consume it and
 * create a trusted device, returning the raw device token (shown once, as a
 * cookie). Any refusal throws StaffCheckinError('CODE_INVALID').
 *
 * Two short transactions, each under the account row lock, with the bcrypt
 * compare between them so the lock is never held for the hash:
 *   1. re-read the account, prove the code is its newest live code, reserve
 *      one of the five guesses;
 *   2. after a matching compare, re-read the account again, prove the same
 *      code is still the newest live code, consume it once, and create the
 *      device and its log entry together.
 * @param {{ id: string, role: string }} account
 * @param {unknown} code
 * @returns {Promise<{ rawToken: string, expiresAt: Date }>}
 */
export async function verifyCheckinCode(account, code) {
  if (!account || !isStaffRole(account.role)) {
    throw new StaffCheckinError('CODE_INVALID');
  }
  const normalized = typeof code === 'string' ? code.trim() : '';

  const candidate = await prisma.$transaction(async tx => {
    const fresh = await lockAccountTx(tx, account.id);
    if (!mayCheckIn(fresh)) {
      return null;
    }
    const newest = await newestLiveCodeTx(tx, fresh, new Date(), { requireAttemptLeft: true });
    if (!newest) {
      return null;
    }
    const reserved = await tx.staffCheckinCode.updateMany({
      where: { id: newest.id, attempts: { lt: CHECKIN_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    return reserved.count === 1 ? { id: newest.id, codeHash: newest.codeHash } : null;
  });
  if (!candidate) {
    throw new StaffCheckinError('CODE_INVALID');
  }

  const matches =
    /^\d{6}$/.test(normalized) && (await bcrypt.compare(normalized, candidate.codeHash));
  if (!matches) {
    throw new StaffCheckinError('CODE_INVALID');
  }

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const expiresAt = await prisma.$transaction(async tx => {
    const fresh = await lockAccountTx(tx, account.id);
    if (!mayCheckIn(fresh)) {
      throw new StaffCheckinError('CODE_INVALID');
    }
    const now = new Date();
    // Guess cap not re-checked here: this guess already holds its reservation.
    const newest = await newestLiveCodeTx(tx, fresh, now, { requireAttemptLeft: false });
    if (!newest || newest.id !== candidate.id) {
      throw new StaffCheckinError('CODE_INVALID');
    }
    const consumed = await tx.staffCheckinCode.updateMany({
      where: { id: candidate.id, usedAt: null },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) {
      throw new StaffCheckinError('CODE_INVALID');
    }
    const deviceExpiresAt = new Date(now.getTime() + TRUSTED_DEVICE_TTL_MS);
    const device = await tx.staffTrustedDevice.create({
      data: { userId: fresh.id, tokenHash: hashDeviceToken(rawToken), expiresAt: deviceExpiresAt },
    });
    await recordStaffActionTx(tx, {
      actorId: fresh.id,
      actorRole: fresh.role,
      capability: 'staff.checkin',
      targetType: 'device',
      targetId: String(device.id),
      reason: null,
    });
    return deviceExpiresAt;
  });

  return { rawToken, expiresAt };
}
