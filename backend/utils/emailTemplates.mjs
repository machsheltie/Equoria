/**
 * 📨 Email message rendering
 *
 * The HTML + plain-text presentation layer shared by every message
 * `emailService.mjs` sends. Extracted from that module (Equoria-6p398.5 fix
 * round 1) when adding the recovery-address-change messages pushed it past the
 * 600-line source threshold: these two functions are pure string building with
 * no transport, no configuration beyond the support address, and no side
 * effects, so they are the cohesive seam. `emailService.mjs` keeps SMTP
 * transport, the dev/test capture sink, and the individual senders.
 *
 * Nothing here reads a secret or a token — callers pass a finished CTA URL.
 */

/** Support address rendered into every message footer. */
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@equoria.com';

/**
 * Generate HTML Email Template
 * Mobile-first responsive design with fallback for plain text
 *
 * @param {string} subject - Email subject
 * @param {string} heading - Email heading
 * @param {string} bodyHtml - Email body HTML
 * @param {string} [ctaText] - Call to action button text. Omit together with
 *   ctaUrl for an information-only message (the CTA button and its link-expiry
 *   security notice are then omitted rather than rendered with `undefined`).
 * @param {string} [ctaUrl] - Call to action button URL
 * @returns {string} Complete HTML email
 */
export function generateEmailTemplate(subject, heading, bodyHtml, ctaText, ctaUrl) {
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

    ${
      ctaUrl
        ? `<div style="text-align: center;">
      <a href="${ctaUrl}" class="cta-button">${ctaText}</a>
    </div>

    <div class="security-notice">
      <strong>🔒 Security Notice:</strong> This link will expire after the period stated above.
      If you didn't request this email, please ignore it or contact support.
    </div>`
        : ''
    }

    <div class="email-footer">
      <p>This email was sent by Equoria. If you have questions, contact us at
        <a href="mailto:${SUPPORT_EMAIL}" style="color: #4A90E2;">${SUPPORT_EMAIL}</a>
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
 * @param {string} [ctaText] - Call to action text. Omit together with ctaUrl
 *   for an information-only message (the CTA block and its link-expiry security
 *   notice are then omitted rather than rendered with `undefined`).
 * @param {string} [ctaUrl] - Call to action URL
 * @returns {string} Plain text email
 */
export function generatePlainTextEmail(heading, bodyText, ctaText, ctaUrl) {
  return `
${heading}

${bodyText}
${
  ctaUrl
    ? `
${ctaText}: ${ctaUrl}

Security Notice: This link will expire in 24 hours. If you didn't request this email, please ignore it or contact support.
`
    : ''
}

---
This email was sent by Equoria.
If you have questions, contact us at ${SUPPORT_EMAIL}

© ${new Date().getFullYear()} Equoria. All rights reserved.
  `.trim();
}
