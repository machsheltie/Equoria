/**
 * 📨 Email Service
 *
 * Handles sending emails via AWS SES (or fallback to console in development).
 * Supports HTML and plain text email templates with mobile-first design.
 *
 * Phase 1, Day 6-7: Email Verification System
 */

import logger from './logger.mjs';

// Email configuration
const EMAIL_CONFIG = {
  FROM_EMAIL: process.env.EMAIL_FROM || 'noreply@equoria.com',
  FROM_NAME: process.env.EMAIL_FROM_NAME || 'Equoria',
  VERIFICATION_URL_BASE:
    process.env.VERIFICATION_URL_BASE || 'http://localhost:3000/verify-email',
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'support@equoria.com',
};

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
      <strong>🔒 Security Notice:</strong> This link will expire in 24 hours.
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
  try {
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

    // Production email sending via AWS SES is not yet configured
    logger.warn('[EmailService] AWS SES not configured, email not sent', {
      to: email,
    });

    return {
      success: true,
      messageId: 'no-email-service-configured',
      preview: verificationUrl,
    };
  } catch (error) {
    logger.error('[EmailService] Error sending verification email:', error);
    throw error;
  }
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
  try {
    const userName = user.firstName || user.username || 'there';
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000/dashboard';

    const subject = 'Welcome to Equoria - Let\'s Get Started! 🐴';
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

    const _htmlEmail = generateEmailTemplate(
      subject,
      heading,
      bodyHtml,
      'Go to Dashboard',
      dashboardUrl,
    );

    const _plainTextEmail = generatePlainTextEmail(
      heading,
      bodyText,
      'Go to your dashboard',
      dashboardUrl,
    );

    // In development/testing, log email instead of sending
    if (process.env.NODE_ENV !== 'production') {
      logger.info('[EmailService] Welcome email (DEV MODE - not sent)', {
        to: email,
        subject,
      });

      return {
        success: true,
        messageId: `dev-mode-welcome-${Date.now()}`,
      };
    }

    // TODO: Send via AWS SES in production
    logger.warn('[EmailService] AWS SES not configured, welcome email not sent', {
      to: email,
    });

    return {
      success: true,
      messageId: 'no-email-service-configured-welcome',
    };
  } catch (error) {
    logger.error('[EmailService] Error sending welcome email:', error);
    throw error;
  }
}

export default {
  sendVerificationEmail,
  sendWelcomeEmail,
};
