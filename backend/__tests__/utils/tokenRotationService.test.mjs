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
 *   validateRefreshToken — malformed JWT path
 */

import { describe, it, expect } from '@jest/globals';
import {
  hashRefreshToken,
  generateTokenFamily,
  validateRefreshToken,
  cleanupExpiredTokens,
} from '../../utils/tokenRotationService.mjs';

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
