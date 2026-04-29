/**
 * Jest Test Setup
 * Global configuration for all test files
 *
 * SECURITY: Test environment isolation
 */

import { beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import prisma from '../db/index.mjs';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce test noise

/**
 * Global test setup - runs once before all tests
 */
beforeAll(async () => {
  // Ensure we're using test database
  if (!process.env.DATABASE_URL?.includes('equoria_test')) {
    throw new Error('DANGER: Not using test database! Set DATABASE_URL_TEST');
  }

  // Clear all test data before starting
  await cleanupDatabase();
});

/**
 * Global test teardown - runs once after all tests
 */
afterAll(async () => {
  // Clean up and disconnect
  await cleanupDatabase();

  // Force close all connections
  await prisma.$disconnect();

  // Wait for all async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});

/**
 * Before each test - clean slate
 */
beforeEach(async () => {
  if (process.env.TEST_DB_RESET_PER_TEST === 'true') {
    // Optional per-test cleanup for suites that require a fresh DB.
    await cleanupDatabase();
  }
});

/**
 * After each test - cleanup
 */
afterEach(async () => {
  // Clear any lingering data
  jest.clearAllMocks();
  jest.restoreAllMocks();

  // Ensure all async operations complete before next test
  await new Promise(resolve => setImmediate(resolve));
});

/**
 * Clean all test data from database
 * Order matters due to foreign key constraints - delete child records first!
 */
async function cleanupDatabase() {
  if (process.env.TEST_DB_RESET_PER_TEST !== 'true') {
    return;
  }

  try {
    // Delete in correct order: children before parents
    // RefreshToken has FK to User, so delete it first
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({});
    // Add more tables here as needed, children before parents
  } catch (error) {
    // Ignore "table does not exist" errors
    if (!error.message?.includes('does not exist')) {
      console.error('Error cleaning database:', error.message);
    }
  }
}

/**
 * Test Helpers
 */

/**
 * Create test user with default values
 */
export async function createTestUser(overrides = {}) {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const defaultUser = {
    id: `test-${timestamp}-${randomId}`,
    username: overrides.username || `testuser-${timestamp}-${randomId}`,
    email: overrides.email || `test-${timestamp}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy', // 'password123'
    emailVerified: true, // Fixed: schema uses emailVerified, not isEmailVerified
  };

  return prisma.user.create({
    data: { ...defaultUser, ...overrides },
  });
}

/**
 * Create test refresh token.
 *
 * Equoria-uy73 (2026-04-24): raw JWTs are no longer stored at rest — the
 * DB holds only a SHA-256 hex digest. This helper hashes the synthetic
 * raw value before insert so tests keep a stable, unique row per call.
 */
export async function createTestRefreshToken(userId, overrides = {}) {
  // Equoria-uy73 (review patch P4): the `token` column is gone. A rebased
  // feature branch that still passes `token: '…'` would previously have
  // hit a Prisma validation error; the helper now silently maps to
  // tokenHash, which would let the row insert with the wrong material.
  // Fail fast instead so the rebase-induced bug is impossible to miss.
  if (Object.prototype.hasOwnProperty.call(overrides, 'token')) {
    throw new Error(
      "createTestRefreshToken: 'token' override is no longer supported (Equoria-uy73). " +
        "Use 'rawToken' for the JWT to hash, or 'tokenHash' for an explicit precomputed hash.",
    );
  }
  const { hashRefreshToken } = await import('../utils/tokenRotationService.mjs');
  const rawToken =
    overrides.rawToken ?? `test-token-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // Caller-supplied `tokenHash` wins. Otherwise hash the raw value.
  const tokenHash = overrides.tokenHash ?? hashRefreshToken(rawToken);

  const defaultToken = {
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    lastActivityAt: new Date(),
  };

  // Strip helper-only fields AND the legacy `token` field from overrides
  // so we never leak the removed column name into Prisma.create.
  const { rawToken: _raw, tokenHash: _hash, token: _tok, ...rest } = overrides;
  const record = await prisma.refreshToken.create({
    data: { ...defaultToken, ...rest, tokenHash },
  });
  // Expose the raw token via `.rawToken` ONLY. We deliberately do NOT also
  // alias `.token = rawToken`: a `.token` field shadowing the removed DB
  // column tempts a future caller to ship the row through code-under-test
  // that thinks it's reading the DB. Caller audit (search for `.token` on
  // refresh-token records) found no remaining reads of `record.token` —
  // the only `.token` reference in tests is `expect(session.token).toBeUndefined()`
  // on the API response, which this rename does not affect.
  record.rawToken = rawToken;
  return record;
}

/**
 * Mock Express request object
 */
export function mockRequest(overrides = {}) {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    cookies: {},
    user: null,
    ip: '127.0.0.1',
    originalUrl: '/test',
    method: 'GET',
    get(header) {
      return this.headers[header.toLowerCase()];
    },
    ...overrides,
  };
}

/**
 * Mock Express response object
 */
export function mockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    statusCode: 200,
    headersSent: false,
  };
  return res;
}

/**
 * Mock Express next function
 */
export function mockNext() {
  return jest.fn();
}

/**
 * Wait for async operations to complete
 */
export function waitForAsync() {
  return new Promise(resolve => setImmediate(resolve));
}
