/**
 * emailVerificationService — pure-function + safe-DB branch-coverage tests (Equoria-rr7)
 *
 * Pure functions (no DB):
 *   generateVerificationToken — length, hex format
 *   hashVerificationToken     — deterministic SHA-256
 *
 * Safe DB (no fixtures needed — "not found" / cleanup paths):
 *   verifyEmailToken           — unknown token → INVALID_TOKEN (timing-safe 100ms delay)
 *   verifyEmailToken(null)     — outer catch → VERIFICATION_ERROR (lines 222-241)
 *   getTokenInfo               — unknown token → null
 *   checkVerificationStatus    — unknown userId → {verified:false, error:'User not found'}
 *   cleanupExpiredTokens       — safe delete of already-expired rows, returns count shape
 *   createVerificationToken    — ghost UUID → count+findFirst safe, create→FK fail→catch
 *   resendVerificationEmail    — ghost UUID → user not found → AppError catch + re-throw
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateVerificationToken,
  hashVerificationToken,
  verifyEmailToken,
  getTokenInfo,
  checkVerificationStatus,
  cleanupExpiredTokens,
  createVerificationToken,
  resendVerificationEmail,
} from '../utils/emailVerificationService.mjs';

// Non-existent user UUID — never in the users table; count/findFirst queries
// return 0/null safely; create() hits FK constraint and throws.
const GHOST_UUID = '00000000-0000-0000-0000-ffffffffffff';

// ── generateVerificationToken ─────────────────────────────────────────────────

describe('generateVerificationToken()', () => {
  it('returns a 64-character hex string (32 bytes)', () => {
    const token = generateVerificationToken();
    expect(typeof token).toBe('string');
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it('produces unique values on successive calls', () => {
    const a = generateVerificationToken();
    const b = generateVerificationToken();
    expect(a).not.toBe(b);
  });
});

// ── hashVerificationToken ─────────────────────────────────────────────────────

describe('hashVerificationToken()', () => {
  it('returns a 64-character hex string (SHA-256)', () => {
    const hash = hashVerificationToken('test-token-value');
    expect(typeof hash).toBe('string');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it('is deterministic', () => {
    const token = 'same-input-token';
    expect(hashVerificationToken(token)).toBe(hashVerificationToken(token));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashVerificationToken('tokenA')).not.toBe(hashVerificationToken('tokenB'));
  });
});

// ── verifyEmailToken — invalid/unknown token path ─────────────────────────────

describe('verifyEmailToken() — unknown token', () => {
  it('returns success=false with INVALID_TOKEN code for an unknown token', async () => {
    const fakeToken = generateVerificationToken(); // valid format, unknown to DB
    const result = await verifyEmailToken(fakeToken);
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_TOKEN');
    expect(typeof result.error).toBe('string');
  }, 10000); // allow up to 10s for the 100ms timing-safe delay
});

// ── getTokenInfo — unknown token ──────────────────────────────────────────────

describe('getTokenInfo() — unknown token', () => {
  it('returns null for a token not in the database', async () => {
    const fakeToken = generateVerificationToken();
    const result = await getTokenInfo(fakeToken);
    expect(result).toBeNull();
  });
});

// ── checkVerificationStatus — non-existent user ───────────────────────────────

describe('checkVerificationStatus() — non-existent user', () => {
  it('returns verified=false and User not found error for unknown userId', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const result = await checkVerificationStatus(nonExistentId);
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/user not found/i);
  });
});

// ── cleanupExpiredTokens — safe DB call ───────────────────────────────────────

describe('cleanupExpiredTokens()', () => {
  it('returns removedCount (number) and cutoffDate with default options', async () => {
    const result = await cleanupExpiredTokens();
    expect(typeof result.removedCount).toBe('number');
    expect(result.removedCount).toBeGreaterThanOrEqual(0);
    expect(result.cutoffDate instanceof Date).toBe(true);
  });

  it('accepts custom olderThanDays', async () => {
    const result = await cleanupExpiredTokens({ olderThanDays: 60 });
    expect(typeof result.removedCount).toBe('number');
  });
});

// ── createVerificationToken — count+findFirst+create-FK-fail (lines 63-133) ───

describe('createVerificationToken() — safe DB paths (lines 63-133)', () => {
  it('throws when userId references a non-existent user (count→0, findFirst→null, create→FK fail→catch+rethrow)', async () => {
    // pendingTokens count=0 (no max-tokens error), recentToken=null (no cooldown),
    // then create() throws a FK constraint error which the catch re-throws.
    let thrown = false;
    try {
      await createVerificationToken(GHOST_UUID, 'ghost@example.com');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });
});

// ── verifyEmailToken — outer catch path (lines 222-241) ──────────────────────

describe('verifyEmailToken() — outer catch → VERIFICATION_ERROR', () => {
  it('returns VERIFICATION_ERROR when token is null (hashVerificationToken throws, caught at line 222)', async () => {
    const result = await verifyEmailToken(null);
    expect(result.success).toBe(false);
    expect(result.code).toBe('VERIFICATION_ERROR');
    expect(typeof result.error).toBe('string');
  });
});

// ── resendVerificationEmail — user-not-found path (lines 303-317, 345-348) ────

describe('resendVerificationEmail() — user not found (lines 303-317, 345-348)', () => {
  it('rejects when userId does not exist (findUnique→null→AppError→catch+rethrow)', async () => {
    let thrown = false;
    try {
      await resendVerificationEmail(GHOST_UUID);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });
});
