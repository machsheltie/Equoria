/**
 * 🧪 INTEGRATION TEST: Authentication Middleware
 *
 * Integration tests for authentication middleware using real JWT tokens
 * and actual middleware execution to ensure security measures work correctly.
 *
 * 📋 TEST SCOPE:
 * - authenticateToken: JWT verification with real tokens
 * - optionalAuth: Optional authentication behavior
 * - requireRole: Role-based authorization
 * - generateToken: Token generation and validation
 * - generateRefreshToken: Refresh token uniqueness
 *
 * 🔄 TESTING APPROACH:
 * ✅ REAL: All middleware functions, JWT operations
 * 🔧 MOCK: None - full integration with real JWT library
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import {
  authenticateToken,
  optionalAuth,
  requireRole,
  generateToken,
  generateRefreshToken,
} from '../../middleware/auth.mjs';

describe('🔐 Authentication Middleware Integration Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    // Set up test environment
    process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

    mockReq = {
      headers: {},
      method: 'GET',
      path: '/test',
      ip: '127.0.0.1',
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    if (originalJwtSecret) {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  describe('authenticateToken Middleware', () => {
    it('should authenticate with valid JWT token', (done) => {
      const user = { id: 1, email: 'test@example.com', role: 'user' };
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });

      mockReq.headers['authorization'] = `Bearer ${token}`;

      authenticateToken(mockReq, mockRes, mockNext);

      setTimeout(() => {
        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.user).toBeDefined();
        expect(mockReq.user.id).toBe(1);
        expect(mockReq.user.email).toBe('test@example.com');
        done();
      }, 100);
    });

    it('should reject missing token', () => {
      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Access token is required',
        }),
      );
    });

    it('should reject expired token', (done) => {
      const user = { id: 1, email: 'test@example.com' };
      const expiredToken = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '-1s' });

      mockReq.headers['authorization'] = `Bearer ${expiredToken}`;

      authenticateToken(mockReq, mockRes, mockNext);

      setTimeout(() => {
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Token expired',
          }),
        );
        done();
      }, 100);
    });

    it('should reject invalid token', (done) => {
      mockReq.headers['authorization'] = 'Bearer invalid.token.here';

      authenticateToken(mockReq, mockRes, mockNext);

      setTimeout(() => {
        expect(mockRes.status).toHaveBeenCalledWith(401);
        done();
      }, 100);
    });
  });

  describe('optionalAuth Middleware', () => {
    it('should attach user when valid token provided', (done) => {
      const user = { id: 1, email: 'test@example.com' };
      const token = jwt.sign(user, process.env.JWT_SECRET);

      mockReq.headers['authorization'] = `Bearer ${token}`;

      optionalAuth(mockReq, mockRes, mockNext);

      setTimeout(() => {
        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.user).toBeDefined();
        expect(mockReq.user.id).toBe(1);
        done();
      }, 100);
    });

    it('should continue without user when no token', () => {
      optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should continue without user on invalid token', (done) => {
      mockReq.headers['authorization'] = 'Bearer invalid.token';

      optionalAuth(mockReq, mockRes, mockNext);

      setTimeout(() => {
        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.user).toBeUndefined();
        done();
      }, 100);
    });
  });

  describe('requireRole Middleware', () => {
    it('should allow user with correct role', () => {
      mockReq.user = { id: 1, role: 'admin' };

      const middleware = requireRole('admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject user without required role', () => {
      mockReq.user = { id: 1, role: 'user' };

      const middleware = requireRole('admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Insufficient permissions',
        }),
      );
    });

    it('should reject unauthenticated request', () => {
      mockReq.user = null;

      const middleware = requireRole('admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should allow user with any of multiple allowed roles', () => {
      mockReq.user = { id: 1, role: 'moderator' };

      const middleware = requireRole('admin', 'moderator', 'staff');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('generateToken Function', () => {
    it('should generate valid JWT token', () => {
      const payload = { id: 1, email: 'test@example.com' };

      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.id).toBe(1);
      expect(decoded.email).toBe('test@example.com');
    });

    it('should generate token with default 24h expiration', () => {
      const payload = { id: 1 };

      const token = generateToken(payload);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBe(24 * 60 * 60); // 24 hours
    });

    it('should generate token with custom expiration', () => {
      const payload = { id: 1 };

      const token = generateToken(payload, '1h');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBe(60 * 60); // 1 hour
    });
  });

  describe('generateRefreshToken Function', () => {
    it('should generate unique refresh tokens', () => {
      const payload = { id: 1, email: 'test@example.com' };

      const token1 = generateRefreshToken(payload);
      const token2 = generateRefreshToken(payload);

      expect(token1).not.toBe(token2);

      const decoded1 = jwt.verify(token1, process.env.JWT_SECRET);
      const decoded2 = jwt.verify(token2, process.env.JWT_SECRET);

      expect(decoded1.timestamp).toBeDefined();
      expect(decoded1.random).toBeDefined();
      expect(decoded2.timestamp).toBeDefined();
      expect(decoded2.random).toBeDefined();
    });

    it('should have 7 day expiration', () => {
      const payload = { id: 1 };

      const token = generateRefreshToken(payload);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBe(7 * 24 * 60 * 60); // 7 days
    });

    it('should preserve original payload properties', () => {
      const payload = {
        id: 1,
        email: 'test@example.com',
        role: 'admin',
        username: 'testuser',
      };

      const token = generateRefreshToken(payload);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.username).toBe(payload.username);
    });
  });

  describe('Security Tests', () => {
    it('should reject tampered token', (done) => {
      const payload = { id: 1, role: 'user' };
      const token = jwt.sign(payload, process.env.JWT_SECRET);

      // Tamper with token
      const parts = token.split('.');
      const tamperedPayload = Buffer.from(JSON.stringify({ id: 999, role: 'admin' })).toString('base64');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      mockReq.headers['authorization'] = `Bearer ${tamperedToken}`;

      authenticateToken(mockReq, mockRes, mockNext);

      setTimeout(() => {
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockNext).not.toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should reject token signed with different secret', (done) => {
      const token = jwt.sign({ id: 1 }, 'different-secret');

      mockReq.headers['authorization'] = `Bearer ${token}`;

      authenticateToken(mockReq, mockRes, mockNext);

      setTimeout(() => {
        expect(mockRes.status).toHaveBeenCalledWith(401);
        done();
      }, 100);
    });
  });
});
