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
 * Create test refresh token
 */
export async function createTestRefreshToken(userId, overrides = {}) {
  const defaultToken = {
    token: `test-token-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    lastActivityAt: new Date(),
  };

  return prisma.refreshToken.create({
    data: { ...defaultToken, ...overrides },
  });
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
    get: function (header) {
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
