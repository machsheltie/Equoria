/**
 * tokenRotationService — gap-fill coverage tests (Equoria-rr7)
 *
 * Targets uncovered lines NOT reached by the existing test files that together
 * achieve ~83.58% line coverage:
 *   modules/services/__tests__/tokenRotationService.test.mjs
 *   modules/auth/__tests__/token-rotation.test.mjs
 *
 * Uncovered lines targeted here:
 *
 *   226-229  createTokenPair() outer catch + re-throw
 *            → temporarily unset JWT_SECRET so jwt.sign() inside
 *              _buildSignedTokenPair throws, propagating to the outer catch
 *              (which logs + re-throws). Deterministic; does NOT depend on the
 *              removed ensureUserExists()/prisma.user.create() path (Equoria-x243u)
 *              or on Prisma validation behavior. See the inline note below.
 *
 * Additional branches exercised for robustness:
 *   hashRefreshToken edge inputs, generateTokenFamily format checks,
 *   cleanupExpiredTokens boundary values, invalidateTokenFamily edge cases,
 *   validateRefreshToken non-string input types.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  createTokenPair,
  hashRefreshToken,
  generateTokenFamily,
  validateRefreshToken,
  cleanupExpiredTokens,
  invalidateTokenFamily,
} from '../utils/tokenRotationService.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

// ── createTokenPair() outer-catch path (lines 226-229) ───────────────────────
// Temporarily unsetting JWT_SECRET causes jwt.sign() inside _buildSignedTokenPair
// to throw "secretOrPrivateKey must have a value". Since _buildSignedTokenPair is
// called inside the outer try (line 165), this propagates to the outer catch
// (line 226), which logs the error (line 227) and re-throws (line 228).
// This is deterministic and does not depend on Prisma validation behavior.

describe('createTokenPair() — outer-catch re-throw (lines 226-229)', () => {
  it('throws when JWT_SECRET is unset (jwt.sign throws inside _buildSignedTokenPair, outer catch re-throws)', async () => {
    const savedSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = ''; // empty string → jwt.sign throws "secretOrPrivateKey must have a value"
    try {
      await expect(createTokenPair('some-user-id')).rejects.toThrow();
    } finally {
      process.env.JWT_SECRET = savedSecret;
    }
  });

  it('thrown error is an Error instance (outer catch at lines 226-228 re-throws)', async () => {
    const savedSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = '';
    let caught = null;
    try {
      await createTokenPair('some-user-id');
    } catch (err) {
      caught = err;
    } finally {
      process.env.JWT_SECRET = savedSecret;
    }
    expect(caught).not.toBeNull();
    expect(caught instanceof Error).toBe(true);
  });
});

// ── hashRefreshToken() — additional paths ────────────────────────────────────

describe('hashRefreshToken() — edge inputs', () => {
  it('returns consistent 64-char hex for empty string', () => {
    const result = hashRefreshToken('');
    expect(result).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(result)).toBe(true);
    // SHA-256 of empty string is a known constant
    expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('handles unicode string input without throwing', () => {
    const result = hashRefreshToken('tëst-tøkën');
    expect(result).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(result)).toBe(true);
  });
});

// ── generateTokenFamily() — format validation ─────────────────────────────────

describe('generateTokenFamily() — format validation', () => {
  it('random part (after underscore) is 32 hex chars (16 random bytes)', () => {
    const family = generateTokenFamily();
    const parts = family.split('_');
    expect(parts.length).toBeGreaterThanOrEqual(2);
    const hexPart = parts[parts.length - 1];
    expect(/^[0-9a-f]+$/.test(hexPart)).toBe(true);
    expect(hexPart.length).toBe(32);
  });

  it('first segment is a base-36 timestamp (non-empty, alphanumeric)', () => {
    const family = generateTokenFamily();
    const timestampPart = family.split('_')[0];
    expect(timestampPart.length).toBeGreaterThan(0);
    expect(/^[0-9a-z]+$/.test(timestampPart)).toBe(true);
  });
});

// ── cleanupExpiredTokens() — boundary olderThanDays values ───────────────────

describe('cleanupExpiredTokens() — boundary values', () => {
  it('returns valid shape with olderThanDays=1', async () => {
    const result = await cleanupExpiredTokens({ olderThanDays: 1 });
    expect(typeof result.removedCount).toBe('number');
    expect(result.removedCount).toBeGreaterThanOrEqual(0);
    expect(result.cutoffDate instanceof Date).toBe(true);
  });

  it('returns valid shape with olderThanDays=365', async () => {
    const result = await cleanupExpiredTokens({ olderThanDays: 365 });
    expect(typeof result.removedCount).toBe('number');
    expect(result.cutoffDate instanceof Date).toBe(true);
  });

  it('expiredCount equals removedCount (simplified implementation)', async () => {
    const result = await cleanupExpiredTokens();
    expect(result.expiredCount).toBe(result.removedCount);
    expect(result.invalidatedCount).toBe(0);
  });
});

// ── invalidateTokenFamily() — edge cases ─────────────────────────────────────

describe('invalidateTokenFamily() — edge cases', () => {
  it('handles an unlikely familyId with no rows (count=0)', async () => {
    // Equoria-qmze: collision-safe fixture ID via randomBytes (replaces
    // Date.now()+Math.random() which Equoria-3gti flagged as flake-prone).
    const testFamilyId = `gap-test-family-${randomBytes(8).toString('hex')}`;
    const result = await invalidateTokenFamily(testFamilyId);
    expect(result.success).toBe(true);
    expect(result.invalidatedCount).toBe(0);
  });

  it('returns familyId in response matching the input', async () => {
    const testFamilyId = `gap-fid-${randomBytes(8).toString('hex')}`;
    const result = await invalidateTokenFamily(testFamilyId);
    expect(result.familyId).toBe(testFamilyId);
    expect(result.success).toBe(true);
  });
});

// ── validateRefreshToken() — non-string input types ──────────────────────────

describe('validateRefreshToken() — non-string input types', () => {
  it('returns isValid=false for an object input (typeof !== string)', async () => {
    const result = await validateRefreshToken({ token: 'value' });
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid token format');
  });

  it('returns isValid=false for an array input', async () => {
    const result = await validateRefreshToken(['bearer', 'token']);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid token format');
  });

  it('returns isValid=false for boolean false', async () => {
    const result = await validateRefreshToken(false);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid token format');
  });
});

// ── createTokenPair() — with real DB user (full success path) ─────────────────

describe('createTokenPair() — with real DB user (Equoria-rr7 gap coverage)', () => {
  let gapUser = null;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    // Equoria-qmze: collision-safe fixture ID via randomBytes.
    const rand = randomBytes(8).toString('hex');
    gapUser = await prisma.user.create({
      data: {
        email: `trs-gap-${rand}@test.invalid`,
        username: `trsgap${rand}`.slice(0, 50),
        password: 'test-hash',
        firstName: 'Gap',
        lastName: 'Test',
        money: 0,
      },
    });
  }, 30000);

  afterAll(() => {
    // Fail-loud, FK-ordered, scoped cleanup (Equoria-1ohys). Tokens (children,
    // userId-scoped) are deleted before the user (parent, id-scoped). These two
    // deletes previously used silent no-op catch arms that hid cleanup failures;
    // now any failure throws so a leaked fixture surfaces (CLAUDE.md §2).
    if (gapUser) {
      cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: gapUser.id } }), 'refreshToken(userId)');
      cleanup.add(() => prisma.user.delete({ where: { id: gapUser.id } }), 'user');
    }
    return cleanup.run();
  }, 30000);

  it('returns accessToken, refreshToken, familyId all as non-empty strings', async () => {
    const result = await createTokenPair(gapUser.id);
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
    expect(typeof result.familyId).toBe('string');
    expect(result.accessToken.length).toBeGreaterThan(50);
    expect(result.refreshToken.length).toBeGreaterThan(50);
  });

  it('explicit familyId is preserved in the returned pair', async () => {
    const family = generateTokenFamily();
    const result = await createTokenPair(gapUser.id, family);
    expect(result.familyId).toBe(family);
  });

  it('role is embedded in access token when provided', async () => {
    const result = await createTokenPair(gapUser.id, undefined, 'admin');
    const decoded = jwt.decode(result.accessToken);
    expect(decoded.role).toBe('admin');
    expect(decoded.userId).toBe(gapUser.id);
  });

  it('access token does not embed role when omitted', async () => {
    const result = await createTokenPair(gapUser.id);
    const decoded = jwt.decode(result.accessToken);
    expect(decoded.role).toBeUndefined();
    expect(decoded.type).toBe('access');
  });
});
