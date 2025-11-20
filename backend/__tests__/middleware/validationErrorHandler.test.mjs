/**
 * Validation Error Handler Tests
 * Tests for XSS prevention and parameter pollution protection
 *
 * SECURITY: CWE-79 (XSS), CWE-20 (Improper Input Validation)
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { mockRequest, mockResponse, mockNext } from '../setup.mjs';

// Create mock functions for express-validator
const mockValidationResult = jest.fn();
const mockMatchedData = jest.fn();

// Mock the express-validator module
jest.unstable_mockModule('express-validator', () => ({
  validationResult: mockValidationResult,
  matchedData: mockMatchedData,
}));

// Import after mocking
const { handleValidationErrors, sanitizeRequestData } = await import(
  '../../middleware/validationErrorHandler.mjs'
);

describe('Validation Error Handler', () => {
  describe('handleValidationErrors()', () => {
    let req, res, next;

    beforeEach(() => {
      req = mockRequest();
      res = mockResponse();
      next = mockNext();
    });

    it('should call next() when no validation errors', () => {
      mockValidationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });

      handleValidationErrors(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 when validation errors exist', () => {
      mockValidationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          { msg: 'Email is required', path: 'email' },
          { msg: 'Password must be at least 8 characters', path: 'password' },
        ],
      });

      handleValidationErrors(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email is required', // First error message
        errors: [
          { msg: 'Email is required', path: 'email' },
          { msg: 'Password must be at least 8 characters', path: 'password' },
        ],
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle single validation error', () => {
      mockValidationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: 'Invalid email format', path: 'email' }],
      });

      handleValidationErrors(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid email format', // First error message
        errors: [{ msg: 'Invalid email format', path: 'email' }],
      });
    });

    it('should handle nested field validation errors', () => {
      mockValidationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: 'Invalid address', path: 'user.address.street' }],
      });

      handleValidationErrors(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid address', // First error message
        errors: [{ msg: 'Invalid address', path: 'user.address.street' }],
      });
    });
  });

  describe('sanitizeRequestData() - XSS Prevention', () => {
    let req, res, next;

    beforeEach(() => {
      req = mockRequest();
      res = mockResponse();
      next = mockNext();
    });

    describe('No validation errors', () => {
      beforeEach(() => {
        mockValidationResult.mockReturnValue({
          isEmpty: () => true,
        });
      });

      it('should sanitize body data and remove extra fields', () => {
        req.body = {
          email: 'test@example.com',
          password: 'password123',
          maliciousField: '<script>alert("XSS")</script>',
        };

        mockMatchedData.mockReturnValue({
          email: 'test@example.com',
          password: 'password123',
          // maliciousField is NOT in validated data
        });

        sanitizeRequestData(req, res, next);

        expect(req.body).toEqual({
          email: 'test@example.com',
          password: 'password123',
        });
        expect(req.body.maliciousField).toBeUndefined();
        expect(next).toHaveBeenCalled();
      });

      it('should sanitize query parameters', () => {
        req.query = {
          search: 'thoroughbred',
          page: '1',
          invalidParam: '<img src=x onerror=alert(1)>',
        };

        mockMatchedData.mockReturnValue({
          search: 'thoroughbred',
          page: '1',
        });

        sanitizeRequestData(req, res, next);

        expect(req.query).toEqual({
          search: 'thoroughbred',
          page: '1',
        });
        expect(req.query.invalidParam).toBeUndefined();
      });

      it('should sanitize route parameters', () => {
        req.params = {
          id: '123',
          malicious: '"><script>alert(1)</script>',
        };

        mockMatchedData.mockReturnValue({
          id: '123',
        });

        sanitizeRequestData(req, res, next);

        expect(req.params).toEqual({
          id: '123',
        });
        expect(req.params.malicious).toBeUndefined();
      });

      it('should handle multiple request sources simultaneously', () => {
        req.body = {
          email: 'test@example.com',
          extraBody: 'should be removed',
        };
        req.query = {
          page: '1',
          extraQuery: '<script>',
        };
        req.params = {
          id: '456',
          extraParam: 'remove me',
        };

        mockMatchedData.mockReturnValue({
          email: 'test@example.com',
          page: '1',
          id: '456',
        });

        sanitizeRequestData(req, res, next);

        expect(req.body).toEqual({ email: 'test@example.com' });
        expect(req.query).toEqual({ page: '1' });
        expect(req.params).toEqual({ id: '456' });
      });

      it('should preserve validated data with special characters', () => {
        req.body = {
          firstName: "O'Brien", // Valid apostrophe
          bio: 'Loves horses & riding', // Valid ampersand
        };

        mockMatchedData.mockReturnValue({
          firstName: "O'Brien",
          bio: 'Loves horses & riding',
        });

        sanitizeRequestData(req, res, next);

        expect(req.body).toEqual({
          firstName: "O'Brien",
          bio: 'Loves horses & riding',
        });
      });

      it('should handle empty validated data', () => {
        req.body = {
          malicious1: '<script>alert(1)</script>',
          malicious2: 'DROP TABLE users;',
        };

        mockMatchedData.mockReturnValue({});

        sanitizeRequestData(req, res, next);

        // Should not replace body if no validated fields match
        expect(req.body).toEqual({
          malicious1: '<script>alert(1)</script>',
          malicious2: 'DROP TABLE users;',
        });
        expect(next).toHaveBeenCalled();
      });

      it('should handle optional fields', () => {
        req.body = {
          email: 'test@example.com',
          middleName: undefined, // Optional field
        };

        mockMatchedData.mockReturnValue({
          email: 'test@example.com',
          middleName: undefined,
        });

        sanitizeRequestData(req, res, next);

        expect(req.body).toEqual({
          email: 'test@example.com',
          middleName: undefined,
        });
      });
    });

    describe('With validation errors', () => {
      beforeEach(() => {
        mockValidationResult.mockReturnValue({
          isEmpty: () => false,
        });
      });

      it('should NOT modify request data when validation failed', () => {
        req.body = {
          email: 'invalid-email',
          malicious: '<script>alert(1)</script>',
        };

        const originalBody = { ...req.body };

        sanitizeRequestData(req, res, next);

        expect(req.body).toEqual(originalBody);
        expect(next).toHaveBeenCalled();
      });

      it('should still call next() to allow handleValidationErrors to run', () => {
        req.body = { invalid: 'data' };

        sanitizeRequestData(req, res, next);

        expect(next).toHaveBeenCalled();
      });
    });

    describe('XSS Attack Scenarios', () => {
      beforeEach(() => {
        mockValidationResult.mockReturnValue({
          isEmpty: () => true,
        });
      });

      it('should prevent <script> injection', () => {
        req.body = {
          comment: '<script>alert("XSS")</script>',
          validField: 'safe data',
        };

        mockMatchedData.mockReturnValue({
          validField: 'safe data',
          // comment is NOT validated, so it's removed
        });

        sanitizeRequestData(req, res, next);

        expect(req.body.comment).toBeUndefined();
        expect(req.body.validField).toBe('safe data');
      });

      it('should prevent event handler injection', () => {
        req.body = {
          bio: '<img src=x onerror=alert(1)>',
          name: 'John',
        };

        mockMatchedData.mockReturnValue({
          name: 'John',
        });

        sanitizeRequestData(req, res, next);

        expect(req.body.bio).toBeUndefined();
      });

      it('should prevent iframe injection', () => {
        req.body = {
          description: '<iframe src="javascript:alert(1)"></iframe>',
          title: 'My Horse',
        };

        mockMatchedData.mockReturnValue({
          title: 'My Horse',
        });

        sanitizeRequestData(req, res, next);

        expect(req.body.description).toBeUndefined();
      });

      it('should prevent SVG XSS', () => {
        req.body = {
          avatar: '<svg><script>alert(1)</script></svg>',
          username: 'user123',
        };

        mockMatchedData.mockReturnValue({
          username: 'user123',
        });

        sanitizeRequestData(req, res, next);

        expect(req.body.avatar).toBeUndefined();
      });
    });

    describe('Parameter Pollution Prevention (CWE-20)', () => {
      beforeEach(() => {
        mockValidationResult.mockReturnValue({
          isEmpty: () => true,
        });
      });

      it('should prevent array parameter pollution', () => {
        req.query = {
          price: ['100', '200'], // Attacker tries to manipulate with array
          breed: 'thoroughbred',
        };

        mockMatchedData.mockReturnValue({
          price: '100', // Only first value validated
          breed: 'thoroughbred',
        });

        sanitizeRequestData(req, res, next);

        expect(req.query).toEqual({
          price: '100',
          breed: 'thoroughbred',
        });
      });

      it('should prevent object parameter pollution', () => {
        req.body = {
          user: { email: 'test@example.com', isAdmin: true }, // Attacker tries to escalate
          password: 'pass123',
        };

        mockMatchedData.mockReturnValue({
          password: 'pass123',
          // user.email validated but not user.isAdmin
        });

        sanitizeRequestData(req, res, next);

        expect(req.body).toEqual({
          password: 'pass123',
        });
        expect(req.body.user).toBeUndefined();
      });

      it('should prevent duplicate parameter names', () => {
        req.query = {
          sort: 'price', // First occurrence
          extraParam1: 'value1',
          extraParam2: 'value2',
        };

        mockMatchedData.mockReturnValue({
          sort: 'price',
        });

        sanitizeRequestData(req, res, next);

        expect(req.query).toEqual({
          sort: 'price',
        });
      });
    });
  });
});
