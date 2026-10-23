/**
 * emailVerificationService pure functions: token generation and hashing
 * (Equoria-rr7 coverage sprint). Both are pure and synchronous, so no database
 * or fixture is involved.
 *
 * These cases were misfiled in modules/horses/__tests__/healthCheckAtBirthMilestone.test.mjs
 * and moved here, unchanged, with the module that owns the service (Equoria-7t1tn).
 * The fuller service suite is backend/__tests__/emailVerificationService.test.mjs.
 */

import { describe, it, expect } from '@jest/globals';
import { generateVerificationToken, hashVerificationToken } from '../services/emailVerificationService.mjs';

// ── emailVerificationService pure fns ────────────────────────────────────────

describe('generateVerificationToken', () => {
  it('returns a 64-char hex string (32 random bytes)', () => {
    const token = generateVerificationToken();
    expect(typeof token).toBe('string');
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it('returns unique values on successive calls', () => {
    const a = generateVerificationToken();
    const b = generateVerificationToken();
    expect(a).not.toBe(b);
  });
});

describe('hashVerificationToken', () => {
  it('returns a 64-char hex SHA-256 digest', () => {
    const hash = hashVerificationToken('test-token-value');
    expect(typeof hash).toBe('string');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it('is deterministic — same input produces same hash', () => {
    const token = 'deterministic-verification-token';
    expect(hashVerificationToken(token)).toBe(hashVerificationToken(token));
  });

  it('different tokens produce different hashes', () => {
    expect(hashVerificationToken('token-A')).not.toBe(hashVerificationToken('token-B'));
  });
});
