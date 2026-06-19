/**
 * passwordController.mjs (Equoria-vhv3i — extracted from authController.mjs)
 *
 * Three password-lifecycle endpoints:
 *
 *   POST /api/v1/auth/change-password   authenticated (CWE-613 session rotation)
 *   POST /api/v1/auth/forgot-password   public (Equoria-dv1lv timing-safe + Equoria-n62tl IP source)
 *   POST /api/v1/auth/reset-password    public (token-hash lookup, atomic commit)
 *
 * Security history preserved (do NOT regress when editing):
 *   - CWE-613: changePassword invalidates ALL refresh tokens, stamps
 *     passwordChangedAt so the JWT-verify middleware rejects access
 *     tokens issued before now, and evicts the per-user
 *     passwordChangedAt cache (Equoria-2bbf) so the rejection takes
 *     effect on the next request (not after the 30s TTL).
 *   - Equoria-ie4wc: ASVS L1 password floor is enforced at the route
 *     validator layer; this controller enforces an 8-char minimum as a
 *     defense-in-depth check (the validator catches L1; this catches
 *     direct controller invocations and historical 8-char policy).
 *   - Equoria-dv1lv / Equoria-54sk7: forgotPassword has TWO timing-side-
 *     channel mitigations. (a) BOTH branches run a fixed-cost
 *     bcrypt.compare against FAKE_BCRYPT_HASH (Equoria-54sk7) so the
 *     dominant, deterministic CPU cost is identical whether or not the
 *     email is registered — the same constant-time anchor the login
 *     handler uses (authController FAKE_BCRYPT_HASH, Equoria-gm4fg). This
 *     replaced the prior SQL-sleep "delay padding", which was a literal
 *     no-op that did NOT mirror the user-branch UPDATE+INSERT cost. (b) the
 *     email send is fire-and-forget AFTER the response so the SMTP RTT does
 *     not encode registration-state.
 *   - Equoria-54sk7: the reset-token lookup compares a SHA-256 hash of the
 *     submitted token against the stored hash inside Postgres
 *     (WHERE "tokenHash" = ${hash}), NOT via a hand-rolled JS string/byte
 *     comparison. Hashing already flattens the raw-token timing surface, so
 *     there is no in-process secret comparison that needs
 *     crypto.timingSafeEqual here. Do NOT reintroduce a `===` comparison of
 *     a raw token/secret — if one is ever added, it MUST use
 *     crypto.timingSafeEqual on equal-length Buffers.
 *   - Equoria-n62tl: req.ip already honors Express's trust proxy. Do
 *     NOT add an `x-forwarded-for` header fallback — that re-enables
 *     attacker-controlled audit-IP injection. Fall back to null.
 *   - Migration 20260414001000_add_password_reset_tokens creates the
 *     table + indexes. Runtime DDL was removed (Equoria-v0yc); this
 *     controller assumes the migration has run.
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AppError, ValidationError } from '../../../errors/index.mjs';
import logger from '../../../utils/logger.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import emailService from '../../../utils/emailService.mjs';
import { CLEAR_COOKIE_OPTIONS } from '../../../utils/cookieConfig.mjs';
import { CSRF_COOKIE_NAME, CLEAR_CSRF_COOKIE_OPTIONS } from '../../../middleware/csrf.mjs';
import { evictPasswordChangedAtCache } from '../../../middleware/auth.mjs';

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

// Equoria-54sk7: constant-time CPU anchor for the forgotPassword timing
// mitigation. The no-user branch must perform work equivalent to the user
// branch so response latency does not reveal whether an email is registered.
// A fixed-cost bcrypt.compare against this placeholder hash (cost 12, ~tens of
// ms) is the dominant deterministic cost on BOTH branches — it swamps the
// small difference between the user-branch UPDATE+INSERT and the no-user
// branch, which the prior SQL-sleep no-op failed to mirror. This mirrors the
// login handler's FAKE_BCRYPT_HASH approach (authController.mjs, Equoria-gm4fg).
//
// The placeholder hashes a random ~32-byte secret generated at module import;
// the passphrase is never persisted, so a successful compare here is
// structurally impossible. Cost is pinned to 12 (NOT read from
// BCRYPT_SALT_ROUNDS) so the timing envelope cannot drift with per-deploy
// config — identical rationale to the login handler.
const FAKE_BCRYPT_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);
// Fixed input fed to the constant-time compare. Static so the compare cost is
// data-independent and identical on every request, on both branches.
const TIMING_ANCHOR_INPUT = 'forgot-password-timing-anchor';

/**
 * Run the fixed-cost bcrypt compare that anchors the forgotPassword timing
 * envelope. Always returns false (FAKE_BCRYPT_HASH is unmatchable); the return
 * value is intentionally ignored — only the wall-clock cost matters. Called on
 * BOTH the registered-email and unknown-email branches so the dominant CPU
 * cost is identical regardless of registration state (Equoria-54sk7).
 */
async function runTimingAnchorCompare() {
  return bcrypt.compare(TIMING_ANCHOR_INPUT, FAKE_BCRYPT_HASH);
}

/**
 * Hash a raw password reset token for storage (so a DB leak does NOT
 * expose actually-usable tokens). SHA-256 is sufficient here — the token
 * is high-entropy (32 random bytes from crypto.randomBytes), so the
 * preimage-attack surface is bounded by entropy, not by hash strength.
 */
function hashPasswordResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Change Password
 * Validates old password, updates to new password, and invalidates all sessions
 * CWE-613: Forces logout from all devices for security
 */
export const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // Validate input
    if (!oldPassword || !newPassword) {
      throw new ValidationError('Old password and new password are required');
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters long');
    }

    // User must be authenticated
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }

    // Get current user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isOldPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password in database. Stamp passwordChangedAt so the JWT-verify
    // middleware (CWE-613) can reject any access tokens issued before now —
    // closes the residual ≤access-token-TTL window where a stolen token would
    // otherwise outlive the password rotation.
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword, passwordChangedAt: new Date() },
    });

    // Equoria-2bbf: evict the per-user passwordChangedAt cache so the next
    // authenticated request reads the fresh DB value immediately rather than
    // waiting up to ~30s for TTL expiry.
    evictPasswordChangedAtCache(req.user.id);

    // ✅ CWE-613 MITIGATION: Invalidate ALL refresh tokens across all devices
    // (access tokens are invalidated separately via the passwordChangedAt
    // check in authenticateToken). Forces re-login everywhere after rotation.
    await prisma.refreshToken.deleteMany({
      where: { userId: req.user.id },
    });

    logger.info('[passwordController.changePassword] Password changed successfully', {
      userId: req.user.id,
      email: user.email,
    });

    // Clear cookies for current session
    res.clearCookie('accessToken', CLEAR_COOKIE_OPTIONS.accessToken);
    res.clearCookie('refreshToken', CLEAR_COOKIE_OPTIONS.refreshToken);
    // Equoria-uxh1l: also clear the CSRF cookie on session invalidation.
    res.clearCookie(CSRF_COOKIE_NAME, CLEAR_CSRF_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please login again.',
      data: {
        sessionInvalidated: true,
      },
    });
  } catch (error) {
    logger.error('[passwordController.changePassword] Error changing password:', error);
    if (AppError.isAppError(error) || error instanceof ValidationError) {
      return next(error);
    }
    next(new AppError('Password change failed due to an unexpected error.', 500));
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new ValidationError('Email is required');
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, username: true, firstName: true },
    });

    const responseMessage =
      'If an account exists for that email, password reset instructions have been sent.';

    // Equoria-54sk7: constant-time anchor — run the SAME fixed-cost
    // bcrypt.compare on BOTH branches (registered and unknown email) so the
    // dominant deterministic CPU cost is identical and response latency does
    // not encode registration state. Must run BEFORE the branch split so it is
    // unconditional. The return value is discarded; only the cost matters.
    await runTimingAnchorCompare();

    if (!user) {
      // Equoria-54sk7: the constant-time anchor (runTimingAnchorCompare) has
      // already run unconditionally above — its bcrypt cost dominates both
      // branches identically, so the unknown-email branch needs no additional
      // padding here (the prior SQL-sleep no-op is removed). Do NOT
      // short-circuit BEFORE the anchor above — that re-introduces the
      // enumeration oracle (same failure mode as authController login).
      logger.info(
        '[passwordController.forgotPassword] Password reset requested for unknown email',
        {
          email,
        },
      );
      return res.status(200).json({
        success: true,
        message: responseMessage,
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashPasswordResetToken(rawToken);
    // Equoria-n62tl: req.ip already honors Express's `trust proxy` setting
    // (the upstream-IP resolution lives there, not here). Dropping the
    // `req.headers['x-forwarded-for']` fallback closes a vector where a
    // misconfigured / disabled `trust proxy` makes req.ip undefined and
    // re-enables ATTACKER-CONTROLLED audit-IP injection. Fall back to null
    // instead of a forgeable header — an unknown IP is honest; a forged
    // one is a stealth-frame primitive. The 5 sibling sites in this file
    // and the rate-limit-key site in middleware/rateLimiting.mjs are
    // tracked separately per OPTIMAL_FIX §3 (do-not-bundle).
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.headers['user-agent'];
    const ttlSeconds = Math.floor(PASSWORD_RESET_TOKEN_TTL_MS / 1000);

    // Invalidate existing unused tokens and insert the new one atomically.
    // The password_reset_tokens table is created by migration
    // 20260414001000_add_password_reset_tokens — no runtime DDL needed.
    // expiresAt uses NOW() server-side to avoid client timezone serialization issues.
    // Equoria-nz94y: parameterized $executeRaw tagged templates replace the
    // $executeRawUnsafe form. Each ${interpolation} becomes a bound parameter
    // (never string-spliced into the SQL text), so the SQL-injection surface
    // is closed at the driver layer. SQL operators / casts (NOW(), ||,
    // ::interval) stay as literal template text outside the bindings.
    // Equoria-7x9po: transient P2028 tx-timeout -> retryable 503 (AppError
    // subclass) so the isAppError-gated next(error) below forwards it as 503.
    await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        await tx.$executeRaw`
        UPDATE password_reset_tokens
        SET "usedAt" = NOW()
        WHERE "userId" = ${user.id} AND "usedAt" IS NULL`;
        await tx.$executeRaw`
        INSERT INTO password_reset_tokens
          ("tokenHash", "userId", email, "expiresAt", "ipAddress", "userAgent")
        VALUES (
          ${tokenHash},
          ${user.id},
          ${user.email},
          NOW() + (${String(ttlSeconds)} || ' seconds')::interval,
          ${ipAddress},
          ${userAgent}
        )`;
      }),
      { message: 'Password reset service is busy right now, please retry in a moment.' },
    );

    // Equoria-dv1lv: the email-send was the dominant timing-side-channel
    // because the outbound SMTP/transactional-mail call adds tens to
    // hundreds of ms that the no-user branch never paid. Fire-and-forget
    // it AFTER the controller has already responded so the response
    // duration no longer encodes registered-vs-unregistered. Errors are
    // swallowed into the log; the token row is already persisted so the
    // user can retry from the UI if delivery fails. Pairs with the
    // !user branch's constant-time padding (see above) for two-sided
    // defense against email enumeration via timing.
    emailService.sendPasswordResetEmail(user.email, rawToken, user).catch(err => {
      logger.error(
        `[passwordController.forgotPassword] Email send failed (token still persisted): ${err.message}`,
      );
    });

    logger.info('[passwordController.forgotPassword] Password reset email queued', {
      userId: user.id,
      email: user.email,
    });

    return res.status(200).json({
      success: true,
      message: responseMessage,
    });
  } catch (error) {
    logger.error('[passwordController.forgotPassword] Error:', error);
    if (AppError.isAppError(error) || error instanceof ValidationError) {
      return next(error);
    }
    next(new AppError('Failed to request password reset.', 500));
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword, password } = req.body;
    const candidatePassword = newPassword || password;

    if (!token || !candidatePassword) {
      throw new ValidationError('Token and new password are required');
    }
    if (candidatePassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters long');
    }

    const tokenHash = hashPasswordResetToken(token);
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    const hashedPassword = await bcrypt.hash(candidatePassword, saltRounds);

    // Look up a valid (non-expired, non-used) token — expiry checked server-side with
    // NOW() to avoid client timezone serialization issues with TIMESTAMP columns.
    // Equoria-nz94y: parameterized $queryRaw tagged template (tokenHash bound,
    // never string-spliced) replaces $queryRawUnsafe. Returns the same row
    // shape ([{ id, userId }]) the downstream code already consumes.
    const rows = await prisma.$queryRaw`
      SELECT id, "userId"
      FROM password_reset_tokens
      WHERE "tokenHash" = ${tokenHash}
        AND "usedAt" IS NULL
        AND "expiresAt" > NOW()`;
    const resetToken = rows[0];
    if (!resetToken) {
      throw new AppError('Password reset token is invalid or expired', 400);
    }

    // Apply writes atomically: update password, mark token used, invalidate sessions.
    // passwordChangedAt is stamped so the JWT-verify middleware (CWE-613) rejects
    // any access tokens issued before this reset — closes the residual window.
    // Equoria-7x9po: transient P2028 tx-timeout -> retryable 503.
    await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        await tx.user.update({
          where: { id: resetToken.userId },
          data: { password: hashedPassword, passwordChangedAt: new Date() },
        });
        // Equoria-nz94y: parameterized $executeRaw tagged template (resetToken.id
        // bound) replaces $executeRawUnsafe.
        await tx.$executeRaw`UPDATE password_reset_tokens SET "usedAt" = NOW() WHERE id = ${resetToken.id}`;
        await tx.refreshToken.deleteMany({
          where: { userId: resetToken.userId },
        });
      }),
      { message: 'Password reset service is busy right now, please retry in a moment.' },
    );

    // Equoria-2bbf: evict the per-user passwordChangedAt cache so the next
    // authenticated request reads the fresh DB value immediately.
    evictPasswordChangedAtCache(resetToken.userId);

    res.clearCookie('accessToken', CLEAR_COOKIE_OPTIONS.accessToken);
    res.clearCookie('refreshToken', CLEAR_COOKIE_OPTIONS.refreshToken);
    // Equoria-uxh1l: also clear the CSRF cookie on session invalidation.
    res.clearCookie(CSRF_COOKIE_NAME, CLEAR_CSRF_COOKIE_OPTIONS);

    logger.info('[passwordController.resetPassword] Password reset successfully', {
      userId: resetToken.userId,
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. Please login again.',
    });
  } catch (error) {
    logger.error('[passwordController.resetPassword] Error:', error);
    if (AppError.isAppError(error) || error instanceof ValidationError) {
      return next(error);
    }
    next(new AppError('Failed to reset password.', 500));
  }
};
