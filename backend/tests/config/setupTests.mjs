/**
 * Test Setup Configuration
 *
 * Runs before each test file.
 * Sets up mocks, utilities, and test environment.
 */

import { jest, expect } from '@jest/globals';

// Configure test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key';

// Global test utilities
global.testUtils = {
  /**
   * Wait for async operations to complete
   */
  async wait(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Create mock user for testing
   */
  createMockUser(overrides = {}) {
    return {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      money: 1000,
      level: 1,
      xp: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  },

  /**
   * Create mock request object
   */
  createMockRequest(overrides = {}) {
    return {
      body: {},
      query: {},
      params: {},
      headers: {},
      cookies: {},
      user: null,
      ...overrides,
    };
  },

  /**
   * Create mock response object
   */
  createMockResponse() {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    return res;
  },

  /**
   * Create mock next function
   */
  createMockNext() {
    return jest.fn();
  },
};

// Console suppression for cleaner test output (optional)
if (process.env.SUPPRESS_LOGS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error for debugging
    error: console.error,
  };
}

// Custom matchers
expect.extend({
  /**
   * Check if object has httpOnly cookie
   */
  toHaveHttpOnlyCookie(received, cookieName) {
    const cookies = received.headers?.['set-cookie'] || [];
    const cookie = cookies.find(c => c.startsWith(`${cookieName}=`));

    const pass = cookie && cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict');

    if (pass) {
      return {
        message: () => `expected response not to have httpOnly cookie "${cookieName}"`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected response to have httpOnly cookie "${cookieName}" with HttpOnly and SameSite=Strict`,
        pass: false,
      };
    }
  },

  /**
   * Check if object does not contain sensitive data
   */
  toNotContainSensitiveData(received) {
    const responseBody = JSON.stringify(received);
    const hasSensitiveData =
      responseBody.includes('"token"') ||
      responseBody.includes('"refreshToken"') ||
      responseBody.includes('"password"') ||
      /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/.test(responseBody); // JWT pattern

    if (hasSensitiveData) {
      return {
        message: () => 'expected response not to contain sensitive data (tokens, passwords)',
        pass: false,
      };
    } else {
      return {
        message: () => 'expected response to contain sensitive data',
        pass: true,
      };
    }
  },
});

// Cleanup after each test
afterEach(async () => {
  jest.clearAllMocks();
});
