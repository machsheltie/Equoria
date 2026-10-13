/**
 * Gmail API mail transport (Equoria-s4rf4).
 *
 * Railway blocks outbound SMTP below its Pro plan, so production mail leaves
 * through the Gmail API over HTTPS instead. This module exposes a `sendMail`
 * that accepts the same options emailService already passes to nodemailer
 * (from, to, subject, text, html, ...). nodemailer's own MIME composer builds
 * the raw message; Node's `fetch` carries it to Google.
 *
 * Errors name the HTTP status and Google's error code/description only. They
 * never carry the client secret, refresh token, access token, or message body.
 */

import { URLSearchParams } from 'node:url';
import nodemailer from 'nodemailer';

const DEFAULT_OAUTH_URL = 'https://oauth2.googleapis.com/token';
const DEFAULT_API_URL = 'https://gmail.googleapis.com';
const DEFAULT_TIMEOUT_MS = 15000;
const TOKEN_EXPIRY_MARGIN_MS = 60 * 1000;

export const GMAIL_REQUIRED_VARS = [
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'GMAIL_REFRESH_TOKEN',
];

/**
 * Read the Gmail API settings from the environment.
 *
 * Returns the settings when all three required variables are set, and `null`
 * when none are. A half-configured set throws in production (naming what is
 * missing) and counts as not configured anywhere else.
 */
export function readGmailConfig(env = process.env) {
  const missing = GMAIL_REQUIRED_VARS.filter(name => !env[name]);
  if (missing.length === GMAIL_REQUIRED_VARS.length) {
    return null;
  }
  if (missing.length > 0) {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        `[EmailService] Gmail API is half-configured. Missing: ${missing.join(', ')}. ` +
          'Set all of GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, or none of them.',
      );
    }
    return null;
  }
  return {
    clientId: env.GMAIL_CLIENT_ID,
    clientSecret: env.GMAIL_CLIENT_SECRET,
    refreshToken: env.GMAIL_REFRESH_TOKEN,
    sender: env.GMAIL_SENDER || undefined,
    oauthUrl: env.GMAIL_OAUTH_URL || undefined,
    apiUrl: env.GMAIL_API_URL || undefined,
  };
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function describeGoogleError(body) {
  if (!body || typeof body !== 'object') {
    return 'no error detail';
  }
  // OAuth endpoint: { error: 'invalid_grant', error_description: '...' }
  if (typeof body.error === 'string') {
    return [body.error, body.error_description].filter(Boolean).join(': ');
  }
  // Gmail API: { error: { code, status, message } }
  const err = body.error;
  if (err && typeof err === 'object') {
    const message = typeof err.message === 'string' ? err.message.slice(0, 200) : '';
    return [err.status, message].filter(Boolean).join(': ') || 'no error detail';
  }
  return 'no error detail';
}

async function timedFetch(stage, url, init, timeoutMs) {
  try {
    return await fetch(url, { ...init, signal: globalThis.AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const reason =
      error?.name === 'TimeoutError'
        ? `timed out after ${timeoutMs} ms`
        : error?.cause?.code || error?.name;
    throw new Error(`[GmailApi] ${stage} request failed: ${reason}`, { cause: error });
  }
}

async function buildRawMessage(composer, mailOptions) {
  try {
    const { message } = await composer.sendMail(mailOptions);
    return message.toString('base64url');
  } catch (error) {
    throw new Error(`[GmailApi] could not compose message: ${error.message}`, { cause: error });
  }
}

/**
 * Create a transport whose `sendMail(mailOptions)` resolves to `{ messageId }`
 * and rejects with an Error on any failure.
 */
export function createGmailApiTransport({
  clientId,
  clientSecret,
  refreshToken,
  sender,
  oauthUrl = DEFAULT_OAUTH_URL,
  apiUrl = DEFAULT_API_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  let accessToken = null;
  let accessTokenExpiresAt = 0;
  let pendingRefresh = null;
  // nodemailer's stream transport composes the MIME message without sending it.
  const composer = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: 'unix',
  });

  async function refreshAccessToken() {
    const response = await timedFetch(
      'token',
      oauthUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }).toString(),
      },
      timeoutMs,
    );
    const body = await readJsonSafely(response);
    if (!response.ok) {
      throw new Error(
        `[GmailApi] token refresh failed: HTTP ${response.status} ${describeGoogleError(body)}`,
      );
    }
    if (!body || typeof body.access_token !== 'string') {
      throw new Error(
        `[GmailApi] token refresh failed: HTTP ${response.status} without an access token`,
      );
    }
    const lifetimeMs = Number(body.expires_in) * 1000;
    accessToken = body.access_token;
    accessTokenExpiresAt =
      Date.now() + (Number.isFinite(lifetimeMs) ? lifetimeMs : 0) - TOKEN_EXPIRY_MARGIN_MS;
    return accessToken;
  }

  function getAccessToken() {
    if (accessToken && Date.now() < accessTokenExpiresAt) {
      return Promise.resolve(accessToken);
    }
    if (!pendingRefresh) {
      pendingRefresh = refreshAccessToken().finally(() => {
        pendingRefresh = null;
      });
    }
    return pendingRefresh;
  }

  function postMessage(token, raw) {
    return timedFetch(
      'send',
      `${apiUrl}/gmail/v1/users/me/messages/send`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      },
      timeoutMs,
    );
  }

  async function sendMail(mailOptions = {}) {
    const raw = await buildRawMessage(composer, {
      ...mailOptions,
      from: mailOptions.from || sender,
    });

    let response = await postMessage(await getAccessToken(), raw);
    if (response.status === 401) {
      // The cached token was revoked or expired early: refresh and retry once.
      await response.body?.cancel();
      accessToken = null;
      accessTokenExpiresAt = 0;
      response = await postMessage(await getAccessToken(), raw);
    }

    const body = await readJsonSafely(response);
    if (!response.ok) {
      throw new Error(
        `[GmailApi] send failed: HTTP ${response.status} ${describeGoogleError(body)}`,
      );
    }
    return { messageId: body?.id };
  }

  return { sendMail };
}

export default createGmailApiTransport;
