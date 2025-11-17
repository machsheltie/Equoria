/**
 * 🧪 COMPREHENSIVE TEST: Authentication Controller
 *
 * Tests all authentication controller functions including registration, login,
 * token refresh, profile management, and logout with focus on error paths and edge cases.
 *
 * 📋 COVERAGE SCOPE:
 * - register: User registration with validation and error handling
 * - login: User authentication with credential validation
 * - refreshToken: Token refresh mechanism and expiration
 * - getProfile: User profile retrieval and authentication
 * - updateProfile: Profile updates with conflict detection
 * - logout: Session termination and token cleanup
 *
 * 🎯 TEST CATEGORIES:
 * 1. Registration - Success, validation errors, duplicate users
 * 2. Login - Success, invalid credentials, missing fields
 * 3. Token Refresh - Valid refresh, invalid/expired tokens
 * 4. Profile Retrieval - Authenticated access, missing user
 * 5. Profile Update - Field updates, conflicts, validation
 * 6. Logout - Token cleanup, error handling
 * 7. Error Paths - Database errors, validation failures
 * 8. Edge Cases - Boundary conditions, race conditions
 *
 * 🔄 TESTING APPROACH:
 * ✅ REAL: Controller logic, error handling, validation
 * 🔧 MOCK: Prisma database, bcrypt, JWT functions, logger
 *
 * 💡 TEST STRATEGY: Unit tests with comprehensive error path coverage
 *    to ensure all edge cases and failure scenarios are handled correctly
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  register,
  login,
  refreshToken,
  getProfile,
  updateProfile,
  logout,
} from '../../controllers/authController.mjs';
import { AppError, ValidationError } from '../../errors/index.mjs';
import prisma from '../../db/index.mjs';

// Mock dependencies
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../db/index.mjs', () => ({
  default: {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));
jest.mock('../../utils/logger.mjs', () => ({
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));
jest.mock('../../middleware/auth.mjs', () => ({
  generateToken: jest.fn(() => 'mock-access-token'),
  generateRefreshToken: jest.fn(() => 'mock-refresh-token'),
}));

describe('🔐 Authentication Controller Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Setup mock request
    mockReq = {
      body: {},
      user: null,
    };

    // Setup mock response
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Setup mock next
    mockNext = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();

    // Setup JWT secret
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('register Controller', () => {
    describe('✅ Successful Registration', () => {
      test('should register new user with all required fields', async () => {
        mockReq.body = {
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
        };

        prisma.user.findFirst.mockResolvedValue(null); // No existing user
        bcrypt.hash.mockResolvedValue('hashed-password');
        prisma.user.create.mockResolvedValue({
          id: 1,
          username: 'newuser',
          email: 'newuser@example.com',
          firstName: 'John',
          lastName: 'Doe',
          money: 1000,
          level: 1,
          xp: 0,
        });
        prisma.refreshToken.create.mockResolvedValue({});

        await register(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(mockRes.json).toHaveBeenCalledWith({
          status: 'success',
          message: 'User registered successfully',
          data: expect.objectContaining({
            user: expect.objectContaining({
              id: 1,
              username: 'newuser',
              email: 'newuser@example.com',
            }),
            token: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
          }),
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      test('should register user with default values when optional fields missing', async () => {
        mockReq.body = {
          username: 'basicuser',
          email: 'basic@example.com',
          password: 'password123',
        };

        prisma.user.findFirst.mockResolvedValue(null);
        bcrypt.hash.mockResolvedValue('hashed-password');
        prisma.user.create.mockResolvedValue({
          id: 2,
          username: 'basicuser',
          email: 'basic@example.com',
          firstName: null,
          lastName: null,
          money: 1000,
          level: 1,
          xp: 0,
        });
        prisma.refreshToken.create.mockResolvedValue({});

        await register(mockReq, mockRes, mockNext);

        expect(prisma.user.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            money: 1000,
            level: 1,
            xp: 0,
            firstName: null,
            lastName: null,
          }),
        });
        expect(mockRes.status).toHaveBeenCalledWith(201);
      });

      test('should create refresh token with 7 day expiration', async () => {
        mockReq.body = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        };

        prisma.user.findFirst.mockResolvedValue(null);
        bcrypt.hash.mockResolvedValue('hashed-password');
        prisma.user.create.mockResolvedValue({
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        });
        prisma.refreshToken.create.mockResolvedValue({});

        await register(mockReq, mockRes, mockNext);

        expect(prisma.refreshToken.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            token: 'mock-refresh-token',
            userId: 1,
            expiresAt: expect.any(Date),
          }),
        });

        const createCall = prisma.refreshToken.create.mock.calls[0][0];
        const expiresAt = createCall.data.expiresAt;
        const expectedExpiration = 7 * 24 * 60 * 60 * 1000; // 7 days
        const timeDiff = Math.abs(expiresAt - new Date() - expectedExpiration);
        expect(timeDiff).toBeLessThan(1000); // Within 1 second
      });
    });

    describe('❌ Validation Errors', () => {
      test('should return validation error when username missing', async () => {
        mockReq.body = {
          email: 'test@example.com',
          password: 'password123',
        };

        await register(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
        expect(mockNext.mock.calls[0][0].message).toBe('Username, email, and password are required');
      });

      test('should return validation error when email missing', async () => {
        mockReq.body = {
          username: 'testuser',
          password: 'password123',
        };

        await register(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      });

      test('should return validation error when password missing', async () => {
        mockReq.body = {
          username: 'testuser',
          email: 'test@example.com',
        };

        await register(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      });

      test('should return validation error when all required fields missing', async () => {
        mockReq.body = {};

        await register(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      });
    });

    describe('❌ Duplicate User Errors', () => {
      test('should return error when email already exists', async () => {
        mockReq.body = {
          username: 'newuser',
          email: 'existing@example.com',
          password: 'password123',
        };

        prisma.user.findFirst.mockResolvedValue({
          id: 1,
          email: 'existing@example.com',
        });

        await register(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('User with this email or username already exists');
        expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
      });

      test('should return error when username already exists', async () => {
        mockReq.body = {
          username: 'existinguser',
          email: 'new@example.com',
          password: 'password123',
        };

        prisma.user.findFirst.mockResolvedValue({
          id: 1,
          username: 'existinguser',
        });

        await register(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('User with this email or username already exists');
      });
    });

    describe('❌ Database Errors', () => {
      test('should handle database error during user lookup', async () => {
        mockReq.body = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        };

        prisma.user.findFirst.mockRejectedValue(new Error('Database connection error'));

        await register(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });

      test('should handle database error during user creation', async () => {
        mockReq.body = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        };

        prisma.user.findFirst.mockResolvedValue(null);
        bcrypt.hash.mockResolvedValue('hashed-password');
        prisma.user.create.mockRejectedValue(new Error('User creation failed'));

        await register(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });

  describe('login Controller', () => {
    describe('✅ Successful Login', () => {
      test('should login user with valid credentials', async () => {
        mockReq.body = {
          email: 'user@example.com',
          password: 'password123',
        };

        const mockUser = {
          id: 1,
          username: 'testuser',
          email: 'user@example.com',
          password: 'hashed-password',
        };

        prisma.user.findUnique.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        prisma.refreshToken.create.mockResolvedValue({});

        await login(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
          status: 'success',
          message: 'Login successful',
          data: {
            user: {
              id: 1,
              username: 'testuser',
              email: 'user@example.com',
            },
            token: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
          },
        });
      });

      test('should create new refresh token on login', async () => {
        mockReq.body = {
          email: 'user@example.com',
          password: 'password123',
        };

        prisma.user.findUnique.mockResolvedValue({
          id: 1,
          email: 'user@example.com',
          password: 'hashed-password',
        });
        bcrypt.compare.mockResolvedValue(true);
        prisma.refreshToken.create.mockResolvedValue({});

        await login(mockReq, mockRes, mockNext);

        expect(prisma.refreshToken.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            token: 'mock-refresh-token',
            userId: 1,
            expiresAt: expect.any(Date),
          }),
        });
      });
    });

    describe('❌ Invalid Credentials', () => {
      test('should return error when email not found', async () => {
        mockReq.body = {
          email: 'nonexistent@example.com',
          password: 'password123',
        };

        prisma.user.findUnique.mockResolvedValue(null);

        await login(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('Invalid email or password');
        expect(mockNext.mock.calls[0][0].statusCode).toBe(401);
      });

      test('should return error when password is incorrect', async () => {
        mockReq.body = {
          email: 'user@example.com',
          password: 'wrongpassword',
        };

        prisma.user.findUnique.mockResolvedValue({
          id: 1,
          email: 'user@example.com',
          password: 'hashed-password',
        });
        bcrypt.compare.mockResolvedValue(false);

        await login(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('Invalid email or password');
      });
    });

    describe('❌ Validation Errors', () => {
      test('should return validation error when email missing', async () => {
        mockReq.body = {
          password: 'password123',
        };

        await login(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
        expect(mockNext.mock.calls[0][0].message).toBe('Email and password are required');
      });

      test('should return validation error when password missing', async () => {
        mockReq.body = {
          email: 'user@example.com',
        };

        await login(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      });

      test('should return validation error when both fields missing', async () => {
        mockReq.body = {};

        await login(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      });
    });

    describe('❌ Database Errors', () => {
      test('should handle database error during user lookup', async () => {
        mockReq.body = {
          email: 'user@example.com',
          password: 'password123',
        };

        prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

        await login(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('Login failed due to an unexpected error.');
      });

      test('should handle bcrypt comparison error', async () => {
        mockReq.body = {
          email: 'user@example.com',
          password: 'password123',
        };

        prisma.user.findUnique.mockResolvedValue({
          id: 1,
          password: 'hashed-password',
        });
        bcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

        await login(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      });
    });
  });

  describe('refreshToken Controller', () => {
    describe('✅ Successful Token Refresh', () => {
      test('should refresh access token with valid refresh token', async () => {
        mockReq.body = {
          refreshToken: 'valid-refresh-token',
        };

        const mockStoredToken = {
          token: 'valid-refresh-token',
          userId: 1,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          user: {
            id: 1,
            email: 'user@example.com',
            username: 'testuser',
          },
        };

        prisma.refreshToken.findFirst.mockResolvedValue(mockStoredToken);
        jwt.verify.mockReturnValue({ id: 1 });

        await refreshToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
          status: 'success',
          message: 'Token refreshed successfully',
          data: {
            token: 'mock-access-token',
          },
        });
      });
    });

    describe('❌ Invalid Refresh Token', () => {
      test('should return error when refresh token missing', async () => {
        mockReq.body = {};

        await refreshToken(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('Refresh token is required');
        expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
      });

      test('should return error when refresh token not found in database', async () => {
        mockReq.body = {
          refreshToken: 'invalid-token',
        };

        prisma.refreshToken.findFirst.mockResolvedValue(null);

        await refreshToken(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('Invalid or expired refresh token');
        expect(mockNext.mock.calls[0][0].statusCode).toBe(401);
      });

      test('should return error when JWT verification fails', async () => {
        mockReq.body = {
          refreshToken: 'expired-token',
        };

        prisma.refreshToken.findFirst.mockResolvedValue({
          token: 'expired-token',
          user: { id: 1 },
        });
        jwt.verify.mockImplementation(() => {
          throw new Error('jwt expired');
        });

        await refreshToken(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('Invalid or expired refresh token');
      });
    });

    describe('❌ Database Errors', () => {
      test('should handle database error during token lookup', async () => {
        mockReq.body = {
          refreshToken: 'some-token',
        };

        prisma.refreshToken.findFirst.mockRejectedValue(new Error('Database error'));

        await refreshToken(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('Token refresh failed due to an unexpected error.');
      });
    });
  });

  describe('getProfile Controller', () => {
    describe('✅ Successful Profile Retrieval', () => {
      test('should return user profile for authenticated user', async () => {
        mockReq.user = { id: 1, email: 'user@example.com' };

        const mockUser = {
          id: 1,
          username: 'testuser',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        prisma.user.findUnique.mockResolvedValue(mockUser);

        await getProfile(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
          status: 'success',
          data: { user: mockUser },
        });
      });
    });

    describe('❌ Authentication Errors', () => {
      test('should return error when user not authenticated', async () => {
        mockReq.user = null;

        await getProfile(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('Authentication error, user not found in request');
        expect(mockNext.mock.calls[0][0].statusCode).toBe(401);
      });

      test('should return error when user id missing from request', async () => {
        mockReq.user = { email: 'user@example.com' }; // No id

        await getProfile(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('Authentication error, user not found in request');
      });

      test('should return error when user not found in database', async () => {
        mockReq.user = { id: 999 };

        prisma.user.findUnique.mockResolvedValue(null);

        await getProfile(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('User not found');
        expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
      });
    });

    describe('❌ Database Errors', () => {
      test('should handle database error during user lookup', async () => {
        mockReq.user = { id: 1 };

        prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

        await getProfile(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('Failed to retrieve profile due to an unexpected error.');
      });
    });
  });

  describe('updateProfile Controller', () => {
    describe('✅ Successful Profile Update', () => {
      test('should update username successfully', async () => {
        mockReq.user = { id: 1 };
        mockReq.body = { username: 'newusername' };

        prisma.user.findFirst.mockResolvedValue(null); // No conflicts
        prisma.user.update.mockResolvedValue({
          id: 1,
          username: 'newusername',
          email: 'user@example.com',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await updateProfile(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
          status: 'success',
          data: {
            user: expect.objectContaining({
              username: 'newusername',
            }),
          },
        });
      });

      test('should update email successfully', async () => {
        mockReq.user = { id: 1 };
        mockReq.body = { email: 'newemail@example.com' };

        prisma.user.findFirst.mockResolvedValue(null);
        prisma.user.update.mockResolvedValue({
          id: 1,
          username: 'testuser',
          email: 'newemail@example.com',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await updateProfile(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
          status: 'success',
          data: {
            user: expect.objectContaining({
              email: 'newemail@example.com',
            }),
          },
        });
      });

      test('should update both username and email', async () => {
        mockReq.user = { id: 1 };
        mockReq.body = {
          username: 'newusername',
          email: 'newemail@example.com',
        };

        prisma.user.findFirst.mockResolvedValue(null);
        prisma.user.update.mockResolvedValue({
          id: 1,
          username: 'newusername',
          email: 'newemail@example.com',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await updateProfile(mockReq, mockRes, mockNext);

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 1 },
          data: {
            username: 'newusername',
            email: 'newemail@example.com',
          },
          select: expect.any(Object),
        });
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });
    });

    describe('❌ Validation Errors', () => {
      test('should return error when no fields provided', async () => {
        mockReq.user = { id: 1 };
        mockReq.body = {};

        await updateProfile(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
        expect(mockNext.mock.calls[0][0].message).toBe('At least one field is required');
      });
    });

    describe('❌ Conflict Errors', () => {
      test('should return error when username already taken by another user', async () => {
        mockReq.user = { id: 1 };
        mockReq.body = { username: 'existingusername' };

        prisma.user.findFirst.mockResolvedValue({
          id: 2, // Different user
          username: 'existingusername',
        });

        await updateProfile(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('Username or email already in use');
        expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
      });

      test('should return error when email already taken by another user', async () => {
        mockReq.user = { id: 1 };
        mockReq.body = { email: 'existing@example.com' };

        prisma.user.findFirst.mockResolvedValue({
          id: 2,
          email: 'existing@example.com',
        });

        await updateProfile(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('Username or email already in use');
      });

      test('should allow user to update their own username/email to same value', async () => {
        mockReq.user = { id: 1 };
        mockReq.body = { username: 'sameusername' };

        // findFirst should exclude current user, so returns null
        prisma.user.findFirst.mockResolvedValue(null);
        prisma.user.update.mockResolvedValue({
          id: 1,
          username: 'sameusername',
        });

        await updateProfile(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(200);
      });
    });

    describe('❌ Database Errors', () => {
      test('should handle database error during conflict check', async () => {
        mockReq.user = { id: 1 };
        mockReq.body = { username: 'newusername' };

        prisma.user.findFirst.mockRejectedValue(new Error('Database error'));

        await updateProfile(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });

      test('should handle database error during update', async () => {
        mockReq.user = { id: 1 };
        mockReq.body = { username: 'newusername' };

        prisma.user.findFirst.mockResolvedValue(null);
        prisma.user.update.mockRejectedValue(new Error('Update failed'));

        await updateProfile(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });

  describe('logout Controller', () => {
    describe('✅ Successful Logout', () => {
      test('should logout user and delete all refresh tokens', async () => {
        mockReq.user = { id: 1 };

        prisma.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

        await logout(mockReq, mockRes, mockNext);

        expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
          where: { userId: 1 },
        });
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
          status: 'success',
          message: 'Logout successful',
        });
      });

      test('should handle logout when no refresh tokens exist', async () => {
        mockReq.user = { id: 1 };

        prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

        await logout(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
          status: 'success',
          message: 'Logout successful',
        });
      });

      test('should handle logout when user not authenticated', async () => {
        mockReq.user = null;

        await logout(mockReq, mockRes, mockNext);

        expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });
    });

    describe('❌ Database Errors', () => {
      test('should handle database error during token deletion', async () => {
        mockReq.user = { id: 1 };

        prisma.refreshToken.deleteMany.mockRejectedValue(new Error('Database error'));

        await logout(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('Logout failed due to an unexpected error.');
        expect(mockNext.mock.calls[0][0].statusCode).toBe(500);
      });
    });
  });

  describe('🔒 Edge Cases and Security', () => {
    describe('Password Security', () => {
      test('should hash password before storing during registration', async () => {
        mockReq.body = {
          username: 'secureuser',
          email: 'secure@example.com',
          password: 'plaintextpassword',
        };

        prisma.user.findFirst.mockResolvedValue(null);
        bcrypt.hash.mockResolvedValue('$2a$10$hashedpassword');
        prisma.user.create.mockResolvedValue({ id: 1 });
        prisma.refreshToken.create.mockResolvedValue({});

        await register(mockReq, mockRes, mockNext);

        expect(bcrypt.hash).toHaveBeenCalledWith('plaintextpassword', 10);
        expect(prisma.user.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            password: '$2a$10$hashedpassword',
          }),
        });
      });

      test('should use bcrypt compare for password verification', async () => {
        mockReq.body = {
          email: 'user@example.com',
          password: 'testpassword',
        };

        prisma.user.findUnique.mockResolvedValue({
          id: 1,
          password: 'hashed-password',
        });
        bcrypt.compare.mockResolvedValue(true);
        prisma.refreshToken.create.mockResolvedValue({});

        await login(mockReq, mockRes, mockNext);

        expect(bcrypt.compare).toHaveBeenCalledWith('testpassword', 'hashed-password');
      });
    });

    describe('SQL Injection Prevention', () => {
      test('should handle email with SQL injection attempt safely', async () => {
        mockReq.body = {
          email: "admin'--",
          password: 'password123',
        };

        prisma.user.findUnique.mockResolvedValue(null);

        await login(mockReq, mockRes, mockNext);

        // Prisma handles SQL injection, should just return invalid credentials
        expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
        expect(mockNext.mock.calls[0][0].message).toBe('Invalid email or password');
      });
    });

    describe('Race Conditions', () => {
      test('should handle concurrent registration attempts with same email', async () => {
        mockReq.body = {
          username: 'raceuser',
          email: 'race@example.com',
          password: 'password123',
        };

        // First check passes, but another user registers before creation
        prisma.user.findFirst.mockResolvedValueOnce(null);
        bcrypt.hash.mockResolvedValue('hashed-password');
        prisma.user.create.mockRejectedValue({
          code: 'P2002', // Prisma unique constraint violation
          message: 'Unique constraint failed',
        });

        await register(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });
  });
});
