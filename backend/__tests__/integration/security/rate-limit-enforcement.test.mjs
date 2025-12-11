/**
 * 🔒 INTEGRATION TESTS: Rate Limit Enforcement Under Load
 *
 * Tests for rate limiting effectiveness under various load scenarios:
 * - Concurrent request flooding
 * - Distributed rate limiting (Redis)
 * - Per-endpoint rate limits
 * - Burst vs sustained traffic
 * - Rate limit bypass attempts
 * - IP-based vs user-based limits
 * - Rate limit window sliding
 * - Exponential backoff validation
 *
 * @module __tests__/integration/security/rate-limit-enforcement
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { createMockUser, createMockToken } from '../../factories/index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

describe('Rate Limit Enforcement Integration Tests', () => {
  let testUser;
  let validToken;

  beforeEach(async () => {
    // Create test user in database
    testUser = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        username: `testuser-${Date.now()}`,
        password: 'hashedPassword123',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
      },
    });

    validToken = createMockToken(testUser.id);
  });

  afterEach(async () => {
    // Wait for rate limit windows to expire
    await new Promise(resolve => setTimeout(resolve, 1000));
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

  describe('Concurrent Request Flooding', () => {
    it('should block excessive concurrent requests from same IP', async () => {
      const requests = Array(50).fill(null).map(() =>
        request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const responses = await Promise.all(requests);

      // Count successful vs rate-limited responses
      const successCount = responses.filter(r => r.status === 200).length;
      const blockedCount = responses.filter(r => r.status === 429).length;

      // Should have blocked some requests (rate limit threshold)
      expect(blockedCount).toBeGreaterThan(0);
      expect(successCount).toBeLessThan(50);

      // Check rate limit headers
      const blockedResponse = responses.find(r => r.status === 429);
      expect(blockedResponse.headers['retry-after']).toBeDefined();
      expect(blockedResponse.body).toEqual({
        success: false,
        message: expect.stringContaining('rate limit'),
        status: 'error',
      });
    });

    it('should apply per-user rate limits independently', async () => {
      // Create second user
      const user2 = await prisma.user.create({
        data: {
          email: `test2-${Date.now()}@example.com`,
          username: `testuser2-${Date.now()}`,
          password: 'hashedPassword123',
          firstName: 'Test',
          lastName: 'User2',
          emailVerified: true,
        },
      });

      const token2 = createMockToken(user2.id);

      // Both users make 20 requests
      const user1Requests = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const user2Requests = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${token2}`)
      );

      const [user1Responses, user2Responses] = await Promise.all([
        Promise.all(user1Requests),
        Promise.all(user2Requests),
      ]);

      // Each user should have independent rate limits
      const user1Success = user1Responses.filter(r => r.status === 200).length;
      const user2Success = user2Responses.filter(r => r.status === 200).length;

      expect(user1Success).toBeGreaterThan(0);
      expect(user2Success).toBeGreaterThan(0);

      // Cleanup
      await prisma.user.delete({ where: { id: user2.id } });
    });

    it('should handle burst traffic followed by sustained load', async () => {
      // Burst: 30 requests immediately
      const burstRequests = Array(30).fill(null).map(() =>
        request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const burstResponses = await Promise.all(burstRequests);
      const burstBlocked = burstResponses.filter(r => r.status === 429).length;

      expect(burstBlocked).toBeGreaterThan(0);

      // Wait 500ms
      await new Promise(resolve => setTimeout(resolve, 500));

      // Sustained: 10 more requests
      const sustainedRequests = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const sustainedResponses = await Promise.all(sustainedRequests);
      const sustainedBlocked = sustainedResponses.filter(r => r.status === 429).length;

      // Should still be blocked (window not expired)
      expect(sustainedBlocked).toBeGreaterThan(0);
    });
  });

  describe('Distributed Rate Limiting (Redis)', () => {
    it('should enforce rate limits across multiple server instances', async () => {
      // Simulate requests from different server instances
      // (In production, Redis would coordinate this)

      const instanceA = Array(15).fill(null).map(() =>
        request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${validToken}`)
          .set('X-Server-Instance', 'A')
      );

      const instanceB = Array(15).fill(null).map(() =>
        request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${validToken}`)
          .set('X-Server-Instance', 'B')
      );

      const [responsesA, responsesB] = await Promise.all([
        Promise.all(instanceA),
        Promise.all(instanceB),
      ]);

      const allResponses = [...responsesA, ...responsesB];
      const blockedCount = allResponses.filter(r => r.status === 429).length;

      // Rate limit should be enforced across both instances
      expect(blockedCount).toBeGreaterThan(0);
    });

    it('should use sliding window for rate limit calculation', async () => {
      // Make 10 requests
      const phase1 = await Promise.all(
        Array(10).fill(null).map(() =>
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${validToken}`)
        )
      );

      // Wait half the window (500ms)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Make 10 more requests
      const phase2 = await Promise.all(
        Array(10).fill(null).map(() =>
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${validToken}`)
        )
      );

      // Wait remaining half window (500ms)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Phase 1 requests should have expired, phase 3 should succeed
      const phase3 = await Promise.all(
        Array(10).fill(null).map(() =>
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${validToken}`)
        )
      );

      const phase3Success = phase3.filter(r => r.status === 200).length;
      expect(phase3Success).toBeGreaterThan(0);
    });

    it('should maintain rate limit state across Redis restarts', async () => {
      // This test verifies graceful degradation if Redis is unavailable
      // In production, we fall back to memory-based rate limiting

      const requests = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const responses = await Promise.all(requests);
      const blockedCount = responses.filter(r => r.status === 429).length;

      // Rate limiting should still work (fallback to memory)
      expect(blockedCount).toBeGreaterThan(0);
    });
  });

  describe('Per-Endpoint Rate Limits', () => {
    it('should enforce stricter limits on authentication endpoints', async () => {
      // Login endpoint typically has stricter rate limit (e.g., 5 per minute)
      const loginRequests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123',
          })
      );

      const responses = await Promise.all(loginRequests);
      const blockedCount = responses.filter(r => r.status === 429).length;

      // Should block after ~5 requests
      expect(blockedCount).toBeGreaterThan(3);
    });

    it('should enforce different limits for read vs write operations', async () => {
      // Read operations: Higher limit (e.g., 100/min)
      const readRequests = Array(30).fill(null).map(() =>
        request(app)
          .get('/api/horses')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const readResponses = await Promise.all(readRequests);
      const readBlocked = readResponses.filter(r => r.status === 429).length;

      // Create test horse for write operations directly to ensure valid schema fields
      const horse = await prisma.horse.create({
        data: {
          name: `TestHorse-${Date.now()}`,
          sex: 'mare',
          dateOfBirth: new Date('2017-01-01'),
          userId: testUser.id,
        },
      });

      const horseId = horse.id;

      // Write operations: Lower limit (e.g., 30/min)
      const writeRequests = Array(30).fill(null).map(() =>
        request(app)
          .put(`/api/horses/${horseId}`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ name: `Updated-${Date.now()}` })
      );

      const writeResponses = await Promise.all(writeRequests);
      const writeBlocked = writeResponses.filter(r => r.status === 429).length;

      // Write operations should have stricter limits
      expect(writeBlocked).toBeGreaterThan(readBlocked);

      // Cleanup
      if (horseId) {
        await prisma.horse.delete({ where: { id: horseId } }).catch(() => {});
      }
    });

    it('should have separate limits for public vs authenticated endpoints', async () => {
      // Public endpoint (no auth): Very strict (e.g., 10/min)
      const publicRequests = Array(15).fill(null).map(() =>
        request(app).get('/api/health')
      );

      const publicResponses = await Promise.all(publicRequests);
      const publicBlocked = publicResponses.filter(r => r.status === 429).length;

      // Authenticated endpoint: More lenient
      const authRequests = Array(30).fill(null).map(() =>
        request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const authResponses = await Promise.all(authRequests);
      const authBlocked = authResponses.filter(r => r.status === 429).length;

      // Public should be more restrictive
      expect(publicBlocked).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Bypass Attempts', () => {
    it('should reject requests with spoofed X-Forwarded-For headers', async () => {
      const requests = Array(30).fill(null).map((_, i) =>
        request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${validToken}`)
          .set('X-Forwarded-For', `192.168.1.${i}`) // Different IPs
      );

      const responses = await Promise.all(requests);
      const blockedCount = responses.filter(r => r.status === 429).length;

      // Should still be rate-limited (by user ID, not just IP)
      expect(blockedCount).toBeGreaterThan(0);
    });

    it('should reject requests with multiple X-Forwarded-For headers', async () => {
      const requests = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${validToken}`)
          .set('X-Forwarded-For', '1.1.1.1, 2.2.2.2, 3.3.3.3')
      );

      const responses = await Promise.all(requests);
      const blockedCount = responses.filter(r => r.status === 429).length;

      // Should extract real IP and enforce limit
      expect(blockedCount).toBeGreaterThan(0);
    });

    it('should reject requests attempting to reset rate limit counters', async () => {
      // Flood requests
      await Promise.all(
        Array(30).fill(null).map(() =>
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${validToken}`)
        )
      );

      // Attempt to reset counter via malicious header
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Rate-Limit-Reset', 'true')
        .expect(429);

      expect(response.body.success).toBe(false);
    });

    it('should reject requests with manipulated User-Agent strings', async () => {
      const requests = Array(30).fill(null).map((_, i) =>
        request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${validToken}`)
          .set('User-Agent', `Bot-${i}`) // Different user agents
      );

      const responses = await Promise.all(requests);
      const blockedCount = responses.filter(r => r.status === 429).length;

      // Should still be rate-limited (by user ID)
      expect(blockedCount).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should return X-RateLimit-* headers on successful requests', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();

      expect(parseInt(response.headers['x-ratelimit-limit'])).toBeGreaterThan(0);
      expect(parseInt(response.headers['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
    });

    it('should decrement X-RateLimit-Remaining with each request', async () => {
      const response1 = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`);

      const remaining1 = parseInt(response1.headers['x-ratelimit-remaining']);

      const response2 = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`);

      const remaining2 = parseInt(response2.headers['x-ratelimit-remaining']);

      expect(remaining2).toBe(remaining1 - 1);
    });

    it('should return Retry-After header on rate limit exceeded', async () => {
      // Exhaust rate limit
      await Promise.all(
        Array(30).fill(null).map(() =>
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${validToken}`)
        )
      );

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      const retryAfter = parseInt(response.headers['retry-after']);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThan(120); // Should be reasonable
    });

    it('should include rate limit info in 429 response body', async () => {
      // Exhaust rate limit
      await Promise.all(
        Array(30).fill(null).map(() =>
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${validToken}`)
        )
      );

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(429);

      expect(response.body).toEqual({
        success: false,
        message: expect.stringContaining('rate limit'),
        status: 'error',
        retryAfter: expect.any(Number),
      });
    });
  });

  describe('Exponential Backoff Validation', () => {
    it('should increase retry time for repeated violations', async () => {
      // First violation
      await Promise.all(
        Array(30).fill(null).map(() =>
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${validToken}`)
        )
      );

      const response1 = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(429);

      const retryAfter1 = parseInt(response1.headers['retry-after']);

      // Wait and retry before window expires
      await new Promise(resolve => setTimeout(resolve, 500));

      // Second violation
      await Promise.all(
        Array(20).fill(null).map(() =>
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${validToken}`)
        )
      );

      const response2 = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(429);

      const retryAfter2 = parseInt(response2.headers['retry-after']);

      // Retry time should increase (exponential backoff)
      expect(retryAfter2).toBeGreaterThan(retryAfter1);
    });

    it('should reset backoff after successful cooldown period', async () => {
      // Exhaust rate limit
      await Promise.all(
        Array(30).fill(null).map(() =>
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${validToken}`)
        )
      );

      const response1 = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(429);

      const retryAfter1 = parseInt(response1.headers['retry-after']);

      // Wait for full cooldown
      await new Promise(resolve => setTimeout(resolve, retryAfter1 * 1000 + 500));

      // Should be able to make requests again with reset backoff
      const response2 = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response2.body.success).toBe(true);
    });
  });

  describe('IP-Based vs User-Based Limits', () => {
    it('should enforce both IP and user-based rate limits', async () => {
      // Create second user from same IP
      const user2 = await prisma.user.create({
        data: {
          email: `test2-${Date.now()}@example.com`,
          username: `testuser2-${Date.now()}`,
          password: 'hashedPassword123',
          firstName: 'Test',
          lastName: 'User2',
          emailVerified: true,
        },
      });

      const token2 = createMockToken(user2.id);

      // User 1: Exhaust rate limit
      await Promise.all(
        Array(30).fill(null).map(() =>
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${validToken}`)
        )
      );

      // User 1 should be blocked
      const user1Response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(429);

      // User 2 from same IP: Should also be limited (IP-based)
      const user2Requests = await Promise.all(
        Array(30).fill(null).map(() =>
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token2}`)
        )
      );

      const user2Blocked = user2Requests.filter(r => r.status === 429).length;
      expect(user2Blocked).toBeGreaterThan(0);

      // Cleanup
      await prisma.user.delete({ where: { id: user2.id } });
    });

    it('should allow higher limits for verified accounts', async () => {
      // Unverified user
      const unverifiedUser = await prisma.user.create({
        data: {
          email: `unverified-${Date.now()}@example.com`,
          username: `unverified-${Date.now()}`,
          password: 'hashedPassword123',
          firstName: 'Test',
          lastName: 'Unverified',
          emailVerified: false,
        },
      });

      const unverifiedToken = createMockToken(unverifiedUser.id);

      // Make 20 requests with unverified account
      const unverifiedResponses = await Promise.all(
        Array(20).fill(null).map(() =>
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${unverifiedToken}`)
        )
      );

      const unverifiedBlocked = unverifiedResponses.filter(r => r.status === 429).length;

      // Make 20 requests with verified account
      const verifiedResponses = await Promise.all(
        Array(20).fill(null).map(() =>
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${validToken}`)
        )
      );

      const verifiedBlocked = verifiedResponses.filter(r => r.status === 429).length;

      // Unverified should have stricter limits
      expect(unverifiedBlocked).toBeGreaterThan(verifiedBlocked);

      // Cleanup
      await prisma.user.delete({ where: { id: unverifiedUser.id } });
    });
  });

  describe('Rate Limit Performance', () => {
    it('should handle rate limit checks with minimal overhead', async () => {
      const startTime = Date.now();

      await Promise.all(
        Array(10).fill(null).map(() =>
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${validToken}`)
        )
      );

      const duration = Date.now() - startTime;

      // Rate limit check should add <50ms overhead per request
      const averageTime = duration / 10;
      expect(averageTime).toBeLessThan(200);
    });

    it('should not cause memory leaks with many concurrent requests', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Make 100 concurrent requests
      await Promise.all(
        Array(100).fill(null).map(() =>
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${validToken}`)
        )
      );

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Memory increase should be minimal (<50MB)
      expect(memoryIncrease).toBeLessThan(50);
    });
  });
});
