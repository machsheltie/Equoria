/**
 * emailChangeController.mjs (Equoria-6p398.5, Finding 5)
 *
 * The only surface that may move a player's recovery identity:
 *
 *   POST /api/v1/auth/email-change/request   authenticated + CSRF + fresh auth
 *   GET  /api/v1/auth/email-change/confirm   public (the emailed link)
 *
 * `confirm` is public for the same reason `GET /auth/verify-email` is: the link
 * is opened from the mailbox of the REPLACEMENT address, frequently in another
 * browser or on another device. Authority comes entirely from the token, which
 * is one-time, expiring, purpose-tagged and bound to one account + one exact
 * normalized destination. Making it session-gated would only mean the person
 * proving control of the new mailbox must also happen to be logged in — it
 * would add no security, because the session is precisely what the audit found
 * insufficient.
 *
 * Delivery runs AFTER the staging transaction has committed, never inside it,
 * so no database lock is held across the SMTP round trip. A delivery failure is
 * reported honestly (502) and leaves the pending change intact: retrying the
 * request mints a fresh link and supersedes the undelivered one.
 */

import { AppError, ValidationError } from '../../../errors/index.mjs';
import logger from '../../../utils/logger.mjs';
import emailService from '../../../utils/emailService.mjs';
import { requestEmailChange, confirmEmailChange } from '../services/emailChangeService.mjs';

/**
 * POST /api/v1/auth/email-change/request
 */
export const requestEmailChangeController = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }

    const { email, password, totpToken } = req.body || {};

    const staged = await requestEmailChange({
      userId: req.user.id,
      requestedEmail: email,
      password,
      totpToken,
      metadata: {
        // Equoria-n62tl: req.ip already honors Express's `trust proxy`. Do NOT
        // add an x-forwarded-for fallback — that re-enables attacker-controlled
        // audit-IP injection.
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    // Outside the transaction, on purpose. The raw token exists only here and
    // in the outbound message; it is never logged and never returned.
    try {
      await emailService.sendEmailChangeConfirmationEmail(
        staged.pendingEmail,
        staged.rawToken,
        staged.user,
      );
    } catch (deliveryError) {
      logger.error(
        `[emailChangeController.request] Confirmation email delivery failed (pending change retained): ${deliveryError.message}`,
      );
      return res.status(502).json({
        success: false,
        message:
          'Your email change is pending, but the confirmation email could not be sent. Please try again in a moment.',
        data: { pendingEmail: staged.pendingEmail, delivered: false },
      });
    }

    return res.status(200).json({
      success: true,
      message:
        'Confirm the change from the link we sent to the new address. Until you do, your current email address stays in place.',
      data: {
        pendingEmail: staged.pendingEmail,
        expiresAt: staged.expiresAt,
        delivered: true,
      },
    });
  } catch (error) {
    logger.error(`[emailChangeController.request] ${error.message}`);
    if (AppError.isAppError(error) || error instanceof ValidationError) {
      return next(error);
    }
    return next(new AppError('Failed to start the email change.', 500));
  }
};

/**
 * GET /api/v1/auth/email-change/confirm?token=...
 */
export const confirmEmailChangeController = async (req, res, next) => {
  try {
    const { token } = req.query;

    const updated = await confirmEmailChange({
      rawToken: typeof token === 'string' ? token : undefined,
      metadata: {
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Your email address has been changed and verified.',
      data: {
        email: updated.email,
        emailVerified: updated.emailVerified,
        emailVerifiedAt: updated.emailVerifiedAt,
      },
    });
  } catch (error) {
    logger.error(`[emailChangeController.confirm] ${error.message}`);
    if (AppError.isAppError(error) || error instanceof ValidationError) {
      return next(error);
    }
    return next(new AppError('Failed to confirm the email change.', 500));
  }
};
