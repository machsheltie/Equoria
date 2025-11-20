/**
 * Test Helper Utilities
 *
 * Provides reusable test utilities for:
 * - Rate limit bypassing
 * - Test data factories
 * - Database cleanup
 * - Mock request/response objects
 *
 * Phase 1, Day 3: Rate Limiting Implementation
 */

import bcrypt from 'bcryptjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateToken, generateRefreshToken } from '../../middleware/auth.mjs';

/**
 * User Test Data Factory
 * Creates complete user objects with all required fields
 */
export const createUserData = (overrides = {}) => {
  const timestamp = Date.now();
  return {
    username: `testuser_${timestamp}`,
    email: `test_${timestamp}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    ...overrides,
  };
};

/**
 * Create Test User in Database
 * Returns complete user object with hashed password
 */
export const createTestUser = async (overrides = {}) => {
  const userData = createUserData(overrides);
  const hashedPassword = await bcrypt.hash(userData.password, 10);

  const user = await prisma.user.create({
    data: {
      username: userData.username,
      email: userData.email,
      password: hashedPassword,
      firstName: userData.firstName,
      lastName: userData.lastName,
    },
  });

  return {
    ...user,
    plainPassword: userData.password, // For login tests
  };
};

/**
 * Clean Up Test User
 * Deletes user and all related data
 */
export const cleanupTestUser = async (userId) => {
  if (!userId) return;

  try {
    // Delete refresh tokens first (foreign key constraint)
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });

    // Delete user
    await prisma.user.delete({
      where: { id: userId },
    });
  } catch (error) {
    // Ignore errors (user may already be deleted)
  }
};

/**
 * Clean Up Test Users by Email Pattern
 * Useful for cleaning up after failed tests
 */
export const cleanupTestUsersByEmail = async (emailPattern) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: emailPattern,
        },
      },
    });

    for (const user of users) {
      await cleanupTestUser(user.id);
    }
  } catch (error) {
    // Ignore errors
  }
};

/**
 * Generate Test JWT Tokens
 * Creates valid access and refresh tokens for testing
 */
export const generateTestTokens = (user) => {
  const tokenPayload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role || 'user',
  };

  return {
    accessToken: generateToken(tokenPayload, '1h'),
    refreshToken: generateRefreshToken(tokenPayload),
  };
};

/**
 * Rate Limit Bypass Configuration
 * Returns environment overrides to disable rate limiting in tests
 */
export const getRateLimitBypassConfig = () => {
  return {
    NODE_ENV: 'test',
    RATE_LIMIT_ENABLED: 'false',
    RATE_LIMIT_MAX_REQUESTS: '10000', // Very high limit for tests
  };
};

/**
 * Sleep Utility
 * Wait for specified milliseconds
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wait for Rate Limit Window to Reset
 * Waits for rate limit window + buffer time
 */
export const waitForRateLimitReset = async (windowMs = 15 * 60 * 1000) => {
  const bufferMs = 1000; // 1 second buffer
  await sleep(windowMs + bufferMs);
};

/**
 * Mock Express Request Object
 */
export const createMockRequest = (overrides = {}) => {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    ip: '127.0.0.1',
    method: 'GET',
    path: '/test',
    get: function(header) {
      return this.headers[header.toLowerCase()];
    },
    ...overrides,
  };
};

/**
 * Mock Express Response Object
 */
export const createMockResponse = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.body = data;
      return this;
    },
    setHeader: function(key, value) {
      this.headers[key] = value;
      return this;
    },
    cookie: function(name, value, options) {
      this.cookies = this.cookies || {};
      this.cookies[name] = { value, options };
      return this;
    },
  };
  return res;
};

/**
 * Database Cleanup Helper
 * Cleans up all test data from database
 */
export const cleanupDatabase = async () => {
  try {
    // Delete in correct order to respect foreign key constraints
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test',
        },
      },
    });
  } catch (error) {
    console.error('Database cleanup error:', error);
  }
};

/**
 * Rate Limit Store Reset
 * Clears in-memory rate limit store
 */
export const resetRateLimitStore = async () => {
  try {
    const { resetAllAuthRateLimits } = await import('../../middleware/authRateLimiter.mjs');
    resetAllAuthRateLimits();
  } catch (error) {
    // Silently ignore if module doesn't exist yet
  }
  return Promise.resolve();
};

/**
 * Assertion Helpers
 */
export const expectRateLimitHeaders = (response) => {
  expect(response.headers).toHaveProperty('ratelimit-limit');
  expect(response.headers).toHaveProperty('ratelimit-remaining');
  expect(response.headers).toHaveProperty('ratelimit-reset');
};

export const expectRateLimitExceeded = (response) => {
  expect(response.status).toBe(429);
  expect(response.body).toMatchObject({
    success: false,
    error: expect.stringContaining('Too many requests'),
  });
  expectRateLimitHeaders(response);
};

export const expectAuthSuccess = (response) => {
  expect(response.status).toBeOneOf([200, 201]);
  expect(response.body).toHaveProperty('status', 'success');
  expect(response.body).toHaveProperty('data');
};

export const expectAuthFailure = (response, status = 401) => {
  expect(response.status).toBe(status);
  expect(response.body).toHaveProperty('success', false);
};

/**
 * Token Rotation Test Helpers
 * Phase 1, Day 4-5: Token Rotation with Reuse Detection
 */

/**
 * Extract Cookie Value from Set-Cookie Headers
 */
export const extractCookieValue = (cookies, cookieName) => {
  if (!cookies) return null;

  const cookie = cookies.find(cookie =>
    cookie.includes(`${cookieName}=`)
  );

  if (!cookie) return null;

  const match = cookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
};

/**
 * Extract Refresh Token from Set-Cookie Headers
 */
export const extractRefreshTokenFromCookies = (cookies) => {
  return extractCookieValue(cookies, 'refreshToken');
};

/**
 * Extract Access Token from Set-Cookie Headers
 */
export const extractAccessTokenFromCookies = (cookies) => {
  return extractCookieValue(cookies, 'accessToken');
};

/**
 * Create Test Token Family
 * Creates a full token family for testing rotation scenarios
 */
export const createTestTokenFamily = async (user) => {
  const familyId = `test-family-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // This will be implemented in tokenRotationService.mjs
  try {
    const { createTokenPair } = await import('../../utils/tokenRotationService.mjs');
    return await createTokenPair(user.id, familyId);
  } catch (error) {
    // Return mock structure for TDD RED phase
    return {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      familyId: familyId
    };
  }
};

/**
 * Cleanup All Refresh Tokens
 * Removes all refresh tokens from database
 */
export const cleanupAllRefreshTokens = async () => {
  try {
    await prisma.refreshToken.deleteMany({});
  } catch (error) {
    console.error('Refresh token cleanup error:', error);
  }
};

/**
 * Create Test Refresh Token in Database
 * Directly creates token record for testing
 */
export const createTestRefreshTokenRecord = async (tokenData) => {
  const defaultData = {
    token: `test-token-${Date.now()}`,
    userId: 'test-user-id',
    familyId: `test-family-${Date.now()}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    isActive: true,
    isInvalidated: false,
  };

  return await prisma.refreshToken.create({
    data: { ...defaultData, ...tokenData },
  });
};

/**
 * Verify Token Family State
 * Checks the state of all tokens in a family
 */
export const verifyTokenFamilyState = async (familyId) => {
  const tokens = await prisma.refreshToken.findMany({
    where: { familyId },
  });

  return {
    familyId,
    totalTokens: tokens.length,
    activeTokens: tokens.filter(t => t.isActive).length,
    invalidatedTokens: tokens.filter(t => t.isInvalidated).length,
    tokens: tokens.map(t => ({
      token: t.token.substring(0, 20) + '...', // Truncate for safety
      isActive: t.isActive,
      isInvalidated: t.isInvalidated,
      createdAt: t.createdAt,
    })),
  };
};

/**
 * Assert Token Rotation Occurred
 * Verifies that token rotation happened correctly
 */
export const assertTokenRotationOccurred = (oldTokens, newTokens) => {
  expect(newTokens.accessToken).toBeDefined();
  expect(newTokens.refreshToken).toBeDefined();
  expect(newTokens.refreshToken).not.toBe(oldTokens.refreshToken);
  expect(newTokens.accessToken).not.toBe(oldTokens.accessToken);
};

/**
 * Assert Token Reuse Detection
 * Verifies that token reuse was properly detected
 */
export const assertTokenReuseDetected = (response) => {
  expect(response.status).toBe(401);
  expect(response.body.message).toMatch(/reuse.*detected|invalid.*token/i);
};

/**
 * Assert Family Invalidation
 * Verifies that an entire token family was invalidated
 */
export const assertFamilyInvalidation = async (familyId) => {
  const familyState = await verifyTokenFamilyState(familyId);
  expect(familyState.activeTokens).toBe(0);
  expect(familyState.invalidatedTokens).toBe(familyState.totalTokens);
};

/**
 * Mock Token Rotation Service Functions
 * Provides mock implementations for TDD RED phase
 */
export const mockTokenRotationService = () => {
  return {
    generateTokenFamily: jest.fn(() => `mock-family-${Date.now()}`),
    createTokenPair: jest.fn(async () => ({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    })),
    validateRefreshToken: jest.fn(async () => ({
      isValid: true,
      decoded: { userId: 'test-user', familyId: 'test-family' },
      error: null,
    })),
    rotateRefreshToken: jest.fn(async () => ({
      success: true,
      newTokenPair: {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      },
    })),
    detectTokenReuse: jest.fn(async () => ({
      isReuse: false,
      familyId: 'test-family',
      shouldInvalidateFamily: false,
    })),
    invalidateTokenFamily: jest.fn(async () => ({
      success: true,
      invalidatedCount: 1,
    })),
    cleanupExpiredTokens: jest.fn(async () => ({
      removedCount: 0,
      expiredCount: 0,
      invalidatedCount: 0,
    })),
  };
};

/**
 * Token Security Test Helpers
 */
export const expectTokenSecurityHeaders = (response) => {
  const cookies = response.headers['set-cookie'] || [];
  const refreshCookie = cookies.find(c => c.includes('refreshToken='));

  if (refreshCookie) {
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/Secure/i);
    expect(refreshCookie).toMatch(/SameSite=Strict/i);
  }
};

/**
 * Rate Limit Store Reset for Token Tests
 * Extended version that handles token-related rate limits
 */
export const resetTokenRateLimitStore = async () => {
  await resetRateLimitStore();

  try {
    // Reset any token-specific rate limits
    const { resetTokenRotationRateLimits } = await import('../../middleware/authRateLimiter.mjs');
    if (resetTokenRotationRateLimits) {
      resetTokenRotationRateLimits();
    }
  } catch (error) {
    // Ignore if not implemented yet
  }
};

/**
 * Custom Jest Matchers
 */
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be one of ${expected}`
          : `expected ${received} to be one of ${expected}`,
    };
  },

  toBeValidJWT(received) {
    const pass = typeof received === 'string' && received.split('.').length === 3;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid JWT`
          : `expected ${received} to be a valid JWT (format: header.payload.signature)`,
    };
  },

  toHaveTokenRotationHeaders(received) {
    const headers = received.headers || {};
    const cookies = headers['set-cookie'] || [];
    const hasRefreshToken = cookies.some(c => c.includes('refreshToken='));
    const hasAccessToken = cookies.some(c => c.includes('accessToken='));
    const pass = hasRefreshToken && hasAccessToken;

    return {
      pass,
      message: () =>
        pass
          ? 'expected response not to have token rotation headers'
          : 'expected response to have both refreshToken and accessToken in Set-Cookie headers',
    };
  },
});
