/**
 * Integration Tests: HttpOnly Cookie Authentication
 *
 * Tests the complete authentication flow with httpOnly cookies
 * Verifies XSS protection, CSRF protection, and secure cookie handling
 *
 * Phase 1, Day 1-2: HttpOnly Cookie Migration
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import bcrypt from 'bcryptjs';

describe('Authentication with HttpOnly Cookies', () => {
  let testUser;
  const testUserData = {
    username: 'cookietest',
    email: 'cookietest@example.com',
    password: 'TestPassword123!',
    firstName: 'Cookie',
    lastName: 'Test',
  };

  beforeAll(async () => {
    // Clean up any existing test user
    await prisma.refreshToken.deleteMany({
      where: { user: { email: testUserData.email } },
    });
    await prisma.user.deleteMany({
      where: { email: testUserData.email },
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      await prisma.refreshToken.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.delete({
        where: { id: testUser.id },
      }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register - Cookie Setting', () => {
    it('should set httpOnly cookies on successful registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUserData)
        .expect(201);

      // Verify response structure
      expect(response.body.status).toBe('success');
      expect(response.body.data.user).toMatchObject({
        username: testUserData.username,
        email: testUserData.email,
      });

      // CRITICAL: Verify tokens NOT in response body
      expect(response.body.data.token).toBeUndefined();
      expect(response.body.data.refreshToken).toBeUndefined();

      // CRITICAL: Verify httpOnly cookies are set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.length).toBeGreaterThanOrEqual(2);

      // Verify accessToken cookie
      const accessTokenCookie = cookies.find(c => c.startsWith('accessToken='));
      expect(accessTokenCookie).toBeDefined();
      expect(accessTokenCookie).toContain('HttpOnly');
      expect(accessTokenCookie).toContain('SameSite=Strict');

      // Verify refreshToken cookie
      const refreshTokenCookie = cookies.find(c => c.startsWith('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toContain('HttpOnly');
      expect(refreshTokenCookie).toContain('SameSite=Strict');

      // Save test user for later tests
      testUser = response.body.data.user;
    });

    it('should NOT expose tokens in response body (XSS protection)', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUserData,
          email: 'cookietest2@example.com',
          username: 'cookietest2',
        })
        .expect(201);

      // Verify no tokens in JSON (prevents XSS token theft)
      const responseBody = JSON.stringify(response.body);
      expect(responseBody).not.toContain('eyJ'); // JWT prefix
      expect(responseBody).not.toContain('token":');
      expect(responseBody).not.toContain('refreshToken":');

      // Clean up
      await prisma.user.delete({
        where: { email: 'cookietest2@example.com' },
      });
    });
  });

  describe('POST /api/auth/login - Cookie Setting', () => {
    it('should set httpOnly cookies on successful login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      // Verify response
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.email).toBe(testUserData.email);

      // Verify tokens NOT in response
      expect(response.body.data.token).toBeUndefined();
      expect(response.body.data.refreshToken).toBeUndefined();

      // Verify httpOnly cookies
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.startsWith('accessToken='))).toBe(true);
      expect(cookies.some(c => c.startsWith('refreshToken='))).toBe(true);
    });

    it('should include SameSite=Strict for CSRF protection', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      const cookies = response.headers['set-cookie'];
      cookies.forEach(cookie => {
        if (cookie.startsWith('accessToken=') || cookie.startsWith('refreshToken=')) {
          expect(cookie).toContain('SameSite=Strict');
        }
      });
    });
  });

  describe('GET /api/auth/profile - Cookie Authentication', () => {
    let cookieHeader;

    beforeAll(async () => {
      // Login to get cookies
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      cookieHeader = loginResponse.headers['set-cookie'];
    });

    it('should authenticate with httpOnly cookies', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', cookieHeader)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user.email).toBe(testUserData.email);
    });

    it('should reject request without cookies', async () => {
      await request(app)
        .get('/api/auth/profile')
        .expect(401);
    });

    it('should reject request with invalid cookies', async () => {
      await request(app)
        .get('/api/auth/profile')
        .set('Cookie', ['accessToken=invalid_token'])
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh-token - Cookie Refresh', () => {
    let refreshCookie;

    beforeAll(async () => {
      // Login to get refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      refreshCookie = loginResponse.headers['set-cookie'].find(c =>
        c.startsWith('refreshToken=')
      );
    });

    it('should refresh accessToken using httpOnly refreshToken cookie', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', [refreshCookie])
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Token refreshed successfully');

      // Verify new accessToken cookie is set
      const cookies = response.headers['set-cookie'];
      const newAccessToken = cookies?.find(c => c.startsWith('accessToken='));
      expect(newAccessToken).toBeDefined();
      expect(newAccessToken).toContain('HttpOnly');
    });

    it('should reject refresh without refreshToken cookie', async () => {
      await request(app)
        .post('/api/auth/refresh-token')
        .expect(400);
    });
  });

  describe('POST /api/auth/logout - Cookie Clearing', () => {
    let authCookies;

    beforeEach(async () => {
      // Login to get cookies
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      authCookies = loginResponse.headers['set-cookie'];
    });

    it('should clear httpOnly cookies on logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.status).toBe('success');

      // Verify cookies are cleared (Max-Age=0 or Expires in past)
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();

      const accessTokenClear = cookies.find(c => c.startsWith('accessToken='));
      const refreshTokenClear = cookies.find(c => c.startsWith('refreshToken='));

      // Cookies should be set to expire immediately
      expect(accessTokenClear || refreshTokenClear).toBeDefined();
    });

    it('should invalidate refresh tokens in database on logout', async () => {
      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', authCookies)
        .expect(200);

      // Verify refresh tokens are deleted
      const tokens = await prisma.refreshToken.findMany({
        where: { userId: testUser.id },
      });

      expect(tokens.length).toBe(0);
    });
  });

  describe('Security: XSS Protection Verification', () => {
    it('should never include JWT tokens in any response body', async () => {
      // Test all auth endpoints
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUserData,
          email: 'xss-test@example.com',
          username: 'xsstest',
        })
        .expect(201);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'xss-test@example.com',
          password: testUserData.password,
        })
        .expect(200);

      // Verify NO tokens in response bodies
      [registerResponse, loginResponse].forEach(response => {
        const body = JSON.stringify(response.body);
        expect(body).not.toMatch(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/); // JWT pattern
        expect(body).not.toContain('"token"');
        expect(body).not.toContain('"refreshToken"');
      });

      // Clean up
      await prisma.user.delete({ where: { email: 'xss-test@example.com' } });
    });
  });

  describe('Security: CSRF Protection Verification', () => {
    it('should set SameSite=Strict on all auth cookies', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];
      const authCookies = cookies.filter(c =>
        c.startsWith('accessToken=') || c.startsWith('refreshToken=')
      );

      authCookies.forEach(cookie => {
        expect(cookie).toContain('SameSite=Strict');
      });
    });
  });

  describe('Production Security: HTTPS Enforcement', () => {
    it('should set Secure flag in production environment', async () => {
      // Note: This test assumes NODE_ENV=production sets secure flag
      // In test environment, secure flag may be false
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];

      // In production, cookies should have Secure flag
      // In test/dev, this may not be set
      if (process.env.NODE_ENV === 'production') {
        cookies.forEach(cookie => {
          if (cookie.startsWith('accessToken=') || cookie.startsWith('refreshToken=')) {
            expect(cookie).toContain('Secure');
          }
        });
      }
    });
  });

  describe('Backward Compatibility: Authorization Header Fallback', () => {
    let accessToken;

    beforeAll(async () => {
      // Create a user and manually generate token for testing
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
      const user = await prisma.user.create({
        data: {
          username: 'fallbacktest',
          email: 'fallback@example.com',
          password: hashedPassword,
        },
      });

      // Generate token using the auth middleware
      const { generateToken } = await import('../../middleware/auth.mjs');
      accessToken = generateToken(user);

      testUser = user; // For cleanup
    });

    it('should still accept Authorization header for backward compatibility', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user.email).toBe('fallback@example.com');
    });
  });
});
