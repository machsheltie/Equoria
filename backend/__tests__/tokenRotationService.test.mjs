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

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import jwt from 'jsonwebtoken';
import {
  hashRefreshToken,
  generateTokenFamily,
  createTokenPair,
  validateRefreshToken,
  cleanupExpiredTokens,
  detectTokenReuse,
  invalidateTokenFamily,
  rotateRefreshToken,
} from '../utils/tokenRotationService.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

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

// ── createTokenPair — auto-generates familyId when not provided (line 147-149) ─

describe('createTokenPair() — familyId auto-generation branch (lines 147-149) (Equoria-jkht)', () => {
  let trsUser;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);
    trsUser = await prisma.user.create({
      data: {
        email: `trs-ctp-${ts}-${rand()}@test.com`,
        username: `trsctp${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'TRS',
        lastName: 'CTP',
        money: 0,
      },
    });
  }, 30000);

  afterAll(() => {
    // Fail-loud, FK-ordered, scoped cleanup (Equoria-1ohys). Tokens (children,
    // userId-scoped) before the user (parent, id-scoped). Previously two silent
    // no-op catch arms hid cleanup failures; now any failure throws (CLAUDE.md §2).
    cleanup.add(
      () => prisma.refreshToken.deleteMany({ where: { userId: trsUser.id } }),
      'refreshToken(userId)',
    );
    cleanup.add(() => prisma.user.delete({ where: { id: trsUser.id } }), 'user');
    return cleanup.run();
  }, 30000);

  it('auto-generates familyId when called without one (line 147-149)', async () => {
    const result = await createTokenPair(trsUser.id);
    expect(typeof result.accessToken).toBe('string');
    expect(result.accessToken.length).toBeGreaterThan(0);
    expect(typeof result.refreshToken).toBe('string');
    expect(result.refreshToken.length).toBeGreaterThan(0);
    expect(typeof result.familyId).toBe('string');
    expect(result.familyId).toContain('_');
  });
});

// ── validateRefreshToken — DB record status checks (lines 282-305) ────────────
// Covers: isActive=false (line 282), isInvalidated=true (line 290), expiresAt past (line 299)

describe('validateRefreshToken() — DB record status checks (lines 282-305) (Equoria-jkht)', () => {
  let vrtUser;
  const cleanup = createCleanupTracker();
  let inactiveToken;
  let invalidatedToken;
  let expiredToken;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    vrtUser = await prisma.user.create({
      data: {
        email: `trs-vrt-${ts}-${rand()}@test.com`,
        username: `trsvrt${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'VRT',
        lastName: 'Fixture',
        money: 0,
      },
    });

    // Token 1: will be set isActive=false
    const pair1 = await createTokenPair(vrtUser.id);
    inactiveToken = pair1.refreshToken;
    await prisma.refreshToken.update({
      where: { tokenHash: hashRefreshToken(inactiveToken) },
      data: { isActive: false },
    });

    // Token 2: will be set isInvalidated=true
    const pair2 = await createTokenPair(vrtUser.id);
    invalidatedToken = pair2.refreshToken;
    await prisma.refreshToken.update({
      where: { tokenHash: hashRefreshToken(invalidatedToken) },
      data: { isInvalidated: true },
    });

    // Token 3: will have expiresAt set to the past
    const pair3 = await createTokenPair(vrtUser.id);
    expiredToken = pair3.refreshToken;
    await prisma.refreshToken.update({
      where: { tokenHash: hashRefreshToken(expiredToken) },
      data: { expiresAt: new Date(Date.now() - 60 * 1000) },
    });
  }, 60000);

  afterAll(() => {
    // Fail-loud, FK-ordered, scoped cleanup (Equoria-1ohys). Tokens (children,
    // userId-scoped) before the user (parent, id-scoped). Previously two silent
    // no-op catch arms hid cleanup failures; now any failure throws (CLAUDE.md §2).
    cleanup.add(
      () => prisma.refreshToken.deleteMany({ where: { userId: vrtUser.id } }),
      'refreshToken(userId)',
    );
    cleanup.add(() => prisma.user.delete({ where: { id: vrtUser.id } }), 'user');
    return cleanup.run();
  }, 30000);

  it('returns isValid=false with "Token is inactive" when isActive=false (line 282-288)', async () => {
    const result = await validateRefreshToken(inactiveToken);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Token is inactive');
    expect(result.decoded).toBeNull();
  });

  it('returns isValid=false with "Token has been invalidated" when isInvalidated=true (lines 290-296)', async () => {
    const result = await validateRefreshToken(invalidatedToken);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Token has been invalidated');
    expect(result.decoded).toBeNull();
  });

  it('returns isValid=false with "Token has expired" when expiresAt is in the past (lines 299-305)', async () => {
    const result = await validateRefreshToken(expiredToken);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Token has expired');
    expect(result.decoded).toBeNull();
  });
});

// ── rotateRefreshToken + validateRefreshToken happy-path + detectTokenReuse first-use ─
// Shared fixture: one user, one token. Tests run sequentially within the describe:
//   1+2: read-only checks on fresh token1
//   3:   first rotation (token1 → isActive=false, isInvalidated=false)
//   4:   second rotation attempt → reuse detection fires (isReuse=true, familyId present)
//   5:   malformed token → isReuse=true, familyId=null (no-family branch)
//   6:   SESSION_UPGRADE_REQUIRED token → !validation.isValid branch (line 433-439)

describe('rotateRefreshToken + validateRefreshToken happy-path + detectTokenReuse first-use (Equoria-jkht)', () => {
  let rtUser;
  const cleanup = createCleanupTracker();
  let token1;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);
    rtUser = await prisma.user.create({
      data: {
        email: `trs-rot-${ts}-${rand()}@test.com`,
        username: `trsrot${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'ROT',
        lastName: 'Fixture',
        money: 0,
      },
    });
    const pair = await createTokenPair(rtUser.id);
    token1 = pair.refreshToken;
  }, 30000);

  afterAll(() => {
    // Fail-loud, FK-ordered, scoped cleanup (Equoria-1ohys). Tokens (children,
    // userId-scoped) before the user (parent, id-scoped). Previously two silent
    // no-op catch arms hid cleanup failures; now any failure throws (CLAUDE.md §2).
    cleanup.add(
      () => prisma.refreshToken.deleteMany({ where: { userId: rtUser.id } }),
      'refreshToken(userId)',
    );
    cleanup.add(() => prisma.user.delete({ where: { id: rtUser.id } }), 'user');
    return cleanup.run();
  }, 30000);

  it('validateRefreshToken: returns isValid=true with decoded+tokenRecord for a fresh active token (lines 307-312)', async () => {
    const result = await validateRefreshToken(token1);
    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.decoded).toBeDefined();
    expect(result.decoded.userId).toBe(rtUser.id);
    expect(result.tokenRecord).toBeDefined();
    expect(result.tokenRecord.isActive).toBe(true);
    expect(result.tokenRecord.isInvalidated).toBe(false);
  });

  it('detectTokenReuse: returns isReuse=false, reason="First use" for an active token not yet rotated (lines 384-390)', async () => {
    const result = await detectTokenReuse(token1);
    expect(result.isReuse).toBe(false);
    expect(result.reason).toBe('First use');
    expect(typeof result.familyId).toBe('string');
    expect(result.shouldInvalidateFamily).toBe(false);
  });

  it('rotateRefreshToken: success path — returns new token pair (lines 448-492)', async () => {
    const result = await rotateRefreshToken(token1);
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.newTokenPair).toBeDefined();
    expect(typeof result.newTokenPair.refreshToken).toBe('string');
    expect(result.familyInvalidated).toBe(false);
    // token1 is now isActive=false, isInvalidated=false — next test uses this state
  });

  it('rotateRefreshToken: reuse with familyId — success=false, familyInvalidated=true (lines 411-427)', async () => {
    // token1 is isActive=false after the previous rotation → reuse detected with familyId present
    const result = await rotateRefreshToken(token1);
    expect(result.success).toBe(false);
    expect(result.familyInvalidated).toBe(true);
    expect(result.newTokenPair).toBeNull();
  });

  it('rotateRefreshToken: isReuse=true with familyId=null (malformed JWT) — success=false, familyInvalidated=true (lines 411-416 false branch)', async () => {
    // detectTokenReuse sees no record → {isReuse: true, familyId: null} → skips invalidateTokenFamily
    const result = await rotateRefreshToken('not.a.real.jwt');
    expect(result.success).toBe(false);
    expect(result.familyInvalidated).toBe(true);
  });

  it('rotateRefreshToken: !validation.isValid path — success=false, familyInvalidated=false (lines 431-439)', async () => {
    // GHOST_USER_ID: detectTokenReuse → isReuse=false (SESSION_UPGRADE), then
    // validateRefreshToken → isValid=false → !validation.isValid branch fires
    const token = signRefreshToken({ userId: GHOST_USER_ID, type: 'refresh' });
    const result = await rotateRefreshToken(token);
    expect(result.success).toBe(false);
    expect(result.familyInvalidated).toBe(false);
    expect(result.error).toBe('SESSION_UPGRADE_REQUIRED');
  });
});
