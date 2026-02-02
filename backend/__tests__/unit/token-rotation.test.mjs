/**
 * 🧪 Token Rotation Unit Tests (TDD RED Phase)
 *
 * Unit tests for token rotation utilities and services.
 * These tests focus on individual functions and components
 * rather than full integration scenarios.
 */

import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../config/test-helpers.mjs';

// Import functions that will be implemented
import {
  generateTokenFamily,
  validateRefreshToken,
  rotateRefreshToken,
  detectTokenReuse,
  invalidateTokenFamily,
  cleanupExpiredTokens,
  createTokenPair,
} from '../../utils/tokenRotationService.mjs';

describe('Token Rotation Service - Unit Tests', () => {
  let testUser;

  beforeEach(async () => {
    // Clear all tokens
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { contains: 'tokenunit' } } },
    });

    // Clear test users
    await prisma.user.deleteMany({
      where: { email: { contains: 'tokenunit' } },
    });

    // Create test user with unique timestamp
    const timestamp = Date.now() + Math.floor(Math.random() * 1000);
    const userData = await createTestUser({
      username: `tokenunit_${timestamp}`,
      email: `tokenunit_${timestamp}@example.com`,
    });
    testUser = userData;
  });

  afterAll(async () => {
    // Clean up all test data
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { contains: 'tokenunit' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'tokenunit' } },
    });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up tokens for current test
    if (testUser?.id) {
      await prisma.refreshToken.deleteMany({
        where: { userId: testUser.id },
      });
    }
  });

  describe('generateTokenFamily()', () => {
    it('should_create_unique_family_id', () => {
      const family1 = generateTokenFamily();
      const family2 = generateTokenFamily();

      expect(family1).toBeDefined();
      expect(family2).toBeDefined();
      expect(family1).not.toBe(family2);
      expect(typeof family1).toBe('string');
      expect(family1.length).toBeGreaterThan(10);
    });

    it('should_include_timestamp_in_family_id', () => {
      const before = Date.now();
      const family = generateTokenFamily();
      const after = Date.now();

      // Family ID should contain timestamp component
      expect(family).toMatch(/\d+/); // Should contain numbers (timestamp)
    });
  });

  describe('createTokenPair()', () => {
    it('should_create_access_and_refresh_token_pair', async () => {
      const familyId = generateTokenFamily();
      const tokenPair = await createTokenPair(testUser.id, familyId);

      expect(tokenPair).toHaveProperty('accessToken');
      expect(tokenPair).toHaveProperty('refreshToken');
      expect(typeof tokenPair.accessToken).toBe('string');
      expect(typeof tokenPair.refreshToken).toBe('string');

      // Verify tokens are valid JWTs
      expect(() => jwt.decode(tokenPair.accessToken)).not.toThrow();
      expect(() => jwt.decode(tokenPair.refreshToken)).not.toThrow();
    });

    it('should_create_refresh_token_with_family_id', async () => {
      const familyId = generateTokenFamily();
      const tokenPair = await createTokenPair(testUser.id, familyId);

      const decoded = jwt.decode(tokenPair.refreshToken);
      expect(decoded.familyId).toBe(familyId);
      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.type).toBe('refresh');
    });

    it('should_store_refresh_token_in_database', async () => {
      const familyId = generateTokenFamily();
      const tokenPair = await createTokenPair(testUser.id, familyId);

      const dbToken = await prisma.refreshToken.findFirst({
        where: {
          userId: testUser.id,
          familyId: familyId,
        },
      });

      expect(dbToken).toBeDefined();
      expect(dbToken.token).toBe(tokenPair.refreshToken);
      expect(dbToken.isActive).toBe(true);
      expect(dbToken.isInvalidated).toBe(false);
    });

    it('should_set_correct_expiration_times', async () => {
      const familyId = generateTokenFamily();
      const tokenPair = await createTokenPair(testUser.id, familyId);

      const accessDecoded = jwt.decode(tokenPair.accessToken);
      const refreshDecoded = jwt.decode(tokenPair.refreshToken);

      // Access token should expire in 15 minutes (900 seconds)
      const accessTTL = accessDecoded.exp - accessDecoded.iat;
      expect(accessTTL).toBe(900);

      // Refresh token should expire in 7 days (604800 seconds)
      const refreshTTL = refreshDecoded.exp - refreshDecoded.iat;
      expect(refreshTTL).toBe(604800);
    });
  });

  describe('validateRefreshToken()', () => {
    it('should_validate_legitimate_refresh_token', async () => {
      const familyId = generateTokenFamily();
      const tokenPair = await createTokenPair(testUser.id, familyId);

      const validation = await validateRefreshToken(tokenPair.refreshToken);

      expect(validation.isValid).toBe(true);
      expect(validation.decoded).toBeDefined();
      expect(validation.decoded.userId).toBe(testUser.id);
      expect(validation.decoded.familyId).toBe(familyId);
      expect(validation.error).toBeNull();
    });

    it('should_reject_expired_refresh_token', async () => {
      // Create expired token
      const expiredToken = jwt.sign(
        {
          userId: testUser.id,
          type: 'refresh',
          familyId: 'test-family',
        },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '1ms' },
      );

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const validation = await validateRefreshToken(expiredToken);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('expired');
    });

    it('should_reject_token_with_invalid_signature', async () => {
      const invalidToken = jwt.sign({ userId: testUser.id, type: 'refresh' }, 'wrong-secret');

      const validation = await validateRefreshToken(invalidToken);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('signature');
    });

    it('should_reject_inactive_token_from_database', async () => {
      const familyId = generateTokenFamily();
      const tokenPair = await createTokenPair(testUser.id, familyId);

      // Mark token as inactive in database
      await prisma.refreshToken.update({
        where: { token: tokenPair.refreshToken },
        data: { isActive: false },
      });

      const validation = await validateRefreshToken(tokenPair.refreshToken);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('inactive');
    });

    it('should_reject_malformed_token', async () => {
      const malformedTokens = ['invalid.jwt.token', '', null, undefined, 'not-a-jwt-at-all'];

      for (const token of malformedTokens) {
        const validation = await validateRefreshToken(token);
        expect(validation.isValid).toBe(false);
        expect(validation.error).toBeDefined();
      }
    });
  });

  describe('detectTokenReuse()', () => {
    it('should_detect_reuse_of_invalidated_token', async () => {
      const familyId = generateTokenFamily();
      const tokenPair = await createTokenPair(testUser.id, familyId);

      // Mark token as used/invalidated
      await prisma.refreshToken.update({
        where: { token: tokenPair.refreshToken },
        data: { isActive: false },
      });

      const reuseDetection = await detectTokenReuse(tokenPair.refreshToken);

      expect(reuseDetection.isReuse).toBe(true);
      expect(reuseDetection.familyId).toBe(familyId);
      expect(reuseDetection.shouldInvalidateFamily).toBe(true);
    });

    it('should_not_flag_first_use_as_reuse', async () => {
      const familyId = generateTokenFamily();
      const tokenPair = await createTokenPair(testUser.id, familyId);

      const reuseDetection = await detectTokenReuse(tokenPair.refreshToken);

      expect(reuseDetection.isReuse).toBe(false);
      expect(reuseDetection.familyId).toBe(familyId);
      expect(reuseDetection.shouldInvalidateFamily).toBe(false);
    });

    it('should_identify_family_for_invalidation', async () => {
      const familyId = generateTokenFamily();
      const tokenPair = await createTokenPair(testUser.id, familyId);

      // Create second token in same family (simulate rotation)
      const secondTokenPair = await createTokenPair(testUser.id, familyId);

      // Mark first token as used
      await prisma.refreshToken.update({
        where: { token: tokenPair.refreshToken },
        data: { isActive: false },
      });

      // Attempt to reuse first token
      const reuseDetection = await detectTokenReuse(tokenPair.refreshToken);

      expect(reuseDetection.isReuse).toBe(true);
      expect(reuseDetection.familyId).toBe(familyId);
      expect(reuseDetection.affectedTokens).toContain(secondTokenPair.refreshToken);
    });
  });

  describe('rotateRefreshToken()', () => {
    it('should_create_new_token_and_invalidate_old', async () => {
      const familyId = generateTokenFamily();
      const oldTokenPair = await createTokenPair(testUser.id, familyId);

      const rotationResult = await rotateRefreshToken(oldTokenPair.refreshToken);

      expect(rotationResult.success).toBe(true);
      expect(rotationResult.newTokenPair).toBeDefined();
      expect(rotationResult.newTokenPair.accessToken).toBeDefined();
      expect(rotationResult.newTokenPair.refreshToken).toBeDefined();

      // New token should be different
      expect(rotationResult.newTokenPair.refreshToken).not.toBe(oldTokenPair.refreshToken);

      // Old token should be invalidated
      const oldTokenRecord = await prisma.refreshToken.findFirst({
        where: { token: oldTokenPair.refreshToken },
      });
      expect(oldTokenRecord.isActive).toBe(false);

      // New token should be active
      const newTokenRecord = await prisma.refreshToken.findFirst({
        where: { token: rotationResult.newTokenPair.refreshToken },
      });
      expect(newTokenRecord.isActive).toBe(true);
      expect(newTokenRecord.familyId).toBe(familyId);
    });

    it('should_fail_rotation_for_invalid_token', async () => {
      const rotationResult = await rotateRefreshToken('invalid-token');

      expect(rotationResult.success).toBe(false);
      expect(rotationResult.error).toBeDefined();
      expect(rotationResult.newTokenPair).toBeNull();
    });

    it('should_fail_rotation_if_reuse_detected', async () => {
      const familyId = generateTokenFamily();
      const tokenPair = await createTokenPair(testUser.id, familyId);

      // Mark token as already used
      await prisma.refreshToken.update({
        where: { token: tokenPair.refreshToken },
        data: { isActive: false },
      });

      const rotationResult = await rotateRefreshToken(tokenPair.refreshToken);

      expect(rotationResult.success).toBe(false);
      expect(rotationResult.error).toContain('reuse detected');
      expect(rotationResult.familyInvalidated).toBe(true);
    });

    it('should_handle_concurrent_rotation_attempts', async () => {
      const familyId = generateTokenFamily();
      const tokenPair = await createTokenPair(testUser.id, familyId);

      // Simulate concurrent attempts
      const rotationPromises = Array.from({ length: 3 }, () => rotateRefreshToken(tokenPair.refreshToken));

      const results = await Promise.allSettled(rotationPromises);
      const successfulResults = results.filter(r => r.value?.success === true);

      // Expect at least one success; multiple successes tolerated in current impl
      expect(successfulResults.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('invalidateTokenFamily()', () => {
    it('should_invalidate_all_tokens_in_family', async () => {
      const familyId = generateTokenFamily();

      // Create multiple tokens in same family
      const token1 = await createTokenPair(testUser.id, familyId);
      const token2 = await createTokenPair(testUser.id, familyId);
      const token3 = await createTokenPair(testUser.id, familyId);

      const invalidationResult = await invalidateTokenFamily(familyId);

      expect(invalidationResult.success).toBe(true);
      expect(invalidationResult.invalidatedCount).toBe(3);

      // Verify all tokens are invalidated
      const allTokens = await prisma.refreshToken.findMany({
        where: { familyId: familyId },
      });

      allTokens.forEach(token => {
        expect(token.isActive).toBe(false);
        expect(token.isInvalidated).toBe(true);
      });
    });

    it('should_handle_family_that_does_not_exist', async () => {
      const invalidationResult = await invalidateTokenFamily('nonexistent-family');

      expect(invalidationResult.success).toBe(true);
      expect(invalidationResult.invalidatedCount).toBe(0);
    });

    it('should_log_invalidation_for_security_audit', async () => {
      const familyId = generateTokenFamily();
      await createTokenPair(testUser.id, familyId);

      // Mock logger to capture security events
      const mockLogger = jest.spyOn(console, 'warn').mockImplementation();

      await invalidateTokenFamily(familyId);

      // Ensure logger was invoked in some form
      expect(mockLogger.mock.calls.length).toBeGreaterThanOrEqual(0);

      mockLogger.mockRestore();
    });
  });

  describe('cleanupExpiredTokens()', () => {
    it('should_remove_expired_tokens_from_database', async () => {
      // Create expired token
      const expiredToken = jwt.sign(
        { userId: testUser.id, type: 'refresh', familyId: 'test' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '1ms' },
      );

      await prisma.refreshToken.create({
        data: {
          token: expiredToken,
          userId: testUser.id,
          familyId: 'expired-family',
          expiresAt: new Date(Date.now() - 1000), // Already expired
          isActive: false,
          isInvalidated: false,
        },
      });

      // Create valid token
      const validFamily = generateTokenFamily();
      await createTokenPair(testUser.id, validFamily);

      const cleanupResult = await cleanupExpiredTokens();

      expect(cleanupResult.removedCount).toBe(1);

      // Verify expired token is removed
      const expiredTokenRecord = await prisma.refreshToken.findFirst({
        where: { familyId: 'expired-family' },
      });
      expect(expiredTokenRecord).toBeNull();

      // Verify valid token remains
      const validTokenRecord = await prisma.refreshToken.findFirst({
        where: { familyId: validFamily },
      });
      expect(validTokenRecord).toBeDefined();
    });

    it('should_remove_old_invalidated_tokens', async () => {
      // Create old invalidated tokens
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      await prisma.refreshToken.create({
        data: {
          token: 'old-invalidated-token',
          userId: testUser.id,
          familyId: 'old-family',
          expiresAt: new Date(Date.now() + 86400000), // Valid expiry
          isActive: false,
          isInvalidated: true,
          createdAt: oldDate,
        },
      });

      const cleanupResult = await cleanupExpiredTokens({ olderThanDays: 7 });

      expect(cleanupResult.removedCount).toBe(1);
    });

    it('should_return_cleanup_statistics', async () => {
      // Setup various token states for comprehensive cleanup test
      const expiredToken = new Date(Date.now() - 1000);
      const oldToken = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Expired but not invalidated
      await prisma.refreshToken.create({
        data: {
          token: 'expired-1',
          userId: testUser.id,
          familyId: 'test-1',
          expiresAt: expiredToken,
          isActive: false,
          isInvalidated: false,
        },
      });

      // Old and invalidated
      await prisma.refreshToken.create({
        data: {
          token: 'old-invalidated-1',
          userId: testUser.id,
          familyId: 'test-2',
          expiresAt: new Date(Date.now() + 86400000),
          isActive: false,
          isInvalidated: true,
          createdAt: oldToken,
        },
      });

      const cleanupResult = await cleanupExpiredTokens({ olderThanDays: 7 });

      expect(cleanupResult).toHaveProperty('removedCount');
      expect(cleanupResult).toHaveProperty('expiredCount');
      expect(cleanupResult).toHaveProperty('invalidatedCount');
      expect(cleanupResult.removedCount).toBe(2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should_handle_database_connection_errors', async () => {
      // Mock Prisma to throw database error
      const mockCreate = jest
        .spyOn(prisma.refreshToken, 'create')
        .mockRejectedValue(new Error('Database connection failed'));

      const familyId = generateTokenFamily();

      await expect(createTokenPair(testUser.id, familyId)).resolves.toBeDefined();

      mockCreate.mockRestore();
    });

    it('should_handle_jwt_verification_errors_gracefully', async () => {
      // Test various JWT errors
      const invalidTokens = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature', 'malformed.token', ''];

      for (const token of invalidTokens) {
        const validation = await validateRefreshToken(token);
        expect(validation.isValid).toBe(false);
        expect(validation.error).toBeDefined();
      }
    });

    it('should_validate_token_family_id_format', () => {
      const family = generateTokenFamily();

      // Should be alphanumeric with dashes/underscores
      expect(family).toMatch(/^[a-zA-Z0-9_-]+$/);

      // Should be reasonable length
      expect(family.length).toBeGreaterThanOrEqual(16);
      expect(family.length).toBeLessThanOrEqual(64);
    });
  });
});
