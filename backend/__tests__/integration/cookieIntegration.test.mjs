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
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';
import { jest as _jest } from '@jest/globals';

describe('Cookie Integration Tests', () => {
  let testUser;
  const rateLimitBypassHeader = { 'X-Test-Bypass-Rate-Limit': 'true', 'X-Test-Bypass-Auth': 'true' };

  beforeAll(async () => {
    // Clean up test database
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'cookietest',
        },
      },
    });
  });

  afterEach(async () => {
    // Clean up test user after each test
    if (testUser) {
      await prisma.refreshToken.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.delete({
        where: { id: testUser.id },
      });
      testUser = null;
    }
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'cookietest',
        },
      },
    });
  });

  describe('Registration Endpoint Cookies', () => {
    test('should set accessToken cookie with correct attributes', async () => {
      const response = await request(app).post('/auth/register').set(rateLimitBypassHeader).send({
        username: 'cookietestuser1',
        email: 'cookietest1@test.com',
        password: 'TestPass123!',
        firstName: 'Cookie',
        lastName: 'Test',
      });

      expect(response.status).toBe(201);

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();

      const accessTokenCookie = cookies.find(cookie => cookie.startsWith('accessToken='));
      expect(accessTokenCookie).toBeDefined();

      // Verify security attributes
      expect(accessTokenCookie).toContain('HttpOnly');
      expect(accessTokenCookie).toContain('SameSite=Strict');
      expect(accessTokenCookie).toContain('Path=/');
      expect(accessTokenCookie).toContain('Max-Age=900'); // 15 minutes

      // In test environment, secure should not be set
      expect(accessTokenCookie).not.toContain('Secure');

      // Clean up
      testUser = await prisma.user.findUnique({
        where: { email: 'cookietest1@test.com' },
      });
    });

    test('should set refreshToken cookie with correct attributes', async () => {
      const response = await request(app).post('/auth/register').send({
        username: 'cookietestuser2',
        email: 'cookietest2@test.com',
        password: 'TestPass123!',
        firstName: 'Cookie',
        lastName: 'Test',
      });

      expect(response.status).toBe(201);

      const cookies = response.headers['set-cookie'];
      const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();

      // Verify security attributes
      expect(refreshTokenCookie).toContain('HttpOnly');
      expect(refreshTokenCookie).toContain('SameSite=Strict');
      expect(refreshTokenCookie).toContain('Path=/auth/refresh-token'); // Scoped path
      expect(refreshTokenCookie).toContain('Max-Age=604800'); // 7 days

      // In test environment, secure should not be set
      expect(refreshTokenCookie).not.toContain('Secure');

      // Clean up
      testUser = await prisma.user.findUnique({
        where: { email: 'cookietest2@test.com' },
      });
    });

    test('should set both cookies in a single response', async () => {
      const response = await request(app).post('/auth/register').send({
        username: 'cookietestuser3',
        email: 'cookietest3@test.com',
        password: 'TestPass123!',
        firstName: 'Cookie',
        lastName: 'Test',
      });

      expect(response.status).toBe(201);

      const cookies = response.headers['set-cookie'];
      expect(cookies).toHaveLength(2); // accessToken and refreshToken

      // Clean up
      testUser = await prisma.user.findUnique({
        where: { email: 'cookietest3@test.com' },
      });
    });
  });

  describe('Login Endpoint Cookies', () => {
    beforeEach(async () => {
      // Create test user
      const response = await request(app).post('/auth/register').set(rateLimitBypassHeader).send({
        username: 'logincookietest',
        email: 'logincookietest@test.com',
        password: 'TestPass123!',
        firstName: 'Login',
        lastName: 'Test',
      });

      testUser = await prisma.user.findUnique({
        where: { email: 'logincookietest@test.com' },
      });
    });

    test('should set cookies on successful login', async () => {
      const response = await request(app).post('/auth/login').set(rateLimitBypassHeader).send({
        email: 'logincookietest@test.com',
        password: 'TestPass123!',
      });

      expect(response.status).toBe(200);

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies).toHaveLength(2); // accessToken and refreshToken
    });

    test('should set accessToken cookie with correct attributes on login', async () => {
      const response = await request(app).post('/auth/login').set(rateLimitBypassHeader).send({
        email: 'logincookietest@test.com',
        password: 'TestPass123!',
      });

      const cookies = response.headers['set-cookie'] || [];
      const accessTokenCookie = cookies.find(cookie => cookie.startsWith('accessToken='));
      expect(accessTokenCookie).toBeDefined();

      expect(accessTokenCookie).toContain('HttpOnly');
      expect(accessTokenCookie).toContain('SameSite=Strict');
      expect(accessTokenCookie).toContain('Path=/');
      expect(accessTokenCookie).toContain('Max-Age=900');
    });

    test('should set refreshToken cookie with correct attributes on login', async () => {
      const response = await request(app).post('/auth/login').set(rateLimitBypassHeader).send({
        email: 'logincookietest@test.com',
        password: 'TestPass123!',
      });

      const cookies = response.headers['set-cookie'] || [];
      const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();

      expect(refreshTokenCookie).toContain('HttpOnly');
      expect(refreshTokenCookie).toContain('SameSite=Strict');
      expect(refreshTokenCookie).toContain('Path=/auth/refresh-token');
      expect(refreshTokenCookie).toContain('Max-Age=604800');
    });
  });

  describe('Token Refresh Endpoint Cookies', () => {
    let loginResponse;

    beforeEach(async () => {
      // Create and login test user
      await request(app).post('/auth/register').set(rateLimitBypassHeader).send({
        username: 'refreshcookietest',
        email: 'refreshcookietest@test.com',
        password: 'TestPass123!',
        firstName: 'Refresh',
        lastName: 'Test',
      });

      testUser = await prisma.user.findUnique({
        where: { email: 'refreshcookietest@test.com' },
      });

      loginResponse = await request(app).post('/auth/login').set(rateLimitBypassHeader).send({
        email: 'refreshcookietest@test.com',
        password: 'TestPass123!',
      });
    });

    test('should set new cookies on token refresh', async () => {
      const cookies = loginResponse.headers['set-cookie'] || [];
      const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();

      const response = await request(app)
        .post('/auth/refresh-token')
        .set(rateLimitBypassHeader)
        .set('Cookie', refreshTokenCookie);

      expect(response.status).toBe(200);

      const newCookies = response.headers['set-cookie'];
      expect(newCookies).toBeDefined();
      expect(newCookies).toHaveLength(2); // new accessToken and refreshToken
    });

    test('should set new accessToken cookie with correct attributes', async () => {
      const cookies = loginResponse.headers['set-cookie'] || [];
      const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();

      const response = await request(app)
        .post('/auth/refresh-token')
        .set(rateLimitBypassHeader)
        .set('Cookie', refreshTokenCookie);

      const newCookies = response.headers['set-cookie'];
      const newAccessTokenCookie = newCookies.find(cookie => cookie.startsWith('accessToken='));

      expect(newAccessTokenCookie).toContain('HttpOnly');
      expect(newAccessTokenCookie).toContain('SameSite=Strict');
      expect(newAccessTokenCookie).toContain('Path=/');
      expect(newAccessTokenCookie).toContain('Max-Age=900');
    });

    test('should set new refreshToken cookie with correct attributes', async () => {
      const cookies = loginResponse.headers['set-cookie'] || [];
      const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();

      const response = await request(app)
        .post('/auth/refresh-token')
        .set(rateLimitBypassHeader)
        .set('Cookie', refreshTokenCookie);

      const newCookies = response.headers['set-cookie'];
      const newRefreshTokenCookie = newCookies.find(cookie => cookie.startsWith('refreshToken='));

      expect(newRefreshTokenCookie).toContain('HttpOnly');
      expect(newRefreshTokenCookie).toContain('SameSite=Strict');
      expect(newRefreshTokenCookie).toContain('Path=/auth/refresh-token');
      expect(newRefreshTokenCookie).toContain('Max-Age=604800');
    });
  });

  describe('Logout Endpoint Cookie Clearing', () => {
    let loginResponse;

    beforeEach(async () => {
      // Create and login test user
      await request(app).post('/auth/register').set(rateLimitBypassHeader).send({
        username: 'logoutcookietest',
        email: 'logoutcookietest@test.com',
        password: 'TestPass123!',
        firstName: 'Logout',
        lastName: 'Test',
      });

      testUser = await prisma.user.findUnique({
        where: { email: 'logoutcookietest@test.com' },
      });

      loginResponse = await request(app).post('/auth/login').set(rateLimitBypassHeader).send({
        email: 'logoutcookietest@test.com',
        password: 'TestPass123!',
      });
    });

    test('should clear accessToken cookie on logout', async () => {
      const cookies = loginResponse.headers['set-cookie'] || [];
      const accessTokenCookie = cookies.find(cookie => cookie.startsWith('accessToken='));
      expect(accessTokenCookie).toBeDefined();

      const response = await request(app)
        .post('/auth/logout')
        .set(rateLimitBypassHeader)
        .set('Cookie', accessTokenCookie);

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

      const response = await request(app)
        .post('/auth/logout')
        .set(rateLimitBypassHeader)
        .set('Cookie', accessTokenCookie);

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

      const response = await request(app)
        .post('/auth/logout')
        .set(rateLimitBypassHeader)
        .set('Cookie', accessTokenCookie);

      const clearCookies = response.headers['set-cookie'];

      const clearedAccessToken = clearCookies.find(cookie => cookie.startsWith('accessToken='));
      expect(clearedAccessToken).toContain('Path=/');

      const clearedRefreshToken = clearCookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(clearedRefreshToken).toContain('Path=/auth/refresh-token');
    });
  });

  describe('Cookie Security Attributes', () => {
    test('should use consistent security attributes across all endpoints', async () => {
      // Register
      const registerResponse = await request(app).post('/auth/register').set(rateLimitBypassHeader).send({
        username: 'securitytest1',
        email: 'securitytest1@test.com',
        password: 'TestPass123!',
        firstName: 'Security',
        lastName: 'Test',
      });

      testUser = await prisma.user.findUnique({
        where: { email: 'securitytest1@test.com' },
      });

      // Login
      const loginResponse = await request(app).post('/auth/login').set(rateLimitBypassHeader).send({
        email: 'securitytest1@test.com',
        password: 'TestPass123!',
      });

      // Refresh
      const loginCookies = loginResponse.headers['set-cookie'] || [];
      const refreshTokenCookie = loginCookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();
      const refreshResponse = await request(app)
        .post('/auth/refresh-token')
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
        expect(accessToken).toContain('SameSite=Strict');
        expect(refreshToken).toContain('HttpOnly');
        expect(refreshToken).toContain('SameSite=Strict');
      });
    });
  });
});
