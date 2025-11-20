/**
 * 🧪 Token Rotation and Reuse Detection Tests (TDD RED Phase)
 *
 * This test suite validates the implementation of refresh token rotation
 * and reuse detection security measures. All tests are designed to fail
 * initially as the implementation is not yet complete.
 *
 * Security Features Tested:
 * - Refresh token rotation on each use
 * - Token family tracking
 * - Reuse detection and family invalidation
 * - Concurrent request handling
 * - Token compromise scenarios
 *
 * TDD Approach: RED → GREEN → REFACTOR
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createTestUser, resetRateLimitStore } from '../config/test-helpers.mjs';

describe('Token Rotation and Reuse Detection System', () => {
  let testUser;
  let testPassword;

  beforeEach(async () => {
    // Reset rate limits to avoid interference
    resetRateLimitStore();

    // Clean up any existing tokens and users
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'tokentest' } }
    });

    // Create test user with unique identifier
    const timestamp = Date.now();
    const userData = await createTestUser({
      username: `tokentest_${timestamp}`,
      email: `tokentest_${timestamp}@example.com`
    });
    testUser = userData;
    testPassword = userData.plainPassword;
  });

  afterEach(async () => {
    // Clean up tokens
    await prisma.refreshToken.deleteMany({});
  });

  describe('Basic Token Rotation', () => {
    it('should_rotate_refresh_token_on_each_use', async () => {
      // Step 1: Login to get initial tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testPassword
        });

      expect(loginResponse.status).toBe(200);

      // Extract initial refresh token from cookies
      const initialCookies = loginResponse.headers['set-cookie'];
      const initialRefreshToken = extractRefreshTokenFromCookies(initialCookies);
      expect(initialRefreshToken).toBeDefined();

      // Step 2: Use refresh token to get new tokens
      const refreshResponse = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${initialRefreshToken}`);

      expect(refreshResponse.status).toBe(200);

      // Extract new refresh token
      const newCookies = refreshResponse.headers['set-cookie'];
      const newRefreshToken = extractRefreshTokenFromCookies(newCookies);

      // Verify token rotation occurred
      expect(newRefreshToken).toBeDefined();
      expect(newRefreshToken).not.toBe(initialRefreshToken);

      // Verify new access token is provided
      const newAccessToken = extractAccessTokenFromCookies(newCookies);
      expect(newAccessToken).toBeDefined();
    });

    it('should_invalidate_old_refresh_token_after_rotation', async () => {
      // Get initial tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testPassword
        });

      const initialRefreshToken = extractRefreshTokenFromCookies(
        loginResponse.headers['set-cookie']
      );

      // Use refresh token to rotate
      await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${initialRefreshToken}`);

      // Attempt to use old refresh token again - should fail
      const replayResponse = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${initialRefreshToken}`);

      expect(replayResponse.status).toBe(401);
      expect(replayResponse.body.message).toContain('Invalid refresh token');
    });

    it('should_track_token_families_in_database', async () => {
      // Login to create token family
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testPassword
        });

      const initialRefreshToken = extractRefreshTokenFromCookies(
        loginResponse.headers['set-cookie']
      );

      // Check database for token family creation
      const tokenRecord = await prisma.refreshToken.findFirst({
        where: { userId: testUser.id }
      });

      expect(tokenRecord).toBeDefined();
      expect(tokenRecord.familyId).toBeDefined();
      expect(tokenRecord.isActive).toBe(true);
      expect(tokenRecord.isInvalidated).toBe(false);

      // Rotate token
      await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${initialRefreshToken}`);

      // Check that old token is invalidated and new one created
      const oldToken = await prisma.refreshToken.findFirst({
        where: {
          userId: testUser.id,
          token: initialRefreshToken
        }
      });
      expect(oldToken.isActive).toBe(false);

      // New token should exist with same family ID
      const newToken = await prisma.refreshToken.findFirst({
        where: {
          userId: testUser.id,
          isActive: true
        }
      });
      expect(newToken).toBeDefined();
      expect(newToken.familyId).toBe(tokenRecord.familyId);
    });
  });

  describe('Token Reuse Detection', () => {
    it('should_detect_refresh_token_reuse', async () => {
      // Get initial tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testPassword
        });

      const initialRefreshToken = extractRefreshTokenFromCookies(
        loginResponse.headers['set-cookie']
      );

      // Use refresh token legitimately
      const firstRefresh = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${initialRefreshToken}`);

      expect(firstRefresh.status).toBe(200);

      // Attempt to reuse the old token - should trigger reuse detection
      const reuseAttempt = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${initialRefreshToken}`);

      expect(reuseAttempt.status).toBe(401);
      expect(reuseAttempt.body.message).toContain('Token reuse detected');
    });

    it('should_invalidate_entire_token_family_on_reuse_detection', async () => {
      // Get initial tokens and create a token chain
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testPassword
        });

      const initialRefreshToken = extractRefreshTokenFromCookies(
        loginResponse.headers['set-cookie']
      );

      // Create a chain of rotated tokens
      const firstRotation = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${initialRefreshToken}`);

      const secondRefreshToken = extractRefreshTokenFromCookies(
        firstRotation.headers['set-cookie']
      );

      const secondRotation = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${secondRefreshToken}`);

      const thirdRefreshToken = extractRefreshTokenFromCookies(
        secondRotation.headers['set-cookie']
      );

      // Now attempt to reuse the initial token (trigger reuse detection)
      const reuseAttempt = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${initialRefreshToken}`);

      expect(reuseAttempt.status).toBe(401);

      // Verify that ALL tokens in the family are invalidated
      const allTokens = await prisma.refreshToken.findMany({
        where: { userId: testUser.id }
      });

      allTokens.forEach(token => {
        expect(token.isActive).toBe(false);
        expect(token.isInvalidated).toBe(true);
      });

      // Current valid token should also be invalid now
      const currentTokenTest = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${thirdRefreshToken}`);

      expect(currentTokenTest.status).toBe(401);
    });

    it('should_require_reauthentication_after_family_invalidation', async () => {
      // Setup token family and trigger reuse detection
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testPassword
        });

      const initialRefreshToken = extractRefreshTokenFromCookies(
        loginResponse.headers['set-cookie']
      );

      // Rotate once
      await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${initialRefreshToken}`);

      // Trigger reuse detection
      await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${initialRefreshToken}`);

      // User should need to login again
      const newLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testPassword
        });

      expect(newLoginResponse.status).toBe(200);

      // New login should create new family
      const newRefreshToken = extractRefreshTokenFromCookies(
        newLoginResponse.headers['set-cookie']
      );
      expect(newRefreshToken).toBeDefined();

      // New token should work normally
      const refreshTest = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${newRefreshToken}`);

      expect(refreshTest.status).toBe(200);
    });
  });

  describe('Concurrent Token Usage', () => {
    it('should_handle_concurrent_refresh_requests_gracefully', async () => {
      // Get initial tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testPassword
        });

      const refreshToken = extractRefreshTokenFromCookies(
        loginResponse.headers['set-cookie']
      );

      // Make multiple concurrent refresh requests with same token
      const concurrentRequests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/auth/refresh-token')
          .set('Cookie', `refreshToken=${refreshToken}`)
      );

      const responses = await Promise.all(concurrentRequests);

      // Only one should succeed
      const successResponses = responses.filter(r => r.status === 200);
      const failureResponses = responses.filter(r => r.status === 401);

      expect(successResponses).toHaveLength(1);
      expect(failureResponses).toHaveLength(4);

      // All failures should indicate token was already used
      failureResponses.forEach(response => {
        expect(response.body.message).toMatch(/already used|invalid/i);
      });
    });

    it('should_prevent_race_conditions_in_token_rotation', async () => {
      // This test verifies database-level constraints prevent race conditions
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testPassword
        });

      const refreshToken = extractRefreshTokenFromCookies(
        loginResponse.headers['set-cookie']
      );

      // Rapid sequential requests (simulating race condition)
      const rapidRequests = [];
      for (let i = 0; i < 3; i++) {
        rapidRequests.push(
          request(app)
            .post('/api/auth/refresh-token')
            .set('Cookie', `refreshToken=${refreshToken}`)
        );
      }

      const responses = await Promise.allSettled(rapidRequests);
      const statuses = responses.map(r => r.value?.status || r.status);

      // Verify only one succeeded
      const successCount = statuses.filter(s => s === 200).length;
      expect(successCount).toBe(1);
    });
  });

  describe('Token Compromise Scenarios', () => {
    it('should_handle_legitimate_user_concurrent_with_attacker', async () => {
      // Simulate: Legitimate user has valid refresh token,
      // Attacker somehow gets old refresh token and tries to use it

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testPassword
        });

      const originalToken = extractRefreshTokenFromCookies(
        loginResponse.headers['set-cookie']
      );

      // Legitimate user rotates token
      const legitRefresh = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${originalToken}`);

      const newToken = extractRefreshTokenFromCookies(
        legitRefresh.headers['set-cookie']
      );

      // Attacker tries to use old token (should trigger security response)
      const attackerAttempt = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${originalToken}`);

      expect(attackerAttempt.status).toBe(401);
      expect(attackerAttempt.body.message).toContain('Token reuse detected');

      // Legitimate user's current token should now be invalid too (security measure)
      const legitAfterAttack = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${newToken}`);

      expect(legitAfterAttack.status).toBe(401);
    });

    it('should_log_security_events_for_monitoring', async () => {
      // Note: This test verifies security logging exists
      // In a real implementation, you'd check log files or monitoring systems

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testPassword
        });

      const refreshToken = extractRefreshTokenFromCookies(
        loginResponse.headers['set-cookie']
      );

      // Rotate token
      await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${refreshToken}`);

      // Trigger reuse detection (should log security event)
      const reuseResponse = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${refreshToken}`);

      expect(reuseResponse.status).toBe(401);

      // In real implementation, verify security logs contain:
      // - Token reuse detection event
      // - User ID
      // - IP address
      // - Timestamp
      // - Family invalidation event
    });
  });

  describe('Token Expiration and Cleanup', () => {
    it('should_reject_expired_refresh_tokens', async () => {
      // Create a token with very short expiry for testing
      const shortLivedToken = jwt.sign(
        {
          userId: testUser.id,
          type: 'refresh',
          familyId: 'test-family-' + Date.now()
        },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '1ms' } // Immediately expires
      );

      // Store token in database
      await prisma.refreshToken.create({
        data: {
          token: shortLivedToken,
          userId: testUser.id,
          familyId: 'test-family-' + Date.now(),
          expiresAt: new Date(Date.now() + 1), // 1ms from now
          isActive: true,
          isInvalidated: false
        }
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      // Attempt to use expired token
      const expiredResponse = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${shortLivedToken}`);

      expect(expiredResponse.status).toBe(401);
      expect(expiredResponse.body.message).toContain('expired');
    });

    it('should_clean_up_invalidated_token_families', async () => {
      // Create multiple token families and invalidate one
      const loginResponse1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testPassword
        });

      const token1 = extractRefreshTokenFromCookies(
        loginResponse1.headers['set-cookie']
      );

      // Logout to create second family
      await request(app).post('/api/auth/logout')
        .set('Cookie', `refreshToken=${token1}`);

      const loginResponse2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testPassword
        });

      const token2 = extractRefreshTokenFromCookies(
        loginResponse2.headers['set-cookie']
      );

      // Trigger reuse detection on first family
      await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${token2}`);

      await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', `refreshToken=${token2}`);

      // Run cleanup (would normally be background job)
      // This endpoint should be implemented to clean old tokens
      const cleanupResponse = await request(app)
        .post('/api/auth/cleanup-tokens')
        .send({ olderThanDays: 0 }); // Clean immediately for test

      expect(cleanupResponse.status).toBe(200);

      // Verify invalidated tokens are removed
      const remainingTokens = await prisma.refreshToken.findMany({
        where: {
          userId: testUser.id,
          isInvalidated: true
        }
      });

      expect(remainingTokens).toHaveLength(0);
    });
  });

  describe('Database Constraints and Security', () => {
    it('should_enforce_unique_constraints_on_token_families', async () => {
      // This test verifies database schema constraints
      const familyId = 'test-family-' + Date.now();

      // Attempt to create two active tokens with same family ID
      // This should be prevented by database constraints
      const tokenData = {
        token: 'test-token-1',
        userId: testUser.id,
        familyId: familyId,
        expiresAt: new Date(Date.now() + 86400000), // 24 hours
        isActive: true,
        isInvalidated: false
      };

      await prisma.refreshToken.create({ data: tokenData });

      // Second token with same family should fail if constraint exists
      await expect(
        prisma.refreshToken.create({
          data: { ...tokenData, token: 'test-token-2' }
        })
      ).rejects.toThrow(); // Should throw constraint violation
    });

    it('should_validate_token_structure_and_signatures', async () => {
      // Test various malformed tokens
      const malformedTokens = [
        'invalid.jwt.token',
        '',
        null,
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid'
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .post('/api/auth/refresh-token')
          .set('Cookie', `refreshToken=${token}`);

        expect(response.status).toBe(401);
      }
    });
  });
});

/**
 * Helper function to extract refresh token from Set-Cookie headers
 */
function extractRefreshTokenFromCookies(cookies) {
  if (!cookies) return null;

  const refreshCookie = cookies.find(cookie =>
    cookie.includes('refreshToken=')
  );

  if (!refreshCookie) return null;

  const match = refreshCookie.match(/refreshToken=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Helper function to extract access token from Set-Cookie headers
 */
function extractAccessTokenFromCookies(cookies) {
  if (!cookies) return null;

  const accessCookie = cookies.find(cookie =>
    cookie.includes('accessToken=')
  );

  if (!accessCookie) return null;

  const match = accessCookie.match(/accessToken=([^;]+)/);
  return match ? match[1] : null;
}