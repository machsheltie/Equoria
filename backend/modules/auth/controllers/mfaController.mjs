/**
 * mfaController.mjs (Equoria-vhv3i — extracted from authController.mjs)
 *
 * OWASP A07 TOTP MFA endpoints. Four handlers:
 *
 *   POST /api/v1/auth/mfa/enroll              authenticated
 *   POST /api/v1/auth/mfa/verify-enrollment   authenticated
 *   POST /api/v1/auth/mfa/challenge           public (second factor of login)
 *   POST /api/v1/auth/mfa/disable             authenticated
 *
 * Security history preserved (do NOT regress when editing):
 *   - Equoria-2vwwh: opt-in TOTP MFA shipped 2026-05-18
 *   - Equoria-yi13v: mfaSecret encrypted at rest with AES-256-GCM
 *   - Equoria-kg7i2: per-userId failure lockout on /mfa/challenge so the
 *     10^6 TOTP space cannot be brute-forced. Failure counter MUST be
 *     incremented BEFORE responding so the threshold-crossing failure
 *     locks the next attempt at the isLocked() gate.
 *   - Equoria-uqq8n: sibling lockout for /mfa/disable so a compromised
 *     session cannot brute-force TOTP to strip MFA off the account.
 *   - Equoria-y932s: TOTP replay protection — a code already consumed
 *     within the current validity window is rejected even if otplib
 *     still accepts it as a valid time-step match.
 */

import jwt from 'jsonwebtoken';
import { AppError, ValidationError } from '../../../errors/index.mjs';
import * as mfaService from '../services/mfaService.mjs';
import * as mfaLockoutService from '../services/mfaLockoutService.mjs';
import * as mfaReplayProtectionService from '../services/mfaReplayProtectionService.mjs';
import { encryptField, decryptField } from '../../../utils/fieldEncryption.mjs';
import logger from '../../../utils/logger.mjs';
import prisma from '../../../db/index.mjs';
import { issueAuthenticatedSession } from '../services/authSessionService.mjs';

/**
 * POST /api/v1/auth/mfa/enroll  (authenticated)
 *
 * Generates a fresh TOTP secret + otpauth provisioning URL and STAGES it on
 * the user (mfaSecret set, mfaEnabled stays false). MFA is not active until
 * the user proves possession via /mfa/verify-enrollment.
 */
export const mfaEnroll = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, mfaEnabled: true },
    });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (user.mfaEnabled) {
      throw new AppError('MFA is already enabled for this account', 409);
    }

    const { secret, otpauthUrl } = mfaService.generateSecret(user.email);
    await prisma.user.update({
      where: { id: user.id },
      // Encrypt the TOTP shared secret at rest (Equoria-yi13v, A07).
      data: { mfaSecret: encryptField(secret), mfaEnabled: false },
    });

    logger.info('[mfaController.mfaEnroll] MFA secret staged', { userId: user.id });
    return res.status(200).json({
      success: true,
      message: 'MFA secret generated. Verify a token to enable.',
      data: { secret, otpauthUrl },
    });
  } catch (error) {
    logger.error('[mfaController.mfaEnroll] Error:', error);
    if (AppError.isAppError(error)) {
      return next(error);
    }
    return next(new AppError('Failed to start MFA enrollment.', 500));
  }
};

/**
 * POST /api/v1/auth/mfa/verify-enrollment  (authenticated)
 *
 * Confirms the staged secret by verifying a first TOTP. On success: sets
 * mfaEnabled=true and returns 10 single-use recovery codes ONCE (hashed at
 * rest). Idempotency: if already enabled, rejects.
 */
export const mfaVerifyEnrollment = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }
    const { token } = req.body || {};
    if (!token) {
      throw new AppError('TOTP token is required', 400);
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, mfaSecret: true, mfaEnabled: true },
    });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (user.mfaEnabled) {
      throw new AppError('MFA is already enabled for this account', 409);
    }
    if (!user.mfaSecret) {
      throw new AppError('No MFA enrollment in progress. Call /mfa/enroll first.', 400);
    }
    // Equoria-y932s: replay-protection — reject a code already consumed
    // within the current TOTP validity window, even if otplib still accepts
    // it as a valid time-step match. The replay check fires BEFORE the
    // verify so a captured-and-replayed code cannot succeed even once
    // beyond its first use.
    if (mfaReplayProtectionService.hasBeenUsed(user.id, token)) {
      throw new AppError('Invalid TOTP token', 401);
    }
    if (!mfaService.verifyToken(token, decryptField(user.mfaSecret))) {
      throw new AppError('Invalid TOTP token', 401);
    }
    mfaReplayProtectionService.recordSuccessfulVerification(user.id, token);

    const { plaintext, hashed } = await mfaService.generateRecoveryCodes();
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true, mfaRecoveryCodes: hashed },
    });

    logger.info('[mfaController.mfaVerifyEnrollment] MFA enabled', { userId: user.id });
    return res.status(200).json({
      success: true,
      message: 'MFA enabled. Store these recovery codes — they are shown only once.',
      data: { recoveryCodes: plaintext },
    });
  } catch (error) {
    logger.error('[mfaController.mfaVerifyEnrollment] Error:', error);
    if (AppError.isAppError(error)) {
      return next(error);
    }
    return next(new AppError('Failed to verify MFA enrollment.', 500));
  }
};

/**
 * POST /api/v1/auth/mfa/challenge  (public — second factor of login)
 *
 * Consumes the short-lived signed mfaChallengeToken from /auth/login and
 * verifies EITHER a TOTP `token` OR a single-use `recoveryCode`. On success,
 * issues the real session triple (identical to non-MFA login).
 */
export const mfaChallenge = async (req, res, next) => {
  try {
    const { mfaChallengeToken, token, recoveryCode } = req.body || {};
    if (!mfaChallengeToken) {
      throw new AppError('mfaChallengeToken is required', 400);
    }
    if (!token && !recoveryCode) {
      throw new AppError('A TOTP token or a recovery code is required', 400);
    }

    let payload;
    try {
      payload = jwt.verify(mfaChallengeToken, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new AppError('MFA challenge expired or invalid. Please log in again.', 401);
    }
    if (!payload || payload.type !== 'mfa_challenge' || !payload.userId) {
      throw new AppError('MFA challenge expired or invalid. Please log in again.', 401);
    }

    // Equoria-kg7i2: per-userId lockout — defeats brute-force of the 10^6
    // TOTP space that the shared 200/15min authRateLimiter does not. The
    // check runs BEFORE any DB lookup or cryptographic work so a locked
    // attacker cannot use the endpoint as an oracle / load amplifier.
    const lockState = mfaLockoutService.isLocked(payload.userId);
    if (lockState.locked) {
      logger.warn('[mfaController.mfaChallenge] Locked-out user attempted MFA', {
        userId: payload.userId,
        retryAfterSec: lockState.retryAfterSec,
      });
      return res.status(429).json({
        success: false,
        message:
          'Too many failed MFA attempts. The challenge has been revoked — please log in again.',
        retryAfter: lockState.retryAfterSec,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        email: true,
        money: true,
        level: true,
        xp: true,
        role: true,
        settings: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaRecoveryCodes: true,
      },
    });
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new AppError('MFA is not enabled for this account', 401);
    }

    let verified = false;
    if (token) {
      // Equoria-y932s: replay-protection — reject a TOTP code already
      // consumed within the current validity window, even if otplib still
      // accepts it as a valid time-step match. Combined with the kg7i2
      // failure counter, a brute-replay is bounded to a handful of attempts
      // before the user is locked out.
      if (mfaReplayProtectionService.hasBeenUsed(user.id, token)) {
        verified = false;
      } else {
        verified = mfaService.verifyToken(token, decryptField(user.mfaSecret));
        if (verified) {
          mfaReplayProtectionService.recordSuccessfulVerification(user.id, token);
        }
      }
    }
    if (!verified && recoveryCode) {
      const stored = Array.isArray(user.mfaRecoveryCodes) ? user.mfaRecoveryCodes : [];
      const result = await mfaService.verifyRecoveryCode(recoveryCode, stored);
      if (result.valid) {
        verified = true;
        // Persist single-use consumption immediately.
        await prisma.user.update({
          where: { id: user.id },
          data: { mfaRecoveryCodes: result.updatedCodes },
        });
      }
    }

    if (!verified) {
      // Equoria-kg7i2: increment per-userId failure counter BEFORE responding.
      // On the threshold-crossing failure the user becomes locked; the very
      // next request hits the isLocked() branch above and returns 429.
      mfaLockoutService.recordFailure(payload.userId);
      throw new AppError('Invalid MFA credentials', 401);
    }

    // Equoria-kg7i2: a successful challenge resets the failure counter so a
    // single typo before success does not penalise a legitimate user.
    mfaLockoutService.recordSuccess(payload.userId);

    const sessionData = await issueAuthenticatedSession(req, res, user);
    logger.info('[mfaController.mfaChallenge] MFA challenge passed', { userId: user.id });
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: sessionData,
    });
  } catch (error) {
    logger.error('[mfaController.mfaChallenge] Error:', error);
    if (AppError.isAppError(error) || error instanceof ValidationError) {
      return next(error);
    }
    return next(new AppError('MFA challenge failed due to an unexpected error.', 500));
  }
};

/**
 * POST /api/v1/auth/mfa/disable  (authenticated)
 *
 * Disables MFA after re-verifying a current TOTP. Clears mfaSecret,
 * mfaEnabled, and mfaRecoveryCodes so re-enrollment starts clean.
 */
export const mfaDisable = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }
    const { token } = req.body || {};
    if (!token) {
      throw new AppError('Current TOTP token is required to disable MFA', 400);
    }

    // Equoria-uqq8n (defense-in-depth, sibling of Equoria-kg7i2): without
    // this lockout, a compromised session could brute-force the 10^6 TOTP
    // space on /mfa/disable to strip MFA off the account. The shared
    // 200/15min authRateLimiter is far wider than the TOTP keyspace and is
    // not by itself sufficient. The lockout key is req.user.id (per-account,
    // mirroring kg7i2). The check runs BEFORE any DB lookup or cryptographic
    // work so a locked attacker cannot use the endpoint as an oracle.
    const lockState = mfaLockoutService.isLocked(req.user.id);
    if (lockState.locked) {
      logger.warn('[mfaController.mfaDisable] Locked-out user attempted MFA disable', {
        userId: req.user.id,
        retryAfterSec: lockState.retryAfterSec,
      });
      return res.status(429).json({
        success: false,
        message: 'Too many failed MFA attempts. Please try again later.',
        retryAfter: lockState.retryAfterSec,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, mfaEnabled: true, mfaSecret: true },
    });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new AppError('MFA is not enabled for this account', 400);
    }
    // Equoria-y932s: replay-protection — reject a TOTP code already
    // consumed within the current validity window. The replay check is
    // BEFORE verifyToken so a replayed code increments the failure counter
    // the same way an invalid code does, ensuring the kg7i2/uqq8n lockout
    // catches brute-replay attempts.
    const isReplay = mfaReplayProtectionService.hasBeenUsed(req.user.id, token);
    const otpValid = !isReplay && mfaService.verifyToken(token, decryptField(user.mfaSecret));
    if (!otpValid) {
      // Equoria-uqq8n: record the failure BEFORE responding so the threshold
      // crossing locks the next attempt at the isLocked() gate above.
      mfaLockoutService.recordFailure(req.user.id);
      throw new AppError('Invalid TOTP token', 401);
    }
    mfaReplayProtectionService.recordSuccessfulVerification(req.user.id, token);

    // Equoria-uqq8n: success resets the counter (mirrors kg7i2).
    mfaLockoutService.recordSuccess(req.user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: null },
    });

    logger.info('[mfaController.mfaDisable] MFA disabled', { userId: user.id });
    return res.status(200).json({
      success: true,
      message: 'MFA disabled',
      data: { mfaEnabled: false },
    });
  } catch (error) {
    logger.error('[mfaController.mfaDisable] Error:', error);
    if (AppError.isAppError(error)) {
      return next(error);
    }
    return next(new AppError('Failed to disable MFA.', 500));
  }
};
