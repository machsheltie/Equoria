/**
 * passwordChangedAt cache (Equoria-2bbf) — integration test
 *
 * Verifies the in-memory TTL cache wired into authenticateToken:
 *   1. First request populates the cache from DB.
 *   2. Subsequent requests use the cached value (DB updates do NOT leak
 *      through until eviction or TTL expiry).
 *   3. evictPasswordChangedAtCache(userId) clears the entry so the next
 *      request reads the fresh DB value.
 *
 * This is the §2 sentinel-positive proof that the eviction mechanism
 * actually works: without explicit eviction, a stale cache would silently
 * accept tokens that should have been rejected after a password rotation.
 *
 * Real DB only — no mocks (per CLAUDE.md no-mocks doctrine).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { authenticateToken, evictPasswordChangedAtCache } from '../../../middleware/auth.mjs';

const SUITE_PREFIX = 'pwcache_';
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci';

function makeTracked(returnValue) {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
    return returnValue;
  };
  fn.mock = { calls };
  return fn;
}

function makeReqRes(token) {
  const req = {
    cookies: { accessToken: token },
    headers: {},
    method: 'GET',
    path: '/api/test',
    ip: '127.0.0.1',
  };
  const res = {
    _status: null,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
  const next = makeTracked(undefined);
  return { req, res, next };
}

describe('Equoria-2bbf — passwordChangedAt cache', () => {
  let testUser;

  beforeAll(async () => {
    // Clean any leftovers from prior crashed runs.
    await prisma.user.deleteMany({
      where: { email: { startsWith: SUITE_PREFIX } },
    });

    const ts = randomBytes(8).toString('hex');
    testUser = await prisma.user.create({
      data: {
        username: `${SUITE_PREFIX}${ts}`,
        email: `${SUITE_PREFIX}${ts}@example.com`,
        password: await bcrypt.hash('TestPassword123!', 1),
        firstName: 'Cache',
        lastName: 'Test',
        // passwordChangedAt deliberately omitted → null at start
      },
    });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  });

  it('evict clears the cache so the next request reads the fresh DB value', async () => {
    // Start each test with a clean cache slot for this user.
    evictPasswordChangedAtCache(testUser.id);

    const iatSec = Math.floor(Date.now() / 1000);
    const token = jwt.sign({ userId: testUser.id, iat: iatSec }, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '15m',
    });

    // Step 1: passwordChangedAt is null in DB. First request hits DB and
    // populates the cache with null. authenticateToken should call next()
    // (token accepted — null = no constraint).
    {
      const { req, res, next } = makeReqRes(token);
      await authenticateToken(req, res, next);
      expect(next.mock.calls.length).toBeGreaterThan(0);
      expect(next.mock.calls[0]).toEqual([]);
      expect(req.user.id).toBe(testUser.id);
      expect(res._status).not.toBe(401);
    }

    // Step 2: Mutate the DB directly — bypassing the controllers — to set
    // passwordChangedAt to 5 seconds in the FUTURE relative to the token's
    // iat. The DB now contains a value that, if read fresh, would cause the
    // middleware to reject the token (iat < floor(passwordChangedAt/1000)).
    // We do NOT call evict, simulating a direct DB write that the cache
    // doesn't know about (e.g., admin SQL, a future code path that forgets
    // to evict).
    const futurePwdChangedAt = new Date((iatSec + 5) * 1000);
    await prisma.user.update({
      where: { id: testUser.id },
      data: { passwordChangedAt: futurePwdChangedAt },
    });

    // Step 3: With the stale cache (still holding null), authenticateToken
    // should STILL accept the token. This proves the cache is being read
    // (the DB update is invisible to the middleware until the cache is
    // evicted or expires).
    {
      const { req, res, next } = makeReqRes(token);
      await authenticateToken(req, res, next);
      expect(next.mock.calls.length).toBeGreaterThan(0);
      expect(next.mock.calls[0]).toEqual([]);
      expect(req.user.id).toBe(testUser.id);
      expect(res._status).not.toBe(401);
    }

    // Step 4: Evict the cache entry. The next request should DB-read the
    // fresh passwordChangedAt and reject the token.
    evictPasswordChangedAtCache(testUser.id);

    {
      const { req, res, next } = makeReqRes(token);
      await authenticateToken(req, res, next);
      expect(next.mock.calls.length).toBe(0);
      expect(res._status).toBe(401);
      expect(res._body).toMatchObject({
        success: false,
        message: expect.stringMatching(/Session invalidated/i),
      });
    }

    // Cleanup: clear the future passwordChangedAt and the cache so adjacent
    // tests start from a clean slate.
    await prisma.user.update({
      where: { id: testUser.id },
      data: { passwordChangedAt: null },
    });
    evictPasswordChangedAtCache(testUser.id);
  });

  it('evict on a non-string userId is a no-op (does not throw)', () => {
    expect(() => evictPasswordChangedAtCache(undefined)).not.toThrow();
    expect(() => evictPasswordChangedAtCache(null)).not.toThrow();
    expect(() => evictPasswordChangedAtCache(123)).not.toThrow();
    expect(() => evictPasswordChangedAtCache('')).not.toThrow();
  });
});
