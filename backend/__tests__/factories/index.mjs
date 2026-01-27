/**
 * 🏭 TEST FACTORIES
 *
 * Reusable test data generators for consistent and DRY testing.
 * Reduces test code duplication by 50%+ and ensures data consistency.
 *
 * Usage:
 * ```javascript
 * import { createMockUser, createMockHorse, createMockToken } from '../factories/index.mjs';
 *
 * const user = createMockUser({ email: 'custom@example.com' });
 * const horse = createMockHorse({ name: 'Custom Name' });
 * const token = createMockToken(user.id);
 * ```
 *
 * @module __tests__/factories
 */

import jwt from 'jsonwebtoken';

/**
 * Default test configuration
 */
const TEST_CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'test-secret-key',
};

/**
 * Create a mock user with sensible defaults
 *
 * @param {Object} overrides - Custom properties to override defaults
 * @returns {Object} Mock user object
 */
export function createMockUser(overrides = {}) {
  const defaults = {
    id: Math.floor(Math.random() * 10000),
    email: `test${Math.random()}@example.com`,
    username: `testuser${Math.random().toString(36).substr(2, 9)}`,
    password: 'hashedPassword123',
    role: 'USER',
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock user with simple hashed password (for testing)
 *
 * @param {Object} overrides - Custom properties to override defaults
 * @returns {Object} Mock user with simple hashed password
 */
export function createMockUserWithHash(overrides = {}) {
  const password = overrides.password || 'TestPassword123';
  const hashedPassword = `hashed_${password}`; // Simple mock hash

  return createMockUser({
    ...overrides,
    password: hashedPassword,
    rawPassword: password, // Store raw password for testing login
  });
}

/**
 * Create a mock horse with sensible defaults
 *
 * @param {Object} overrides - Custom properties to override defaults
 * @returns {Object} Mock horse object
 */
export function createMockHorse(overrides = {}) {
  const defaults = {
    id: Math.floor(Math.random() * 10000),
    name: `TestHorse${Math.random().toString(36).substr(2, 9)}`,
    userId: 1,
    breed: 'Thoroughbred',
    gender: 'MARE',
    color: 'Bay',
    age: 5,
    baseStats: {
      speed: 50,
      stamina: 50,
      agility: 50,
      intelligence: 50,
    },
    currentStats: {
      speed: 50,
      stamina: 50,
      agility: 50,
      intelligence: 50,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock groom with sensible defaults
 *
 * @param {Object} overrides - Custom properties to override defaults
 * @returns {Object} Mock groom object
 */
export function createMockGroom(overrides = {}) {
  const defaults = {
    id: Math.floor(Math.random() * 10000),
    name: `TestGroom${Math.random().toString(36).substr(2, 9)}`,
    userId: 1,
    specialty: 'TRAINING',
    experience: 50,
    salary: 1000,
    hireDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock JWT access token
 *
 * @param {number|string} userId - User ID to encode in token
 * @param {Object} options - Token options
 * @param {boolean} options.expired - Whether token should be expired
 * @param {string} options.expiresIn - Token expiration time (default: '15m')
 * @param {Object} options.payload - Additional payload data
 * @returns {string} JWT token string
 */
export function createMockToken(userId, options = {}) {
  const { expired = false, expiresIn = '15m', payload = {} } = options;

  const tokenPayload = {
    userId,
    iat: expired ? Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60 : Math.floor(Date.now() / 1000), // 7 days ago if expired
    ...payload,
  };

  // SECURITY: Explicitly specify HS256 to match auth.mjs verification requirements
  return jwt.sign(tokenPayload, TEST_CONFIG.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: expired ? '1ms' : expiresIn,
  });
}

/**
 * Create a mock JWT refresh token
 *
 * @param {number|string} userId - User ID to encode in token
 * @param {Object} options - Token options
 * @returns {string} JWT refresh token string
 */
export function createMockRefreshToken(userId, options = {}) {
  const { expired = false, familyId = `family_${Math.random().toString(36).substr(2, 9)}` } =
    options;

  return createMockToken(userId, {
    expired,
    expiresIn: '7d',
    payload: {
      familyId,
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(2),
    },
  });
}

/**
 * Create a malformed JWT token for testing invalid tokens
 *
 * @returns {string} Malformed token string
 */
export function createMalformedToken() {
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';
}

/**
 * Create a mock refresh token database record
 *
 * @param {Object} overrides - Custom properties to override defaults
 * @returns {Object} Mock refresh token record
 */
export function createMockRefreshTokenRecord(overrides = {}) {
  const defaults = {
    id: Math.floor(Math.random() * 10000),
    userId: 1,
    token: createMockRefreshToken(1),
    familyId: `family_${Math.random().toString(36).substr(2, 9)}`,
    isValid: true,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    createdAt: new Date(),
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock training session with sensible defaults
 *
 * @param {Object} overrides - Custom properties to override defaults
 * @returns {Object} Mock training session object
 */
export function createMockTrainingSession(overrides = {}) {
  const defaults = {
    id: Math.floor(Math.random() * 10000),
    horseId: 1,
    userId: 1,
    type: 'SPEED',
    duration: 60,
    intensity: 'MEDIUM',
    results: {
      speedGain: 5,
      staminaGain: 3,
      fatigueGain: 10,
    },
    createdAt: new Date(),
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock competition entry with sensible defaults
 *
 * @param {Object} overrides - Custom properties to override defaults
 * @returns {Object} Mock competition entry object
 */
export function createMockCompetitionEntry(overrides = {}) {
  const defaults = {
    id: Math.floor(Math.random() * 10000),
    horseId: 1,
    userId: 1,
    competitionId: 1,
    status: 'ENTERED',
    score: null,
    placement: null,
    createdAt: new Date(),
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock breeding record with sensible defaults
 *
 * @param {Object} overrides - Custom properties to override defaults
 * @returns {Object} Mock breeding record object
 */
export function createMockBreeding(overrides = {}) {
  const defaults = {
    id: Math.floor(Math.random() * 10000),
    mareId: 1,
    stallionId: 2,
    userId: 1,
    status: 'PENDING',
    expectedFoalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    createdAt: new Date(),
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock CSRF token
 *
 * @returns {string} Mock CSRF token
 */
export function createMockCsrfToken() {
  return `csrf_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
}

/**
 * Create multiple mock users at once
 *
 * @param {number} count - Number of users to create
 * @param {Object} baseOverrides - Base overrides applied to all users
 * @returns {Object[]} Array of mock users
 */
export function createMockUsers(count, baseOverrides = {}) {
  return Array.from({ length: count }, (_, i) =>
    createMockUser({ ...baseOverrides, email: `test${i}@example.com` }),
  );
}

/**
 * Create multiple mock horses at once
 *
 * @param {number} count - Number of horses to create
 * @param {Object} baseOverrides - Base overrides applied to all horses
 * @returns {Object[]} Array of mock horses
 */
export function createMockHorses(count, baseOverrides = {}) {
  return Array.from({ length: count }, (_, i) =>
    createMockHorse({ ...baseOverrides, name: `TestHorse${i}` }),
  );
}

/**
 * Export all factories
 */
/**
 * Export all factories as default
 */
export default {
  createMockUser,
  createMockUserWithHash,
  createMockHorse,
  createMockGroom,
  createMockToken,
  createMockRefreshToken,
  createMalformedToken,
  createMockRefreshTokenRecord,
  createMockTrainingSession,
  createMockCompetitionEntry,
  createMockBreeding,
  createMockCsrfToken,
  createMockUsers,
  createMockHorses,
};
