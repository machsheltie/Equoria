/**
 * REAL-DB COVERAGE TESTS: middleware/auth.mjs
 *
 * Equoria-fzt5. The named auth security suite (auth-bypass-attempts.test.mjs)
 * exercises only a thin HTTP-stack slice of auth.mjs (~10% line coverage per
 * the coverage-security artifact). This suite invokes the exported middleware
 * functions DIRECTLY against the real database (no Prisma mocks, no bypass
 * headers) to cover every real branch:
 *
 *   - authenticateToken: cookie token, Bearer header token, non-Bearer header
 *     rejection, missing/null/undefined token, missing JWT_SECRET, undecodable
 *     token, expired (precheck + verify), algorithm-confusion rejection,
 *     max-session-age cap, userId→id mapping, passwordChangedAt cache
 *     (miss→DB→hit), CWE-613 iat-predates-rotation rejection, fail-closed on
 *     DB lookup error, generic unexpected-error catch.
 *   - requireRole: no req.user, role present in token, role absent → DB
 *     lookup, DB-lookup fail-closed (500), insufficient permissions (403),
 *     authorized path, non-AppError catch (500).
 *   - generateToken / generateRefreshToken: success + missing-secret throw.
 *   - evictPasswordChangedAtCache: valid id, invalid id (no-op).
 *
 * Real-DB, no-mocks per project Testing Philosophy.
 *
 * @module __tests__/middleware/authMiddlewareCoverage
 */

// JWT_SECRET must be set BEFORE auth.mjs is imported (it reads process.env at
// call time, but pinning here keeps token signing and verification in lockstep
// regardless of which jest config / shell env is active).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';
const TEST_JWT_SECRET = process.env.JWT_SECRET;

import { describe, it, expect, afterAll, beforeEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import prisma from '../../db/index.mjs';
import {
  authenticateToken,
  requireRole,
  generateToken,
  generateRefreshToken,
  evictPasswordChangedAtCache,
} from '../../middleware/auth.mjs';

/** Build a minimal Express-like res spy. */
function makeRes() {
  const res = {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

/** Build a minimal req. */
function makeReq({ cookies, headers, user } = {}) {
  return {
    method: 'GET',
    path: '/test',
    ip: '127.0.0.1',
    cookies: cookies || {},
    headers: headers || {},
    user,
  };
}

function uniqueEmail() {
  return `TestFixture-fzt5-${randomBytes(8).toString('hex')}@example.com`;
}

describe('auth.mjs middleware — real-DB coverage (Equoria-fzt5)', () => {
  const createdUserIds = [];

  async function createUser(overrides = {}) {
    const u = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: `TestFixture-fzt5-${randomBytes(8).toString('hex')}`,
        password: 'hashedPasswordPlaceholder',
        firstName: 'Test',
        lastName: 'Fixture',
        emailVerified: true,
        ...overrides,
      },
    });
    createdUserIds.push(u.id);
    return u;
  }

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  // -----------------------------------------------------------------------
  // authenticateToken
  // -----------------------------------------------------------------------
  describe('authenticateToken', () => {
    let user;
    beforeEach(async () => {
      user = await createUser();
      // Ensure no stale cache entry from a prior test of the same UUID space.
      evictPasswordChangedAtCache(user.id);
    });

    it('accepts a valid token from httpOnly cookie and populates req.user', async () => {
      const token = jwt.sign({ userId: user.id }, TEST_JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '15m',
      });
      const req = makeReq({ cookies: { accessToken: token } });
      const res = makeRes();
      let nextCalled = false;
      await authenticateToken(req, res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(true);
      expect(req.user.id).toBe(user.id);
      expect(res.statusCode).toBeUndefined();
    });

    it('accepts a valid token from Bearer Authorization header', async () => {
      const token = jwt.sign({ userId: user.id }, TEST_JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '15m',
      });
      const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
      const res = makeRes();
      let nextCalled = false;
      await authenticateToken(req, res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(true);
      expect(req.user.id).toBe(user.id);
    });

    it('maps decoded.id to req.user.id when userId is absent', async () => {
      const token = jwt.sign({ id: user.id }, TEST_JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '15m',
      });
      const req = makeReq({ cookies: { accessToken: token } });
      const res = makeRes();
      let nextCalled = false;
      await authenticateToken(req, res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(true);
      expect(req.user.id).toBe(user.id);
    });

    it('falls into the outer catch (401) on an unexpected error', async () => {
      // A req whose `cookies` getter throws drives an unexpected error before
      // any guarded path — the outer try/catch must still respond 401, never
      // leak the stack or fall through.
      const res = makeRes();
      const req = {
        method: 'GET',
        path: '/test',
        ip: '127.0.0.1',
        headers: {},
        get cookies() {
          throw new Error('synthetic unexpected failure');
        },
      };
      let nextCalled = false;
      await authenticateToken(req, res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Invalid or expired token');
    });

    it('rejects a non-Bearer Authorization header with 401', async () => {
      const req = makeReq({ headers: { authorization: 'Basic abc123' } });
      const res = makeRes();
      let nextCalled = false;
      await authenticateToken(req, res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Access token is required');
    });

    it('rejects when no token is present', async () => {
      const req = makeReq();
      const res = makeRes();
      await authenticateToken(req, res, () => {});
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Access token is required');
    });

    it('rejects the literal "null" token string', async () => {
      const req = makeReq({ cookies: { accessToken: 'null' } });
      const res = makeRes();
      await authenticateToken(req, res, () => {});
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Access token is required');
    });

    it('returns 500 when JWT_SECRET is not configured', async () => {
      const saved = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      try {
        const req = makeReq({ cookies: { accessToken: 'something' } });
        const res = makeRes();
        await authenticateToken(req, res, () => {});
        expect(res.statusCode).toBe(500);
        expect(res.body.message).toBe('Authentication configuration error');
      } finally {
        process.env.JWT_SECRET = saved;
      }
    });

    it('rejects an undecodable garbage token', async () => {
      const req = makeReq({ cookies: { accessToken: 'not-a-jwt' } });
      const res = makeRes();
      await authenticateToken(req, res, () => {});
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Invalid or expired token');
    });

    it('rejects an expired token via the decode precheck', async () => {
      // exp in the past, signed with current secret so decode() succeeds.
      const token = jwt.sign({ userId: user.id, exp: Math.floor(Date.now() / 1000) - 10 }, TEST_JWT_SECRET, {
        algorithm: 'HS256',
      });
      const req = makeReq({ cookies: { accessToken: token } });
      const res = makeRes();
      await authenticateToken(req, res, () => {});
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Token expired');
    });

    it('rejects a token signed with the wrong secret (verify failure)', async () => {
      const token = jwt.sign({ userId: user.id }, 'a-different-wrong-secret', {
        algorithm: 'HS256',
        expiresIn: '15m',
      });
      const req = makeReq({ cookies: { accessToken: token } });
      const res = makeRes();
      await authenticateToken(req, res, () => {});
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Invalid or expired token');
    });

    it('rejects an algorithm-confusion token (HS512 not in allow-list)', async () => {
      const token = jwt.sign({ userId: user.id }, TEST_JWT_SECRET, {
        algorithm: 'HS512',
        expiresIn: '15m',
      });
      const req = makeReq({ cookies: { accessToken: token } });
      const res = makeRes();
      await authenticateToken(req, res, () => {});
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Invalid or expired token');
    });

    it('rejects a session older than the 7-day absolute max age', async () => {
      // Valid signature & not expired (long expiry) but iat well over 7 days old.
      const oldIat = Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60;
      const token = jwt.sign({ userId: user.id, iat: oldIat }, TEST_JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '30d',
      });
      const req = makeReq({ cookies: { accessToken: token } });
      const res = makeRes();
      await authenticateToken(req, res, () => {});
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Session expired. Please login again.');
    });

    it('rejects a token whose iat predates passwordChangedAt (CWE-613)', async () => {
      // Stamp a passwordChangedAt in the future relative to the token iat.
      const future = new Date(Date.now() + 60_000);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordChangedAt: future },
      });
      evictPasswordChangedAtCache(user.id);
      const token = jwt.sign({ userId: user.id, iat: Math.floor(Date.now() / 1000) - 10 }, TEST_JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '15m',
      });
      const req = makeReq({ cookies: { accessToken: token } });
      const res = makeRes();
      await authenticateToken(req, res, () => {});
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Session invalidated. Please login again.');
    });

    it('accepts when iat is after passwordChangedAt, and the second call hits the TTL cache', async () => {
      const past = new Date(Date.now() - 60_000);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordChangedAt: past },
      });
      evictPasswordChangedAtCache(user.id);
      const token = jwt.sign({ userId: user.id }, TEST_JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '15m',
      });

      // First call: cache miss → DB read → cache populate.
      const req1 = makeReq({ cookies: { accessToken: token } });
      const res1 = makeRes();
      let next1 = false;
      await authenticateToken(req1, res1, () => {
        next1 = true;
      });
      expect(next1).toBe(true);

      // Second call: cache hit (exercises getCachedPasswordChangedAt hit path).
      const req2 = makeReq({ cookies: { accessToken: token } });
      const res2 = makeRes();
      let next2 = false;
      await authenticateToken(req2, res2, () => {
        next2 = true;
      });
      expect(next2).toBe(true);
    });

    it('accepts a token for a user with null passwordChangedAt (never rotated)', async () => {
      // Fresh user defaults to null passwordChangedAt.
      const fresh = await createUser();
      evictPasswordChangedAtCache(fresh.id);
      const token = jwt.sign({ userId: fresh.id }, TEST_JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '15m',
      });
      const req = makeReq({ cookies: { accessToken: token } });
      const res = makeRes();
      let nextCalled = false;
      await authenticateToken(req, res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(true);
    });

    // NOTE: authenticateToken's passwordChangedAt fail-closed catch (lines
    // 199-207) guards on `typeof user.id === 'string'` BEFORE the DB call, so
    // a token payload alone cannot drive Prisma to throw (User.id is a plain
    // String column — any string, valid-UUID-shaped or not, resolves to null
    // without error). Triggering that branch requires an actual DB-connectivity
    // failure, which the no-mock real-DB philosophy intentionally does not
    // simulate by stubbing Prisma. The symmetric, reachable fail-closed branch
    // in requireRole IS exercised below (req.user.id has no string-type guard).
    // This is documented as a known coverage gap on a defensive branch that is
    // unreachable through request input by design.
  });

  // -----------------------------------------------------------------------
  // requireRole
  // -----------------------------------------------------------------------
  describe('requireRole', () => {
    it('returns 401 when req.user is missing', async () => {
      const req = makeReq();
      const res = makeRes();
      await requireRole('admin')(req, res, () => {});
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Authentication required');
    });

    it('authorizes when role is already present in req.user (no DB lookup)', async () => {
      const req = makeReq({ user: { id: 'irrelevant', role: 'admin' } });
      const res = makeRes();
      let nextCalled = false;
      await requireRole('admin', 'moderator')(req, res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(true);
      expect(res.statusCode).toBeUndefined();
    });

    it('falls back to a DB lookup when role is absent on the token', async () => {
      const adminUser = await createUser({ role: 'admin' });
      const req = makeReq({ user: { id: adminUser.id } });
      const res = makeRes();
      let nextCalled = false;
      await requireRole('admin')(req, res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(true);
      expect(req.user.role).toBe('admin');
    });

    it('returns 403 for a valid user whose role is not permitted', async () => {
      const normalUser = await createUser({ role: 'user' });
      const req = makeReq({ user: { id: normalUser.id } });
      const res = makeRes();
      let nextCalled = false;
      await requireRole('admin')(req, res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe('Insufficient permissions');
    });

    it('returns 500 via the non-AppError catch when a downstream throws a plain Error', async () => {
      // next() is invoked inside the try; a plain (non-AppError) throw from it
      // must be caught and converted to a 500 generic envelope, not rethrown.
      const req = makeReq({ user: { id: 'irrelevant', role: 'admin' } });
      const res = makeRes();
      await requireRole('admin')(req, res, () => {
        throw new Error('synthetic downstream failure');
      });
      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe('Authorization error');
    });

    it('fails closed with 500 when the role DB lookup errors', async () => {
      // req.user.id has no string-type guard before the findUnique, so passing
      // a non-string value makes Prisma throw a real PrismaClientValidationError
      // (no mock). The fail-closed catch must return 500, not fall through to a
      // misleading 403 (Equoria-f8bp).
      const req = makeReq({ user: { id: { malformed: true } } });
      const res = makeRes();
      let nextCalled = false;
      await requireRole('admin')(req, res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe('Role verification unavailable. Please retry.');
    });
  });

  // -----------------------------------------------------------------------
  // generateToken / generateRefreshToken
  // -----------------------------------------------------------------------
  describe('generateToken / generateRefreshToken', () => {
    it('generates a verifiable HS256 access token', () => {
      const token = generateToken({ userId: 'abc' }, '1h');
      const decoded = jwt.verify(token, TEST_JWT_SECRET, { algorithms: ['HS256'] });
      expect(decoded.userId).toBe('abc');
    });

    it('throws when JWT_SECRET is not configured', () => {
      const saved = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      try {
        expect(() => generateToken({ userId: 'abc' })).toThrow('JWT_SECRET not configured');
      } finally {
        process.env.JWT_SECRET = saved;
      }
    });

    it('generates a refresh token carrying the uniqueness payload', () => {
      const token = generateRefreshToken({ userId: 'abc' });
      const decoded = jwt.verify(token, TEST_JWT_SECRET, { algorithms: ['HS256'] });
      expect(decoded.userId).toBe('abc');
      expect(typeof decoded.timestamp).toBe('number');
      expect(typeof decoded.random).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // evictPasswordChangedAtCache
  // -----------------------------------------------------------------------
  describe('evictPasswordChangedAtCache', () => {
    it('is a no-op for non-string / empty ids (does not throw)', () => {
      expect(() => evictPasswordChangedAtCache(undefined)).not.toThrow();
      expect(() => evictPasswordChangedAtCache(null)).not.toThrow();
      expect(() => evictPasswordChangedAtCache(123)).not.toThrow();
      expect(() => evictPasswordChangedAtCache('')).not.toThrow();
    });

    it('evicts a populated cache entry so the next auth call re-reads the DB', async () => {
      const u = await createUser();
      const token = jwt.sign({ userId: u.id }, TEST_JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '15m',
      });
      // Populate cache (null passwordChangedAt).
      const req1 = makeReq({ cookies: { accessToken: token } });
      await authenticateToken(req1, makeRes(), () => {});

      // Rotate the password in the DB AND evict — next call must reject.
      await prisma.user.update({
        where: { id: u.id },
        data: { passwordChangedAt: new Date(Date.now() + 60_000) },
      });
      evictPasswordChangedAtCache(u.id);

      const req2 = makeReq({ cookies: { accessToken: token } });
      const res2 = makeRes();
      await authenticateToken(req2, res2, () => {});
      expect(res2.statusCode).toBe(401);
      expect(res2.body.message).toBe('Session invalidated. Please login again.');
    });
  });
});
