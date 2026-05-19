import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import config from '../../config/config.mjs';

/**
 * Generate a test JWT token for authenticated requests
 */
export const generateTestToken = (userData = {}) => {
  const defaultUser = {
    id: 'test-user-uuid-123',
    email: 'test@example.com',
    role: 'user',
    fingerprint: Date.now(),
  };

  const user = { ...defaultUser, ...userData };

  return jwt.sign(user, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn || '7d',
  });
};

/**
 * Generate an admin test token
 */
export const generateAdminToken = () => {
  return generateTestToken({
    id: 'admin-user-uuid-456',
    email: 'admin@example.com',
    role: 'admin',
  });
};

/**
 * Create authorization header for requests
 */
export const authHeader = token => {
  return { Authorization: `Bearer ${token}` };
};

/**
 * Create test user data for registration/login tests
 */
export const createTestUser = (overrides = {}) => {
  // randomBytes(8).toString('hex') replaces Date.now()+Math.random() to eliminate
  // the same-millisecond collision class that flakes parallel real-DB suites
  // (Math.random().toString(36) returns variable-length strings — unlucky values
  // shrink the random suffix to 1 char of entropy). Matches the canonical
  // pattern documented in __tests__/setup.mjs:96-110 (Equoria-3gti).
  const uid = randomBytes(8).toString('hex');
  return {
    username: `testuser_${uid}`,
    firstName: 'Test',
    lastName: 'User',
    email: `test_${uid}@example.com`,
    password: 'TestPassword123!',
    // Equoria-iqzn: registration now enforces a COPPA age gate. Test users
    // default to a fixed adult DOB so /register POSTs pass the gate.
    dateOfBirth: '1990-01-01',
    money: 1000, // Added default money
    ...overrides,
  };
};

export const createLoginData = (overrides = {}) => {
  return {
    email: 'test@example.com',
    password: 'TestPassword123!',
    ...overrides,
  };
};
