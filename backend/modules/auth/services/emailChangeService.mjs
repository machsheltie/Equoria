/**
 * Staged recovery-address change (Equoria-6p398.5, Finding 5).
 *
 * The audit found `PUT /api/v1/auth/profile` replacing `User.email` on nothing
 * but a session + CSRF token, keeping `emailVerified`/`emailVerifiedAt`. That
 * lets a stolen session redirect account recovery and then take the account
 * over through `POST /auth/forgot-password`. Merely resetting the verification
 * flags (what the sibling `PUT /users/:id` did) does NOT close that: the
 * recovery address has already moved.
 *
 * This service owns the only path that may move it:
 *
 *   1. REQUEST  — fresh authentication proportionate to the account
 *                 (current password always; a TOTP step-up as well when MFA is
 *                 enabled, reusing the same lockout + replay services
 *                 `/auth/mfa/disable` uses). The replacement address is STAGED;
 *                 the confirmed identity stays live and keeps receiving
 *                 password recovery.
 *   2. CONFIRM  — a one-time, purpose-tagged, address-bound token delivered to
 *                 the replacement address. Consumption, the identity write, and
 *                 revocation of every obsolete verification / password-reset
 *                 proof commit in ONE transaction.
 *
 * Concurrency mechanism (GLOBAL_CONSTRAINTS ruling): option 2, a guarded
 * conditional UPDATE. The token is claimed with
 * `updateMany({ tokenHash, usedAt: null, expiresAt: > now })` and `count === 1`
 * is required — a losing racer gets 0 and is rejected, so no read-modify-write
 * window exists and no `SELECT ... FOR UPDATE` is needed. Uniqueness is
 * re-checked inside the same transaction AND backstopped by the `User.email`
 * unique constraint (P2002 → 409), so a duplicate-address race cannot commit
 * two identities. Row order inside the transaction: the token claim first (it
 * is the precondition — a losing racer must never reach the User write), then
 * the User row, then the remaining token rows. This matches the order
 * `verifyEmailToken` already uses, so the two cannot deadlock against
 * each other.
 *
 * Tokens stay hashed at rest per ADR-006 — the raw value exists only in the
 * return value of `requestEmailChange` and in the outbound email. Delivery
 * happens in the controller, AFTER this service's transaction has committed,
 * so no database lock is ever held across an SMTP round trip.
 */

import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { AppError, ValidationError } from '../../../errors/index.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { normalizeEmailAddress } from '../../../utils/emailIdentityPolicy.mjs';
import {
  generateVerificationToken,
  hashVerificationToken,
  readTokenPurpose,
  VERIFICATION_TOKEN_PURPOSE,
} from '../../../utils/emailVerificationService.mjs';
import { decryptField } from '../../../utils/fieldEncryption.mjs';
import * as mfaService from './mfaService.mjs';
import * as mfaLockoutService from './mfaLockoutService.mjs';
import * as mfaReplayProtectionService from './mfaReplayProtectionService.mjs';

/** Pending changes expire on the same 24h clock as signup verification. */
export const PENDING_EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Deliberately generic rejection for every unusable confirmation link (unknown,
 * expired, already consumed, superseded, wrong purpose, wrong account). Telling
 * a holder WHICH of those applies is an oracle over other people's pending
 * changes.
 */
const INVALID_LINK_MESSAGE =
  'This email change link is invalid, expired, or has already been used.';

const invalidLink = () => new AppError(INVALID_LINK_MESSAGE, 400);

/**
 * Step 1 — verify fresh authentication and stage the replacement address.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {unknown} params.requestedEmail - Route-validated + normalized address.
 * @param {unknown} params.password - Current account password.
 * @param {unknown} [params.totpToken] - Required when the account has MFA on.
 * @param {{ipAddress?: string|null, userAgent?: string|null}} [params.metadata]
 * @returns {Promise<{rawToken: string, pendingEmail: string, expiresAt: Date, user: object}>}
 */
export async function requestEmailChange({
  userId,
  requestedEmail,
  password,
  totpToken,
  metadata = {},
}) {
  const pendingEmail = normalizeEmailAddress(requestedEmail);
  if (!pendingEmail) {
    throw new ValidationError('A valid email address is required');
  }
  if (typeof password !== 'string' || password.length === 0) {
    throw new ValidationError('Your current password is required to change your email address');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      password: true,
      mfaEnabled: true,
      mfaSecret: true,
    },
  });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // ── Fresh authentication ────────────────────────────────────────────────
  // The MFA lockout gate runs BEFORE any cryptographic work so a locked-out
  // attacker cannot use this endpoint as an oracle (same posture as
  // /auth/mfa/disable, Equoria-uqq8n).
  if (user.mfaEnabled) {
    const lockState = await mfaLockoutService.isLocked(user.id);
    if (lockState.locked) {
      const error = new AppError('Too many failed MFA attempts. Please try again later.', 429);
      error.retryAfterSec = lockState.retryAfterSec;
      throw error;
    }
  }

  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) {
    logger.warn('[emailChangeService] Rejected email change — wrong password', { userId: user.id });
    throw new AppError('Current password is incorrect', 401);
  }

  if (user.mfaEnabled) {
    if (typeof totpToken !== 'string' || totpToken.trim().length === 0) {
      throw new AppError('A current TOTP code is required to change your email address', 401);
    }
    // Replay check first so a replayed code feeds the lockout counter exactly
    // like an invalid one (Equoria-y932s / uqq8n).
    const isReplay = mfaReplayProtectionService.hasBeenUsed(user.id, totpToken);
    const otpValid =
      !isReplay && user.mfaSecret
        ? mfaService.verifyToken(totpToken, decryptField(user.mfaSecret))
        : false;
    if (!otpValid) {
      await mfaLockoutService.recordFailure(user.id);
      throw new AppError('Invalid TOTP token', 401);
    }
    mfaReplayProtectionService.recordSuccessfulVerification(user.id, totpToken);
    await mfaLockoutService.recordSuccess(user.id);
  }

  // ── Destination validation ──────────────────────────────────────────────
  const currentEmail = normalizeEmailAddress(user.email);
  if (pendingEmail === currentEmail) {
    throw new AppError('That is already the email address on this account', 400);
  }

  const taken = await prisma.user.findFirst({
    where: { email: pendingEmail, NOT: { id: user.id } },
    select: { id: true },
  });
  if (taken) {
    throw new AppError('That email address is already in use', 409);
  }

  // ── Stage it ────────────────────────────────────────────────────────────
  const rawToken = generateVerificationToken(VERIFICATION_TOKEN_PURPOSE.EMAIL_CHANGE);
  const expiresAt = new Date(Date.now() + PENDING_EMAIL_CHANGE_TTL_MS);

  await withRetryableTxMapping(
    prisma.$transaction(async tx => {
      // Supersede every outstanding proof aimed at an address that is NOT the
      // confirmed one — i.e. any earlier pending change. At most one pending
      // replacement can exist at a time, so a link mailed to a previously
      // requested address dies the moment a newer request is made.
      await tx.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null, NOT: { email: user.email } },
        data: { usedAt: new Date() },
      });
      await tx.emailVerificationToken.create({
        data: {
          tokenHash: hashVerificationToken(rawToken),
          userId: user.id,
          email: pendingEmail,
          expiresAt,
          ipAddress: metadata.ipAddress ?? null,
          userAgent: metadata.userAgent ?? null,
        },
      });
    }),
    { message: 'The email change service is busy right now, please retry in a moment.' },
  );

  logger.info('[emailChangeService] Staged pending recovery-address change', {
    userId: user.id,
    expiresAt,
  });

  return {
    rawToken,
    pendingEmail,
    expiresAt,
    user: { id: user.id, username: user.username, firstName: user.firstName },
  };
}

/**
 * Step 2 — consume the confirmation token and commit the identity transition.
 *
 * @param {object} params
 * @param {unknown} params.rawToken
 * @param {{ipAddress?: string|null, userAgent?: string|null}} [params.metadata]
 * @returns {Promise<{id: string, email: string, emailVerified: boolean, emailVerifiedAt: Date}>}
 */
export async function confirmEmailChange({ rawToken, metadata = {} }) {
  if (typeof rawToken !== 'string' || rawToken.trim().length === 0) {
    throw new ValidationError('A confirmation token is required');
  }
  // PURPOSE binding: a signup-verification token (or any untagged legacy token)
  // can never confirm a recovery-address change.
  if (readTokenPurpose(rawToken) !== VERIFICATION_TOKEN_PURPOSE.EMAIL_CHANGE) {
    throw invalidLink();
  }

  const tokenHash = hashVerificationToken(rawToken);
  const tokenRecord = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, email: true, expiresAt: true, usedAt: true },
  });
  if (!tokenRecord || tokenRecord.usedAt !== null || new Date() > tokenRecord.expiresAt) {
    throw invalidLink();
  }

  // The exact normalized destination this token was minted for. Never taken
  // from the request.
  const destination = normalizeEmailAddress(tokenRecord.email);
  if (!destination) {
    throw invalidLink();
  }

  const now = new Date();
  const updated = await withRetryableTxMapping(
    prisma.$transaction(async tx => {
      // (a) Guarded one-time claim. `count === 1` is the whole race guard:
      // a concurrent confirmation of the same link gets 0 and is rejected
      // before it can touch the User row. Rolling back (any throw below)
      // un-claims it, so a losing duplicate-address conflict stays retryable.
      const claimed = await tx.emailVerificationToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) {
        throw invalidLink();
      }

      // (b) Re-check account state at commit time — the row may have been
      // deleted, or its identity may have moved, since the link was mailed.
      const owner = await tx.user.findUnique({
        where: { id: tokenRecord.userId },
        select: { id: true, email: true },
      });
      if (!owner) {
        throw invalidLink();
      }
      if (normalizeEmailAddress(owner.email) === destination) {
        throw invalidLink();
      }

      // (c) Re-check uniqueness at commit time. The DB unique constraint is
      // the authority (P2002 below); this makes the common case a clean 409.
      const conflict = await tx.user.findFirst({
        where: { email: destination, NOT: { id: owner.id } },
        select: { id: true },
      });
      if (conflict) {
        throw new AppError('That email address is already in use', 409);
      }

      // (d) The identity transition itself.
      let committed;
      try {
        committed = await tx.user.update({
          where: { id: owner.id },
          data: { email: destination, emailVerified: true, emailVerifiedAt: now },
          select: { id: true, email: true, emailVerified: true, emailVerifiedAt: true },
        });
      } catch (error) {
        if (error?.code === 'P2002') {
          throw new AppError('That email address is already in use', 409);
        }
        throw error;
      }

      // (e) Revoke every other outstanding verification proof. Anything still
      // pending was minted against the OLD identity (a signup token for the
      // previous address, a superseded pending change) and must not survive
      // the transition.
      await tx.emailVerificationToken.updateMany({
        where: { userId: owner.id, usedAt: null },
        data: { usedAt: now },
      });

      // (f) Revoke outstanding password-reset proofs. They were delivered to
      // the address that is no longer the recovery identity.
      await tx.$executeRaw`
        UPDATE password_reset_tokens
        SET "usedAt" = NOW()
        WHERE "userId" = ${owner.id} AND "usedAt" IS NULL`;

      return committed;
    }),
    { message: 'The email change service is busy right now, please retry in a moment.' },
  );

  logger.info('[emailChangeService] Recovery address changed', {
    userId: updated.id,
    tokenId: tokenRecord.id,
    ipAddress: metadata.ipAddress ?? null,
  });

  return updated;
}
