/**
 * 📨 Email Service
 *
 * Handles sending emails via AWS SES (or fallback to console in development).
 * Supports HTML and plain text email templates with mobile-first design.
 *
 * Phase 1, Day 6-7: Email Verification System
 */

import logger from './logger.mjs';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { SUPPORT_EMAIL, generateEmailTemplate, generatePlainTextEmail } from './emailTemplates.mjs';

// Email configuration
const EMAIL_CONFIG = {
  FROM_EMAIL: process.env.EMAIL_FROM || 'noreply@equoria.com',
  FROM_NAME: process.env.EMAIL_FROM_NAME || 'Equoria',
  VERIFICATION_URL_BASE: process.env.VERIFICATION_URL_BASE || 'http://localhost:3000/verify-email',
  PASSWORD_RESET_URL_BASE:
    process.env.PASSWORD_RESET_URL_BASE || 'http://localhost:3000/reset-password',
  // Equoria-6p398.5 (Finding 5): confirmation link for a STAGED recovery-address
  // change. Deliberately a different landing page from VERIFICATION_URL_BASE —
  // the two token purposes are not interchangeable.
  EMAIL_CHANGE_URL_BASE:
    process.env.EMAIL_CHANGE_URL_BASE || 'http://localhost:3000/confirm-email-change',
  // Single source of truth lives with the templates that render it.
  SUPPORT_EMAIL,
};

// Cached SMTP transporter (lazy-initialized so import-time doesn't fail).
let cachedTransporter = null;

/**
 * Build / return a nodemailer SMTP transporter from env config.
 *
 * Required env vars in production:
 *   - SMTP_HOST  (e.g. email-smtp.us-east-1.amazonaws.com for SES, smtp.resend.com for Resend)
 *   - SMTP_PORT  (587 STARTTLS or 465 TLS)
 *   - SMTP_USER  (provider's SMTP username)
 *   - SMTP_PASS  (provider's SMTP password / API key)
 *
 * Throws (fail-loud) if any required var is missing in production. Returns
 * `null` in non-production so capture/dev paths stay opt-in.
 */
function getSmtpTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    if (process.env.NODE_ENV === 'production') {
      // Fail closed: refuse to silently drop user-facing emails in production.
      throw new Error(
        '[EmailService] SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in environment.',
      );
    }
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass },
  });
  return cachedTransporter;
}

/**
 * Reset the cached transporter (test-only helper so env changes between tests
 * take effect). Not exported on the default export.
 */
export function _resetTransporter() {
  cachedTransporter = null;
}

/**
 * Deliver a single message via the configured SMTP provider.
 * Throws on send failure so callers can surface the error.
 */
async function sendViaSmtp({ to, subject, html, text }) {
  const transporter = getSmtpTransporter();
  if (!transporter) {
    // Non-production path with no SMTP configured — should never reach here
    // because the production branches gate on getSmtpTransporter() first.
    throw new Error('[EmailService] sendViaSmtp called without a configured transporter');
  }
  const from = `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.FROM_EMAIL}>`;
  const info = await transporter.sendMail({ from, to, subject, html, text });
  return info;
}

/**
 * Capture non-production emails for local readiness gates.
 *
 * This is a real email-service sink, not a test bypass: callers still execute
 * the same send*Email service path and receive the same preview URL that the
 * development email adapter would log.
 */
function captureEmailPreview(kind, payload) {
  const captureFile = process.env.EMAIL_CAPTURE_FILE;
  if (!captureFile || process.env.NODE_ENV === 'production') {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(captureFile), { recursive: true });
    fs.appendFileSync(
      captureFile,
      `${JSON.stringify({ kind, capturedAt: new Date().toISOString(), ...payload })}\n`,
      'utf-8',
    );
  } catch (error) {
    logger.error('[EmailService] Failed to capture email preview:', error);
  }
}

/**
 * Send Email Verification
 * Sends verification email with token link
 *
 * @param {string} email - Recipient email
 * @param {string} token - Verification token
 * @param {Object} user - User object (optional, for personalization)
 * @returns {Promise<Object>} Send result
 */
export async function sendVerificationEmail(email, token, user = {}) {
  const verificationUrl = `${EMAIL_CONFIG.VERIFICATION_URL_BASE}?token=${token}`;
  const userName = user.firstName || user.username || 'there';

  const subject = 'Verify Your Email Address - Equoria';
  const heading = 'Welcome to Equoria! 🐴';
  const bodyHtml = `
    <p>Hi ${userName},</p>
    <p>Thank you for joining Equoria! To complete your registration and start your horse breeding journey,
    please verify your email address by clicking the button below.</p>
    <p>This verification link will expire in <strong>24 hours</strong>.</p>
  `;
  const bodyText = `Hi ${userName},\n\nThank you for joining Equoria! To complete your registration and start your horse breeding journey, please verify your email address by clicking the link below.\n\nThis verification link will expire in 24 hours.`;

  const htmlEmail = generateEmailTemplate(
    subject,
    heading,
    bodyHtml,
    'Verify Email Address',
    verificationUrl,
  );

  const plainTextEmail = generatePlainTextEmail(
    heading,
    bodyText,
    'Verify your email',
    verificationUrl,
  );

  // In development/testing, log email instead of sending
  if (process.env.NODE_ENV !== 'production') {
    captureEmailPreview('verification', {
      to: email,
      subject,
      preview: verificationUrl,
    });

    logger.info('[EmailService] Email verification (DEV MODE - not sent)', {
      to: email,
      subject,
      verificationUrl,
      htmlLength: htmlEmail.length,
      textLength: plainTextEmail.length,
    });

    return {
      success: true,
      messageId: `dev-mode-${Date.now()}`,
      preview: verificationUrl,
    };
  }

  // Production: send via configured SMTP provider. Fails loud if unconfigured.
  const info = await sendViaSmtp({
    to: email,
    subject,
    html: htmlEmail,
    text: plainTextEmail,
  });

  logger.info('[EmailService] Verification email sent', {
    to: email,
    messageId: info?.messageId,
  });

  return {
    success: true,
    messageId: info?.messageId,
    preview: verificationUrl,
  };
}

/**
 * Send Welcome Email (after verification)
 * Sends welcome email after successful verification
 *
 * @param {string} email - Recipient email
 * @param {Object} user - User object
 * @returns {Promise<Object>} Send result
 */
export async function sendWelcomeEmail(email, user = {}) {
  const userName = user.firstName || user.username || 'there';
  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000/dashboard';

  const subject = "Welcome to Equoria - Let's Get Started! 🐴";
  const heading = 'Your Email is Verified!';
  const bodyHtml = `
    <p>Hi ${userName},</p>
    <p>Congratulations! Your email has been successfully verified. You now have full access to Equoria.</p>
    <p>Here's what you can do next:</p>
    <ul>
      <li>🐴 Browse and purchase your first horses</li>
      <li>🏇 Start breeding champions</li>
      <li>🎯 Compete in shows and events</li>
      <li>💰 Build your stable empire</li>
    </ul>
    <p>We're excited to have you as part of the Equoria community!</p>
  `;
  const bodyText = `Hi ${userName},\n\nCongratulations! Your email has been successfully verified. You now have full access to Equoria.\n\nHere's what you can do next:\n- Browse and purchase your first horses\n- Start breeding champions\n- Compete in shows and events\n- Build your stable empire\n\nWe're excited to have you as part of the Equoria community!`;

  const htmlEmail = generateEmailTemplate(
    subject,
    heading,
    bodyHtml,
    'Go to Dashboard',
    dashboardUrl,
  );

  const plainTextEmail = generatePlainTextEmail(
    heading,
    bodyText,
    'Go to your dashboard',
    dashboardUrl,
  );

  // In development/testing, log email instead of sending
  if (process.env.NODE_ENV !== 'production') {
    captureEmailPreview('welcome', {
      to: email,
      subject,
    });

    logger.info('[EmailService] Welcome email (DEV MODE - not sent)', {
      to: email,
      subject,
    });

    return {
      success: true,
      messageId: `dev-mode-welcome-${Date.now()}`,
    };
  }

  // Production: send via configured SMTP provider. Fails loud if unconfigured.
  const info = await sendViaSmtp({
    to: email,
    subject,
    html: htmlEmail,
    text: plainTextEmail,
  });

  logger.info('[EmailService] Welcome email sent', {
    to: email,
    messageId: info?.messageId,
  });

  return {
    success: true,
    messageId: info?.messageId,
  };
}

export async function sendPasswordResetEmail(email, token, user = {}) {
  const resetUrl = `${EMAIL_CONFIG.PASSWORD_RESET_URL_BASE}?token=${token}`;
  const userName = user.firstName || user.username || 'there';

  const subject = 'Reset Your Equoria Password';
  const heading = 'Reset your password';
  const bodyHtml = `
    <p>Hi ${userName},</p>
    <p>We received a request to reset the password for your Equoria account.</p>
    <p>This reset link will expire in <strong>1 hour</strong> and can only be used once.</p>
  `;
  const bodyText = `Hi ${userName},\n\nWe received a request to reset the password for your Equoria account.\n\nThis reset link will expire in 1 hour and can only be used once.`;

  const htmlEmail = generateEmailTemplate(subject, heading, bodyHtml, 'Reset Password', resetUrl);
  const plainTextEmail = generatePlainTextEmail(heading, bodyText, 'Reset your password', resetUrl);

  if (process.env.NODE_ENV !== 'production') {
    captureEmailPreview('password-reset', {
      to: email,
      subject,
      preview: resetUrl,
    });

    logger.info('[EmailService] Password reset email (DEV MODE - not sent)', {
      to: email,
      subject,
      resetUrl,
      htmlLength: htmlEmail.length,
      textLength: plainTextEmail.length,
    });

    return {
      success: true,
      messageId: `dev-mode-password-reset-${Date.now()}`,
      preview: resetUrl,
    };
  }

  // Production: send via configured SMTP provider. Fails loud if unconfigured.
  const info = await sendViaSmtp({
    to: email,
    subject,
    html: htmlEmail,
    text: plainTextEmail,
  });

  logger.info('[EmailService] Password reset email sent', {
    to: email,
    messageId: info?.messageId,
  });

  return {
    success: true,
    messageId: info?.messageId,
    preview: resetUrl,
  };
}

/**
 * Send the confirmation link for a staged recovery-address change
 * (Equoria-6p398.5, Finding 5).
 *
 * Addressed to the REPLACEMENT address only — the confirmed identity is not
 * asked to approve its own replacement here; that proof was the fresh
 * authentication (password, plus TOTP when MFA is on) already required at
 * `POST /auth/email-change/request`.
 *
 * @param {string} email - The staged replacement address.
 * @param {string} token - Raw, purpose-tagged confirmation token.
 * @param {Object} user - Optional personalization fields.
 * @returns {Promise<Object>} Send result
 */
export async function sendEmailChangeConfirmationEmail(email, token, user = {}) {
  const confirmUrl = `${EMAIL_CONFIG.EMAIL_CHANGE_URL_BASE}?token=${token}`;
  const userName = user.firstName || user.username || 'there';

  const subject = 'Confirm your new Equoria email address';
  const heading = 'Confirm your new email address';
  const bodyHtml = `
    <p>Hi ${userName},</p>
    <p>Someone asked to make <strong>${email}</strong> the email address for your Equoria account,
    and confirmed your current password to do it.</p>
    <p>Your existing email address stays in place — including for password recovery — until you
    confirm below. This link expires in <strong>24 hours</strong> and can be used once.</p>
    <p>If this was not you, do nothing and change your password.</p>
  `;
  const bodyText = `Hi ${userName},

Someone asked to make ${email} the email address for your Equoria account, and confirmed your current password to do it.

Your existing email address stays in place — including for password recovery — until you confirm with the link below. This link expires in 24 hours and can be used once.

If this was not you, do nothing and change your password.`;

  const htmlEmail = generateEmailTemplate(
    subject,
    heading,
    bodyHtml,
    'Confirm New Email Address',
    confirmUrl,
  );
  const plainTextEmail = generatePlainTextEmail(
    heading,
    bodyText,
    'Confirm your new email address',
    confirmUrl,
  );

  if (process.env.NODE_ENV !== 'production') {
    captureEmailPreview('email-change', {
      to: email,
      subject,
      preview: confirmUrl,
    });

    logger.info('[EmailService] Email change confirmation (DEV MODE - not sent)', {
      to: email,
      subject,
      htmlLength: htmlEmail.length,
      textLength: plainTextEmail.length,
    });

    return {
      success: true,
      messageId: `dev-mode-email-change-${Date.now()}`,
      preview: confirmUrl,
    };
  }

  // Production: send via configured SMTP provider. Fails loud if unconfigured.
  const info = await sendViaSmtp({
    to: email,
    subject,
    html: htmlEmail,
    text: plainTextEmail,
  });

  logger.info('[EmailService] Email change confirmation sent', {
    to: email,
    messageId: info?.messageId,
  });

  return {
    success: true,
    messageId: info?.messageId,
    preview: confirmUrl,
  };
}

/**
 * Notify the CURRENT confirmed address that a recovery-address change was
 * requested (Equoria-6p398.5 fix round 1).
 *
 * The confirmation link goes to the replacement address, which means the person
 * who still controls the confirmed address would otherwise learn nothing until
 * the change had already committed. This is the out-of-band signal that lets
 * them react while their address is still the live recovery identity — the same
 * role the "your password was changed" notice plays. It carries NO token and no
 * action link: it is information only, so it can never itself be used to
 * approve or complete the change.
 *
 * @param {string} email - The account's confirmed (current) address.
 * @param {{pendingEmail: string, user?: Object}} details
 * @returns {Promise<Object>} Send result
 */
export async function sendEmailChangeNoticeEmail(email, details = {}) {
  const { pendingEmail, user = {} } = details;
  const userName = user.firstName || user.username || 'there';
  const supportEmail = EMAIL_CONFIG.SUPPORT_EMAIL;

  const subject = 'A change to your Equoria email address was requested';
  const heading = 'Someone asked to change your email address';
  const bodyHtml = `
    <p>Hi ${userName},</p>
    <p>A request was made to change the email address on your Equoria account to
    <strong>${pendingEmail}</strong>. The person making it confirmed your current password.</p>
    <p><strong>This address is still your account's email</strong>, including for password
    recovery, until the change is confirmed from the new address.</p>
    <p>If this was not you, change your password now — doing so cancels the pending change
    immediately. Then contact us at ${supportEmail}.</p>
  `;
  const bodyText = `Hi ${userName},

A request was made to change the email address on your Equoria account to ${pendingEmail}. The person making it confirmed your current password.

This address is still your account's email, including for password recovery, until the change is confirmed from the new address.

If this was not you, change your password now — doing so cancels the pending change immediately. Then contact us at ${supportEmail}.`;

  const htmlEmail = generateEmailTemplate(subject, heading, bodyHtml);
  const plainTextEmail = generatePlainTextEmail(heading, bodyText);

  if (process.env.NODE_ENV !== 'production') {
    captureEmailPreview('email-change-notice', {
      to: email,
      subject,
      pendingEmail,
    });

    logger.info('[EmailService] Email change notice (DEV MODE - not sent)', {
      to: email,
      subject,
      htmlLength: htmlEmail.length,
      textLength: plainTextEmail.length,
    });

    return { success: true, messageId: `dev-mode-email-change-notice-${Date.now()}` };
  }

  // Production: send via configured SMTP provider. Fails loud if unconfigured.
  const info = await sendViaSmtp({
    to: email,
    subject,
    html: htmlEmail,
    text: plainTextEmail,
  });

  logger.info('[EmailService] Email change notice sent', {
    to: email,
    messageId: info?.messageId,
  });

  return { success: true, messageId: info?.messageId };
}

export default {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEmailChangeConfirmationEmail,
  sendEmailChangeNoticeEmail,
};
