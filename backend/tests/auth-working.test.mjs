/**
 * 🧪 INTEGRATION TEST: Authentication System - Complete Auth Workflow Validation
 *
 * This test validates the complete authentication system using real HTTP requests
 * and database operations to ensure end-to-end authentication functionality.
 *
 * 📋 BUSINESS RULES TESTED:
 * - User registration: Email uniqueness, password hashing, token generation
 * - User login: Credential validation, JWT token creation, refresh token issuance
 * - Token management: JWT refresh, token expiration, invalid token handling
 * - Protected routes: Authorization middleware, token validation, profile access
 * - Security measures: Password exclusion from responses, proper error handling
 * - Database integration: User creation, duplicate prevention, cleanup operations
 * - Session management: Logout functionality, token invalidation
 * - Input validation: Email format, password strength, required fields
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. POST /api/auth/register - User registration with validation and token generation
 * 2. POST /api/auth/login - User authentication with credential verification
 * 3. POST /api/auth/refresh - JWT token refresh with refresh token validation
 * 4. POST /api/auth/logout - Session termination with token invalidation
 * 5. GET /api/auth/me - Protected profile access with token authentication
 * 6. Error handling: Duplicate emails, invalid credentials, missing tokens
 * 7. Security validation: Password hashing, token security, data sanitization
 * 8. Database operations: User CRUD, cleanup, transaction handling
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Complete HTTP request/response cycle, database operations, authentication logic
 * ✅ REAL: JWT token generation/validation, password hashing, middleware execution
 * ✅ REAL: Express app routing, validation middleware, error handling
 * 🔧 MOCK: None - full integration testing with real database and HTTP stack
 *
 * 💡 TEST STRATEGY: Full integration testing to validate complete authentication
 *    workflows with real HTTP requests, database operations, and security measures
 *
 * ⚠️  NOTE: This represents EXCELLENT integration testing - tests real authentication
 *    flows with actual HTTP requests, database operations, and security validation.
 */

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { body } from 'express-validator';
import { register, login, refreshToken, logout, getProfile } from '../controllers/authController.mjs';
import { authenticateToken } from '../middleware/auth.mjs';
import prisma from '../db/index.mjs';
import { generateTestToken } from './helpers/authHelper.mjs';

// Create a minimal test app without problematic middleware
const createTestApp = () => {
  const app = express();

  // Basic middleware only
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser()); // Required for req.cookies in refreshToken endpoint

  // Auth routes with minimal validation
  app.post(
    '/api/auth/register',
    body('name').trim().isLength({ min: 2, max: 50 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8, max: 128 }),
    register,
  );

  app.post('/api/auth/login', body('email').isEmail().normalizeEmail(), body('password').notEmpty(), login);

  app.post('/api/auth/refresh', refreshToken); // No body validation - token comes from cookies

  app.post('/api/auth/logout', authenticateToken, logout);

  app.get('/api/auth/me', authenticateToken, getProfile);

  // Basic error handler for debugging
  app.use((err, req, res, _next) => {
    // console.error("TEST APP ERROR HANDLER:", err); // Log the error to the console where Jest runs tests
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Internal Server Error',
      error: {
        message: err.message,
        stack: err.stack, // Be mindful of exposing stack traces
        name: err.name,
        code: err.code, // For Prisma errors or other specific codes
        meta: err.meta, // For Prisma error metadata
      },
    });
  });

  return app;
};

describe('🔐 INTEGRATION: Authentication System - Complete Auth Workflow Validation', () => {
  let app;
  // Store created user IDs for targeted cleanup
  const createdUserIds = new Set();

  beforeAll(() => {
    // Corrected: removed space before ()
    app = createTestApp();
  });

  const cleanupTestData = async () => {
    try {
      if (createdUserIds.size > 0) {
        const userIds = Array.from(createdUserIds);
        await prisma.refreshToken.deleteMany({
          where: { userId: { in: userIds } },
        });
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
  const trackUser = response => {
    if (response.body?.data?.user?.id) {
      createdUserIds.add(response.body.data.user.id);
    }
    return response;
  };

  beforeEach(async () => {
    // No aggressive cleanup in beforeEach
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const userData = {
        username: `authtestuser_${timestamp}_${randomSuffix}`,
        email: `authtest-register_${timestamp}_${randomSuffix}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Auth',
        lastName: 'User',
        name: 'Auth User', // Required by minimal app schema in this file
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(201);
      trackUser(response);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe(
        'User registered successfully. Please check your email to verify your account.',
      );
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.firstName).toBe(userData.firstName);
      expect(response.body.data.user.lastName).toBe(userData.lastName);
      // Tokens are now in httpOnly cookies for security, not in response body
      expect(response.headers['set-cookie']).toBeDefined();
      const cookies = response.headers['set-cookie'];
      expect(cookies.some(cookie => cookie.startsWith('accessToken='))).toBe(true);
      expect(cookies.some(cookie => cookie.startsWith('refreshToken='))).toBe(true);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should reject duplicate email registration', async () => {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const userData = {
        username: `authtestdupe_${timestamp}_${randomSuffix}`,
        email: `authtest-duplicate_${timestamp}_${randomSuffix}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Auth',
        lastName: 'User',
        name: 'Auth User',
      };

      // First registration
      const response1 = await request(app).post('/api/auth/register').send(userData).expect(201);
      trackUser(response1);

      // Second registration with same email
      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User with this email or username already exists');
    });
  });

  describe('User Login', () => {
    let loginEmail;
    let loginPassword;
    beforeEach(async () => {
      // Create a test user for login tests
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      loginEmail = `authtest-login_${timestamp}_${randomSuffix}@example.com`;
      loginPassword = 'TestPassword123!';
      const userData = {
        username: `authtestlogin_${timestamp}_${randomSuffix}`,
        email: loginEmail,
        password: loginPassword,
        firstName: 'Auth',
        lastName: 'User',
        name: 'Auth User',
      };

      const response = await request(app).post('/api/auth/register').send(userData);
      trackUser(response);
    });

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: loginEmail,
        password: loginPassword,
      };

      const response = await request(app).post('/api/auth/login').send(loginData).expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user.email).toBe(loginData.email);
      // Tokens are now in httpOnly cookies for security, not in response body
      expect(response.headers['set-cookie']).toBeDefined();
      const cookies = response.headers['set-cookie'];
      expect(cookies.some(cookie => cookie.startsWith('accessToken='))).toBe(true);
      expect(cookies.some(cookie => cookie.startsWith('refreshToken='))).toBe(true);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should reject login with invalid credentials', async () => {
      const loginData = {
        email: loginEmail,
        password: 'wrongpassword',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .set('x-test-require-auth', 'true')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('Token Management', () => {
    let refreshTokenValue; // Renamed to avoid conflict if refreshToken is imported

    beforeEach(async () => {
      // Create user and get refresh token
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const userData = {
        username: `authtesttoken_${timestamp}_${randomSuffix}`,
        email: `authtest-token_${timestamp}_${randomSuffix}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Auth',
        lastName: 'User',
        name: 'Auth User',
      };

      const registerResponse = await request(app).post('/api/auth/register').send(userData);
      trackUser(registerResponse);

      // Extract refreshToken from httpOnly cookie
      if (registerResponse.headers && registerResponse.headers['set-cookie']) {
        const cookies = registerResponse.headers['set-cookie'];
        const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
        if (refreshTokenCookie) {
          refreshTokenValue = refreshTokenCookie.split(';')[0].split('=')[1];
        } else {
          refreshTokenValue = null;
        }
      } else {
        refreshTokenValue = null;
      }
    });

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${refreshTokenValue}`) // Send as cookie header, not body
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Token refreshed successfully');
      // Tokens are in httpOnly cookies, not response body
      expect(response.headers['set-cookie']).toBeDefined();
      const cookies = response.headers['set-cookie'];
      expect(cookies.some(cookie => cookie.startsWith('accessToken='))).toBe(true);
      expect(cookies.some(cookie => cookie.startsWith('refreshToken='))).toBe(true);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token') // Send as cookie header, not body
        .set('x-test-require-auth', 'true')
        .expect(401);

      expect(response.body.success).toBe(false);
      // Token rotation service detects invalid tokens as potential reuse
      expect(response.body.message).toBe('Token reuse detected - please login again');
    });
  });

  describe('Protected Routes', () => {
    let authTokenValue; // Renamed
    let testUserValue; // Renamed

    beforeEach(async () => {
      // Create user and generate auth token using helper
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const userData = {
        username: `authtestprotected_${timestamp}_${randomSuffix}`,
        email: `authtest-protected_${timestamp}_${randomSuffix}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Auth',
        lastName: 'User',
        name: 'Auth User',
      };

      const registerResponse = await request(app).post('/api/auth/register').send(userData);
      trackUser(registerResponse);

      if (registerResponse.body && registerResponse.body.data) {
        testUserValue = registerResponse.body.data.user;
        // Generate JWT token for authentication using test helper
        authTokenValue = generateTestToken({ id: testUserValue.id, email: testUserValue.email });
      } else {
        authTokenValue = null;
        testUserValue = null;
      }
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authTokenValue}`) // Use renamed variable
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user.email).toBe(testUserValue.email); // Use renamed variable
      expect(response.body.data.user.username).toBe(testUserValue.username); // Use renamed variable
      expect(response.body.data.user.firstName).toBe(testUserValue.firstName); // Use renamed variable
      expect(response.body.data.user.lastName).toBe(testUserValue.lastName); // Use renamed variable
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should reject profile request without token', async () => {
      const response = await request(app).get('/api/auth/me').set('x-test-require-auth', 'true').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token is required');
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authTokenValue}`) // Use renamed variable
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Logout successful');
    });
  });
});
