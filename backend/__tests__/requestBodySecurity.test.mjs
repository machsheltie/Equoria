/**
 * 🔒 UNIT TESTS: requestBodySecurity middleware (Equoria-bbmu)
 *
 * Focused coverage of the in-process scanner / guard / handler trio in
 * backend/middleware/requestBodySecurity.mjs. Integration coverage of the
 * same surface lives under __tests__/integration/security/ and exercises
 * the full HTTP chain — these unit tests pin the contracts at function
 * level so a refactor that changes the dispatch shape, error class, or
 * exported surface fails here first (faster feedback than integration
 * tests).
 *
 * Scope (per Equoria-bbmu AC):
 *   - rejects {"__proto__": ...} at any nesting depth
 *   - rejects {"constructor": {...}} where the `prototype` key is the
 *     immediate child (this is the exploit path; constructor-as-string is
 *     fine)
 *   - allows constructor / prototype as STRING VALUES
 *   - allows arrays of objects with safe keys
 *   - the error handler returns the canonical envelope
 *   - sentinel-class dispatch contract (21R-SEC-6, Equoria-tpbu)
 *
 * No mocks beyond jest spies on res.status / res.json — exercises the
 * REAL exported functions on a real prototype-polluting payload.
 */

import { describe, it, expect } from '@jest/globals';
import {
  RequestBodySecurityError,
  REQUEST_BODY_SECURITY_ERROR_MARKER,
  ERROR_MESSAGE_PREFIX,
  rejectPollutedRequestBody,
  rejectPollutedRequestQuery,
  requestBodySecurityErrorHandler,
  sanitizeForLog,
} from '../middleware/requestBodySecurity.mjs';
import { AppError } from '../errors/index.mjs';

// Express-style middleware harness. We don't need a real Request/Response;
// the middlewares only read req.{body,query,url}, and the error handler
// writes via res.status().json() and signals forward via next().
function makeTracked(returnValue) {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
    return returnValue;
  };
  fn.mock = { calls };
  return fn;
}

const harness = ({ body, query, url } = {}) => {
  const res = {};
  res.status = makeTracked(res);
  res.json = makeTracked(res);
  return {
    req: {
      body,
      query,
      url,
      method: 'POST',
      path: '/test',
      originalUrl: url ?? '/test',
      ip: '127.0.0.1',
    },
    res,
    next: makeTracked(undefined),
  };
};

describe('RequestBodySecurityError sentinel class', () => {
  it('extends AppError and carries 400 status', () => {
    const err = new RequestBodySecurityError('forbidden key "__proto__"');
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(400);
    expect(err.isOperational).toBe(true);
  });

  it('wraps message body in canonical ERROR_MESSAGE_PREFIX', () => {
    const err = new RequestBodySecurityError('scanner failure');
    expect(err.message).toBe(`${ERROR_MESSAGE_PREFIX} scanner failure`);
  });

  it('tags instance with the registry symbol marker', () => {
    const err = new RequestBodySecurityError('x');
    expect(err[REQUEST_BODY_SECURITY_ERROR_MARKER]).toBe(true);
  });

  it('isRequestBodySecurityError returns true for sentinel instances', () => {
    expect(RequestBodySecurityError.isRequestBodySecurityError(new RequestBodySecurityError('x'))).toBe(true);
  });

  it('isRequestBodySecurityError returns false for plain AppError with prefix message', () => {
    // Negative sentinel: dispatch must be type-based, not string-based.
    const fake = new AppError(`${ERROR_MESSAGE_PREFIX} x`, 400);
    expect(RequestBodySecurityError.isRequestBodySecurityError(fake)).toBe(false);
  });

  it('isRequestBodySecurityError returns false for non-objects and null', () => {
    expect(RequestBodySecurityError.isRequestBodySecurityError(null)).toBe(false);
    expect(RequestBodySecurityError.isRequestBodySecurityError(undefined)).toBe(false);
    expect(RequestBodySecurityError.isRequestBodySecurityError('string')).toBe(false);
    expect(RequestBodySecurityError.isRequestBodySecurityError(42)).toBe(false);
  });
});

describe('rejectPollutedRequestBody', () => {
  it('forwards via next() when body is undefined', () => {
    const { req, res, next } = harness();
    rejectPollutedRequestBody(req, res, next);
    expect(next.mock.calls.length).toBe(1);
    expect(next.mock.calls[0]).toEqual([]); // no error
  });

  it('forwards via next() for safe nested object', () => {
    const { req, res, next } = harness({
      body: { name: 'Storm', stats: { speed: 90, stamina: 80 } },
    });
    rejectPollutedRequestBody(req, res, next);
    expect(next.mock.calls.length).toBe(1);
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it('rejects {__proto__: ...} at top level', () => {
    // Use defineProperty because direct assignment of __proto__ literal in
    // an object literal sets the prototype rather than creating an own
    // property — the scanner is interested in OWN properties named
    // __proto__, which is what JSON.parse produces.
    const polluted = {};
    Object.defineProperty(polluted, '__proto__', {
      value: { isAdmin: true },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    const { req, res, next } = harness({ body: polluted });
    rejectPollutedRequestBody(req, res, next);
    expect(next.mock.calls.length).toBe(1);
    const err = next.mock.calls[0][0];
    expect(RequestBodySecurityError.isRequestBodySecurityError(err)).toBe(true);
    expect(err.message).toContain('__proto__');
  });

  it('rejects __proto__ at deeper nesting', () => {
    const inner = {};
    Object.defineProperty(inner, '__proto__', {
      value: { isAdmin: true },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    const body = { user: { profile: inner } };
    const { req, res, next } = harness({ body });
    rejectPollutedRequestBody(req, res, next);
    const err = next.mock.calls[0][0];
    expect(RequestBodySecurityError.isRequestBodySecurityError(err)).toBe(true);
    expect(err.message).toContain('__proto__');
  });

  it('rejects {constructor: {prototype: ...}} (the exploit path)', () => {
    const body = { constructor: { prototype: { isAdmin: true } } };
    const { req, res, next } = harness({ body });
    rejectPollutedRequestBody(req, res, next);
    const err = next.mock.calls[0][0];
    expect(RequestBodySecurityError.isRequestBodySecurityError(err)).toBe(true);
    expect(err.message).toMatch(/constructor|prototype/);
  });

  it('allows constructor as a STRING VALUE (not a key naming an object)', () => {
    const body = { breed: 'Arabian', description: 'constructor' };
    const { req, res, next } = harness({ body });
    rejectPollutedRequestBody(req, res, next);
    expect(next.mock.calls.length).toBe(1);
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it('allows prototype as a STRING VALUE', () => {
    const body = { name: 'prototype' };
    const { req, res, next } = harness({ body });
    rejectPollutedRequestBody(req, res, next);
    expect(next.mock.calls.length).toBe(1);
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it('allows arrays of objects with safe keys', () => {
    const body = {
      horses: [
        { name: 'Storm', age: 5 },
        { name: 'Echo', age: 3 },
        { name: 'Apollo', stats: { speed: 80 } },
      ],
    };
    const { req, res, next } = harness({ body });
    rejectPollutedRequestBody(req, res, next);
    expect(next.mock.calls.length).toBe(1);
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it('rejects __proto__ inside an array element', () => {
    const polluted = {};
    Object.defineProperty(polluted, '__proto__', {
      value: { isAdmin: true },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    const body = { horses: [{ name: 'Safe' }, polluted] };
    const { req, res, next } = harness({ body });
    rejectPollutedRequestBody(req, res, next);
    const err = next.mock.calls[0][0];
    expect(RequestBodySecurityError.isRequestBodySecurityError(err)).toBe(true);
  });
});

describe('rejectPollutedRequestQuery', () => {
  it('forwards safely for benign filter querystring', () => {
    const { req, res, next } = harness({
      query: { breed: 'arabian', age: '5' },
      url: '/test?breed=arabian&age=5',
    });
    rejectPollutedRequestQuery(req, res, next);
    expect(next.mock.calls.length).toBe(1);
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it('rejects __proto__ via raw URL scan (qs strips this from req.query)', () => {
    // Stage 1 of the two-stage scan — `req.query` is empty here because
    // qs default mode drops `__proto__` keys; the raw URL still contains
    // the polluting bracket-segment.
    const { req, res, next } = harness({
      query: {},
      url: '/test?__proto__[isAdmin]=1',
    });
    rejectPollutedRequestQuery(req, res, next);
    const err = next.mock.calls[0][0];
    expect(RequestBodySecurityError.isRequestBodySecurityError(err)).toBe(true);
    expect(err.message).toContain('__proto__');
  });

  it('rejects constructor[prototype] via parsed-object scan', () => {
    // Stage 2 — qs lets `constructor[prototype][isAdmin]=1` through into
    // req.query, and `assertNoPollutingKeys` catches it there.
    const { req, res, next } = harness({
      query: { constructor: { prototype: { isAdmin: '1' } } },
      url: '/test?constructor[prototype][isAdmin]=1',
    });
    rejectPollutedRequestQuery(req, res, next);
    const err = next.mock.calls[0][0];
    expect(RequestBodySecurityError.isRequestBodySecurityError(err)).toBe(true);
    expect(err.message).toMatch(/constructor|prototype/);
  });

  it('rejects URL-encoded __proto__ in raw scan', () => {
    // %5F%5Fproto%5F%5F decodes to __proto__. The scanner decodes before
    // checking segments.
    const { req, res, next } = harness({
      query: {},
      url: '/test?%5F%5Fproto%5F%5F[isAdmin]=1',
    });
    rejectPollutedRequestQuery(req, res, next);
    const err = next.mock.calls[0][0];
    expect(RequestBodySecurityError.isRequestBodySecurityError(err)).toBe(true);
  });

  it('forwards safely when url has no querystring', () => {
    const { req, res, next } = harness({ query: {}, url: '/test' });
    rejectPollutedRequestQuery(req, res, next);
    expect(next.mock.calls.length).toBe(1);
    expect(next.mock.calls[0]).toHaveLength(0);
  });
});

describe('requestBodySecurityErrorHandler envelope', () => {
  it('returns 400 with canonical envelope for sentinel error', () => {
    const { req, res, next } = harness();
    const err = new RequestBodySecurityError('forbidden key "__proto__"');
    requestBodySecurityErrorHandler(err, req, res, next);
    expect(res.status.mock.calls[0]?.[0]).toBe(400);
    expect(res.json.mock.calls[0]?.[0]).toEqual({
      success: false,
      message: `${ERROR_MESSAGE_PREFIX} forbidden key "__proto__"`,
    });
    expect(next.mock.calls.length).toBe(0);
  });

  it('forwards plain AppError (NOT a sentinel instance)', () => {
    const { req, res, next } = harness();
    const err = new AppError(`${ERROR_MESSAGE_PREFIX} x`, 400);
    requestBodySecurityErrorHandler(err, req, res, next);
    expect(res.status.mock.calls.length).toBe(0);
    expect(next.mock.calls[0]?.[0]).toBe(err);
  });
});

// ── sanitizeForLog sentinel coverage (Equoria-fefh2.9) ──────────────────────
//
// The LOG_INJECTION_STRIP regex in the middleware carries an eslint-disable
// for no-control-regex because matching control bytes IS the security logic
// (see the threat-model comment above the regex). These tests pin each
// threat-model class: if a future edit narrows the character class, the
// corresponding case here fails.
describe('sanitizeForLog strips log-injection control characters (sentinel)', () => {
  // Scans output for ANY of the hostile code points the production regex
  // is contracted to strip.
  // eslint-disable-next-line no-control-regex -- sentinel test MUST scan for the same control bytes the production regex strips (log-injection threat model); matching control bytes is the point of the assertion, not an accident.
  const HOSTILE = /[\u0000-\u001F\u007F\u0080-\u009F\u202E\u2028\u2029\uFEFF]/;

  it.each([
    ['NUL U+0000 (C0 floor, truncation)', 'a\u0000b'],
    ['US U+001F (C0 ceiling)', 'a\u001Fb'],
    ['ESC U+001B (ANSI escape intro)', 'a\u001B[31mb'],
    ['DEL U+007F', 'a\u007Fb'],
    ['C1 floor U+0080', 'a\u0080b'],
    ['C1 ceiling U+009F (APC)', 'a\u009Fb'],
    ['single-byte CSI U+009B (C1 ANSI)', 'a\u009B31mb'],
    ['bidi RLO override U+202E', 'a\u202Eb'],
    ['LINE SEPARATOR U+2028 (log-splitting)', 'a\u2028b'],
    ['PARAGRAPH SEPARATOR U+2029 (log-splitting)', 'a\u2029b'],
    ['BOM U+FEFF', 'a\uFEFFb'],
  ])('%s does not survive in output', (_label, input) => {
    const out = sanitizeForLog(input, 64);
    // The hostile code point must be gone...
    expect(out).not.toMatch(HOSTILE);
    // ...replaced with '?' (1:1, no length change), with the surrounding
    // legitimate characters intact.
    expect(out).toContain('a');
    expect(out).toContain('b');
    expect(out).toContain('?');
    expect(out.length).toBe(input.length);
  });

  it('strips a multi-class payload (CRLF log-split + ANSI + bidi + BOM) in one pass', () => {
    const out = sanitizeForLog('user\r\nFAKE admin login OK \u001B[2J\u202EkcatTA\uFEFF', 256);
    expect(out).toBe('user??FAKE admin login OK ?[2J?kcatTA?');
  });

  it('leaves plain printable ASCII untouched', () => {
    expect(sanitizeForLog('duplicate JSON key "name"', 64)).toBe('duplicate JSON key "name"');
  });
});
