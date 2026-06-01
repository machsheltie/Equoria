/**
 * fieldEncryption — unit tests (Equoria-yi13v)
 *
 * AES-256-GCM at-rest field encryption util used to protect User.mfaSecret.
 * Pure crypto, no DB. Tests the round-trip, ciphertext opacity, tamper
 * rejection, and fail-fast key policy.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

async function freshImport() {
  // Reset the module registry so the key is re-resolved from the current env.
  jest.resetModules();
  const mod = await import('../utils/fieldEncryption.mjs');
  return mod;
}

describe('fieldEncryption (AES-256-GCM)', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    // 64 hex chars = 32 bytes for AES-256.
    process.env.FIELD_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('round-trips a value: decrypt(encrypt(x)) === x', async () => {
    const { encryptField, decryptField } = await freshImport();
    const plaintext = 'JBSWY3DPEHPK3PXP'; // sample base32 TOTP secret
    const ciphertext = encryptField(plaintext);
    expect(decryptField(ciphertext)).toBe(plaintext);
  });

  it('produces ciphertext that is not the plaintext base32 secret', async () => {
    const { encryptField } = await freshImport();
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const ciphertext = encryptField(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.includes(plaintext)).toBe(false);
  });

  it('uses a random IV — same plaintext encrypts to different ciphertexts', async () => {
    const { encryptField } = await freshImport();
    const a = encryptField('JBSWY3DPEHPK3PXP');
    const b = encryptField('JBSWY3DPEHPK3PXP');
    expect(a).not.toBe(b);
  });

  it('rejects tampered ciphertext (GCM auth tag mismatch)', async () => {
    const { encryptField, decryptField } = await freshImport();
    const ciphertext = encryptField('JBSWY3DPEHPK3PXP');
    // Flip a character in the payload to corrupt the auth tag / data.
    const parts = ciphertext.split(':');
    const last = parts[parts.length - 1];
    const flipped = (last[0] === 'a' ? 'b' : 'a') + last.slice(1);
    parts[parts.length - 1] = flipped;
    const tampered = parts.join(':');
    expect(() => decryptField(tampered)).toThrow();
  });

  it('isEncrypted() recognizes its own ciphertext and rejects raw base32', async () => {
    const { encryptField, isEncrypted } = await freshImport();
    expect(isEncrypted(encryptField('JBSWY3DPEHPK3PXP'))).toBe(true);
    expect(isEncrypted('JBSWY3DPEHPK3PXP')).toBe(false);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted('')).toBe(false);
  });

  it('decryptField passes through a legacy plaintext value (migration tolerance)', async () => {
    const { decryptField } = await freshImport();
    // Pre-existing rows store plaintext base32. decrypt must not throw on them
    // so existing enrolled users are not locked out.
    expect(decryptField('JBSWY3DPEHPK3PXP')).toBe('JBSWY3DPEHPK3PXP');
  });

  it('fails fast in a deployable env when FIELD_ENCRYPTION_KEY is unset', async () => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    const { encryptField } = await freshImport();
    expect(() => encryptField('x')).toThrow(/FIELD_ENCRYPTION_KEY/);
  });

  it('fails fast in a deployable env when key is wrong length', async () => {
    process.env.FIELD_ENCRYPTION_KEY = 'tooshort';
    process.env.NODE_ENV = 'beta';
    const { encryptField } = await freshImport();
    expect(() => encryptField('x')).toThrow(/FIELD_ENCRYPTION_KEY/);
  });

  it('handles null/empty input without throwing (returns input as-is)', async () => {
    const { encryptField, decryptField } = await freshImport();
    expect(encryptField(null)).toBe(null);
    expect(encryptField('')).toBe('');
    expect(decryptField(null)).toBe(null);
    expect(decryptField('')).toBe('');
  });
});
