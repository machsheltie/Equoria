/**
 * Staff check-in service (Equoria-puj1e.1, Task 3)
 *
 * Email-code second factor for the Steward's Office, and the trusted-device
 * record it produces.
 *
 * - A code is 6 digits from crypto.randomInt, stored only as a bcrypt hash,
 *   valid 10 minutes, single use, at most 5 guesses. Only the newest code for
 *   an account is ever checked, so issuing a new code retires the old one.
 * - At most 3 codes per account per 15 minutes. The count runs under a row
 *   lock on the account so two parallel requests cannot both take the last slot.
 * - A guess first reserves one of the 5 attempts with a conditional update
 *   (`attempts < 5`), so parallel wrong guesses can never exceed the cap.
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
 * Issue a check-in code and email it to the account's verified address.
 * @param {{ id: string, email: string, role: string, emailVerified: boolean }} account
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

  await prisma.$transaction(async tx => {
    // Serialize code issuance per account so the window count is exact.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${account.id} FOR UPDATE`;
    const now = new Date();
    const recent = await tx.staffCheckinCode.count({
      where: {
        userId: account.id,
        createdAt: { gt: new Date(now.getTime() - CHECKIN_REQUEST_WINDOW_MS) },
      },
    });
    if (recent >= CHECKIN_REQUEST_LIMIT) {
      throw new StaffCheckinError('RATE_LIMITED');
    }
    await tx.staffCheckinCode.create({
      data: {
        userId: account.id,
        codeHash,
        expiresAt: new Date(now.getTime() + CHECKIN_CODE_TTL_MS),
      },
    });
  });

  await sendStaffCheckinCodeEmail(account.email, code);
}

/**
 * Check a code against the account's newest code. On success, consume it and
 * create a trusted device, returning the raw device token (shown once, as a
 * cookie). Any refusal throws StaffCheckinError('CODE_INVALID').
 * @param {{ id: string, role: string }} account
 * @param {unknown} code
 * @returns {Promise<{ rawToken: string, expiresAt: Date }>}
 */
export async function verifyCheckinCode(account, code) {
  if (!account || !isStaffRole(account.role)) {
    throw new StaffCheckinError('CODE_INVALID');
  }
  const normalized = typeof code === 'string' ? code.trim() : '';

  const latest = await prisma.staffCheckinCode.findFirst({
    where: { userId: account.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, codeHash: true },
  });
  if (!latest) {
    throw new StaffCheckinError('CODE_INVALID');
  }

  // Reserve one attempt atomically. Fails when the code is used, expired or
  // already has 5 guesses against it.
  const reserved = await prisma.$transaction(tx =>
    tx.staffCheckinCode.updateMany({
      where: {
        id: latest.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: CHECKIN_MAX_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
    }),
  );
  if (reserved.count !== 1) {
    throw new StaffCheckinError('CODE_INVALID');
  }

  const matches = /^\d{6}$/.test(normalized) && (await bcrypt.compare(normalized, latest.codeHash));
  if (!matches) {
    throw new StaffCheckinError('CODE_INVALID');
  }

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRUSTED_DEVICE_TTL_MS);

  await prisma.$transaction(async tx => {
    const consumed = await tx.staffCheckinCode.updateMany({
      where: { id: latest.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) {
      throw new StaffCheckinError('CODE_INVALID');
    }
    await tx.staffTrustedDevice.create({
      data: { userId: account.id, tokenHash: hashDeviceToken(rawToken), expiresAt },
    });
  });

  return { rawToken, expiresAt };
}
