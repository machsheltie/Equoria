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

// Email configuration
const EMAIL_CONFIG = {
  FROM_EMAIL: process.env.EMAIL_FROM || 'noreply@equoria.com',
  FROM_NAME: process.env.EMAIL_FROM_NAME || 'Equoria',
  VERIFICATION_URL_BASE: process.env.VERIFICATION_URL_BASE || 'http://localhost:3000/verify-email',
  PASSWORD_RESET_URL_BASE:
    process.env.PASSWORD_RESET_URL_BASE || 'http://localhost:3000/reset-password',
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'support@equoria.com',
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
 * Generate HTML Email Template
 * Mobile-first responsive design with fallback for plain text
 *
 * @param {string} subject - Email subject
 * @param {string} heading - Email heading
 * @param {string} bodyHtml - Email body HTML
 * @param {string} ctaText - Call to action button text
 * @param {string} ctaUrl - Call to action button URL
 * @returns {string} Complete HTML email
 */
function generateEmailTemplate(subject, heading, bodyHtml, ctaText, ctaUrl) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      color: #333333;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 40px 20px;
    }
    .email-header {
      text-align: center;
      margin-bottom: 30px;
    }
    .email-logo {
      font-size: 32px;
      font-weight: bold;
      color: #4A90E2;
      margin-bottom: 10px;
    }
    .email-heading {
      font-size: 24px;
      font-weight: 600;
      color: #333333;
      margin-bottom: 20px;
    }
    .email-body {
      font-size: 16px;
      line-height: 1.6;
      color: #666666;
      margin-bottom: 30px;
    }
    .cta-button {
      display: inline-block;
      background-color: #4A90E2;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
    }
    .email-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      font-size: 14px;
      color: #999999;
      text-align: center;
    }
    .security-notice {
      background-color: #FFF9E6;
      border-left: 4px solid #FFB800;
      padding: 15px;
      margin: 20px 0;
      font-size: 14px;
      color: #666666;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        padding: 20px 15px;
      }
      .email-heading {
        font-size: 20px;
      }
      .email-body {
        font-size: 14px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <div class="email-logo">🐴 Equoria</div>
    </div>

    <h1 class="email-heading">${heading}</h1>

    <div class="email-body">
      ${bodyHtml}
    </div>

    <div style="text-align: center;">
      <a href="${ctaUrl}" class="cta-button">${ctaText}</a>
    </div>

    <div class="security-notice">
      <strong>🔒 Security Notice:</strong> This link will expire after the period stated above.
      If you didn't request this email, please ignore it or contact support.
    </div>

    <div class="email-footer">
      <p>This email was sent by Equoria. If you have questions, contact us at
        <a href="mailto:${EMAIL_CONFIG.SUPPORT_EMAIL}" style="color: #4A90E2;">${EMAIL_CONFIG.SUPPORT_EMAIL}</a>
      </p>
      <p>&copy; ${new Date().getFullYear()} Equoria. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate Plain Text Email
 * Fallback for email clients that don't support HTML
 *
 * @param {string} heading - Email heading
 * @param {string} bodyText - Email body plain text
 * @param {string} ctaText - Call to action text
 * @param {string} ctaUrl - Call to action URL
 * @returns {string} Plain text email
 */
function generatePlainTextEmail(heading, bodyText, ctaText, ctaUrl) {
  return `
${heading}

${bodyText}

${ctaText}: ${ctaUrl}

Security Notice: This link will expire in 24 hours. If you didn't request this email, please ignore it or contact support.

---
This email was sent by Equoria.
If you have questions, contact us at ${EMAIL_CONFIG.SUPPORT_EMAIL}

© ${new Date().getFullYear()} Equoria. All rights reserved.
  `.trim();
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
  const plainTextEmail = generatePlainTextEmail(
    heading,
    bodyText,
    'Reset your password',
    resetUrl,
  );

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

export default {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
};
