/**
 * 🧪 COMPREHENSIVE TEST: Validation Error Handler Middleware
 *
 * Tests the validation error handler middleware that processes
 * express-validator validation results and formats error responses.
 *
 * 📋 COVERAGE SCOPE:
 * - handleValidationErrors: Process validation results
 * - Error formatting: Format validation errors for API responses
 * - Multiple validation errors: Handle multiple field errors
 * - Logging: Track validation failures
 * - Edge cases: Empty errors, malformed errors
 *
 * 🎯 TEST CATEGORIES:
 * 1. Success Cases - No validation errors
 * 2. Single Validation Error - One field fails validation
 * 3. Multiple Validation Errors - Multiple fields fail
 * 4. Error Message Formatting - Correct response structure
 * 5. Logging - Validation error logging
 * 6. Edge Cases - Empty errors, undefined errors
 *
 * 🔄 TESTING APPROACH:
 * ✅ REAL: Middleware logic, error formatting
 * 🔧 MOCK: validationResult from express-validator, logger
 *
 * 💡 TEST STRATEGY: Unit tests with mocked validation results
 *    to ensure proper error handling and response formatting
 */

import { handleValidationErrors } from '../../middleware/validationErrorHandler.mjs';
import { validationResult } from 'express-validator';
import logger from '../../utils/logger.mjs';

// Mock dependencies
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));

jest.mock('../../utils/logger.mjs', () => ({
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('✅ Validation Error Handler Middleware Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      originalUrl: '/api/test/endpoint',
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'short',
      },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('✅ No Validation Errors', () => {
    test('should call next() when no validation errors', () => {
      // Mock validationResult to return no errors
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true),
        array: jest.fn().mockReturnValue([]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    test('should not modify request when validation passes', () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true),
        array: jest.fn().mockReturnValue([]),
      });

      const originalReq = { ...mockReq };

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockReq).toEqual(originalReq);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle empty validation results', () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true),
        array: jest.fn().mockReturnValue([]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('❌ Single Validation Error', () => {
    test('should return 400 status with single validation error', () => {
      const mockError = {
        msg: 'Email is invalid',
        param: 'email',
        location: 'body',
        value: 'invalid-email',
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([mockError]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email is invalid',
        errors: [mockError],
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should use first error message as main message', () => {
      const mockError = {
        msg: 'Password is too short',
        param: 'password',
        location: 'body',
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([mockError]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Password is too short',
        }),
      );
    });

    test('should log validation error with request details', () => {
      const mockError = {
        msg: 'Invalid field',
        param: 'field',
        location: 'body',
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([mockError]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(logger.warn).toHaveBeenCalledWith('Validation errors occurred', {
        url: '/api/test/endpoint',
        method: 'POST',
        errors: [mockError],
      });
    });

    test('should include all error details in response', () => {
      const mockError = {
        msg: 'Email must be valid',
        param: 'email',
        location: 'body',
        value: 'not-an-email',
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([mockError]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email must be valid',
        errors: [mockError],
      });
    });
  });

  describe('❌ Multiple Validation Errors', () => {
    test('should handle multiple validation errors', () => {
      const mockErrors = [
        {
          msg: 'Email is required',
          param: 'email',
          location: 'body',
        },
        {
          msg: 'Password must be at least 8 characters',
          param: 'password',
          location: 'body',
        },
        {
          msg: 'Username is required',
          param: 'username',
          location: 'body',
        },
      ];

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue(mockErrors),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email is required', // First error
        errors: mockErrors,
      });
    });

    test('should return all errors in errors array', () => {
      const mockErrors = [
        { msg: 'Error 1', param: 'field1' },
        { msg: 'Error 2', param: 'field2' },
        { msg: 'Error 3', param: 'field3' },
      ];

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue(mockErrors),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.errors).toHaveLength(3);
      expect(response.errors).toEqual(mockErrors);
    });

    test('should use first error as primary message with multiple errors', () => {
      const mockErrors = [
        { msg: 'Primary error', param: 'field1' },
        { msg: 'Secondary error', param: 'field2' },
        { msg: 'Tertiary error', param: 'field3' },
      ];

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue(mockErrors),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Primary error',
        }),
      );
    });

    test('should log all validation errors', () => {
      const mockErrors = [
        { msg: 'Error 1', param: 'field1' },
        { msg: 'Error 2', param: 'field2' },
      ];

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue(mockErrors),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        'Validation errors occurred',
        expect.objectContaining({
          errors: mockErrors,
        }),
      );
    });
  });

  describe('📋 Error Response Format', () => {
    test('should return correct response structure', () => {
      const mockError = {
        msg: 'Validation failed',
        param: 'field',
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([mockError]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('errors');
      expect(response.success).toBe(false);
      expect(Array.isArray(response.errors)).toBe(true);
    });

    test('should always set success to false on validation errors', () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Error', param: 'field' }]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    test('should return 400 Bad Request status code', () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Error', param: 'field' }]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('📝 Logging', () => {
    test('should log with correct log level', () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Error', param: 'field' }]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(logger.warn).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    test('should log request URL and method', () => {
      mockReq.originalUrl = '/api/users/register';
      mockReq.method = 'POST';

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Error', param: 'field' }]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        'Validation errors occurred',
        expect.objectContaining({
          url: '/api/users/register',
          method: 'POST',
        }),
      );
    });

    test('should include error details in log', () => {
      const mockError = {
        msg: 'Field is invalid',
        param: 'testField',
        location: 'body',
        value: 'invalid',
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([mockError]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        'Validation errors occurred',
        expect.objectContaining({
          errors: [mockError],
        }),
      );
    });

    test('should not log when no validation errors', () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true),
        array: jest.fn().mockReturnValue([]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('🔒 Edge Cases', () => {
    test('should handle error without msg property', () => {
      const mockError = {
        param: 'field',
        location: 'body',
        // No msg property
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([mockError]),
      });

      // Should not throw
      expect(() => {
        handleValidationErrors(mockReq, mockRes, mockNext);
      }).not.toThrow();

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should handle error with empty msg', () => {
      const mockError = {
        msg: '',
        param: 'field',
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([mockError]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '',
          errors: [mockError],
        }),
      );
    });

    test('should handle error with long message', () => {
      const longMessage = 'This is a very long error message that contains detailed information about what went wrong with the validation and provides extensive details to help the user understand the issue'.repeat(5);
      const mockError = {
        msg: longMessage,
        param: 'field',
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([mockError]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: longMessage,
        }),
      );
    });

    test('should handle error with special characters in message', () => {
      const mockError = {
        msg: 'Error: <script>alert("xss")</script> & "quotes" & \'apostrophes\'',
        param: 'field',
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([mockError]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: mockError.msg,
        }),
      );
    });

    test('should handle missing originalUrl in request', () => {
      mockReq.originalUrl = undefined;

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Error', param: 'field' }]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        'Validation errors occurred',
        expect.objectContaining({
          url: undefined,
        }),
      );
    });

    test('should handle missing method in request', () => {
      mockReq.method = undefined;

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Error', param: 'field' }]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        'Validation errors occurred',
        expect.objectContaining({
          method: undefined,
        }),
      );
    });

    test('should handle array with single undefined error', () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([undefined]),
      });

      // Should handle gracefully
      expect(() => {
        handleValidationErrors(mockReq, mockRes, mockNext);
      }).not.toThrow();
    });

    test('should handle nested error objects', () => {
      const mockError = {
        msg: 'Nested error',
        param: 'nested.field.value',
        location: 'body',
        value: { nested: { data: 'value' } },
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([mockError]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Nested error',
        errors: [mockError],
      });
    });
  });

  describe('🔄 Integration with express-validator', () => {
    test('should correctly call validationResult with request', () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true),
        array: jest.fn().mockReturnValue([]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(validationResult).toHaveBeenCalledWith(mockReq);
      expect(validationResult).toHaveBeenCalledTimes(1);
    });

    test('should work with express-validator error format', () => {
      // Standard express-validator error format
      const standardError = {
        value: 'invalid-value',
        msg: 'Invalid value provided',
        param: 'fieldName',
        location: 'body',
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([standardError]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid value provided',
        errors: [standardError],
      });
    });

    test('should handle custom validator messages', () => {
      const customError = {
        msg: 'Custom validation message with variables: test@example.com',
        param: 'email',
        location: 'body',
        value: 'test@example.com',
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([customError]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: customError.msg,
        }),
      );
    });
  });

  describe('🚀 Performance', () => {
    test('should handle large number of validation errors efficiently', () => {
      const largeErrorArray = Array.from({ length: 100 }, (_, i) => ({
        msg: `Error ${i}`,
        param: `field${i}`,
        location: 'body',
      }));

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue(largeErrorArray),
      });

      const startTime = Date.now();
      handleValidationErrors(mockReq, mockRes, mockNext);
      const endTime = Date.now();

      // Should complete quickly (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: largeErrorArray,
        }),
      );
    });

    test('should not block or modify next() callback', () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true),
        array: jest.fn().mockReturnValue([]),
      });

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
