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
 * so no database lock is held across the SMTP round trip. Two messages go out:
 * a token-free security notice to the CURRENT confirmed address, and the
 * confirmation link to the replacement. A confirmation-delivery failure is
 * reported honestly (502) and leaves the pending change intact: retrying the
 * request (after the resend cooldown) mints a fresh link and supersedes the
 * undelivered one.
 */

import { AppError, ValidationError } from '../../../errors/index.mjs';
import logger from '../../../utils/logger.mjs';
import emailService from '../../../utils/emailService.mjs';
import {
  requestEmailChange,
  confirmEmailChange,
  readEmailChangeStatus,
} from '../services/emailChangeService.mjs';

/**
 * GET /api/v1/auth/email-change/status
 *
 * Session-gated read (Equoria-6p398.11, Finding 9). It answers the two
 * questions a recovery-address surface must ask before it can be honest:
 * will this account be asked for a second factor, and is a replacement already
 * waiting to be confirmed? It mutates nothing, sends nothing, and reports only
 * the caller's own account — the user id comes from the verified session, never
 * from the request.
 */
export const getEmailChangeStatusController = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }

    const status = await readEmailChangeStatus(req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Email change status retrieved',
      data: status,
    });
  } catch (error) {
    logger.error(`[emailChangeController.status] ${error.message}`);
    if (AppError.isAppError(error) || error instanceof ValidationError) {
      return next(error);
    }
    return next(new AppError('Failed to read the email change status.', 500));
  }
};

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

    // Both sends are outside the transaction, on purpose. The raw token exists
    // only here and in the outbound confirmation; it is never logged, never
    // returned, and never included in the notice.

    // The out-of-band security notice to the CURRENT confirmed address goes
    // FIRST: it is the signal that lets the person who still holds that address
    // react while it is still the live recovery identity. A notice failure is
    // reported (`noticeDelivered: false`) but does not fail the request — the
    // pending change is already durably staged either way, and hiding that from
    // the caller would be the dishonest option.
    let noticeDelivered = true;
    try {
      await emailService.sendEmailChangeNoticeEmail(staged.confirmedEmail, {
        pendingEmail: staged.pendingEmail,
        user: staged.user,
      });
    } catch (noticeError) {
      noticeDelivered = false;
      logger.error(
        `[emailChangeController.request] Change notice to the confirmed address failed: ${noticeError.message}`,
      );
    }

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
        data: { pendingEmail: staged.pendingEmail, delivered: false, noticeDelivered },
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
        noticeDelivered,
      },
    });
  } catch (error) {
    logger.error(`[emailChangeController.request] ${error.message}`);
    // The central errorHandler has no retry-after handling, so a throttled
    // rejection (MFA lockout, or the email-change resend cooldown) renders its
    // own body here — the same shape /auth/mfa/disable returns.
    if (AppError.isAppError(error) && error.statusCode === 429 && error.retryAfter !== undefined) {
      return res.status(429).json({
        success: false,
        message: error.message,
        retryAfter: error.retryAfter,
      });
    }
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
