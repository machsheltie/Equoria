import { describe, it, expect } from '@jest/globals';
import { handleValidationErrors, sanitizeRequestData } from '../../../middleware/validationErrorHandler.mjs';

function makeTracked(returnValue) {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
    return returnValue;
  };
  fn.mock = { calls };
  return fn;
}

function buildMockRes() {
  const res = {};
  res.status = makeTracked(res);
  res.json = makeTracked(res);
  return res;
}

describe('validationErrorHandler', () => {
  it('passes through when no errors', () => {
    const req = {
      validationResult: () => ({ isEmpty: () => true, array: () => [] }),
    };
    const res = buildMockRes();
    const next = makeTracked(undefined);
    handleValidationErrors(req, res, next);
    expect(next.mock.calls.length).toBeGreaterThan(0);
  });

  it('returns 400 on validation errors', () => {
    const req = {
      validationResult: () => ({
        isEmpty: () => false,
        array: () => [{ msg: 'Invalid' }],
      }),
      get: () => 'jest',
      method: 'GET',
      originalUrl: '/test',
      ip: '127.0.0.1',
    };
    const res = buildMockRes();
    const next = makeTracked(undefined);
    handleValidationErrors(req, res, next);
    expect(res.status.mock.calls[0]?.[0]).toBe(400);
    expect(res.json.mock.calls[0]?.[0]).toEqual({
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
        validationResult: () => ({
          isEmpty: () => false,
          array: () => [
            { msg: 'Invalid email', path: 'email' },
            { msg: 'Password too short', path: 'password' },
          ],
        }),
        get: () => 'jest',
        method: 'POST',
        originalUrl: '/api/v1/auth/register',
        ip: '127.0.0.1',
      };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      handleValidationErrors(req, res, next);
      expect(res.status.mock.calls[0]?.[0]).toBe(400);
      expect(res.json.mock.calls[0]?.[0]).toEqual({
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
      validationResult: () => ({ isEmpty: () => true }),
      matchedData: () => ({ allowed: 'ok' }),
    };
    const res = buildMockRes();
    const next = makeTracked(undefined);
    sanitizeRequestData(req, res, next);
    expect(req.body).toEqual({ allowed: 'ok' });
    expect(next.mock.calls.length).toBeGreaterThan(0);
  });
});
