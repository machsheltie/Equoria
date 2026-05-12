/**
 * tokenRotationService — pure-function + safe-DB branch-coverage tests (Equoria-rr7)
 *
 * Pure functions (no DB):
 *   hashRefreshToken   — deterministic SHA-256 output
 *   generateTokenFamily — format, uniqueness
 *   validateRefreshToken — null/non-string guard, JWT-verify failure (no DB lookup needed)
 *
 * Safe DB (no fixtures needed — "not found" paths / cleanup with empty result):
 *   cleanupExpiredTokens — returns count shape, 0 if nothing to clean
 *   validateRefreshToken — type-check fail + SESSION_UPGRADE_REQUIRED paths
 *   detectTokenReuse    — catch path (null), token-not-found, SESSION_UPGRADE_REQUIRED
 *   invalidateTokenFamily — nonexistent family (updateMany returns 0)
 */

import { describe, it, expect } from '@jest/globals';
import jwt from 'jsonwebtoken';
import {
  hashRefreshToken,
  generateTokenFamily,
  validateRefreshToken,
  cleanupExpiredTokens,
  detectTokenReuse,
  invalidateTokenFamily,
} from '../../utils/tokenRotationService.mjs';

// Synthetic UUID — never created in the real DB; all refreshToken.count queries
// for this userId will return 0, triggering SESSION_UPGRADE_REQUIRED paths.
const GHOST_USER_ID = '00000000-0000-0000-0000-000000000099';

function signRefreshToken(payload) {
  return jwt.sign(
    { familyId: 'test-family-ghost', jti: `jti-${Date.now()}`, ...payload },
    process.env.JWT_REFRESH_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' },
  );
}

// ── hashRefreshToken ──────────────────────────────────────────────────────────

describe('hashRefreshToken()', () => {
  it('returns a 64-character hex string (SHA-256)', () => {
    const result = hashRefreshToken('some-token-value');
    expect(typeof result).toBe('string');
    expect(result).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(result)).toBe(true);
  });

  it('is deterministic — same input always produces same hash', () => {
    const token = 'test-refresh-token-abc123';
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashRefreshToken('tokenA')).not.toBe(hashRefreshToken('tokenB'));
  });
});

// ── generateTokenFamily ───────────────────────────────────────────────────────

describe('generateTokenFamily()', () => {
  it('returns a non-empty string', () => {
    const result = generateTokenFamily();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('contains an underscore separator (timestamp_randomHex format)', () => {
    const result = generateTokenFamily();
    expect(result).toContain('_');
  });

  it('produces unique values on successive calls', () => {
    const a = generateTokenFamily();
    const b = generateTokenFamily();
    expect(a).not.toBe(b);
  });
});

// ── validateRefreshToken — guard branches (no DB needed) ─────────────────────

describe('validateRefreshToken() — guard branches', () => {
  it('returns isValid=false for null token (!token guard)', async () => {
    const result = await validateRefreshToken(null);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid token format');
    expect(result.decoded).toBeNull();
  });

  it('returns isValid=false for undefined token', async () => {
    const result = await validateRefreshToken(undefined);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid token format');
  });

  it('returns isValid=false for numeric token (typeof !== string)', async () => {
    const result = await validateRefreshToken(12345);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid token format');
  });

  it('returns isValid=false for a malformed JWT string (jwt.verify failure branch)', async () => {
    const result = await validateRefreshToken('this.is.not.a.valid.jwt');
    expect(result.isValid).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.error.length).toBeGreaterThan(0);
    expect(result.decoded).toBeNull();
  });
});

// ── cleanupExpiredTokens — safe DB call ───────────────────────────────────────

describe('cleanupExpiredTokens()', () => {
  it('returns removedCount (number) and cutoffDate when called with defaults', async () => {
    const result = await cleanupExpiredTokens();
    expect(typeof result.removedCount).toBe('number');
    expect(result.removedCount).toBeGreaterThanOrEqual(0);
    expect(result.cutoffDate instanceof Date).toBe(true);
  });

  it('accepts custom olderThanDays option', async () => {
    const result = await cleanupExpiredTokens({ olderThanDays: 90 });
    expect(typeof result.removedCount).toBe('number');
  });
});

// ── validateRefreshToken — DB paths (lines 244-280) ──────────────────────────

describe('validateRefreshToken() — DB paths', () => {
  it('returns isValid=false, error="Invalid token type" for a correctly-signed access JWT (type check, line 245)', async () => {
    const token = signRefreshToken({ userId: GHOST_USER_ID, type: 'access' });
    const result = await validateRefreshToken(token);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid token type');
    expect(result.decoded).toBeNull();
  });

  it('returns SESSION_UPGRADE_REQUIRED when refresh JWT is not in DB (user has 0 tokens, lines 258-279)', async () => {
    const token = signRefreshToken({ userId: GHOST_USER_ID, type: 'refresh' });
    const result = await validateRefreshToken(token);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('SESSION_UPGRADE_REQUIRED');
    expect(result.decoded).toBeNull();
  });
});

// ── detectTokenReuse — all branches (lines 327-399) ──────────────────────────

describe('detectTokenReuse()', () => {
  it('returns isReuse=true, reason="Detection error" when token is null (catch path, lines 391-399)', async () => {
    // validateRefreshToken(null) returns guard-error, then hashRefreshToken(null) throws
    const result = await detectTokenReuse(null);
    expect(result.isReuse).toBe(true);
    expect(result.reason).toBe('Detection error');
    expect(result.familyId).toBeNull();
    expect(result.shouldInvalidateFamily).toBe(false);
  });

  it('returns isReuse=true, reason="Token not found" for a malformed string not in DB (lines 349-355)', async () => {
    const result = await detectTokenReuse('this.is.not.a.valid.jwt');
    expect(result.isReuse).toBe(true);
    expect(result.reason).toBe('Token not found');
    expect(result.familyId).toBeNull();
    expect(result.shouldInvalidateFamily).toBe(false);
  });

  it('returns isReuse=false, reason="SESSION_UPGRADE_REQUIRED" for valid refresh JWT with no DB tokens (lines 334-341)', async () => {
    // GHOST_USER_ID has 0 tokens → validateRefreshToken returns SESSION_UPGRADE_REQUIRED
    const token = signRefreshToken({ userId: GHOST_USER_ID, type: 'refresh' });
    const result = await detectTokenReuse(token);
    expect(result.isReuse).toBe(false);
    expect(result.reason).toBe('SESSION_UPGRADE_REQUIRED');
    expect(result.shouldInvalidateFamily).toBe(false);
    expect(result.familyId).toBeNull();
  });

  it('returns isReuse=true, reason="Token not found" for access-type JWT signed with refresh secret (not SESSION_UPGRADE path)', async () => {
    // validateRefreshToken returns "Invalid token type" — not SESSION_UPGRADE_REQUIRED
    // so detectTokenReuse continues, hashes the token, DB returns null → "Token not found"
    const token = signRefreshToken({ userId: GHOST_USER_ID, type: 'access' });
    const result = await detectTokenReuse(token);
    expect(result.isReuse).toBe(true);
    expect(result.reason).toBe('Token not found');
  });
});

// ── invalidateTokenFamily — nonexistent family (safe DB write) ────────────────

describe('invalidateTokenFamily()', () => {
  it('returns success=true, invalidatedCount=0 for a non-existent family ID', async () => {
    const result = await invalidateTokenFamily(`nonexistent-family-${Date.now()}`);
    expect(result.success).toBe(true);
    expect(result.invalidatedCount).toBe(0);
    expect(typeof result.familyId).toBe('string');
  });

  it('returns shape with success, invalidatedCount, familyId', async () => {
    const familyId = `nonexistent-family-shape-${Date.now()}`;
    const result = await invalidateTokenFamily(familyId);
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('invalidatedCount', 0);
    expect(result).toHaveProperty('familyId', familyId);
  });
});
