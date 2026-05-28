/**
 * Sentinel-positive coverage for refresh-token entropy padding
 * (Equoria-hmp59). The legacy `Math.random().toString(36).substring(2)`
 * produces a base36 string of length 0-11 with uneven length distribution
 * and predictable bit-level structure (V8 Xorshift128+). The fix is
 * `crypto.randomBytes(16).toString('hex')` — a CSPRNG-derived, fixed-
 * length, uniformly distributed 32-character hex string.
 *
 * These tests fail before the fix and pass after it. They lock in:
 *   1) `random` field is a fixed-length hex string (length === 32, only
 *      [0-9a-f]). This alone catches a regression to Math.random().toString(36),
 *      which produces variable length and includes letters g-z.
 *   2) No collisions across 10,000 tokens.
 *   3) Byte-level distribution: each of the 16 hex bytes is roughly
 *      uniform across 256 values (chi-square on the first byte ≪ critical
 *      value at p=0.001). This catches a regression to a weak PRNG.
 *
 * Per the Equoria Testing Philosophy: no mocks, no skips, no bypasses.
 *
 * @module __tests__/middleware/refreshTokenEntropy
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';
const TEST_JWT_SECRET = process.env.JWT_SECRET;

import { describe, it, expect } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { generateRefreshToken } from '../../middleware/auth.mjs';

describe('generateRefreshToken — entropy padding (Equoria-hmp59)', () => {
  it('emits a fixed-length 32-character lowercase hex `random` field', () => {
    const token = generateRefreshToken({ userId: 'abc' });
    const decoded = jwt.verify(token, TEST_JWT_SECRET, { algorithms: ['HS256'] });
    expect(typeof decoded.random).toBe('string');
    // 16 bytes → 32 hex chars. Math.random().toString(36).substring(2) is
    // typically length 11 and uses [0-9a-z].
    expect(decoded.random).toMatch(/^[0-9a-f]{32}$/);
  });

  it('produces no collisions across 10,000 generated tokens', () => {
    const seen = new Set();
    for (let i = 0; i < 10_000; i++) {
      const token = generateRefreshToken({ userId: 'abc' });
      const decoded = jwt.verify(token, TEST_JWT_SECRET, { algorithms: ['HS256'] });
      seen.add(decoded.random);
    }
    expect(seen.size).toBe(10_000);
  });

  it('first byte distribution passes a chi-square uniformity check', () => {
    // 4,000 samples across 256 bins → expected count ~15.625 per bin.
    // Critical chi-square at df=255, p=0.001 is ≈ 343. CSPRNG samples land
    // well below; V8 Math.random() base36 cannot produce this distribution
    // at the byte level because base36 collapses 8 bits into one of 36
    // characters non-uniformly.
    const N = 4000;
    const counts = new Array(256).fill(0);
    for (let i = 0; i < N; i++) {
      const token = generateRefreshToken({ userId: 'abc' });
      const decoded = jwt.verify(token, TEST_JWT_SECRET, { algorithms: ['HS256'] });
      const firstByte = parseInt(decoded.random.slice(0, 2), 16);
      counts[firstByte] += 1;
    }
    const expected = N / 256;
    let chi = 0;
    for (let i = 0; i < 256; i++) {
      const diff = counts[i] - expected;
      chi += (diff * diff) / expected;
    }
    expect(chi).toBeLessThan(343);
  });
});
