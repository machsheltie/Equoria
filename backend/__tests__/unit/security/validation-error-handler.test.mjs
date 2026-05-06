import { describe, it, expect, jest } from '@jest/globals';
import { handleValidationErrors, sanitizeRequestData } from '../../../middleware/validationErrorHandler.mjs';

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('validationErrorHandler', () => {
  it('passes through when no errors', () => {
    const req = {
      validationResult: jest.fn(() => ({ isEmpty: () => true, array: () => [] })),
    };
    const res = mockRes();
    const next = jest.fn();
    handleValidationErrors(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 400 on validation errors', () => {
    const req = {
      validationResult: jest.fn(() => ({
        isEmpty: () => false,
        array: () => [{ msg: 'Invalid' }],
      })),
      get: () => 'jest',
      method: 'GET',
      originalUrl: '/test',
      ip: '127.0.0.1',
    };
    const res = mockRes();
    const next = jest.fn();
    handleValidationErrors(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid',
      errors: [{ msg: 'Invalid' }],
    });
  });

  it('returns 400 with redacted error details in production (CWE-209)', () => {
    // Branch coverage on validationErrorHandler.mjs:27 —
    // `process.env.NODE_ENV === 'production'` truthy path. The production
    // branch redacts internal validation details (only the first error's
    // .msg is exposed) to comply with CWE-209 (information leak).
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const req = {
        validationResult: jest.fn(() => ({
          isEmpty: () => false,
          array: () => [
            { msg: 'Invalid email', path: 'email' },
            { msg: 'Password too short', path: 'password' },
          ],
        })),
        get: () => 'jest',
        method: 'POST',
        originalUrl: '/api/v1/auth/register',
        ip: '127.0.0.1',
      };
      const res = mockRes();
      const next = jest.fn();
      handleValidationErrors(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid email',
        // Only first message exposed; field paths and the second error are stripped.
        errors: [{ message: 'Invalid email' }],
      });
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it('sanitizes request body by keeping only validated fields', () => {
    const req = {
      body: { allowed: 'ok', extra: 'bad' },
      validationResult: jest.fn(() => ({ isEmpty: () => true })),
      matchedData: jest.fn(() => ({ allowed: 'ok' })),
    };
    const res = mockRes();
    const next = jest.fn();
    sanitizeRequestData(req, res, next);
    expect(req.body).toEqual({ allowed: 'ok' });
    expect(next).toHaveBeenCalled();
  });
});
