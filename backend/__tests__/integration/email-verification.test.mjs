/**
 * 🧪 Email Verification System - Integration Tests (TDD RED Phase)
 *
 * End-to-end integration tests for email verification workflow.
 * Tests complete user journey from registration to verification.
 *
 * Phase 1, Day 6-7: Email Verification System
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';
import { createTestUser, extractCookieValue as _extractCookieValue, resetRateLimitStore } from '../config/test-helpers.mjs';
import { generateVerificationToken } from '../../utils/emailVerificationService.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';

describe('Email Verification System - Integration Tests', () => {
  let testUser, _testPassword, authToken;

  beforeEach(async () => {
    resetRateLimitStore();

    // Clean up
    const cleanupEmailMatchers = [
      { email: { contains: 'emailint_' } },
      { email: { contains: 'newuser_' } },
      { email: { contains: 'newuser2_' } },
      { email: { contains: 'devuser_' } },
      { email: { contains: 'workflow_' } },
    ];
    const cleanupUsers = await prisma.user.findMany({
      where: { OR: cleanupEmailMatchers },
      select: { id: true },
    });
    const cleanupUserIds = cleanupUsers.map(user => user.id);

    if (cleanupUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: cleanupUserIds } },
      });
    }
    await prisma.emailVerificationToken.deleteMany({
      where: { OR: cleanupEmailMatchers },
    });
    await prisma.user.deleteMany({
      where: { id: { in: cleanupUserIds } },
    });

    // Create test user
    const timestamp = Date.now();
    const userData = await createTestUser({
      username: `emailint_${timestamp}`,
      email: `emailint_${timestamp}@example.com`,
    });
    testUser = userData;
    _testPassword = userData.plainPassword;

    // Generate JWT token for authentication using test helper
    authToken = generateTestToken({ id: testUser.id, email: testUser.email });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  describe('POST /auth/register - Email Verification Integration', () => {
    it('should_create_verification_token_on_registration', async () => {
      const timestamp = Date.now();
      const newUser = {
        username: `newuser_${timestamp}`,
        email: `newuser_${timestamp}@example.com`,
        password: 'SecurePass123!',
        firstName: 'New',
        lastName: 'User',
      };

      const response = await request(app).post('/auth/register').send(newUser);

      expect(response.status).toBe(201);
      expect(response.body.data.emailVerificationSent).toBe(true);
      expect(response.body.data.user.emailVerified).toBe(false);

      // Check token was created
      const tokens = await prisma.emailVerificationToken.findMany({
        where: { email: newUser.email },
      });

      expect(tokens.length).toBe(1);
      expect(tokens[0].usedAt).toBeNull();
    });

    it('should_include_email_verified_status_in_response', async () => {
      const timestamp = Date.now();
      const newUser = {
        username: `newuser2_${timestamp}`,
        email: `newuser2_${timestamp}@example.com`,
        password: 'SecurePass123!',
        firstName: 'New',
        lastName: 'User',
      };

      const response = await request(app).post('/auth/register').send(newUser);

      expect(response.status).toBe(201);
      expect(response.body.data.user).toHaveProperty('emailVerified');
      expect(response.body.data.user.emailVerified).toBe(false);
      expect(response.body.message).toContain('verify your account');
    });

    it('should_log_verification_email_in_development_mode', async () => {
      // This test verifies development mode behavior
      const timestamp = Date.now();
      const newUser = {
        username: `devuser_${timestamp}`,
        email: `devuser_${timestamp}@example.com`,
        password: 'SecurePass123!',
        firstName: 'Dev',
        lastName: 'User',
      };

      const response = await request(app).post('/auth/register').send(newUser);

      expect(response.status).toBe(201);
      expect(response.body.data.emailVerificationSent).toBe(true);

      // In development, email should be logged (check via token existence)
      const token = await prisma.emailVerificationToken.findFirst({
        where: { email: newUser.email },
      });

      expect(token).toBeDefined();
      expect(token.token.length).toBe(64);
    });
  });

  describe('GET /auth/verify-email', () => {
    it('should_verify_email_with_valid_token', async () => {
      // Create verification token
      const token = await prisma.emailVerificationToken.create({
        data: {
          token: generateVerificationToken(),
          userId: testUser.id,
          email: testUser.email,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const response = await request(app).get(`/auth/verify-email?token=${token.token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Email verified successfully');
      expect(response.body.data.verified).toBe(true);
      expect(response.body.data.user.emailVerified).toBe(true);
    });

    it('should_update_user_email_verified_status', async () => {
      const token = await prisma.emailVerificationToken.create({
        data: {
          token: generateVerificationToken(),
          userId: testUser.id,
          email: testUser.email,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await request(app).get(`/auth/verify-email?token=${token.token}`);

      const user = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(user.emailVerified).toBe(true);
      expect(user.emailVerifiedAt).toBeDefined();
      expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    });

    it('should_mark_token_as_used', async () => {
      const token = await prisma.emailVerificationToken.create({
        data: {
          token: generateVerificationToken(),
          userId: testUser.id,
          email: testUser.email,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await request(app).get(`/auth/verify-email?token=${token.token}`);

      const tokenRecord = await prisma.emailVerificationToken.findUnique({
        where: { token: token.token },
      });

      expect(tokenRecord.usedAt).toBeDefined();
      expect(tokenRecord.usedAt).toBeInstanceOf(Date);
    });

    it('should_reject_missing_token', async () => {
      const response = await request(app).get('/auth/verify-email');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Verification token is required');
    });

    it('should_reject_invalid_token', async () => {
      const response = await request(app).get('/auth/verify-email?token=invalid_token_here');

      expect(response.status).toBe(400);
      expect(response.body.message).toBeDefined();
    });

    it('should_reject_expired_token', async () => {
      const token = await prisma.emailVerificationToken.create({
        data: {
          token: generateVerificationToken(),
          userId: testUser.id,
          email: testUser.email,
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      const response = await request(app).get(`/auth/verify-email?token=${token.token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('expired');
    });

    it('should_reject_already_used_token', async () => {
      const token = await prisma.emailVerificationToken.create({
        data: {
          token: generateVerificationToken(),
          userId: testUser.id,
          email: testUser.email,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // Use token first time
      await request(app).get(`/auth/verify-email?token=${token.token}`);

      // Try second time
      const response = await request(app).get(`/auth/verify-email?token=${token.token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already been used');
    });

    it('should_be_publicly_accessible_without_authentication', async () => {
      const token = await prisma.emailVerificationToken.create({
        data: {
          token: generateVerificationToken(),
          userId: testUser.id,
          email: testUser.email,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // No authentication header provided
      const response = await request(app).get(`/auth/verify-email?token=${token.token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });
  });

  describe('POST /auth/resend-verification', () => {
    it('should_create_new_verification_token', async () => {
      const response = await request(app).post('/auth/resend-verification').set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.emailSent).toBe(true);
      expect(response.body.data.expiresAt).toBeDefined();

      // Check token was created
      const tokens = await prisma.emailVerificationToken.findMany({
        where: { userId: testUser.id },
      });

      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should_require_authentication', async () => {
      const response = await request(app).post('/auth/resend-verification').set('x-test-require-auth', 'true');

      expect(response.status).toBe(401);
    });

    it('should_reject_if_email_already_verified', async () => {
      // Verify email first
      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      const response = await request(app).post('/auth/resend-verification').set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('already verified');
    });

    it('should_enforce_rate_limiting', async () => {
      // First resend
      await request(app).post('/auth/resend-verification').set('Authorization', `Bearer ${authToken}`);

      // Immediate second resend should fail
      const response = await request(app).post('/auth/resend-verification').set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(429);
      expect(response.body.message).toContain('wait');
    });

    it('should_cleanup_expired_tokens', async () => {
      // Create expired token
      await prisma.emailVerificationToken.create({
        data: {
          token: generateVerificationToken(),
          userId: testUser.id,
          email: testUser.email,
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      await request(app).post('/auth/resend-verification').set('Authorization', `Bearer ${authToken}`);

      // Expired token should be deleted
      const expiredTokens = await prisma.emailVerificationToken.findMany({
        where: {
          userId: testUser.id,
          expiresAt: { lt: new Date() },
        },
      });

      expect(expiredTokens.length).toBe(0);
    });
  });

  describe('GET /auth/verification-status', () => {
    it('should_return_unverified_status_for_new_user', async () => {
      const response = await request(app).get('/auth/verification-status').set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.verified).toBe(false);
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.verifiedAt).toBeNull();
    });

    it('should_return_verified_status_after_verification', async () => {
      // Verify email
      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      const response = await request(app).get('/auth/verification-status').set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.verified).toBe(true);
      expect(response.body.data.verifiedAt).toBeDefined();
    });

    it('should_require_authentication', async () => {
      const response = await request(app).get('/auth/verification-status').set('x-test-require-auth', 'true');

      expect(response.status).toBe(401);
    });

    it('should_return_user_email_address', async () => {
      const response = await request(app).get('/auth/verification-status').set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.email).toBe(testUser.email);
    });
  });

  describe('Complete Email Verification Workflow', () => {
    it('should_complete_full_registration_to_verification_flow', async () => {
      const timestamp = Date.now();
      const newUser = {
        username: `workflow_${timestamp}`,
        email: `workflow_${timestamp}@example.com`,
        password: 'SecurePass123!',
        firstName: 'Workflow',
        lastName: 'Test',
      };

      // Step 1: Register
      const registerResponse = await request(app).post('/auth/register').send(newUser);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.data.user.emailVerified).toBe(false);

      // Step 2: Get verification token from database
      const tokenRecord = await prisma.emailVerificationToken.findFirst({
        where: { email: newUser.email },
        orderBy: { createdAt: 'desc' },
      });

      expect(tokenRecord).toBeDefined();

      // Step 3: Verify email
      const verifyResponse = await request(app).get(`/auth/verify-email?token=${tokenRecord.token}`);

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.data.user.emailVerified).toBe(true);

      // Step 4: Check user in database
      const user = await prisma.user.findUnique({
        where: { email: newUser.email },
      });

      expect(user.emailVerified).toBe(true);
      expect(user.emailVerifiedAt).toBeDefined();
    });

    it('should_handle_resend_and_verify_workflow', async () => {
      // Step 1: Check status (unverified)
      const statusResponse1 = await request(app)
        .get('/auth/verification-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse1.body.data.verified).toBe(false);

      // Step 2: Resend verification
      const resendResponse = await request(app)
        .post('/auth/resend-verification')
        .set('Authorization', `Bearer ${authToken}`);

      expect(resendResponse.status).toBe(200);

      // Step 4: Get new token
      const tokenRecord = await prisma.emailVerificationToken.findFirst({
        where: { userId: testUser.id },
        orderBy: { createdAt: 'desc' },
      });

      // Step 5: Verify email
      const verifyResponse = await request(app).get(`/auth/verify-email?token=${tokenRecord.token}`);

      expect(verifyResponse.status).toBe(200);

      // Step 5: Check status (verified)
      const statusResponse2 = await request(app)
        .get('/auth/verification-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse2.body.data.verified).toBe(true);
    });

    it('should_prevent_multiple_verification_attempts', async () => {
      const tokenRecord = await prisma.emailVerificationToken.create({
        data: {
          token: generateVerificationToken(),
          userId: testUser.id,
          email: testUser.email,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // First verification
      const response1 = await request(app).get(`/auth/verify-email?token=${tokenRecord.token}`);
      expect(response1.status).toBe(200);

      // Second verification attempt
      const response2 = await request(app).get(`/auth/verify-email?token=${tokenRecord.token}`);
      expect(response2.status).toBe(400);
      expect(response2.body.message).toContain('already been used');

      // Third verification attempt
      const response3 = await request(app).get(`/auth/verify-email?token=${tokenRecord.token}`);
      expect(response3.status).toBe(400);
    });
  });

  describe('Security and Edge Cases', () => {
    it('should_handle_concurrent_verification_requests', async () => {
      const tokenRecord = await prisma.emailVerificationToken.create({
        data: {
          token: generateVerificationToken(),
          userId: testUser.id,
          email: testUser.email,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // Send two concurrent verification requests
      const [response1, response2] = await Promise.all([
        request(app).get(`/auth/verify-email?token=${tokenRecord.token}`),
        request(app).get(`/auth/verify-email?token=${tokenRecord.token}`),
      ]);

      // One should succeed, one should fail
      const responses = [response1, response2];
      const successCount = responses.filter(r => r.status === 200).length;
      const failureCount = responses.filter(r => r.status === 400).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
    });

    it('should_sanitize_error_messages_to_prevent_enumeration', async () => {
      const response = await request(app).get('/auth/verify-email?token=definitely_invalid_token_123');

      expect(response.status).toBe(400);
      // Should not reveal whether user exists or not
      expect(response.body.message).not.toContain('user');
      expect(response.body.message).not.toContain('email');
    });

    it('should_handle_malformed_token_input', async () => {
      const malformedTokens = [
        '',
        ' ',
        'a'.repeat(1000), // Very long token
        '<script>alert("xss")</script>',
        "'; DROP TABLE users; --",
        null,
        undefined,
      ];

      for (const malformed of malformedTokens) {
        const response = await request(app).get(`/auth/verify-email?token=${malformed || ''}`);

        expect([400, 500]).toContain(response.status);
      }
    });
  });
});
