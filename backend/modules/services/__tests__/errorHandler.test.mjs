/**
 * errorHandler middleware — unit tests (Equoria-rr7)
 *
 * Tests the global error handler with mock req/res/next. No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import errorHandler from '../../../middleware/errorHandler.mjs';
import AppError from '../../../errors/AppError.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRes(headersSent = false) {
  const res = { headersSent, _status: null, _body: null };
  res.status = code => {
    res._status = code;
    return {
      json: body => {
        res._body = body;
      },
    };
  };
  return res;
}

function makeReq(overrides = {}) {
  return {
    originalUrl: '/test',
    method: 'GET',
    ip: '127.0.0.1',
    get: () => 'test-agent',
    ...overrides,
  };
}

function makeNext() {
  const calls = [];
  const fn = (...args) => calls.push(args);
  fn.called = () => calls.length > 0;
  fn.calledWith = expected => calls.some(args => args[0] === expected);
  return fn;
}

// ---------------------------------------------------------------------------
// AppError handling
// ---------------------------------------------------------------------------
describe('errorHandler — AppError instances', () => {
  it('uses AppError statusCode and message directly', () => {
    const err = new AppError('Custom error', 422);
    const res = makeRes();
    const next = makeNext();
    errorHandler(err, makeReq(), res, next);
    expect(res._status).toBe(422);
    expect(res._body.success).toBe(false);
    expect(res._body.message).toBe('Custom error');
    expect(next.called()).toBe(false);
  });

  it('uses 500 as fallback when statusCode is absent', () => {
    const err = new Error('Something broke');
    const res = makeRes();
    errorHandler(err, makeReq(), res, makeNext());
    expect(res._status).toBe(500);
  });

  it('sets success: false in response body', () => {
    const err = new AppError('Not found', 404);
    const res = makeRes();
    errorHandler(err, makeReq(), res, makeNext());
    expect(res._body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Prisma error codes
// ---------------------------------------------------------------------------
describe('errorHandler — Prisma error codes', () => {
  it('maps P2002 to 400 with duplicate message', () => {
    const err = Object.assign(new Error('Prisma P2002'), { code: 'P2002' });
    const res = makeRes();
    errorHandler(err, makeReq(), res, makeNext());
    expect(res._status).toBe(400);
    expect(res._body.message).toMatch(/duplicate/i);
  });

  it('maps P2025 to 404 with record not found message', () => {
    const err = Object.assign(new Error('Prisma P2025'), { code: 'P2025' });
    const res = makeRes();
    errorHandler(err, makeReq(), res, makeNext());
    expect(res._status).toBe(404);
    expect(res._body.message).toMatch(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// Mongoose-like error codes (legacy path)
// ---------------------------------------------------------------------------
describe('errorHandler — Mongoose-like error shapes', () => {
  it('maps CastError to 404 Resource not found', () => {
    const err = Object.assign(new Error('Cast error'), { name: 'CastError' });
    const res = makeRes();
    errorHandler(err, makeReq(), res, makeNext());
    expect(res._status).toBe(404);
    expect(res._body.message).toBe('Resource not found');
  });

  it('maps error with code 11000 to 400 duplicate field', () => {
    const err = Object.assign(new Error('Dup key'), { code: 11000 });
    const res = makeRes();
    errorHandler(err, makeReq(), res, makeNext());
    expect(res._status).toBe(400);
    expect(res._body.message).toMatch(/duplicate/i);
  });
});

// ---------------------------------------------------------------------------
// Guard paths
// ---------------------------------------------------------------------------
describe('errorHandler — guard paths', () => {
  it('calls next when res is invalid (no status fn)', () => {
    const err = new Error('test');
    const next = makeNext();
    errorHandler(err, makeReq(), {}, next);
    expect(next.calledWith(err)).toBe(true);
  });

  it('calls next when headers already sent', () => {
    const err = new Error('test');
    const next = makeNext();
    errorHandler(err, makeReq(), makeRes(true), next);
    expect(next.calledWith(err)).toBe(true);
  });
});
