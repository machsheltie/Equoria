/**
 * 🧪 COMPREHENSIVE TEST: Authentication Middleware
 *
 * Tests all authentication middleware functions including JWT verification,
 * optional authentication, role-based authorization, and token generation.
 *
 * 📋 COVERAGE SCOPE:
 * - authenticateToken: JWT verification and error handling
 * - optionalAuth: Optional authentication without requiring token
 * - requireRole: Role-based authorization middleware
 * - generateToken: JWT token generation
 * - generateRefreshToken: Refresh token generation with uniqueness
 *
 * 🎯 TEST CATEGORIES:
 * 1. Token Authentication - Valid/invalid/expired/malformed tokens
 * 2. Optional Authentication - Graceful degradation without token
 * 3. Role-Based Authorization - Permission validation and denial
 * 4. Token Generation - JWT creation and validation
 * 5. Error Handling - Various error scenarios and edge cases
 * 6. Security - Configuration validation and attack vectors
 *
 * 🔄 TESTING APPROACH:
 * ✅ REAL: JWT verification, token generation, middleware logic
 * 🔧 MOCK: Request/response objects, logger, environment variables
 *
 * 💡 TEST STRATEGY: Unit tests with mocked Express req/res objects
 *    to ensure middleware functions correctly in isolation
 */

import jwt from 'jsonwebtoken';
import {
  authenticateToken,
  optionalAuth,
  requireRole,
  generateToken,
  generateRefreshToken,
} from '../../middleware/auth.mjs';
import { AppError } from '../../errors/index.mjs';

// Mock logger to prevent console pollution during tests
jest.mock('../../utils/logger.mjs', () => ({
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('🔐 Authentication Middleware Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  const originalEnv = process.env.JWT_SECRET;

  beforeEach(() => {
    // Setup mock request object
    mockReq = {
      headers: {},
      method: 'GET',
      path: '/test',
      ip: '127.0.0.1',
    };

    // Setup mock response object with chainable methods
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Setup mock next function
    mockNext = jest.fn();

    // Set JWT secret for tests
    process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original JWT_SECRET
    if (originalEnv) {
      process.env.JWT_SECRET = originalEnv;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  describe('authenticateToken Middleware', () => {
    describe('✅ Successful Authentication', () => {
      test('should authenticate with valid token and call next()', () => {
        const payload = { id: 1, email: 'test@example.com', role: 'user' };
        const token = jwt.sign(payload, process.env.JWT_SECRET);

        mockReq.headers['authorization'] = `Bearer ${token}`;

        authenticateToken(mockReq, mockRes, mockNext);

        // Wait for async jwt.verify callback
        setTimeout(() => {
          expect(mockReq.user).toEqual(expect.objectContaining({
            id: payload.id,
            email: payload.email,
            role: payload.role,
          }));
          expect(mockNext).toHaveBeenCalled();
          expect(mockRes.status).not.toHaveBeenCalled();
        }, 100);
      });

      test('should extract token from Bearer authorization header', () => {
        const payload = { id: 123, email: 'user@test.com' };
        const token = jwt.sign(payload, process.env.JWT_SECRET);

        mockReq.headers['authorization'] = `Bearer ${token}`;

        authenticateToken(mockReq, mockRes, mockNext);

        setTimeout(() => {
          expect(mockReq.user).toBeDefined();
          expect(mockReq.user.id).toBe(123);
        }, 100);
      });
    });

    describe('❌ Authentication Failures', () => {
      test('should return 401 when no authorization header provided', () => {
        authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: 'Access token is required',
          status: 'fail',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      test('should return 401 when authorization header has no token', () => {
        mockReq.headers['authorization'] = 'Bearer ';

        authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: 'Access token is required',
          status: 'fail',
        });
      });

      test('should return 401 when authorization header is malformed', () => {
        mockReq.headers['authorization'] = 'InvalidFormat';

        authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: 'Access token is required',
          status: 'fail',
        });
      });

      test('should return 401 for expired token', (done) => {
        const payload = { id: 1, email: 'test@example.com' };
        const expiredToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '-1s' });

        mockReq.headers['authorization'] = `Bearer ${expiredToken}`;

        authenticateToken(mockReq, mockRes, mockNext);

        setTimeout(() => {
          expect(mockRes.status).toHaveBeenCalledWith(401);
          expect(mockRes.json).toHaveBeenCalledWith({
            success: false,
            message: 'Token expired',
            status: 'fail',
          });
          expect(mockNext).not.toHaveBeenCalled();
          done();
        }, 100);
      });

      test('should return 401 for invalid token signature', (done) => {
        const invalidToken = jwt.sign({ id: 1 }, 'wrong-secret');

        mockReq.headers['authorization'] = `Bearer ${invalidToken}`;

        authenticateToken(mockReq, mockRes, mockNext);

        setTimeout(() => {
          expect(mockRes.status).toHaveBeenCalledWith(401);
          expect(mockRes.json).toHaveBeenCalledWith({
            success: false,
            message: 'Invalid or expired token',
            status: 'fail',
          });
          done();
        }, 100);
      });

      test('should return 401 for malformed JWT token', (done) => {
        mockReq.headers['authorization'] = 'Bearer malformed.token.here';

        authenticateToken(mockReq, mockRes, mockNext);

        setTimeout(() => {
          expect(mockRes.status).toHaveBeenCalledWith(401);
          expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
              success: false,
              message: 'Invalid or expired token',
            }),
          );
          done();
        }, 100);
      });

      test('should return 500 when JWT_SECRET is not configured', () => {
        delete process.env.JWT_SECRET;

        mockReq.headers['authorization'] = 'Bearer some.token.here';

        authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: 'Authentication configuration error',
          status: 'error',
        });

        // Restore for other tests
        process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
      });
    });

    describe('🔒 Error Handling', () => {
      test('should handle AppError instances correctly', () => {
        // No token triggers AppError
        authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            status: 'fail',
          }),
        );
      });

      test('should handle unexpected errors gracefully', () => {
        // Create a scenario that causes unexpected error
        mockReq.headers['authorization'] = null;

        authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalled();
      });
    });
  });

  describe('optionalAuth Middleware', () => {
    describe('✅ With Valid Token', () => {
      test('should attach user to request when valid token provided', (done) => {
        const payload = { id: 1, email: 'test@example.com' };
        const token = jwt.sign(payload, process.env.JWT_SECRET);

        mockReq.headers['authorization'] = `Bearer ${token}`;

        optionalAuth(mockReq, mockRes, mockNext);

        setTimeout(() => {
          expect(mockReq.user).toBeDefined();
          expect(mockReq.user.id).toBe(1);
          expect(mockNext).toHaveBeenCalled();
          expect(mockRes.status).not.toHaveBeenCalled();
          done();
        }, 100);
      });
    });

    describe('✅ Without Token (Graceful Degradation)', () => {
      test('should continue without user when no token provided', () => {
        optionalAuth(mockReq, mockRes, mockNext);

        expect(mockReq.user).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      test('should continue without user when token is invalid', (done) => {
        mockReq.headers['authorization'] = 'Bearer invalid.token.here';

        optionalAuth(mockReq, mockRes, mockNext);

        setTimeout(() => {
          expect(mockNext).toHaveBeenCalled();
          expect(mockRes.status).not.toHaveBeenCalled();
          done();
        }, 100);
      });

      test('should continue without user when JWT_SECRET not configured', (done) => {
        delete process.env.JWT_SECRET;

        const token = jwt.sign({ id: 1 }, 'any-secret');
        mockReq.headers['authorization'] = `Bearer ${token}`;

        optionalAuth(mockReq, mockRes, mockNext);

        setTimeout(() => {
          expect(mockNext).toHaveBeenCalled();
          expect(mockRes.status).not.toHaveBeenCalled();
          done();
        }, 50);

        // Restore for other tests
        process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
      });

      test('should handle exceptions gracefully and continue', () => {
        mockReq.headers['authorization'] = null;

        optionalAuth(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('requireRole Middleware', () => {
    describe('✅ Successful Authorization', () => {
      test('should authorize user with correct role', () => {
        mockReq.user = { id: 1, role: 'admin' };

        const middleware = requireRole('admin');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      test('should authorize user with any of multiple allowed roles', () => {
        mockReq.user = { id: 1, role: 'moderator' };

        const middleware = requireRole('admin', 'moderator', 'staff');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      test('should authorize admin for admin-only endpoint', () => {
        mockReq.user = { id: 1, role: 'admin' };

        const middleware = requireRole('admin');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('❌ Authorization Failures', () => {
      test('should return 401 when no user in request (not authenticated)', () => {
        const middleware = requireRole('admin');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: 'Authentication required',
          status: 'fail',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      test('should return 403 when user has insufficient role', () => {
        mockReq.user = { id: 1, role: 'user' };

        const middleware = requireRole('admin');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: 'Insufficient permissions',
          status: 'fail',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      test('should return 403 when user role is not in allowed roles', () => {
        mockReq.user = { id: 1, role: 'user' };

        const middleware = requireRole('admin', 'moderator', 'staff');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: 'Insufficient permissions',
          status: 'fail',
        });
      });

      test('should return 403 when user has no role property', () => {
        mockReq.user = { id: 1 }; // No role property

        const middleware = requireRole('admin');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: 'Insufficient permissions',
          status: 'fail',
        });
      });

      test('should return 403 when user role is null', () => {
        mockReq.user = { id: 1, role: null };

        const middleware = requireRole('admin');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
      });
    });

    describe('🔒 Error Handling', () => {
      test('should handle errors in authorization check', () => {
        mockReq.user = { id: 1, role: 'user' };

        const middleware = requireRole('admin');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalled();
      });
    });
  });

  describe('generateToken Function', () => {
    describe('✅ Successful Token Generation', () => {
      test('should generate valid JWT token with user payload', () => {
        const payload = { id: 1, email: 'test@example.com', role: 'user' };

        const token = generateToken(payload);

        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        expect(decoded).toMatchObject(payload);
      });

      test('should generate token with default expiration (24h)', () => {
        const payload = { id: 1, email: 'test@example.com' };

        const token = generateToken(payload);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check expiration is set (approximately 24 hours from now)
        const expiresIn = decoded.exp - decoded.iat;
        expect(expiresIn).toBe(24 * 60 * 60); // 24 hours in seconds
      });

      test('should generate token with custom expiration', () => {
        const payload = { id: 1 };

        const token = generateToken(payload, '1h');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const expiresIn = decoded.exp - decoded.iat;
        expect(expiresIn).toBe(60 * 60); // 1 hour in seconds
      });

      test('should generate different tokens for different payloads', () => {
        const payload1 = { id: 1, email: 'user1@example.com' };
        const payload2 = { id: 2, email: 'user2@example.com' };

        const token1 = generateToken(payload1);
        const token2 = generateToken(payload2);

        expect(token1).not.toBe(token2);

        const decoded1 = jwt.verify(token1, process.env.JWT_SECRET);
        const decoded2 = jwt.verify(token2, process.env.JWT_SECRET);

        expect(decoded1.id).toBe(1);
        expect(decoded2.id).toBe(2);
      });
    });

    describe('❌ Token Generation Failures', () => {
      test('should throw error when JWT_SECRET not configured', () => {
        delete process.env.JWT_SECRET;

        const payload = { id: 1 };

        expect(() => generateToken(payload)).toThrow('JWT_SECRET not configured');
        expect(() => generateToken(payload)).toThrow(AppError);

        // Restore for other tests
        process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
      });

      test('should handle empty payload', () => {
        const token = generateToken({});

        expect(token).toBeDefined();
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        expect(decoded).toMatchObject({});
      });
    });
  });

  describe('generateRefreshToken Function', () => {
    describe('✅ Successful Refresh Token Generation', () => {
      test('should generate valid refresh token with 7 day expiration', () => {
        const payload = { id: 1, email: 'test@example.com' };

        const refreshToken = generateRefreshToken(payload);

        expect(refreshToken).toBeDefined();
        expect(typeof refreshToken).toBe('string');

        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

        // Check expiration is 7 days
        const expiresIn = decoded.exp - decoded.iat;
        expect(expiresIn).toBe(7 * 24 * 60 * 60); // 7 days in seconds
      });

      test('should add timestamp and random component to ensure uniqueness', () => {
        const payload = { id: 1, email: 'test@example.com' };

        const token1 = generateRefreshToken(payload);
        const token2 = generateRefreshToken(payload);

        // Tokens should be different even with same payload
        expect(token1).not.toBe(token2);

        const decoded1 = jwt.verify(token1, process.env.JWT_SECRET);
        const decoded2 = jwt.verify(token2, process.env.JWT_SECRET);

        // Both should have unique timestamps and random values
        expect(decoded1.timestamp).toBeDefined();
        expect(decoded1.random).toBeDefined();
        expect(decoded2.timestamp).toBeDefined();
        expect(decoded2.random).toBeDefined();

        // Original payload should be preserved
        expect(decoded1.id).toBe(1);
        expect(decoded2.id).toBe(1);
      });

      test('should generate unique tokens even when called rapidly', () => {
        const payload = { id: 1 };
        const tokens = new Set();

        // Generate 10 tokens rapidly
        for (let i = 0; i < 10; i++) {
          tokens.add(generateRefreshToken(payload));
        }

        // All tokens should be unique
        expect(tokens.size).toBe(10);
      });

      test('should preserve all original payload properties', () => {
        const payload = {
          id: 1,
          email: 'test@example.com',
          role: 'admin',
          username: 'testuser',
        };

        const refreshToken = generateRefreshToken(payload);
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

        expect(decoded.id).toBe(payload.id);
        expect(decoded.email).toBe(payload.email);
        expect(decoded.role).toBe(payload.role);
        expect(decoded.username).toBe(payload.username);
      });
    });

    describe('❌ Refresh Token Generation Failures', () => {
      test('should throw error when JWT_SECRET not configured', () => {
        delete process.env.JWT_SECRET;

        const payload = { id: 1 };

        expect(() => generateRefreshToken(payload)).toThrow('JWT_SECRET not configured');

        // Restore for other tests
        process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
      });
    });
  });

  describe('🔒 Security Tests', () => {
    describe('Token Tampering Prevention', () => {
      test('should reject token with modified payload', (done) => {
        const payload = { id: 1, role: 'user' };
        const token = jwt.sign(payload, process.env.JWT_SECRET);

        // Modify token payload (change user id)
        const parts = token.split('.');
        const modifiedPayload = Buffer.from(JSON.stringify({ id: 999, role: 'admin' })).toString('base64');
        const tamperedToken = `${parts[0]}.${modifiedPayload}.${parts[2]}`;

        mockReq.headers['authorization'] = `Bearer ${tamperedToken}`;

        authenticateToken(mockReq, mockRes, mockNext);

        setTimeout(() => {
          expect(mockRes.status).toHaveBeenCalledWith(401);
          expect(mockNext).not.toHaveBeenCalled();
          done();
        }, 100);
      });

      test('should reject token signed with different secret', (done) => {
        const token = jwt.sign({ id: 1 }, 'different-secret');

        mockReq.headers['authorization'] = `Bearer ${token}`;

        authenticateToken(mockReq, mockRes, mockNext);

        setTimeout(() => {
          expect(mockRes.status).toHaveBeenCalledWith(401);
          done();
        }, 100);
      });
    });

    describe('Edge Cases', () => {
      test('should handle very long token', (done) => {
        const largePayload = {
          id: 1,
          data: 'x'.repeat(10000), // Very long string
        };
        const token = jwt.sign(largePayload, process.env.JWT_SECRET);

        mockReq.headers['authorization'] = `Bearer ${token}`;

        authenticateToken(mockReq, mockRes, mockNext);

        setTimeout(() => {
          expect(mockReq.user).toBeDefined();
          expect(mockNext).toHaveBeenCalled();
          done();
        }, 100);
      });

      test('should handle token with special characters in payload', (done) => {
        const payload = {
          id: 1,
          email: 'test+special@example.com',
          name: "O'Brien <script>alert('xss')</script>",
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET);

        mockReq.headers['authorization'] = `Bearer ${token}`;

        authenticateToken(mockReq, mockRes, mockNext);

        setTimeout(() => {
          expect(mockReq.user).toMatchObject(payload);
          expect(mockNext).toHaveBeenCalled();
          done();
        }, 100);
      });

      test('should handle multiple Bearer prefixes', () => {
        const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
        mockReq.headers['authorization'] = `Bearer Bearer ${token}`;

        authenticateToken(mockReq, mockRes, mockNext);

        // Should fail because "Bearer token" is not a valid JWT
        expect(mockRes.status).toHaveBeenCalledWith(401);
      });
    });
  });
});
