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
  return {
    username: 'testuser123',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    password: 'TestPassword123',
    money: 1000, // Added default money
    ...overrides,
  };
};

export const createLoginData = (overrides = {}) => {
  return {
    email: 'test@example.com',
    password: 'TestPassword123',
    ...overrides,
  };
};
