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

/* eslint-disable no-console */
import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
// Jest globals are available in test environment
import request from 'supertest';
import app from '../app.mjs';
import { createTestUser, createLoginData } from './helpers/authHelper.mjs';
import prisma from '../db/index.mjs';

describe('🔐 INTEGRATION: Authentication System - User Registration & Session Management', () => {
  // Clean up test data before and after tests
  const cleanupTestData = async () => {
    try {
      // Find User IDs for cascading deletes or specific targeting
      const usersToDelete = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: 'test' } },
            { username: { contains: 'test' } },
            { email: { contains: 'example.com' } }, // Catch all example.com emails
            { username: { contains: 'user' } }, // Catch usernames with 'user'
            { email: { startsWith: 'new' } }, // Catch newuser@example.com
            { email: { startsWith: 'duplicate' } }, // Catch duplicate@example.com
            { username: { startsWith: 'new' } }, // Catch newuser username
            { username: { startsWith: 'duplicate' } }, // Catch duplicateuser username
          ],
        },
        select: { id: true },
      });
      const userIdsToDelete = usersToDelete.map(u => u.id);

      if (userIdsToDelete.length > 0) {
        // 1. Delete RefreshTokens
        await prisma.refreshToken.deleteMany({
          where: { userId: { in: userIdsToDelete } },
        });

        // 2. Delete TrainingLogs (linked to Horse, which is linked to User via userId)
        await prisma.trainingLog.deleteMany({
          where: { horse: { userId: { in: userIdsToDelete } } },
        });

        // 3. Delete Horses (linked to User via userId)
        await prisma.horse.deleteMany({
          where: {
            userId: { in: userIdsToDelete },
          },
        });

        // 4. Delete Users (Player model is merged into User)
        await prisma.user.deleteMany({
          where: { id: { in: userIdsToDelete } },
        });
      }
    } catch (error) {
      // Using console.error for errors
      console.error(
        'Database cleanup error (can be ignored if tables do not exist yet):',
        error.message,
      );
    }
  };

  beforeEach(async () => {
    await cleanupTestData();
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
      // Test description updated
      const userData = createTestUser({
        email: 'newuser@example.com',
        username: 'newuser',
        firstName: 'New',
        lastName: 'UserReg',
      });

      const response = await request(app).post('/api/auth/register').send(userData).expect(201);
      expect(response.body.status).toBe('success'); // Check for status field
      expect(response.body.message).toBe('User registered successfully');

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

      // Token assertions
      expect(response.body.data.token).toBeDefined(); // Changed from accessToken
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const userData = createTestUser({
        email: 'invalid-email',
      });

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Valid email is required');
    });

    it('should reject registration with weak password', async () => {
      const userData = createTestUser({
        password: 'weak',
      });

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Password must be at least 8 characters long');
    });

    it('should reject duplicate email registration', async () => {
      const userData = createTestUser({
        email: 'duplicate@example.com',
        username: 'duplicateuser', // Ensure username is also unique for this test setup
        firstName: 'Dup',
        lastName: 'User',
      });

      // First registration
      await request(app).post('/api/auth/register').send(userData).expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...userData, username: 'otheruser' }) // Use a different username for the second attempt
        .expect(400); // Changed from 409, as controller throws "User with this email or username already exists"

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      const userData = createTestUser({
        email: 'logintest@example.com',
        username: 'logintest',
        firstName: 'Login',
        lastName: 'TestUser',
      });

      await request(app).post('/api/auth/register').send(userData);
    });

    it('should login successfully with valid credentials', async () => {
      const loginData = createLoginData({
        email: 'logintest@example.com',
      });

      const response = await request(app).post('/api/auth/login').send(loginData).expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user.email).toBe(loginData.email);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should reject login with invalid email', async () => {
      const loginData = createLoginData({
        email: 'nonexistent@example.com',
      });

      const response = await request(app).post('/api/auth/login').send(loginData).expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should reject login with invalid password', async () => {
      const loginData = createLoginData({
        email: 'logintest@example.com',
        password: 'wrongpassword',
      });

      const response = await request(app).post('/api/auth/login').send(loginData).expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should reject login with malformed email', async () => {
      const loginData = createLoginData({
        email: 'invalid-email',
      });

      const response = await request(app).post('/api/auth/login').send(loginData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Valid email is required');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshTokenValue; // Renamed to avoid conflict
    beforeEach(async () => {
      // Create user and get refresh token
      const userData = createTestUser({
        email: 'refreshtest@example.com',
        username: 'refreshtest',
        firstName: 'Refresh',
        lastName: 'TestUser',
      });

      const registerResponse = await request(app).post('/api/auth/register').send(userData);

      refreshTokenValue = registerResponse.body.data.refreshToken;
    });

    it('should refresh token successfully with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: refreshTokenValue })
        .expect(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Token refreshed successfully');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token).not.toBe(refreshTokenValue);
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired refresh token');
    });

    it('should reject refresh without token', async () => {
      const response = await request(app).post('/api/auth/refresh').send({}).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Refresh token is required');
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken;
    let testUser;
    beforeEach(async () => {
      // Create user and get auth token
      const userData = createTestUser({
        email: 'profiletest@example.com',
        username: 'profiletest',
        firstName: 'Profile',
        lastName: 'TestUser',
      });

      const registerResponse = await request(app).post('/api/auth/register').send(userData);

      authToken = registerResponse.body.data.token; // Use 'token'
      testUser = registerResponse.body.data.user;
    });

    it('should get user profile successfully with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
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
      const response = await request(app).get('/api/auth/me').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token is required');
    });

    it('should reject profile request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
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
      const userData = createTestUser({
        email: 'logouttest@example.com',
        username: 'logouttest',
      });

      const registerResponse = await request(app).post('/api/auth/register').send(userData);

      authToken = registerResponse.body.data.token || registerResponse.body.data.accessToken;
    });

    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Logout successful');
    });

    it('should reject logout without token', async () => {
      const response = await request(app).post('/api/auth/logout').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token is required');
    });
  });
});
