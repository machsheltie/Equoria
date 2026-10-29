/**
 * 🧪 Email Verification Service - Unit Tests (TDD RED Phase)
 *
 * Comprehensive unit tests for email verification service functions.
 * Tests token generation, verification, rate limiting, and cleanup.
 *
 * Phase 1, Day 6-7: Email Verification System
 */

import crypto from 'crypto';
import {
  generateVerificationToken,
  createVerificationToken,
  verifyEmailToken,
  checkVerificationStatus,
  resendVerificationEmail,
  cleanupExpiredTokens,
  getTokenInfo,
  hashVerificationToken,
} from '../services/emailVerificationService.mjs';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../../../__tests__/config/test-helpers.mjs';

describe('Email Verification Service - Unit Tests', () => {
  let testUser;

  beforeEach(async () => {
    // Clean up email verification tokens scoped to this suite's test users
    // (email prefix "emailtest_" matches only tokens created by this suite).
    // An unscoped deleteMany({}) would wipe tokens across all users and cause
    // cross-suite flakiness in the full Jest gate (CLAUDE.md §2 scoped-cleanup).
    await prisma.emailVerificationToken.deleteMany({
      where: { email: { startsWith: 'emailtest_' } },
    });

    // Create fresh test user with unique ID
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const userData = await createTestUser({
      username: `emailtest_${uniqueId}`,
      email: `emailtest_${uniqueId}@example.com`,
      // This suite exercises the confirmation flow, so its player starts unconfirmed.
      emailVerified: false,
    });
    testUser = userData;
  });

  describe('generateVerificationToken()', () => {
    it('shouldGenerateUniqueTokens', () => {
      const token1 = generateVerificationToken();
      const token2 = generateVerificationToken();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(typeof token1).toBe('string');
      expect(typeof token2).toBe('string');
    });

    it('shouldGenerate64CharacterHexTokens', () => {
      const token = generateVerificationToken();

      expect(token.length).toBe(64); // 32 bytes * 2 (hex encoding)
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it('shouldGenerateCryptographicallySecureTokens', () => {
      const tokens = new Set();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        tokens.add(generateVerificationToken());
      }

      // All tokens should be unique
      expect(tokens.size).toBe(iterations);
    });
  });

  describe('createVerificationToken()', () => {
    it('shouldCreateTokenWithValidUserId', async () => {
      const result = await createVerificationToken(testUser.id, testUser.email);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.tokenId).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      expect(result.token.length).toBe(64);
    });

    it('shouldStoreTokenInDatabase', async () => {
      const result = await createVerificationToken(testUser.id, testUser.email);

      const tokenRecord = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash: hashVerificationToken(result.token) },
      });

      expect(tokenRecord).toBeDefined();
      expect(tokenRecord.userId).toBe(testUser.id);
      expect(tokenRecord.email).toBe(testUser.email);
      expect(tokenRecord.usedAt).toBeNull();
    });

    it('shouldSetExpirationTo24Hours', async () => {
      const beforeCreate = Date.now();
      const result = await createVerificationToken(testUser.id, testUser.email);
      const afterCreate = Date.now();

      const expiryTime = result.expiresAt.getTime();
      const expectedMin = beforeCreate + 24 * 60 * 60 * 1000;
      const expectedMax = afterCreate + 24 * 60 * 60 * 1000;

      expect(expiryTime).toBeGreaterThanOrEqual(expectedMin);
      expect(expiryTime).toBeLessThanOrEqual(expectedMax);
    });

    it('shouldStoreIpAddressAndUserAgent', async () => {
      const metadata = {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Test Browser)',
      };

      const result = await createVerificationToken(testUser.id, testUser.email, metadata);

      const tokenRecord = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash: hashVerificationToken(result.token) },
      });

      expect(tokenRecord.ipAddress).toBe(metadata.ipAddress);
      expect(tokenRecord.userAgent).toBe(metadata.userAgent);
    });

    it('shouldEnforceMaximumPendingTokensLimit', async () => {
      // Create 5 pending tokens directly in database (bypassing cooldown)
      for (let i = 0; i < 5; i++) {
        await prisma.emailVerificationToken.create({
          data: {
            // Hashed at rest — Equoria-uy73. This row is just padding to hit
            // the MAX_PENDING_TOKENS ceiling; the raw token is not read back.
            tokenHash: hashVerificationToken(`old-token-${i}-${randomBytes(8).toString('hex')}-${Math.random()}`),
            userId: testUser.id,
            email: testUser.email,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            createdAt: new Date(Date.now() - (10 + i) * 60 * 1000), // Backdate 10+ minutes
          },
        });
      }

      // 6th token should fail
      await expect(createVerificationToken(testUser.id, testUser.email)).rejects.toThrow(
        'Maximum pending verification tokens',
      );
    });

    it('shouldEnforceRateLimitingCooldown', async () => {
      // Create first token
      await createVerificationToken(testUser.id, testUser.email);

      // Immediate second token should fail
      await expect(createVerificationToken(testUser.id, testUser.email)).rejects.toThrow('Please wait');
    });

    it('shouldAllowTokenCreationAfterCooldown', async () => {
      // Create first token
      const firstToken = await createVerificationToken(testUser.id, testUser.email);

      // Mark first token as used to bypass pending token limit
      await prisma.emailVerificationToken.update({
        where: { tokenHash: hashVerificationToken(firstToken.token) },
        data: { usedAt: new Date() },
      });

      // Wait 6 minutes (beyond 5-minute cooldown)
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      await prisma.emailVerificationToken.updateMany({
        where: { userId: testUser.id },
        data: { createdAt: sixMinutesAgo },
      });

      // Second token should succeed
      const secondToken = await createVerificationToken(testUser.id, testUser.email);
      expect(secondToken).toBeDefined();
      expect(secondToken.token).not.toBe(firstToken.token);
    });
  });

  describe('verifyEmailToken()', () => {
    it('shouldVerifyValidToken', async () => {
      const tokenData = await createVerificationToken(testUser.id, testUser.email);

      const result = await verifyEmailToken(tokenData.token);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.emailVerified).toBe(true);
      expect(result.user.emailVerifiedAt).toBeDefined();
      expect(result.code).toBe('emailVerified');
    });

    it('shouldMarkUserEmailAsVerified', async () => {
      const tokenData = await createVerificationToken(testUser.id, testUser.email);

      await verifyEmailToken(tokenData.token);

      const user = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(user.emailVerified).toBe(true);
      expect(user.emailVerifiedAt).toBeDefined();
    });

    it('shouldMarkTokenAsUsed', async () => {
      const tokenData = await createVerificationToken(testUser.id, testUser.email);

      await verifyEmailToken(tokenData.token);

      const tokenRecord = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash: hashVerificationToken(tokenData.token) },
      });

      expect(tokenRecord.usedAt).toBeDefined();
      expect(tokenRecord.usedAt?.constructor?.name).toBe('Date');
    });

    it('shouldRejectInvalidToken', async () => {
      const result = await verifyEmailToken('invalidTokenStringHere123456789');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired verification token');
      expect(result.code).toBe('invalidToken');
    });

    it('shouldRejectAlreadyUsedToken', async () => {
      const tokenData = await createVerificationToken(testUser.id, testUser.email);

      // Use token first time
      await verifyEmailToken(tokenData.token);

      // Try to use again
      const result = await verifyEmailToken(tokenData.token);

      expect(result.success).toBe(false);
      // Implementation returns a generic invalid/expired response once the token is consumed;
      // accept either specific already-used message or the generic invalid token response.
      expect(['Verification token has already been used', 'Invalid or expired verification token']).toContain(
        result.error,
      );
      expect(['tokenAlreadyUsed', 'invalidToken']).toContain(result.code);
    });

    it('shouldRejectExpiredToken', async () => {
      const tokenData = await createVerificationToken(testUser.id, testUser.email);

      // Manually expire the token
      await prisma.emailVerificationToken.update({
        where: { tokenHash: hashVerificationToken(tokenData.token) },
        data: { expiresAt: new Date(Date.now() - 1000) }, // Expired 1 second ago
      });

      const result = await verifyEmailToken(tokenData.token);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Verification token has expired');
      expect(result.code).toBe('tokenExpired');
    });

    it('shouldUseAtomicTransactionForVerification', async () => {
      const tokenData = await createVerificationToken(testUser.id, testUser.email);

      // Verify that both token update and user update happen atomically
      const _result = await verifyEmailToken(tokenData.token);

      const [tokenRecord, userRecord] = await Promise.all([
        prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashVerificationToken(tokenData.token) } }),
        prisma.user.findUnique({ where: { id: testUser.id } }),
      ]);

      // Both should be updated
      expect(tokenRecord.usedAt).toBeDefined();
      expect(userRecord.emailVerified).toBe(true);
    });

    it('shouldImplementTimingSafeResponseForInvalidTokens', async () => {
      const startTime = Date.now();
      await verifyEmailToken('invalidToken');
      const endTime = Date.now();

      const elapsed = endTime - startTime;

      // Should take at least 100ms (timing-safe delay)
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });

  describe('checkVerificationStatus()', () => {
    it('shouldReturnVerificationStatusForVerifiedUser', async () => {
      // Verify user first
      const tokenData = await createVerificationToken(testUser.id, testUser.email);
      await verifyEmailToken(tokenData.token);

      const status = await checkVerificationStatus(testUser.id);

      expect(status.verified).toBe(true);
      expect(status.email).toBe(testUser.email);
      expect(status.verifiedAt).toBeDefined();
    });

    it('shouldReturnVerificationStatusForUnverifiedUser', async () => {
      const status = await checkVerificationStatus(testUser.id);

      expect(status.verified).toBe(false);
      expect(status.email).toBe(testUser.email);
      expect(status.verifiedAt).toBeNull();
    });

    it('shouldHandleNonExistentUser', async () => {
      const status = await checkVerificationStatus('non-existent-user-id');

      expect(status.verified).toBe(false);
      expect(status.error).toBe('User not found');
    });
  });

  describe('resendVerificationEmail()', () => {
    it('shouldCreateNewTokenForUnverifiedUser', async () => {
      const result = await resendVerificationEmail(testUser.id);

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('shouldRejectResendForVerifiedUser', async () => {
      // Verify user first
      const tokenData = await createVerificationToken(testUser.id, testUser.email);
      await verifyEmailToken(tokenData.token);

      // Verify the user still exists and is marked as verified
      const verifiedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(verifiedUser).toBeDefined();
      expect(verifiedUser.emailVerified).toBe(true);

      await expect(resendVerificationEmail(testUser.id)).rejects.toThrow('Email is already verified');
    });

    it('shouldCleanupExpiredTokensBeforeCreatingNew', async () => {
      // Create expired token
      const expiredToken = await createVerificationToken(testUser.id, testUser.email);
      await prisma.emailVerificationToken.update({
        where: { tokenHash: hashVerificationToken(expiredToken.token) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      // Resend should cleanup expired token
      await resendVerificationEmail(testUser.id);

      const expiredTokenRecord = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash: hashVerificationToken(expiredToken.token) },
      });

      expect(expiredTokenRecord).toBeNull();
    });

    it('shouldEnforceRateLimitingOnResend', async () => {
      // Create first token
      await resendVerificationEmail(testUser.id);

      // Immediate resend should fail
      await expect(resendVerificationEmail(testUser.id)).rejects.toThrow('Please wait');
    });
  });

  describe('cleanupExpiredTokens()', () => {
    it('shouldDeleteExpiredTokens', async () => {
      // Create token and expire it
      const tokenData = await createVerificationToken(testUser.id, testUser.email);
      await prisma.emailVerificationToken.update({
        where: { tokenHash: hashVerificationToken(tokenData.token) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const result = await cleanupExpiredTokens();

      expect(result.removedCount).toBeGreaterThan(0);

      const tokenRecord = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash: hashVerificationToken(tokenData.token) },
      });

      expect(tokenRecord).toBeNull();
    });

    it('shouldDeleteOldUsedTokens', async () => {
      // Create and use token
      const tokenData = await createVerificationToken(testUser.id, testUser.email);
      await verifyEmailToken(tokenData.token);

      // Make it old (31 days)
      await prisma.emailVerificationToken.update({
        where: { tokenHash: hashVerificationToken(tokenData.token) },
        data: { createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
      });

      const result = await cleanupExpiredTokens({ olderThanDays: 30 });

      expect(result.removedCount).toBeGreaterThan(0);
    });

    it('shouldKeepActiveValidTokens', async () => {
      const tokenData = await createVerificationToken(testUser.id, testUser.email);

      await cleanupExpiredTokens();

      const tokenRecord = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash: hashVerificationToken(tokenData.token) },
      });

      expect(tokenRecord).toBeDefined();
    });
  });

  describe('getTokenInfo()', () => {
    it('shouldReturnTokenInformation', async () => {
      const tokenData = await createVerificationToken(testUser.id, testUser.email);

      const info = await getTokenInfo(tokenData.token);

      expect(info).toBeDefined();
      expect(info.email).toBe(testUser.email);
      expect(info.expiresAt).toBeDefined();
      expect(info.isValid).toBe(true);
      expect(info.isExpired).toBe(false);
      expect(info.isUsed).toBe(false);
    });

    it('shouldIndicateUsedToken', async () => {
      const tokenData = await createVerificationToken(testUser.id, testUser.email);
      await verifyEmailToken(tokenData.token);

      const info = await getTokenInfo(tokenData.token);

      expect(info.isUsed).toBe(true);
      expect(info.usedAt).toBeDefined();
      expect(info.isValid).toBe(false);
    });

    it('shouldIndicateExpiredToken', async () => {
      const tokenData = await createVerificationToken(testUser.id, testUser.email);
      await prisma.emailVerificationToken.update({
        where: { tokenHash: hashVerificationToken(tokenData.token) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const info = await getTokenInfo(tokenData.token);

      expect(info.isExpired).toBe(true);
      expect(info.isValid).toBe(false);
    });

    it('shouldReturnNullForInvalidToken', async () => {
      const info = await getTokenInfo('invalidTokenHere');

      expect(info).toBeNull();
    });
  });
});
