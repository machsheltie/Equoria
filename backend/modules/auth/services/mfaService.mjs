/**
 * TOTP-based MFA service (OWASP A07, Equoria-2vwwh).
 *
 * Pure, real-implementation service for time-based one-time password (TOTP)
 * multi-factor auth. No mocks anywhere — callers exercise this against the
 * real DB. Uses `otplib` (actively maintained) for RFC 6238 TOTP.
 *
 * Design notes:
 *  - `mfaSecret` is the base32 TOTP shared secret. At-rest encryption is NOT
 *    yet applied because the codebase has no encryption util; this is a
 *    documented, tracked follow-up (see SECURITY.md A07 note + bd follow-up).
 *  - Recovery codes are bcrypt-hashed (never stored or logged in plaintext)
 *    and single-use: consumption stamps `usedAt` so a code cannot be replayed.
 *  - `verifyToken` uses a ±1 step window (otplib `window: 1`) to tolerate
 *    minor client/server clock skew without materially widening the attack
 *    surface.
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authenticator } from 'otplib';

// ±1 time-step tolerance (each step = 30s) for clock skew.
authenticator.options = { window: 1 };

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_BYTES = 5; // 10 hex chars per code
const RECOVERY_CODE_HASH_ROUNDS = 10;
const TOTP_ISSUER = 'Equoria';

/**
 * Generate a fresh base32 TOTP secret plus an otpauth:// provisioning URL
 * (consumable by authenticator apps / QR generators).
 *
 * @param {string} accountLabel - Stable account identifier (e.g. email).
 * @returns {{ secret: string, otpauthUrl: string }}
 */
export function generateSecret(accountLabel) {
  if (!accountLabel || typeof accountLabel !== 'string') {
    throw new Error('generateSecret: accountLabel is required');
  }
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(accountLabel, TOTP_ISSUER, secret);
  return { secret, otpauthUrl };
}

/**
 * Verify a TOTP token against a secret (±1 step window).
 *
 * @param {string} token - 6-digit code from the user's authenticator app.
 * @param {string} secret - The user's base32 TOTP secret.
 * @returns {boolean}
 */
export function verifyToken(token, secret) {
  if (!token || !secret || typeof token !== 'string' || typeof secret !== 'string') {
    return false;
  }
  const normalized = token.trim();
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }
  try {
    return authenticator.verify({ token: normalized, secret });
  } catch {
    // otplib throws on malformed secret/token — fail closed (treat as invalid),
    // never throw out of a verification boundary.
    return false;
  }
}

/**
 * Generate `RECOVERY_CODE_COUNT` single-use recovery codes. Returns the
 * plaintext codes (shown to the user exactly once) and the hashed records to
 * persist. Plaintext is never stored.
 *
 * @returns {Promise<{ plaintext: string[], hashed: Array<{ codeHash: string, usedAt: null }> }>}
 */
export async function generateRecoveryCodes() {
  const plaintext = [];
  const hashed = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
    const code = crypto.randomBytes(RECOVERY_CODE_BYTES).toString('hex');
    plaintext.push(code);

    const codeHash = await bcrypt.hash(code, RECOVERY_CODE_HASH_ROUNDS);
    hashed.push({ codeHash, usedAt: null });
  }
  return { plaintext, hashed };
}

/**
 * Verify a recovery code against the stored hashed records and consume it.
 *
 * Returns the UPDATED records array (with the matched code's `usedAt`
 * stamped) so the caller can persist it. A code that is already used does
 * not match. This is single-use by construction: the caller must persist the
 * returned `updatedCodes`.
 *
 * @param {string} candidate - Plaintext recovery code supplied by the user.
 * @param {Array<{ codeHash: string, usedAt: string|null }>} storedCodes
 * @returns {Promise<{ valid: boolean, updatedCodes: Array<object> }>}
 */
export async function verifyRecoveryCode(candidate, storedCodes) {
  const codes = Array.isArray(storedCodes) ? storedCodes : [];
  if (!candidate || typeof candidate !== 'string') {
    return { valid: false, updatedCodes: codes };
  }
  const trimmed = candidate.trim();
  for (let i = 0; i < codes.length; i += 1) {
    const record = codes[i];
    if (!record || record.usedAt || typeof record.codeHash !== 'string') {
      continue;
    }
    let match;
    try {
      match = await bcrypt.compare(trimmed, record.codeHash);
    } catch {
      match = false;
    }
    if (match) {
      const updatedCodes = codes.map((c, idx) =>
        idx === i ? { ...c, usedAt: new Date().toISOString() } : c,
      );
      return { valid: true, updatedCodes };
    }
  }
  return { valid: false, updatedCodes: codes };
}

export const __testing = { RECOVERY_CODE_COUNT };
