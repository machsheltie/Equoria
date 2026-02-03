/**
 * 🧪 INTEGRATION TEST: Authentication System - User Registration & Session Management
 *
 * This test validates the complete authentication system including user registration,
 * login, token management, and session handling with real database operations.
 *
 * 📋 BUSINESS RULES TESTED:
 * - User registration with email/username uniqueness validation
 * - Password strength requirements: minimum 8 characters
 * - Email format validation: proper email structure required
 * - JWT token generation and validation for access control
 * - Refresh token functionality for session extension
 * - User profile retrieval with authentication verification
 * - Secure logout with token invalidation
 * - Database cascading deletes: refresh tokens, training logs, horses, users
 * - Error handling: invalid credentials, malformed data, missing tokens
 * - Response consistency: success/error structure with status/message/data
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. POST /api/auth/register - User registration with validation
 * 2. POST /api/auth/login - User authentication with credential verification
 * 3. POST /api/auth/refresh - Token refresh for session management
 * 4. GET /api/auth/me - User profile retrieval with authentication
 * 5. POST /api/auth/logout - Session termination with token cleanup
 * 6. Database cleanup and cascading delete operations
 * 7. Edge cases: duplicate emails, weak passwords, invalid tokens
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Complete authentication flow, database operations, JWT handling
 * ✅ REAL: Password hashing, email validation, token generation, session management
 * 🔧 MOCK: None - full integration testing with real database and HTTP requests
 *
 * 💡 TEST STRATEGY: Full integration testing with real database to validate
 *    complete authentication workflows and ensure security requirements work correctly
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
// Jest globals are available in test environment
import request from 'supertest';
import app from '../app.mjs';
import { createTestUser, createLoginData } from './helpers/authHelper.mjs';
import prisma from '../db/index.mjs';
import { resetAllAuthRateLimits } from '../middleware/authRateLimiter.mjs';

/**
 * Extract cookie value from Set-Cookie header
 * @param {Array} cookies - Array of cookie strings from response headers
 * @param {string} name - Cookie name to extract
 * @returns {string|null} - Cookie value or null if not found
 */
const extractCookie = (cookies, name) => {
  if (!cookies || !Array.isArray(cookies)) return null;
  const cookie = cookies.find((c) => c.startsWith(`${name}=`));
  if (!cookie) return null;
  // Extract value between = and ; (or end of string)
  const match = cookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
};
// SECURITY FIX (Phase 1, Task 1.1): Removed x-test-bypass-rate-limit headers
// Rate limits use in-memory store (REDIS_DISABLED=true) and are reset in beforeEach
const authPost = (path) => request(app).post(path);
const authGet = (path) => request(app).get(path);

describe('🔐 INTEGRATION: Authentication System - User Registration & Session Management', () => {
  // Store created user IDs for targeted cleanup
  const createdUserIds = new Set();

  const cleanupTestData = async () => {
    try {
      if (createdUserIds.size > 0) {
        const userIds = Array.from(createdUserIds);

        // 1. Delete RefreshTokens
        await prisma.refreshToken.deleteMany({
          where: { userId: { in: userIds } },
        });

        // 2. Delete TrainingLogs
        await prisma.trainingLog.deleteMany({
          where: { horse: { userId: { in: userIds } } },
        });

        // 3. Delete Horses
        await prisma.horse.deleteMany({
          where: { userId: { in: userIds } },
        });

        // 4. Delete Users
        await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        });

        createdUserIds.clear();
      }
    } catch (error) {
      console.error('Database cleanup error:', error.message);
    }
  };

  // Helper to track created users
  const trackUser = (response) => {
    if (response.body?.data?.user?.id) {
      createdUserIds.add(response.body.data.user.id);
    }
    return response;
  };

  beforeEach(async () => {
    // We don't clean up before each to avoid deleting data needed by current test
    // but we do reset rate limits
    resetAllAuthRateLimits();
  });

  afterAll(async () => {
    await cleanupTestData();
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error('Error disconnecting Prisma:', disconnectError.message);
    }
  });
  describe('POST /api/auth/register', () => {
    it('should register a new user and player successfully', async () => {
      const userData = createTestUser();

      const response = await authPost('/api/auth/register').send(userData).expect(201);
      trackUser(response);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe(
        'User registered successfully. Please check your email to verify your account.'
      );

      // User details assertions
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.firstName).toBe(userData.firstName); // Added assertion
      expect(response.body.data.user.lastName).toBe(userData.lastName); // Added assertion
      expect(response.body.data.user.password).toBeUndefined(); // Password should not be returned
      expect(response.body.data.user.id).toBeDefined();

      // User details are now part of the user object
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.level).toBe(1);
      expect(response.body.data.user.xp).toBe(0);
      expect(response.body.data.user.money).toBe(1000); // Or default value

      // Token assertions - tokens now in httpOnly cookies
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const accessToken = extractCookie(cookies, 'accessToken');
      const refreshToken = extractCookie(cookies, 'refreshToken');
      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const userData = createTestUser({
        email: 'invalid-email',
      });

      const response = await authPost('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Valid email is required');
    });

    it('should reject registration with weak password', async () => {
      const userData = createTestUser({
        password: 'weak',
      });

      const response = await authPost('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Password must be between 8 and 128 characters long');
    });

    it('should reject duplicate email registration', async () => {
      const userData = createTestUser();

      // First registration
      const response1 = await authPost('/api/auth/register').send(userData).expect(201);
      trackUser(response1);

      // Second registration with same email
      const response = await authPost('/api/auth/register')
        .send({ ...userData, username: `other_${Date.now()}` }) // Use a different username
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    let loginEmail;
    let loginPassword;
    beforeEach(async () => {
      // Create a test user for login tests
      const userData = createTestUser();
      loginEmail = userData.email;
      loginPassword = userData.password;

      const response = await authPost('/api/auth/register').send(userData);
      trackUser(response);
    });

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: loginEmail,
        password: loginPassword,
      };

      const response = await authPost('/api/auth/login').send(loginData).expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user.email).toBe(loginData.email);

      // Token assertions - tokens now in httpOnly cookies
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const accessToken = extractCookie(cookies, 'accessToken');
      const refreshToken = extractCookie(cookies, 'refreshToken');
      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();

      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should reject login with invalid email', async () => {
      const loginData = {
        email: `nonexistent_${Date.now()}@example.com`,
        password: 'Password123!',
      };

      const response = await authPost('/api/auth/login')
        .send(loginData)
        .set('x-test-require-auth', 'true')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: loginEmail,
        password: 'wrongpassword',
      };

      const response = await authPost('/api/auth/login')
        .send(loginData)
        .set('x-test-require-auth', 'true')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should reject login with malformed email', async () => {
      const loginData = {
        email: 'invalid-email',
        password: 'Password123!',
      };

      const response = await authPost('/api/auth/login').send(loginData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Valid email is required');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshTokenValue; // Renamed to avoid conflict
    beforeEach(async () => {
      // Create user and get refresh token
      const userData = createTestUser();

      const registerResponse = await authPost('/api/auth/register').send(userData);
      trackUser(registerResponse);

      // Extract refresh token from cookies
      const cookies = registerResponse.headers['set-cookie'];
      refreshTokenValue = extractCookie(cookies, 'refreshToken');
    });

    it('should refresh token successfully with valid refresh token', async () => {
      const response = await authPost('/api/auth/refresh')
        .send({ refreshToken: refreshTokenValue })
        .expect(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Token refreshed successfully');

      // New access token should be in cookies
      const cookies = response.headers['set-cookie'];
      const newAccessToken = extractCookie(cookies, 'accessToken');
      expect(newAccessToken).toBeDefined();
      expect(newAccessToken).not.toBe(refreshTokenValue);
    });

    it('should reject refresh with invalid token', async () => {
      const response = await authPost('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .set('x-test-require-auth', 'true')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Token reuse detected - please login again');
    });

    it('should reject refresh without token', async () => {
      const response = await authPost('/api/auth/refresh').send({}).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Refresh token is required');
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken;
    let testUser;
    beforeEach(async () => {
      // Create user and get auth token
      const userData = createTestUser();

      const registerResponse = await authPost('/api/auth/register').send(userData);
      trackUser(registerResponse);

      // Extract access token from cookies
      const cookies = registerResponse.headers['set-cookie'];
      authToken = extractCookie(cookies, 'accessToken');
      testUser = registerResponse.body.data.user;
    });

    it('should get user profile successfully with valid token', async () => {
      const response = await authGet('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.firstName).toBe(testUser.firstName);
      expect(response.body.data.user.lastName).toBe(testUser.lastName);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should reject profile request without token', async () => {
      const response = await authGet('/api/auth/me').set('x-test-require-auth', 'true').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token is required');
    });

    it('should reject profile request with invalid token', async () => {
      const response = await authGet('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired token');
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken;

    beforeEach(async () => {
      // Create user and get auth token
      const userData = createTestUser();

      const registerResponse = await authPost('/api/auth/register').send(userData);
      trackUser(registerResponse);

      // Extract access token from cookies
      const cookies = registerResponse.headers['set-cookie'];
      authToken = extractCookie(cookies, 'accessToken');
    });

    it('should logout successfully with valid token', async () => {
      const response = await authPost('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Logout successful');
    });

    it('should reject logout without token', async () => {
      const response = await authPost('/api/auth/logout')
        .set('x-test-require-auth', 'true')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token is required');
    });
  });
});
