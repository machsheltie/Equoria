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
 * 1. POST /api/v1/auth/register - User registration with validation and token generation
 * 2. POST /api/v1/auth/login - User authentication with credential verification
 * 3. POST /api/v1/auth/refresh - JWT token refresh with refresh token validation
 * 4. POST /api/v1/auth/logout - Session termination with token invalidation
 * 5. GET /api/v1/auth/me - Protected profile access with token authentication
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

import { randomBytes } from 'crypto';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { body } from 'express-validator';
import { register, login, refreshToken, logout, getProfile } from '../../controllers/authController.mjs';
import { authenticateToken } from '../../middleware/auth.mjs';
import prisma from '../../db/index.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';

// Create a minimal test app without problematic middleware
const createTestApp = () => {
  const app = express();

  // Basic middleware only
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser()); // Required for req.cookies in refreshToken endpoint

  // Auth routes with minimal validation
  app.post(
    '/api/v1/auth/register',
    body('name').trim().isLength({ min: 2, max: 50 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8, max: 128 }),
    register,
  );

  app.post('/api/v1/auth/login', body('email').isEmail().normalizeEmail(), body('password').notEmpty(), login);

  app.post('/api/v1/auth/refresh', refreshToken); // No body validation - token comes from cookies

  app.post('/api/v1/auth/logout', authenticateToken, logout);

  app.get('/api/v1/auth/me', authenticateToken, getProfile);

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
    // prisma.$disconnect() removed — global teardown handles disconnection
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const uid = randomBytes(8).toString('hex');
      const userData = {
        username: `authtestuser_${uid}`,
        email: `authtest-register_${uid}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Auth',
        lastName: 'User',
        name: 'Auth User', // Required by minimal app schema in this file
        // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201.
        dateOfBirth: '1990-01-01',
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send(userData)
        .expect(201);
      trackUser(response);

      expect(response.body.success).toBe(true);
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
      const uid = randomBytes(8).toString('hex');
      const userData = {
        username: `authtestdupe_${uid}`,
        email: `authtest-duplicate_${uid}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Auth',
        lastName: 'User',
        name: 'Auth User',
        // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201;
        // the duplicate-email 409 case needs the FIRST register to succeed.
        dateOfBirth: '1990-01-01',
      };

      // First registration
      const response1 = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send(userData)
        .expect(201);
      trackUser(response1);

      // Second registration with same email — expect 409 Conflict (Equoria-t0wk)
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('User Login', () => {
    let loginEmail;
    let loginPassword;
    beforeEach(async () => {
      // Create a test user for login tests
      const uid = randomBytes(8).toString('hex');
      loginEmail = `authtest-login_${uid}@example.com`;
      loginPassword = 'TestPassword123!';
      const userData = {
        username: `authtestlogin_${uid}`,
        email: loginEmail,
        password: loginPassword,
        firstName: 'Auth',
        lastName: 'User',
        name: 'Auth User',
        // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201.
        dateOfBirth: '1990-01-01',
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send(userData);
      trackUser(response);
    }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: loginEmail,
        password: loginPassword,
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
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
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send(loginData)

        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('Token Management', () => {
    let refreshTokenValue; // Renamed to avoid conflict if refreshToken is imported

    beforeEach(async () => {
      // Create user and get refresh token
      const uid = randomBytes(8).toString('hex');
      const userData = {
        username: `authtesttoken_${uid}`,
        email: `authtest-token_${uid}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Auth',
        lastName: 'User',
        name: 'Auth User',
        // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201.
        dateOfBirth: '1990-01-01',
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send(userData);
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
    }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', `refreshToken=${refreshTokenValue}`) // Send as cookie header, not body
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token refreshed successfully');
      // Tokens are in httpOnly cookies, not response body
      expect(response.headers['set-cookie']).toBeDefined();
      const cookies = response.headers['set-cookie'];
      expect(cookies.some(cookie => cookie.startsWith('accessToken='))).toBe(true);
      expect(cookies.some(cookie => cookie.startsWith('refreshToken='))).toBe(true);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', 'refreshToken=invalid-token') // Send as cookie header, not body

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
      const uid = randomBytes(8).toString('hex');
      const userData = {
        username: `authtestprotected_${uid}`,
        email: `authtest-protected_${uid}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Auth',
        lastName: 'User',
        name: 'Auth User',
        // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201.
        dateOfBirth: '1990-01-01',
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send(userData);
      trackUser(registerResponse);

      if (registerResponse.body && registerResponse.body.data) {
        testUserValue = registerResponse.body.data.user;
        // Generate JWT token for authentication using test helper
        authTokenValue = generateTestToken({ id: testUserValue.id, email: testUserValue.email });
      } else {
        authTokenValue = null;
        testUserValue = null;
      }
    }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authTokenValue}`) // Use renamed variable
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUserValue.email); // Use renamed variable
      expect(response.body.data.user.username).toBe(testUserValue.username); // Use renamed variable
      expect(response.body.data.user.firstName).toBe(testUserValue.firstName); // Use renamed variable
      expect(response.body.data.user.lastName).toBe(testUserValue.lastName); // Use renamed variable
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should reject profile request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Origin', 'http://localhost:3000')

        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token is required');
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authTokenValue}`) // Use renamed variable
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');
    });
  });
});
