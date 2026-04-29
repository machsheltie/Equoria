/**
 * Jest Test Setup
 * Global configuration for all test files
 *
 * SECURITY: Test environment isolation
 */

import { beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
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
 * Create test user with default values.
 *
 * Equoria-3gti (21R-SEC-3-REVIEW-2-ADJ-1, 2026-04-29): switched from
 * `${Date.now()}-${Math.random().toString(36).substring(7)}` to
 * `${randomBytes(8).toString('hex')}`. The legacy pattern had two collision modes that
 * surfaced as flaky failures when test scheduling shifted (e.g. after
 * adding a new test file in the security suite):
 *
 *   1. Same-millisecond Date.now() + identical Math.random() output =>
 *      duplicate id / email / username, P2002 unique-constraint
 *      violation on user.create.
 *   2. Math.random().toString(36).substring(7) returns the empty
 *      string when the base-36 representation is shorter than 7
 *      characters (~36^-5 probability per call). The `email` defaulted
 *      to test-${Date.now()}@example.com (no randomId at all), so the
 *      email-collision class was already present even without the
 *      empty-randomId case.
 *
 * randomBytes(8).toString('hex') is collision-free for any practical run length and has
 * no dependence on monotonic clocks, so removes both classes. Phase 3a
 * (commit 85246b2a) updated test-file fixtures to use slice(2,6) but
 * did NOT update this helper — that gap is what surfaced now.
 *
 * The `test-` prefix is preserved so suite-level cleanup queries that
 * filter by `where: { email: { contains: 'test' } }` continue to match.
 */
export async function createTestUser(overrides = {}) {
  const uid = randomBytes(8).toString('hex');
  const defaultUser = {
    id: `test-${uid}`,
    username: overrides.username || `testuser-${uid}`,
    email: overrides.email || `test-${uid}@example.com`,
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
  // Equoria-3gti: randomBytes(8).toString('hex') replaces the Date.now()+Math.random()
  // collision-prone pattern (see createTestUser doc comment for full
  // rationale). The `test-token-` prefix is preserved for grep-friendly
  // identification in audit logs.
  const rawToken = overrides.rawToken ?? `test-token-${randomBytes(8).toString('hex')}`;

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
  // Expose the raw token alongside the DB row. The column itself is gone
  // (Equoria-uy73) but callers still need the raw value to send as the
  // refreshToken cookie/header in tests. `.token` stays as the raw value
  // for backward compat with ~15 call sites that do `record.token`.
  record.rawToken = rawToken;
  record.token = rawToken;
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
