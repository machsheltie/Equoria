import { describe, it, expect, vi } from '@jest/globals';
import { validationResult } from 'express-validator';
import { handleValidationErrors, sanitizeRequestData } from '../../middleware/validationErrorHandler.mjs';

vi.mock('express-validator', () => {
  return {
    validationResult: vi.fn(),
  };
});

const mockRes = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe('validationErrorHandler', () => {
  it('passes through when no errors', () => {
    const req = {};
    const res = mockRes();
    const next = vi.fn();
    validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });
    handleValidationErrors(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 400 on validation errors', () => {
    const req = {};
    const res = mockRes();
    const next = vi.fn();
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Invalid' }],
    });
    handleValidationErrors(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [{ msg: 'Invalid' }],
    });
  });

  it('sanitizes request body by keeping only validated fields', () => {
    const req = {
      body: { allowed: 'ok', extra: 'bad' },
      _validatedFields: ['allowed'],
    };
    const res = mockRes();
    const next = vi.fn();
    sanitizeRequestData(req, res, next);
    expect(req.body).toEqual({ allowed: 'ok' });
    expect(next).toHaveBeenCalled();
  });
});
