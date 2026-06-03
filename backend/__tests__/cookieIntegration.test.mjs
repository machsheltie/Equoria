/**
 * 🧪 COOKIE INTEGRATION TESTS
 *
 * Integration tests for cookie handling in authentication endpoints
 * Verifies cookies are set correctly with proper security attributes
 *
 * Test Coverage:
 * - Registration endpoint cookie attributes
 * - Login endpoint cookie attributes
 * - Token refresh endpoint cookie attributes
 * - Logout endpoint cookie clearing
 * - Cookie security in production vs development
 * - Cookie domain handling
 *
 * @module __tests__/integration/cookieIntegration.test
 */

import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../tests/helpers/csrfHelper.mjs';
describe('Cookie Integration Tests', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  // Per-suite prefix prevents cross-suite collisions when shards run in
  // parallel. Cleanup uses startsWith(SUITE_PREFIX) for resilience against
  // crashed prior runs (Phase 3b).
  const SUITE_PREFIX = 'cintg';
  let testUser;
  // Test-bypass headers were purged from production middleware in commits
  // 5a158681 / 3590916e. Empty object preserves `.set(rateLimitBypassHeader)`
  // call-site signatures with no behavior. Rate pressure in test env is
  // governed by TEST_RATE_LIMIT_* env knobs (see middleware/rateLimiting.mjs).
  const rateLimitBypassHeader = {};

  const cleanSuite = async () => {
    const stale = await prisma.user.findMany({
      where: { OR: [{ email: { startsWith: `${SUITE_PREFIX}-` } }, { username: { startsWith: `${SUITE_PREFIX}_` } }] },
      select: { id: true },
    });
    if (stale.length > 0) {
      const ids = stale.map(u => u.id);
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      // Registration auto-creates a starter horse; horses_userId_fkey is
      // onDelete: Restrict (schema:282), so the user's horses MUST be deleted
      // (userId-scoped) BEFORE the user or user.deleteMany throws
      // PrismaClientKnownRequestError (P2003). Equoria-t1f5r.
      await prisma.horse.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  };

  beforeAll(async () => {
    await cleanSuite();
  });

  afterEach(async () => {
    // Clean up test user after each test
    if (testUser) {
      await prisma.refreshToken.deleteMany({
        where: { userId: testUser.id },
      });
      // FK-ordered: delete the user's auto-created starter horse(s) BEFORE the
      // user. horses_userId_fkey is onDelete: Restrict (schema:282), so a bare
      // user delete throws P2003 while a horse still references it. Equoria-t1f5r.
      await prisma.horse.deleteMany({
        where: { userId: testUser.id },
      });
      // deleteMany is idempotent; singular delete throws if already gone
      await prisma.user.deleteMany({
        where: { id: testUser.id },
      });
      testUser = null;
    }
  });

  afterAll(async () => {
    await cleanSuite();
  });

  describe('Registration Endpoint Cookies', () => {
    test('should set accessToken cookie with correct attributes', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set(rateLimitBypassHeader)
        .send({
          username: `${SUITE_PREFIX}_r1user`,
          email: `${SUITE_PREFIX}-r1@test.com`,
          password: 'TestPass123!',
          firstName: 'Cookie',
          lastName: 'Test',
          // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201.
          dateOfBirth: '1990-01-01',
        });

      expect(response.status).toBe(201);

      const cookies = response.headers['set-cookie'];
      // 21R-AUTH-3 compatibility: strip the seeded CSRF cookie so the
      // pre-fetched __csrf__ pair stays authoritative for these tests.
      const __allCookies__ = [
        ...cookies.map(c => c.split(';')[0]).filter(c => !c.startsWith('_csrf=') && !c.startsWith('__Host-csrf=')),
        ...(__csrf__.cookieHeader || []),
      ];
      expect(cookies).toBeDefined();

      const accessTokenCookie = cookies.find(cookie => cookie.startsWith('accessToken='));
      expect(accessTokenCookie).toBeDefined();

      // Verify security attributes
      expect(accessTokenCookie).toContain('HttpOnly');
      expect(accessTokenCookie).toContain('SameSite=Lax');
      expect(accessTokenCookie).toContain('Path=/');
      expect(accessTokenCookie).toContain('Max-Age=900'); // 15 minutes

      // In test environment, secure should not be set
      expect(accessTokenCookie).not.toContain('Secure');

      // Clean up
      testUser = await prisma.user.findUnique({
        where: { email: `${SUITE_PREFIX}-r1@test.com` },
      });
    });

    test('should set refreshToken cookie with correct attributes', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send({
          username: `${SUITE_PREFIX}_r2user`,
          email: `${SUITE_PREFIX}-r2@test.com`,
          password: 'TestPass123!',
          firstName: 'Cookie',
          lastName: 'Test',
          // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201.
          dateOfBirth: '1990-01-01',
        });

      expect(response.status).toBe(201);

      const cookies = response.headers['set-cookie'];
      // 21R-AUTH-3 compatibility: strip the seeded CSRF cookie so the
      // pre-fetched __csrf__ pair stays authoritative for these tests.
      const __allCookies__ = [
        ...cookies.map(c => c.split(';')[0]).filter(c => !c.startsWith('_csrf=') && !c.startsWith('__Host-csrf=')),
        ...(__csrf__.cookieHeader || []),
      ];
      const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();

      // Verify security attributes
      expect(refreshTokenCookie).toContain('HttpOnly');
      expect(refreshTokenCookie).toContain('SameSite=Lax');
      expect(refreshTokenCookie).toMatch(/;\s*Path=\/(;|$)/); // 21R-AUTH-1: root path so /auth and /api/auth both receive cookie
      expect(refreshTokenCookie).toContain('Max-Age=604800'); // 7 days

      // In test environment, secure should not be set
      expect(refreshTokenCookie).not.toContain('Secure');

      // Clean up
      testUser = await prisma.user.findUnique({
        where: { email: `${SUITE_PREFIX}-r2@test.com` },
      });
    });

    test('should set both cookies in a single response', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send({
          username: `${SUITE_PREFIX}_r3user`,
          email: `${SUITE_PREFIX}-r3@test.com`,
          password: 'TestPass123!',
          firstName: 'Cookie',
          lastName: 'Test',
          // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201.
          dateOfBirth: '1990-01-01',
        });

      expect(response.status).toBe(201);

      const cookies = response.headers['set-cookie'];
      // 21R-AUTH-3 compatibility: strip the seeded CSRF cookie so the
      // pre-fetched __csrf__ pair stays authoritative for these tests.
      const __allCookies__ = [
        ...cookies.map(c => c.split(';')[0]).filter(c => !c.startsWith('_csrf=') && !c.startsWith('__Host-csrf=')),
        ...(__csrf__.cookieHeader || []),
      ];
      // 21R-AUTH-3: register now also seeds the CSRF cookie alongside
      // accessToken + refreshToken so the first mutation can skip the
      // separate /csrf-token round-trip.
      expect(cookies).toHaveLength(3);
      expect(cookies.some(c => c.startsWith('accessToken='))).toBe(true);
      expect(cookies.some(c => c.startsWith('refreshToken='))).toBe(true);
      expect(cookies.some(c => c.startsWith('__Host-csrf=') || c.startsWith('_csrf='))).toBe(true);

      // Clean up
      testUser = await prisma.user.findUnique({
        where: { email: `${SUITE_PREFIX}-r3@test.com` },
      });
    });
  });

  describe('Login Endpoint Cookies', () => {
    beforeEach(async () => {
      // Create test user
      await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set(rateLimitBypassHeader)
        .send({
          username: `${SUITE_PREFIX}_luser`,
          email: `${SUITE_PREFIX}-l@test.com`,
          password: 'TestPass123!',
          firstName: 'Login',
          lastName: 'Test',
          // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201.
          dateOfBirth: '1990-01-01',
        });

      testUser = await prisma.user.findUnique({
        where: { email: `${SUITE_PREFIX}-l@test.com` },
      });
    });

    test('should set cookies on successful login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set(rateLimitBypassHeader)
        .send({
          email: `${SUITE_PREFIX}-l@test.com`,
          password: 'TestPass123!',
        });

      expect(response.status).toBe(200);

      const cookies = response.headers['set-cookie'];
      // 21R-AUTH-3 compatibility: strip the seeded CSRF cookie so the
      // pre-fetched __csrf__ pair stays authoritative for these tests.
      const __allCookies__ = [
        ...cookies.map(c => c.split(';')[0]).filter(c => !c.startsWith('_csrf=') && !c.startsWith('__Host-csrf=')),
        ...(__csrf__.cookieHeader || []),
      ];
      expect(cookies).toBeDefined();
      // 21R-AUTH-3: login now seeds the CSRF cookie alongside auth cookies.
      expect(cookies).toHaveLength(3);
      expect(cookies.some(c => c.startsWith('accessToken='))).toBe(true);
      expect(cookies.some(c => c.startsWith('refreshToken='))).toBe(true);
      expect(cookies.some(c => c.startsWith('__Host-csrf=') || c.startsWith('_csrf='))).toBe(true);
    });

    test('should set accessToken cookie with correct attributes on login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set(rateLimitBypassHeader)
        .send({
          email: `${SUITE_PREFIX}-l@test.com`,
          password: 'TestPass123!',
        });

      const cookies = response.headers['set-cookie'] || [];
      const accessTokenCookie = cookies.find(cookie => cookie.startsWith('accessToken='));
      expect(accessTokenCookie).toBeDefined();

      expect(accessTokenCookie).toContain('HttpOnly');
      expect(accessTokenCookie).toContain('SameSite=Lax');
      expect(accessTokenCookie).toContain('Path=/');
      expect(accessTokenCookie).toContain('Max-Age=900');
    });

    test('should set refreshToken cookie with correct attributes on login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set(rateLimitBypassHeader)
        .send({
          email: `${SUITE_PREFIX}-l@test.com`,
          password: 'TestPass123!',
        });

      const cookies = response.headers['set-cookie'] || [];
      const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();

      expect(refreshTokenCookie).toContain('HttpOnly');
      expect(refreshTokenCookie).toContain('SameSite=Lax');
      expect(refreshTokenCookie).toMatch(/;\s*Path=\/(;|$)/); // 21R-AUTH-1
      expect(refreshTokenCookie).toContain('Max-Age=604800');
    });
  });

  describe('Token Refresh Endpoint Cookies', () => {
    let loginResponse;

    beforeEach(async () => {
      // Create and login test user
      await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set(rateLimitBypassHeader)
        .send({
          username: `${SUITE_PREFIX}_rfuser`,
          email: `${SUITE_PREFIX}-rf@test.com`,
          password: 'TestPass123!',
          firstName: 'Refresh',
          lastName: 'Test',
          // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201.
          dateOfBirth: '1990-01-01',
        });

      testUser = await prisma.user.findUnique({
        where: { email: `${SUITE_PREFIX}-rf@test.com` },
      });

      loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set(rateLimitBypassHeader)
        .send({
          email: `${SUITE_PREFIX}-rf@test.com`,
          password: 'TestPass123!',
        });
    });

    test('should set new cookies on token refresh', async () => {
      const cookies = loginResponse.headers['set-cookie'] || [];
      const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();

      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('Origin', 'http://localhost:3000')
        .set(rateLimitBypassHeader)
        .set('Cookie', refreshTokenCookie);

      expect(response.status).toBe(200);

      const newCookies = response.headers['set-cookie'];
      expect(newCookies).toBeDefined();
      // 21R-AUTH-3: refresh-token rotation also rotates the CSRF cookie.
      expect(newCookies).toHaveLength(3);
      expect(newCookies.some(c => c.startsWith('accessToken='))).toBe(true);
      expect(newCookies.some(c => c.startsWith('refreshToken='))).toBe(true);
      expect(newCookies.some(c => c.startsWith('__Host-csrf=') || c.startsWith('_csrf='))).toBe(true);
    });

    test('should set new accessToken cookie with correct attributes', async () => {
      const cookies = loginResponse.headers['set-cookie'] || [];
      const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();

      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('Origin', 'http://localhost:3000')
        .set(rateLimitBypassHeader)
        .set('Cookie', refreshTokenCookie);

      const newCookies = response.headers['set-cookie'];
      const newAccessTokenCookie = newCookies.find(cookie => cookie.startsWith('accessToken='));

      expect(newAccessTokenCookie).toContain('HttpOnly');
      expect(newAccessTokenCookie).toContain('SameSite=Lax');
      expect(newAccessTokenCookie).toContain('Path=/');
      expect(newAccessTokenCookie).toContain('Max-Age=900');
    });

    test('should set new refreshToken cookie with correct attributes', async () => {
      const cookies = loginResponse.headers['set-cookie'] || [];
      const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();

      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('Origin', 'http://localhost:3000')
        .set(rateLimitBypassHeader)
        .set('Cookie', refreshTokenCookie);

      const newCookies = response.headers['set-cookie'];
      const newRefreshTokenCookie = newCookies.find(cookie => cookie.startsWith('refreshToken='));

      expect(newRefreshTokenCookie).toContain('HttpOnly');
      expect(newRefreshTokenCookie).toContain('SameSite=Lax');
      expect(newRefreshTokenCookie).toMatch(/;\s*Path=\/(;|$)/); // 21R-AUTH-1
      expect(newRefreshTokenCookie).toContain('Max-Age=604800');
    });
  });

  describe('Logout Endpoint Cookie Clearing', () => {
    let loginResponse;

    beforeEach(async () => {
      // Create and login test user
      await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set(rateLimitBypassHeader)
        .send({
          username: `${SUITE_PREFIX}_louser`,
          email: `${SUITE_PREFIX}-lo@test.com`,
          password: 'TestPass123!',
          firstName: 'Logout',
          lastName: 'Test',
          // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201.
          dateOfBirth: '1990-01-01',
        });

      testUser = await prisma.user.findUnique({
        where: { email: `${SUITE_PREFIX}-lo@test.com` },
      });

      loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set(rateLimitBypassHeader)
        .send({
          email: `${SUITE_PREFIX}-lo@test.com`,
          password: 'TestPass123!',
        });
    });

    test('should clear accessToken cookie on logout', async () => {
      const cookies = loginResponse.headers['set-cookie'] || [];
      const accessTokenCookie = cookies.find(cookie => cookie.startsWith('accessToken='));
      expect(accessTokenCookie).toBeDefined();

      // Per-user CSRF binding (Equoria-plw0h): the token must be issued under
      // the logged-in user's session, or csrfProtection 403s the authenticated POST.
      const csrf = await fetchCsrf(app, { extraCookies: [accessTokenCookie] });
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', csrf.csrfToken)
        .set(rateLimitBypassHeader)
        .set('Cookie', [accessTokenCookie, ...csrf.cookieHeader]);

      expect(response.status).toBe(200);

      const clearCookies = response.headers['set-cookie'];
      expect(clearCookies).toBeDefined();

      const clearedAccessToken = clearCookies.find(cookie => cookie.startsWith('accessToken='));
      expect(clearedAccessToken).toBeDefined();

      // Verify cookie is cleared (Max-Age=0 or Expires in past)
      expect(clearedAccessToken.includes('Max-Age=0') || clearedAccessToken.includes('Expires=')).toBe(true);
    });

    test('should clear refreshToken cookie on logout', async () => {
      const cookies = loginResponse.headers['set-cookie'] || [];
      const accessTokenCookie = cookies.find(cookie => cookie.startsWith('accessToken='));
      expect(accessTokenCookie).toBeDefined();

      // Per-user CSRF binding (Equoria-plw0h): the token must be issued under
      // the logged-in user's session, or csrfProtection 403s the authenticated POST.
      const csrf = await fetchCsrf(app, { extraCookies: [accessTokenCookie] });
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', csrf.csrfToken)
        .set(rateLimitBypassHeader)
        .set('Cookie', [accessTokenCookie, ...csrf.cookieHeader]);

      expect(response.status).toBe(200);

      const clearCookies = response.headers['set-cookie'];
      const clearedRefreshToken = clearCookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(clearedRefreshToken).toBeDefined();

      // Verify cookie is cleared
      expect(clearedRefreshToken.includes('Max-Age=0') || clearedRefreshToken.includes('Expires=')).toBe(true);
    });

    test('should maintain same path when clearing cookies', async () => {
      const cookies = loginResponse.headers['set-cookie'] || [];
      const accessTokenCookie = cookies.find(cookie => cookie.startsWith('accessToken='));
      expect(accessTokenCookie).toBeDefined();

      // Per-user CSRF binding (Equoria-plw0h): the token must be issued under
      // the logged-in user's session, or csrfProtection 403s the authenticated POST.
      const csrf = await fetchCsrf(app, { extraCookies: [accessTokenCookie] });
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', csrf.csrfToken)
        .set(rateLimitBypassHeader)
        .set('Cookie', [accessTokenCookie, ...csrf.cookieHeader]);

      const clearCookies = response.headers['set-cookie'];

      const clearedAccessToken = clearCookies.find(cookie => cookie.startsWith('accessToken='));
      expect(clearedAccessToken).toContain('Path=/');

      const clearedRefreshToken = clearCookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(clearedRefreshToken).toMatch(/;\s*Path=\/(;|$)/); // 21R-AUTH-1: clear must match set path
    });
  });

  describe('Cookie Security Attributes', () => {
    test('should use consistent security attributes across all endpoints', async () => {
      // Randomized + SUITE_PREFIX-aligned credentials so this fixture cannot
      // collide on re-run / parallel shards, and is swept by cleanSuite()
      // (startsWith `${SUITE_PREFIX}-`/`${SUITE_PREFIX}_`) if a prior run crashed
      // before afterEach. Replaces the former fixed `securitytest1@test.com`.
      const tag = randomBytes(6).toString('hex');
      const secEmail = `${SUITE_PREFIX}-sec-${tag}@test.com`;
      const secUsername = `${SUITE_PREFIX}_sec_${tag}`;

      // Register
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set(rateLimitBypassHeader)
        .send({
          username: secUsername,
          email: secEmail,
          password: 'TestPass123!',
          firstName: 'Security',
          lastName: 'Test',
          // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201.
          dateOfBirth: '1990-01-01',
        });

      testUser = await prisma.user.findUnique({
        where: { email: secEmail },
      });

      // Login
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set(rateLimitBypassHeader)
        .send({
          email: secEmail,
          password: 'TestPass123!',
        });

      // Refresh
      const loginCookies = loginResponse.headers['set-cookie'] || [];
      const refreshTokenCookie = loginCookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('Origin', 'http://localhost:3000')
        .set(rateLimitBypassHeader)
        .set('Cookie', refreshTokenCookie);

      // Verify all responses have same cookie attributes
      const registerCookies = registerResponse.headers['set-cookie'];
      const refreshCookies = refreshResponse.headers['set-cookie'];

      const cookieSets = [registerCookies, loginCookies, refreshCookies];

      cookieSets.forEach(cookies => {
        const accessToken = cookies.find(c => c.startsWith('accessToken='));
        const refreshToken = cookies.find(c => c.startsWith('refreshToken='));

        // Verify consistent attributes
        expect(accessToken).toContain('HttpOnly');
        expect(accessToken).toContain('SameSite=Lax');
        expect(refreshToken).toContain('HttpOnly');
        expect(refreshToken).toContain('SameSite=Lax');
      });
    });
  });
});
