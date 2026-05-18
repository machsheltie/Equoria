/**
 * fieldEncryption — AES-256-GCM at-rest encryption for sensitive DB fields.
 *
 * Equoria-yi13v: User.mfaSecret was stored as plaintext base32; a DB dump
 * exposed every TOTP shared secret. This util encrypts such fields before
 * persistence and decrypts on read.
 *
 * Design:
 *  - AES-256-GCM (authenticated encryption): tampering with the stored value
 *    fails decryption (auth-tag mismatch) rather than yielding garbage.
 *  - Key from `FIELD_ENCRYPTION_KEY` env (64 hex chars = 32 bytes). In a
 *    deployable env (production/beta) an unset/short key FAILS FAST — mirrors
 *    runtimeSecretPolicy: never silently fall back to plaintext in prod/beta.
 *  - Ciphertext envelope: `v1:<ivHex>:<authTagHex>:<cipherHex>`. The `v1:`
 *    prefix lets `isEncrypted()` distinguish encrypted values from legacy
 *    plaintext rows so migration is transparent (no data migration needed).
 *  - `decryptField` is migration-tolerant: a value that is NOT in the v1
 *    envelope is assumed to be a legacy plaintext secret and returned as-is,
 *    so users enrolled before this change are not locked out. New writes are
 *    always encrypted.
 *  - null/empty input passes through untouched (Prisma stores null mfaSecret
 *    when MFA is disabled).
 */

import crypto from 'crypto';

import { isDeployableEnvironment } from './runtimeSecretPolicy.mjs';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard nonce length
const KEY_BYTES = 32; // AES-256
const ENVELOPE_PREFIX = 'v1';

/**
 * Resolve the 32-byte key from FIELD_ENCRYPTION_KEY.
 *
 * Fail-fast in deployable environments (production/beta): an unset or
 * wrong-length key is a configuration error that must NOT degrade to storing
 * secrets in plaintext.
 *
 * @returns {Buffer} 32-byte key
 */
function resolveKey() {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  const deployable = isDeployableEnvironment();

  if (!raw) {
    throw new Error(
      `FIELD_ENCRYPTION_KEY is not set${
        deployable ? ` (required in ${process.env.NODE_ENV})` : ''
      }. Generate one with: openssl rand -hex 32`,
    );
  }

  const trimmed = raw.trim();
  let key;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    key = Buffer.from(trimmed, 'hex');
  } else if (Buffer.byteLength(trimmed, 'utf8') === KEY_BYTES) {
    key = Buffer.from(trimmed, 'utf8');
  } else {
    throw new Error(
      'FIELD_ENCRYPTION_KEY must be 64 hex characters (32 bytes) or a 32-byte string. ' +
        'Generate one with: openssl rand -hex 32',
    );
  }

  if (key.length !== KEY_BYTES) {
    throw new Error('FIELD_ENCRYPTION_KEY must resolve to exactly 32 bytes for AES-256-GCM.');
  }
  return key;
}

/**
 * @param {*} value
 * @returns {boolean} true if `value` is a v1 encryption envelope produced here.
 */
export function isEncrypted(value) {
  return (
    typeof value === 'string' &&
    value.startsWith(`${ENVELOPE_PREFIX}:`) &&
    value.split(':').length === 4
  );
}

/**
 * Encrypt a string field. null/empty pass through unchanged.
 *
 * @param {string|null} plaintext
 * @returns {string|null} v1 envelope ciphertext (or the untouched null/empty input)
 */
export function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return plaintext;
  }
  if (typeof plaintext !== 'string') {
    throw new TypeError('encryptField: value must be a string');
  }
  // Idempotency guard: never double-encrypt.
  if (isEncrypted(plaintext)) {
    return plaintext;
  }

  const key = resolveKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX,
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Decrypt a v1 envelope. A non-envelope value is treated as legacy plaintext
 * and returned as-is (migration tolerance — pre-existing rows are not broken).
 * A corrupted/tampered envelope throws (GCM auth-tag failure) — fail closed.
 *
 * @param {string|null} stored
 * @returns {string|null}
 */
export function decryptField(stored) {
  if (stored === null || stored === undefined || stored === '') {
    return stored;
  }
  if (typeof stored !== 'string') {
    throw new TypeError('decryptField: value must be a string');
  }
  if (!isEncrypted(stored)) {
    // Legacy plaintext row — return unchanged so existing users keep working.
    return stored;
  }

  const [, ivHex, authTagHex, cipherHex] = stored.split(':');
  const key = resolveKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(), // throws on auth-tag mismatch (tamper) — intentional
  ]);
  return decrypted.toString('utf8');
}
