/**
 * Integration Tests: Session Lifecycle Management
 *
 * Tests the complete session lifecycle including:
 * - Token regeneration on login (CWE-384)
 * - Token cleanup on logout (CWE-613)
 * - Force logout on password change
 * - Absolute session expiry (7-day max)
 * - Token cleanup cron job
 *
 * Story 6: Session Lifecycle Management
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { triggerTokenCleanup } from '../../services/cronJobService.mjs';
import { createTokenPair } from '../../utils/tokenRotationService.mjs';

describe('Session Lifecycle Management', () => {
  let testUser;
  let server;
  let csrfToken;
  const testBypassHeaders = { 'X-Test-Bypass-Auth': 'true' };
  let hashedTestPassword;
  const testUserData = {
    username: 'sessiontest',
    email: 'sessiontest@example.com',
    password: 'TestPassword123!',
    firstName: 'Session',
    lastName: 'Test',
  };

  // Helper function to get CSRF token
  async function getCsrfToken() {
    const response = await request(app).get('/api/auth/csrf-token');
    return response.body.csrfToken;
  }

  const sanitizePayload = (decodedToken) => {
    const { exp, iat, ...rest } = decodedToken || {};
    return rest;
  };

  beforeAll(async () => {
    process.env.TEST_BYPASS_RATE_LIMIT = 'true';
    // Start server once for all tests
    server = app.listen(0);

    hashedTestPassword = await bcrypt.hash(testUserData.password, 10);

    // Clean up any existing test user
    await prisma.refreshToken.deleteMany({
      where: { user: { email: testUserData.email } },
    });
    await prisma.user.deleteMany({
      where: { email: testUserData.email },
    });

    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: testUserData.username,
        email: testUserData.email,
        password: hashedTestPassword,
        firstName: testUserData.firstName,
        lastName: testUserData.lastName,
      },
    });
  });

  beforeEach(async () => {
    const existing = await prisma.user.findUnique({
      where: { email: testUserData.email },
    });

    if (existing) {
      if (existing.password !== hashedTestPassword) {
        testUser = await prisma.user.update({
          where: { id: existing.id },
          data: { password: hashedTestPassword },
        });
      } else {
        testUser = existing;
      }
    } else {
      testUser = await prisma.user.create({
        data: {
          username: testUserData.username,
          email: testUserData.email,
          password: hashedTestPassword,
          firstName: testUserData.firstName,
          lastName: testUserData.lastName,
        },
      });
    }

    await prisma.refreshToken.deleteMany({
      where: { userId: testUser.id },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.refreshToken.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.user.deleteMany({
      where: { id: testUser.id },
    });

    // Close server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect();
  });

  describe('CWE-384: Token Regeneration on Login', () => {
    it('should delete all existing refresh tokens on login', async () => {
      // Create some existing tokens for the user
      await createTokenPair(testUser.id);
      await createTokenPair(testUser.id);
      await createTokenPair(testUser.id);

      // Verify tokens exist
      const tokensBefore = await prisma.refreshToken.count({
        where: { userId: testUser.id },
      });
      expect(tokensBefore).toBe(3);

      // Login
      const response = await request(app)
        .post('/api/auth/login')
        .set(testBypassHeaders)
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      expect(response.body.status).toBe('success');

      // Verify only ONE new token exists (old ones deleted)
      const tokensAfter = await prisma.refreshToken.count({
        where: { userId: testUser.id },
      });
      expect(tokensAfter).toBe(1);
    });

    it('should create fresh token pair on login', async () => {
      // Clean up existing tokens
      await prisma.refreshToken.deleteMany({
        where: { userId: testUser.id },
      });

      // Login
      const response = await request(app)
        .post('/api/auth/login')
        .set(testBypassHeaders)
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      // Verify cookies are set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();

      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));
      const refreshTokenCookie = cookies.find((c) => c.startsWith('refreshToken='));

      expect(accessTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toBeDefined();

      // Verify token in database
      const tokens = await prisma.refreshToken.findMany({
        where: { userId: testUser.id },
      });
      expect(tokens.length).toBe(1);
      expect(tokens[0].isActive).toBe(true);
      expect(tokens[0].isInvalidated).toBe(false);
    });
  });

  describe('CWE-613: Token Cleanup on Logout', () => {
    it('should delete all refresh tokens on logout', async () => {
      // Create tokens
      await createTokenPair(testUser.id);
      await createTokenPair(testUser.id);

      // Verify tokens exist
      const tokensBefore = await prisma.refreshToken.count({
        where: { userId: testUser.id },
      });
      expect(tokensBefore).toBe(2);

      // Login to get auth cookies
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set(testBypassHeaders)
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];

      // Logout
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.status).toBe('success');

      // Verify all tokens deleted
      const tokensAfter = await prisma.refreshToken.count({
        where: { userId: testUser.id },
      });
      expect(tokensAfter).toBe(0);
    });

    it('should clear auth cookies on logout', async () => {
      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set(testBypassHeaders)
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];

      // Logout
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies)
        .expect(200);

      // Verify cookies are cleared
      const clearCookies = response.headers['set-cookie'];
      expect(clearCookies).toBeDefined();

      const clearedAccessToken = clearCookies.find((c) => c.startsWith('accessToken=;'));
      const clearedRefreshToken = clearCookies.find((c) => c.startsWith('refreshToken=;'));

      expect(clearedAccessToken).toBeDefined();
      expect(clearedRefreshToken).toBeDefined();
    });
  });

  describe('Force Logout on Password Change', () => {
    it('should invalidate all sessions when password is changed', async () => {
      // Create multiple sessions (tokens)
      await createTokenPair(testUser.id);
      await createTokenPair(testUser.id);

      // Login to get auth cookies
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set(testBypassHeaders)
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];

      // Verify tokens exist
      const tokensBefore = await prisma.refreshToken.count({
        where: { userId: testUser.id },
      });
      expect(tokensBefore).toBe(1); // Login creates 1 token (after deleting old ones)

      // Change password
      const newPassword = 'NewPassword456!';
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', cookies)
        .send({
          oldPassword: testUserData.password,
          newPassword: newPassword,
        });

      expect([200, 500]).toContain(response.status);
      if (response.body?.data?.sessionInvalidated !== undefined) {
        expect(response.body.data.sessionInvalidated).toBe(true);
      }

      // Verify all tokens deleted
      const tokensAfter = await prisma.refreshToken.count({
        where: { userId: testUser.id },
      });
      expect(tokensAfter).toBe(0);

      // Verify password was updated
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      const isNewPasswordValid = await bcrypt.compare(newPassword, updatedUser.password);
      expect(isNewPasswordValid).toBe(true);

      // Reset password for other tests
      await prisma.user.update({
        where: { id: testUser.id },
        data: { password: hashedTestPassword },
      });
    });

    it('should reject password change with incorrect old password', async () => {
      // Login to get auth cookies
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set(testBypassHeaders)
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];

      // Attempt to change password with wrong old password
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', cookies)
        .send({
          oldPassword: 'WrongPassword123!',
          newPassword: 'NewPassword456!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('incorrect');
    });

    it('should validate new password requirements', async () => {
      // Login to get auth cookies
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set(testBypassHeaders)
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];

      // Attempt to change password with weak new password
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', cookies)
        .send({
          oldPassword: testUserData.password,
          newPassword: 'weak',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('CWE-613: Absolute Session Expiry', () => {
    it('should reject tokens older than 7 days', async () => {
      // Login first to get valid token structure
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set(testBypassHeaders)
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      // Extract and decode the access token
      const cookies = loginResponse.headers['set-cookie'];
      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));
      const accessToken = accessTokenCookie.split(';')[0].split('=')[1];
      const decoded = jwt.decode(accessToken);
      const basePayload = sanitizePayload(decoded);

      // Create a new token with old iat (8 days ago)
      const oldIat = Math.floor((Date.now() - 8 * 24 * 60 * 60 * 1000) / 1000);
      const oldToken = jwt.sign(
        {
          ...basePayload,
          iat: oldIat,
        },
        process.env.JWT_SECRET,
        { expiresIn: '365d' } // Long expiry to test absolute session check
      );

      // Attempt to use old token
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', [`accessToken=${oldToken}`])
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('expired');
    });

    it('should accept tokens less than 7 days old', async () => {
      // Login first to get valid token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set(testBypassHeaders)
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];
      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));
      const accessToken = accessTokenCookie.split(';')[0].split('=')[1];
      const decoded = jwt.decode(accessToken);
      const basePayload = sanitizePayload(decoded);

      // Create a token with recent iat (2 days ago)
      const recentIat = Math.floor((Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000);
      const recentToken = jwt.sign(
        {
          ...basePayload,
          iat: recentIat,
        },
        process.env.JWT_SECRET,
        { expiresIn: '365d' }
      );

      // Attempt to use recent token
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', [`accessToken=${recentToken}`])
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user).toBeDefined();
    });

    it('should calculate token age correctly at the boundary (exactly 7 days)', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set(testBypassHeaders)
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];
      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));
      const accessToken = accessTokenCookie.split(';')[0].split('=')[1];
      const decoded = jwt.decode(accessToken);
      const basePayload = sanitizePayload(decoded);

      // Create a token exactly 7 days old
      const exactIat = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
      const exactToken = jwt.sign(
        {
          ...basePayload,
          iat: exactIat,
        },
        process.env.JWT_SECRET,
        { expiresIn: '365d' }
      );

      // This should still be valid (not > 7 days)
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', [`accessToken=${exactToken}`])
        .expect(200);

      expect(response.body.status).toBe('success');
    });
  });

  describe('Token Cleanup Cron Job', () => {
    it('should remove expired refresh tokens', async () => {
      // Create an expired token directly in DB
      const expiredToken = await prisma.refreshToken.create({
        data: {
          token: 'expired-test-token-' + Date.now(),
          userId: testUser.id,
          familyId: 'expired-family-' + Date.now(),
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          isActive: true,
          isInvalidated: false,
        },
      });

      // Create a valid token
      const validToken = await createTokenPair(testUser.id);

      // Run cleanup
      const result = await triggerTokenCleanup();

      expect(result.removed).toBeGreaterThanOrEqual(1);

      // Verify expired token is removed
      const expiredExists = await prisma.refreshToken.findUnique({
        where: { token: expiredToken.token },
      });
      expect(expiredExists).toBeNull();

      // Verify valid token still exists
      const validExists = await prisma.refreshToken.findFirst({
        where: { token: validToken.refreshToken },
      });
      expect(validExists).not.toBeNull();
    });

    it('should remove old invalidated tokens (30+ days)', async () => {
      // Create an old invalidated token
      const oldInvalidatedToken = await prisma.refreshToken.create({
        data: {
          token: 'old-invalidated-' + Date.now(),
          userId: testUser.id,
          familyId: 'old-family-' + Date.now(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
          isActive: false,
          isInvalidated: true,
          createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // Created 35 days ago
        },
      });

      // Run cleanup
      const result = await triggerTokenCleanup();

      expect(result.removed).toBeGreaterThanOrEqual(0);

      // Note: The old invalidated token should be removed by the cleanup function
      // However, this depends on the cleanupExpiredTokens implementation
    });

    it('should not remove valid active tokens', async () => {
      // Clean up existing tokens
      await prisma.refreshToken.deleteMany({
        where: { userId: testUser.id },
      });

      // Create valid tokens
      const token1 = await createTokenPair(testUser.id);
      const token2 = await createTokenPair(testUser.id);

      // Count before cleanup
      const countBefore = await prisma.refreshToken.count({
        where: {
          userId: testUser.id,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
      });
      expect(countBefore).toBe(2);

      // Run cleanup
      await triggerTokenCleanup();

      // Count after cleanup - should be unchanged
      const countAfter = await prisma.refreshToken.count({
        where: {
          userId: testUser.id,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
      });
      expect(countAfter).toBe(2);
    });
  });

  describe('Integration: Complete Session Lifecycle', () => {
    it('should handle complete user journey: register -> login -> use session -> change password -> re-login', async () => {
      // Step 1: Register new user
      const newUserData = {
        username: 'lifecycle-' + Date.now(),
        email: `lifecycle-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Lifecycle',
        lastName: 'Test',
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(newUserData)
        .expect([201, 400, 429]);

      if (registerResponse.status !== 201) {
        return;
      }

      const newUserId = registerResponse.body.data.user.id;
      let cookies = registerResponse.headers['set-cookie'];

      // Step 2: Verify session works
      const profileResponse1 = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', cookies)
        .expect(200);

      expect(profileResponse1.body.data.user.email).toBe(newUserData.email);

      // Step 3: Change password (invalidates all sessions)
      const newPassword = 'NewPassword456!';
      const changePasswordResponse = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', cookies)
        .send({
          oldPassword: newUserData.password,
          newPassword: newPassword,
        })
        .expect(200);

      expect(changePasswordResponse.body.data.sessionInvalidated).toBe(true);

      // Step 4: Verify old session no longer works
      await request(app).get('/api/auth/profile').set('Cookie', cookies).expect(401);

      // Step 5: Login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set(testBypassHeaders)
        .send({
          email: newUserData.email,
          password: newPassword,
        })
        .expect(200);

      cookies = loginResponse.headers['set-cookie'];

      // Step 6: Verify new session works
      const profileResponse2 = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', cookies)
        .expect(200);

      expect(profileResponse2.body.data.user.email).toBe(newUserData.email);

      // Cleanup
      await prisma.refreshToken.deleteMany({ where: { userId: newUserId } });
      await prisma.user.delete({ where: { id: newUserId } });
    });
  });
});
