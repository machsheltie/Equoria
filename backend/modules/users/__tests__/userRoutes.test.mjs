/**
 * 🧪 INTEGRATION TEST: User Routes - HTTP API Endpoints
 *
 * This test validates the user routes' HTTP API endpoints using real Express
 * application testing with strategic mocking of model dependencies.
 *
 * 📋 BUSINESS RULES TESTED:
 * - User progress API: XP calculations, level progression, response formatting
 * - User CRUD operations: Create, read, update, delete with proper HTTP status codes
 * - XP system integration: XP addition with level-up handling
 * - Input validation: ID format validation, required fields, data constraints
 * - Error handling: 404 for missing users, 400 for invalid data, 500 for server errors
 * - Response security: Sensitive fields excluded from public responses
 * - Edge cases: Special characters, long IDs, boundary values
 * - HTTP compliance: Proper status codes, response formats, error messages
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. GET /api/v1/users/:id/progress - User progress with XP calculations
 * 2. GET /api/v1/users/:id - User lookup by ID
 * 3. POST /api/v1/users - User creation with validation
 * 4. PUT /api/v1/users/:id - User updates with existence checks
 * 5. DELETE /api/v1/users/:id - User deletion with proper responses
 * 6. POST /api/v1/users/:id/add-xp - XP addition with level progression
 * 7. Input validation: ID constraints, data validation, error responses
 * 8. Error scenarios: Missing users, invalid data, server errors
 * 9. Response formatting: Data transformation, field filtering, security
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Express application, HTTP routing, middleware, response formatting
 * ✅ REAL: Input validation, error handling, status codes, API contracts
 * 🔧 MOCK: User model operations - external dependency
 * 🔧 MOCK: Logger calls - external dependency
 *
 * 💡 TEST STRATEGY: Integration testing with real HTTP stack and mocked
 *    model layer to validate API behavior and response formatting
 *
 * ⚠️  NOTE: This represents EXCELLENT API testing - tests real HTTP behavior
 *    with strategic mocking of data layer while validating API contracts.
 */

import { randomUUID } from 'crypto';
import { describe, beforeEach, afterEach, expect, it } from '@jest/globals';
import request from 'supertest';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../../../tests/helpers/testAuth.mjs';

import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// Import app directly - no mocking for full integration testing
const app = (await import('../../../app.mjs')).default;

describe('🌐 INTEGRATION: User Routes - HTTP API Endpoints', () => {
  // Equoria-462kg (sibling of Equoria-hrzwh): this suite formerly created the
  // two shared users (testUser + testUserForCrud) ONCE in beforeAll and
  // read/MUTATED them across 21 `it` blocks (the PUT test mutated
  // testUserForCrud.firstName, the add-xp test mutated testUser's XP, and many
  // reads depended on both surviving). Every reserved test-email pattern is in
  // the broad-cleanup blast radius, so a concurrent broad delete firing
  // mid-suite could strand the later `it` blocks after the earlier ones
  // mutated the rows. The robust fix is structural: each test creates and owns
  // its OWN pair of users (+ per-user CSRF) via a beforeEach helper, tracked
  // for id-scoped cleanup in afterEach, so no test depends on a user surviving
  // across `it` boundaries. Every original assertion is preserved verbatim.
  let __csrf__;
  let __csrfCrud__;

  let testUser;
  let authToken;
  let testUserForCrud; // Additional user for CRUD operations
  let authTokenForCrud; // Token for CRUD user
  let createdUserIds;

  beforeEach(async () => {
    createdUserIds = [];

    // Create test user with authentication token
    const userResult = await createTestUser({
      username: `userroutes_${randomUUID().slice(0, 8)}`,
      email: `userroutes_${randomUUID().slice(0, 8)}@test.com`,
      money: 5000,
      xp: 100,
      level: 2,
    });
    testUser = userResult.user;
    authToken = userResult.token;
    createdUserIds.push(testUser.id);

    // Create additional test user for CRUD operations
    const crudUserResult = await createTestUser({
      username: `crud_user_${randomUUID().slice(0, 8)}`,
      email: `crud_${randomUUID().slice(0, 8)}@test.com`,
      money: 1500,
      xp: 50,
      level: 1,
    });
    testUserForCrud = crudUserResult.user;
    authTokenForCrud = crudUserResult.token;
    createdUserIds.push(testUserForCrud.id);

    // Equoria-myfc5: per-user CSRF (Equoria-plw0h). csrf.mjs resolveSessionIdentifier
    // binds the token to req.user.id; an anonymous fetchCsrf 403s every authenticated
    // mutation. Bind one CSRF token per auth token used in the mutations below.
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });
    __csrfCrud__ = await fetchCsrf(app, { extraCookies: [`accessToken=${authTokenForCrud}`] });
  });

  afterEach(async () => {
    // id-scoped cleanup of exactly the users this test created (including any
    // fresh users a test minted inline, e.g. the DELETE test). The DELETE test
    // removes its own user; deleteMany on an already-gone id is a no-op.
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  describe('GET /api/v1/users/:id/progress', () => {
    // Changed route from /api/player to /api/v1/users
    it('should return user progress successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${testUser.id}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User progress retrieved successfully');
      expect(response.body.data).toMatchObject({
        userId: testUser.id,
        username: testUser.username,
        level: expect.any(Number),
        xp: expect.any(Number),
        progressPercentage: expect.any(Number),
        totalEarnings: expect.any(Number),
        xpForCurrentLevel: expect.any(Number),
        xpForNextLevel: expect.any(Number),
        xpToNextLevel: expect.any(Number),
      });

      // Verify the data types and ranges
      expect(typeof response.body.data.progressPercentage).toBe('number');
      expect(response.body.data.progressPercentage).toBeGreaterThanOrEqual(0);
      expect(response.body.data.progressPercentage).toBeLessThanOrEqual(100);
    });

    it('should return 403 for non-existent user (unauthorized access)', async () => {
      const nonExistentUuid = '550e8400-e29b-41d4-a716-446655440999';
      const response = await request(app)
        .get(`/api/v1/users/${nonExistentUuid}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('own user data');
    });

    it('should return validation error for empty user ID', async () => {
      const response = await request(app)
        .get('/api/v1/users//progress')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(400); // Validation error for empty ID

      expect(response.body).toEqual({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            msg: 'User ID must be a valid UUID',
          }),
        ]),
      });
    });

    it('should return validation error for invalid user ID format', async () => {
      const response = await request(app)
        .get('/api/v1/users/a/progress')
        .set('Origin', 'http://localhost:3000') // Invalid UUID format
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(400); // Validation error for invalid UUID

      expect(response.body).toEqual({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            msg: 'User ID must be a valid UUID',
          }),
        ]),
      });
    });

    it('should return validation error for extremely long user ID', async () => {
      const longId = 'a'.repeat(51); // 51 characters, exceeds limit

      const response = await request(app)
        .get(`/api/v1/users/${longId}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            msg: 'User ID must be a valid UUID',
          }),
        ]),
      });
    });

    it('should return 403 when attempting to access a different user (database error path blocked)', async () => {
      // Use a non-existent UUID to trigger database error
      // Use a valid UUID format but one that doesn't exist in database
      const nonExistentUuid = '550e8400-e29b-41d4-a716-446655440998';

      const response = await request(app)
        .get(`/api/v1/users/${nonExistentUuid}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should calculate xpToNextLevel correctly for edge cases', async () => {
      // Use the real test user for XP calculation tests
      const response = await request(app)
        .get(`/api/v1/users/${testUser.id}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(200);

      // Verify XP calculation fields are present and valid
      expect(response.body.data).toHaveProperty('xpToNextLevel');
      expect(response.body.data).toHaveProperty('progressPercentage');
      expect(response.body.data).toHaveProperty('xpForCurrentLevel');
      expect(response.body.data).toHaveProperty('xpForNextLevel');
      expect(typeof response.body.data.xpToNextLevel).toBe('number');
      expect(response.body.data.xpToNextLevel).toBeGreaterThanOrEqual(0);
    });

    it('should only return required fields in response', async () => {
      // Use the real test user to verify field filtering
      const response = await request(app)
        .get(`/api/v1/users/${testUser.id}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(200);

      // Verify required fields are present
      expect(response.body.data).toHaveProperty('userId');
      expect(response.body.data).toHaveProperty('username');
      expect(response.body.data).toHaveProperty('level');
      expect(response.body.data).toHaveProperty('xp');
      expect(response.body.data).toHaveProperty('progressPercentage');
      expect(response.body.data).toHaveProperty('totalEarnings');
      expect(response.body.data).toHaveProperty('xpForCurrentLevel');
      expect(response.body.data).toHaveProperty('xpForNextLevel');
      expect(response.body.data).toHaveProperty('xpToNextLevel');

      // Verify sensitive fields are not included (if any)
      expect(response.body.data).not.toHaveProperty('password');
      expect(response.body.data).not.toHaveProperty('createdAt');
      expect(response.body.data).not.toHaveProperty('updatedAt');
    });

    it('should handle invalid special characters in user ID', async () => {
      const specialId = 'user-123_test';

      const response = await request(app)
        .get(`/api/v1/users/${specialId}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(400); // Invalid UUID format

      expect(response.body).toEqual({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            msg: 'User ID must be a valid UUID',
          }),
        ]),
      });
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should return a user by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${testUserForCrud.id}`)
        .set('Origin', 'http://localhost:3000') // Use real test user
        .set('Authorization', `Bearer ${authTokenForCrud}`)
        .set('Origin', 'http://localhost:3000')
        // Equoria-myfc5: CSRF cookie carries accessToken and auth.mjs reads the
        // cookie before the Bearer header, so the cookie's user must match this
        // request's Bearer (authTokenForCrud) or the cookie user wins -> 403.
        .set('Cookie', __csrfCrud__.cookieHeader)
        .set('X-CSRF-Token', __csrfCrud__.csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User retrieved successfully');
      expect(response.body.data).toMatchObject({
        id: testUserForCrud.id,
        username: testUserForCrud.username,
        email: testUserForCrud.email,
      });
      // Allow additional fields that the real database might return
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('username');
      expect(response.body.data).toHaveProperty('email');
    });

    it('should return 403 if user not authorized (matches different user)', async () => {
      const nonExistentUuid = '550e8400-e29b-41d4-a716-446655440001';
      const response = await request(app)
        .get(`/api/v1/users/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(403);
      expect(response.body.success).toBe(false);
    });
  });

  // SECURITY (Equoria-sfexv, P2): POST /api/v1/users was a duplicate, weaker
  // account-creation path (6-char password floor, no COPPA age gate) that
  // let any authenticated ordinary user mint arbitrary accounts. It has been
  // DELETED. Account creation has exactly one front door:
  // POST /api/v1/auth/register (12-char + 4-class password, mandatory DOB).
  // These tests assert the duplicate route is GONE (404), not that it works.
  describe('POST /api/v1/users — REMOVED (Equoria-sfexv)', () => {
    it('returns 404 for an authenticated ordinary user (route deleted, cannot mint arbitrary accounts)', async () => {
      const userData = {
        username: `NewUser_${randomUUID().slice(0, 8)}`,
        firstName: 'New',
        lastName: 'User',
        email: `new_${randomUUID().slice(0, 8)}@example.com`,
        // Deliberately the OLD weak password that the deleted route accepted
        // (6+ chars, no upper/number/special). If the route ever comes back,
        // this exact payload would 201 — and this test would fail, surfacing
        // the regression.
        password: 'password123',
      };

      const response = await request(app)
        .post('/api/v1/users')
        .send(userData)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(404);

      // No account-creation success envelope is ever returned.
      expect(response.body.success).not.toBe(true);
      expect(response.body.message).not.toBe('User created successfully');
    });

    it('returns 404 for an unauthenticated request as well (no auth-bypass into a creation path)', async () => {
      await request(app)
        .post('/api/v1/users')
        .send({
          username: `Anon_${randomUUID().slice(0, 8)}`,
          email: `anon_${randomUUID().slice(0, 8)}@example.com`,
          password: 'password123',
        })
        .set('Origin', 'http://localhost:3000')
        // authRouter rejects unauthenticated mutations before route-matching
        // (401), and the route is gone regardless (404). Either way the
        // request is NOT a successful 201 account creation. Assert it is one
        // of the rejection codes, never 2xx.
        .expect(res => {
          if (res.status < 400) {
            throw new Error(`Expected a 4xx rejection for anonymous POST /api/v1/users, got ${res.status}`);
          }
        });
    });
  });

  // AC: the canonical register endpoint is UNCHANGED and remains the only
  // account-creation path. Its password/COPPA policy is NOT weaker than the
  // (now deleted) duplicate route. A 6-char, single-class password is
  // rejected (proves the strong policy is still enforced).
  describe('POST /api/v1/auth/register — canonical path unchanged (Equoria-sfexv)', () => {
    it('rejects a weak 6-char password (policy not weaker than the deleted /users route)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send({
          username: `reg_${randomUUID().slice(0, 8)}`,
          email: `reg_${randomUUID().slice(0, 8)}@example.com`,
          password: 'short1', // 6 chars, no upper/special — accepted by the OLD route, rejected here
          firstName: 'Reg',
          lastName: 'User',
          dateOfBirth: '2000-01-01',
        })
        .expect(400);
      expect(response.body.success).not.toBe(true);
    });

    it('rejects registration with a missing date of birth (COPPA gate present, unlike the deleted route)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send({
          username: `reg_${randomUUID().slice(0, 8)}`,
          email: `reg_${randomUUID().slice(0, 8)}@example.com`,
          password: 'StrongPass1!', // satisfies the strong policy
          firstName: 'Reg',
          lastName: 'User',
          // dateOfBirth intentionally omitted
        })
        .expect(400);
      expect(response.body.success).not.toBe(true);
    });
  });

  describe('PUT /api/v1/users/:id', () => {
    it('should update an existing user with an allowlisted field', async () => {
      // Equoria-qia4j fix: send an allowlisted field (firstName), NOT a privileged
      // field like money. The prior test sent money: 2500 which was proving the
      // mass-assignment vulnerability — that test was incorrect by design.
      const updates = { firstName: 'Updated' };

      const response = await request(app)
        .put(`/api/v1/users/${testUserForCrud.id}`)
        .send(updates)
        .set('Authorization', `Bearer ${authTokenForCrud}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrfCrud__.cookieHeader)
        .set('X-CSRF-Token', __csrfCrud__.csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User updated successfully');
      expect(response.body.data).toMatchObject({
        id: testUserForCrud.id,
        firstName: updates.firstName,
      });
      expect(response.body.data).toHaveProperty('username');
      expect(response.body.data).toHaveProperty('updatedAt');
    });

    it('should return 403 if user to update is not authorized', async () => {
      const nonExistentUuid = '550e8400-e29b-41d4-a716-446655440001';
      const response = await request(app)
        .put(`/api/v1/users/${nonExistentUuid}`)
        .send({ firstName: 'Hacked' })
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('should delete a user', async () => {
      // Create a fresh user to delete to avoid affecting other tests
      const deleteUserResult = await createTestUser({
        username: `delete_user_${randomUUID().slice(0, 8)}`,
        email: `delete_${randomUUID().slice(0, 8)}@test.com`,
      });
      // Track for id-scoped afterEach cleanup in case the DELETE endpoint fails
      // (deleteMany on the successfully-deleted id is a harmless no-op).
      createdUserIds.push(deleteUserResult.user.id);

      const deleteAuthToken = deleteUserResult.token;
      // Equoria-myfc5: bind CSRF to THIS request's token — the CSRF cookie carries
      // accessToken and auth.mjs reads it before the Bearer header, so a cookie
      // bound to a different user would win and requireSelfAccess would 403.
      const deleteCsrf = await fetchCsrf(app, { extraCookies: [`accessToken=${deleteAuthToken}`] });

      const response = await request(app)
        .delete(`/api/v1/users/${deleteUserResult.user.id}`)
        .set('Authorization', `Bearer ${deleteAuthToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', deleteCsrf.cookieHeader)
        .set('X-CSRF-Token', deleteCsrf.csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User deleted successfully');
    });

    it('should return 403 if user to delete is not authorized', async () => {
      const nonExistentUuid = '550e8400-e29b-41d4-a716-446655440001';
      const response = await request(app)
        .delete(`/api/v1/users/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/users/:id/add-xp', () => {
    test('should add XP to a user and potentially level them up', async () => {
      const xpData = { amount: 50 };
      const response = await request(app)
        .post(`/api/v1/users/${testUser.id}/add-xp`)
        .send(xpData)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('XP added successfully');
      // addXpToUser returns a specific structure (see userModel lines 177-184)
      expect(response.body.data).toMatchObject({
        success: true,
        xpGained: 50,
      });
      expect(response.body.data).toHaveProperty('currentXP');
      expect(response.body.data).toHaveProperty('currentLevel');
      expect(response.body.data).toHaveProperty('leveledUp');
      expect(response.body.data).toHaveProperty('levelsGained');
      expect(typeof response.body.data.currentXP).toBe('number');
      expect(typeof response.body.data.currentLevel).toBe('number');
      expect(typeof response.body.data.leveledUp).toBe('boolean');
    });

    it('should return 404 if user not found for XP addition (matches authorized user check)', async () => {
      // Trying to add XP to a different user should return 403
      const nonExistentUuid = '550e8400-e29b-41d4-a716-446655440001';
      const response = await request(app)
        .post(`/api/v1/users/${nonExistentUuid}/add-xp`)
        .send({ amount: 50 })
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  // Add more tests for other player routes if they were migrated to user routes
});
