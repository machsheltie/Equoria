import { describe, it, expect, jest } from '@jest/globals';
import {
  handleValidationErrors,
  sanitizeRequestData,
} from '../../../middleware/validationErrorHandler.mjs';

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
