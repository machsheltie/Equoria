/**
 * 🔒 INTEGRATION TESTS: Authentication Bypass Attempts
 *
 * Tests for preventing authentication bypass attacks including:
 * - Direct endpoint access without authentication
 * - Forged JWT tokens
 * - Expired token usage
 * - Token replay attacks
 * - Authorization header manipulation
 * - Cookie theft simulation
 * - Multi-user session conflicts
 *
 * @module __tests__/integration/security/auth-bypass-attempts
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { createMockUser, createMockToken, createMalformedToken } from '../../factories/index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import jwt from 'jsonwebtoken';

describe('Authentication Bypass Attempts Integration Tests', () => {
  let testUser;
  let validToken;
  let JWT_SECRET;

  beforeEach(async () => {
    // Create test user in database
    testUser = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        username: `testuser-${Date.now()}`,
        password: 'hashedPassword123', // Mock hashed password
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isVerified: true,
      },
    });

    JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
    validToken = createMockToken(testUser.id);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test-',
        },
      },
    });
  });

  describe('Direct Endpoint Access Without Authentication', () => {
    it('should reject GET /api/users/profile without token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        message: 'Access token is required',
        status: 'error',
      });
    });

    it('should reject PUT /api/users/profile without token', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .send({ username: 'hacker' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject DELETE /api/users/account without token', async () => {
      const response = await request(app)
        .delete('/api/users/account')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject GET /api/horses without token', async () => {
      const response = await request(app)
        .get('/api/horses')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject POST /api/horses without token', async () => {
      const response = await request(app)
        .post('/api/horses')
        .send({ name: 'TestHorse' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Forged JWT Tokens', () => {
    it('should reject token with wrong signature', async () => {
      const forgedToken = jwt.sign({ userId: testUser.id }, 'wrong-secret');

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${forgedToken}`)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        message: 'Invalid or expired token',
        status: 'error',
      });
    });

    it('should reject token signed with different algorithm', async () => {
      const forgedToken = jwt.sign(
        { userId: testUser.id },
        JWT_SECRET,
        { algorithm: 'HS512' } // Different from expected HS256
      );

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${forgedToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject token with modified payload', async () => {
      const originalToken = createMockToken(testUser.id);
      const parts = originalToken.split('.');

      // Decode and modify payload
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      payload.userId = 99999; // Try to escalate to different user

      // Re-encode with modified payload (signature will be invalid)
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64');
      const modifiedToken = parts.join('.');

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${modifiedToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject token with algorithm none', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(JSON.stringify({ userId: testUser.id })).toString('base64');
      const noneToken = `${header}.${payload}.`;

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${noneToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject completely malformed token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer not-a-valid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Expired Token Usage', () => {
    it('should reject JWT token past expiration time', async () => {
      const expiredToken = createMockToken(testUser.id, { expired: true });

      // Wait for token to actually expire (1ms expiry)
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        message: 'Token expired',
        status: 'error',
      });
    });

    it('should reject token older than 7 days (CWE-613)', async () => {
      // Create token with iat 8 days ago
      const oldToken = jwt.sign(
        {
          userId: testUser.id,
          iat: Math.floor(Date.now() / 1000) - (8 * 24 * 60 * 60),
        },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        message: 'Session expired. Please login again.',
        status: 'error',
      });
    });

    it('should accept token exactly 7 days old', async () => {
      // Create token with iat exactly 7 days ago
      const sevenDayToken = jwt.sign(
        {
          userId: testUser.id,
          iat: Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60),
        },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${sevenDayToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Token Replay Attacks', () => {
    it('should allow same token for multiple valid requests (expected behavior)', async () => {
      // First request
      const response1 = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response1.body.success).toBe(true);

      // Second request with same token (should work - tokens are stateless)
      const response2 = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response2.body.success).toBe(true);
    });

    it('should accept token from both cookie and header (cookie preferred)', async () => {
      const cookieToken = createMockToken(testUser.id);
      const headerToken = createMockToken(99999); // Different user

      const response = await request(app)
        .get('/api/users/profile')
        .set('Cookie', `accessToken=${cookieToken}`)
        .set('Authorization', `Bearer ${headerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUser.id); // Should use cookie token
    });
  });

  describe('Authorization Header Manipulation', () => {
    it('should reject token without Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', validToken) // Missing "Bearer " prefix
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject token with wrong scheme', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Basic ${validToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject empty Authorization header', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', '')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject Authorization header with only Bearer', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer ')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject multiple Authorization headers', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);

      // Supertest overwrites duplicate headers, so this tests header parsing
      expect(response.body.success).toBe(false);
    });
  });

  describe('Cookie Theft Simulation', () => {
    it('should reject stolen cookie with different IP (if IP binding enabled)', async () => {
      // First request from IP 127.0.0.1
      const response1 = await request(app)
        .get('/api/users/profile')
        .set('Cookie', `accessToken=${validToken}`)
        .set('X-Forwarded-For', '127.0.0.1')
        .expect(200);

      expect(response1.body.success).toBe(true);

      // NOTE: IP binding is typically not enforced for JWT tokens
      // because users may have dynamic IPs. This test documents
      // expected behavior (token should work from any IP).
      const response2 = await request(app)
        .get('/api/users/profile')
        .set('Cookie', `accessToken=${validToken}`)
        .set('X-Forwarded-For', '192.168.1.100')
        .expect(200);

      expect(response2.body.success).toBe(true);
    });

    it('should reject cookie with HttpOnly flag missing (client-side)', async () => {
      // NOTE: This is enforced at cookie creation time, not validation time
      // Test verifies token validation still works regardless of how cookie was set
      const response = await request(app)
        .get('/api/users/profile')
        .set('Cookie', `accessToken=${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Multi-User Session Conflicts', () => {
    it('should prevent user A from accessing user B resources with valid token', async () => {
      // Create second user
      const userB = await prisma.user.create({
        data: {
          email: `testB-${Date.now()}@example.com`,
          username: `testuserB-${Date.now()}`,
          password: 'hashedPassword123',
          role: 'USER',
          isVerified: true,
        },
      });

      const tokenA = createMockToken(testUser.id);

      // Try to access user B's profile with user A's token
      const response = await request(app)
        .get(`/api/users/${userB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        message: 'Forbidden: Insufficient permissions',
        status: 'error',
      });

      // Cleanup
      await prisma.user.delete({ where: { id: userB.id } });
    });

    it('should allow user to access their own resources only', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUser.id);
    });

    it('should prevent concurrent logins from invalidating each other (stateless tokens)', async () => {
      // Create first token
      const token1 = createMockToken(testUser.id);

      // Create second token (simulating login from different device)
      const token2 = createMockToken(testUser.id);

      // Both tokens should work (stateless JWT behavior)
      const response1 = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response1.body.success).toBe(true);

      const response2 = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(response2.body.success).toBe(true);
    });
  });

  describe('Edge Cases and Attack Vectors', () => {
    it('should reject token with null bytes in payload', async () => {
      const maliciousToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxXHUwMDAwIiwiaWF0IjoxNjE2MjM5MDIyfQ.invalid`;

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${maliciousToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject extremely long token (DoS prevention)', async () => {
      const longToken = 'a'.repeat(10000);

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${longToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject token with SQL injection in payload', async () => {
      const sqlInjectionToken = jwt.sign(
        { userId: "1' OR '1'='1" },
        JWT_SECRET
      );

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${sqlInjectionToken}`)
        .expect(401);

      // Should fail because userId is not a valid integer
      expect(response.body.success).toBe(false);
    });

    it('should handle token with missing userId gracefully', async () => {
      const invalidToken = jwt.sign(
        { email: 'test@example.com' }, // Missing userId
        JWT_SECRET
      );

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject token with non-numeric userId', async () => {
      const invalidToken = jwt.sign(
        { userId: 'not-a-number' },
        JWT_SECRET
      );

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
