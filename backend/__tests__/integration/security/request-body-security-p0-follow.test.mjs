/**
 * P0 security regression tests — three follow-up defects from the
 * 21R-SEC-3-FOLLOW-1 (Equoria-ixqg) adversarial audit:
 *
 *   Equoria-gbcm: Content-Type case-sensitivity bypass in verifyJsonBody
 *   Equoria-2l00: rejectPollutedRequestBody fail-open for non-AppError
 *   Equoria-qj3f: __proto__ Unicode-escape bypass in JsonScanner dup-key detection
 *
 * Per EDGE_CASE_FIX_DISCIPLINE.md §1: these tests are written BEFORE the
 * fixes so they fail on the unfixed code, then pass after.
 *
 * @module __tests__/integration/security/request-body-security-p0-follow
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { __TESTING_ONLY_JsonScanner, RequestBodySecurityError } from '../../../middleware/requestBodySecurity.mjs';
import logger from '../../../utils/logger.mjs';

// A public endpoint that express.json() parses — we want to reach the gate
// without auth complications. /api/v1/auth/login is POST + JSON.
const JSON_ENDPOINT = '/api/v1/auth/login';

// ─────────────────────────────────────────────────────────────────────────────
// Equoria-gbcm: Content-Type case-sensitivity bypass in verifyJsonBody
// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-gbcm: Content-Type case-insensitive matching in verifyJsonBody', () => {
  it('rejects duplicate-key body when Content-Type is Application/JSON (uppercase A, uppercase JSON)', async () => {
    const res = await request(app)
      .post(JSON_ENDPOINT)
      .set('Content-Type', 'Application/JSON')
      .set('Origin', 'http://localhost:3000')
      .send('{"email":"a@b.com","email":"hacked@evil.com"}');

    // Without fix: includes('application/json') misses uppercase → body parsed
    // normally → no 400 from our gate.
    // With fix: case-insensitive check → duplicate key detected → 400.
    expect(res.status).toBe(400);
  });

  it('rejects 64-deep array body when Content-Type is application/JSON (mixed case)', async () => {
    const open = Array.from({ length: 64 }, () => '[').join('');
    const close = Array.from({ length: 64 }, () => ']').join('');
    const nested = `${open}1${close}`;
    const res = await request(app)
      .post(JSON_ENDPOINT)
      .set('Content-Type', 'application/JSON')
      .set('Origin', 'http://localhost:3000')
      .send(nested);

    expect(res.status).toBe(400);
  });

  it('still rejects duplicate-key body when Content-Type is lowercase application/json', async () => {
    const res = await request(app)
      .post(JSON_ENDPOINT)
      .set('Content-Type', 'application/json')
      .set('Origin', 'http://localhost:3000')
      .send('{"email":"a@b.com","email":"hacked@evil.com"}');

    expect(res.status).toBe(400);
  });

  it('still rejects 33-deep array body when Content-Type is lowercase application/json', async () => {
    const open = Array.from({ length: 33 }, () => '[').join('');
    const close = Array.from({ length: 33 }, () => ']').join('');
    const nested = `${open}1${close}`;
    const res = await request(app)
      .post(JSON_ENDPOINT)
      .set('Content-Type', 'application/json')
      .set('Origin', 'http://localhost:3000')
      .send(nested);

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Equoria-2l00: rejectPollutedRequestBody fail-open for non-AppError
// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-2l00: rejectPollutedRequestBody fail-closed for non-AppError', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns 400 (not 500) when assertNoPollutingKeys throws a non-AppError', async () => {
    // We need to exercise a code path where assertNoPollutingKeys throws
    // something other than AppError. The function iterates Object.entries —
    // if a getter on req.body throws a TypeError, that should produce 400,
    // not 500 or pass-through.
    //
    // We can't easily inject this via HTTP (express.json() normalises the
    // body). Instead we test the middleware handler contract directly:
    // call rejectPollutedRequestBody with a body where Object.entries
    // throws. We import the function and invoke it with a mocked req.
    const { rejectPollutedRequestBody } = await import('../../../middleware/requestBodySecurity.mjs');

    // Build a body that causes Object.entries / property access to throw.
    // A poisoned object with a throwing getter exercises the non-AppError path.
    const poisonedBody = Object.defineProperty({}, 'bomb', {
      get() {
        throw new TypeError('Intentional non-AppError for test');
      },
      enumerable: true,
    });

    const errors = [];
    const mockReq = { body: poisonedBody };
    const mockRes = {};
    const mockNext = err => errors.push(err);

    rejectPollutedRequestBody(mockReq, mockRes, mockNext);

    expect(errors).toHaveLength(1);
    // Without fix: non-AppError flows to next as-is → 500 from global handler.
    // With fix: wrapped to RequestBodySecurityError → 400 from security handler.
    expect(RequestBodySecurityError.isRequestBodySecurityError(errors[0])).toBe(true);
  });

  it('logs the unexpected error class when assertNoPollutingKeys throws non-AppError', async () => {
    const { rejectPollutedRequestBody } = await import('../../../middleware/requestBodySecurity.mjs');

    const poisonedBody = Object.defineProperty({}, 'bomb', {
      get() {
        throw new TypeError('Test getter explosion');
      },
      enumerable: true,
    });

    const mockReq = { body: poisonedBody };
    const mockRes = {};
    const mockNext = () => {};

    rejectPollutedRequestBody(mockReq, mockRes, mockNext);

    // Should log the unexpected error (same as verifyJsonBody pattern)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unexpected'),
      expect.objectContaining({ unexpected: true }),
    );
  });

  it('still passes clean bodies through', async () => {
    const { rejectPollutedRequestBody } = await import('../../../middleware/requestBodySecurity.mjs');

    const errors = [];
    let nextCalled = false;
    const mockReq = { body: { email: 'a@b.com', password: 'safe' } };
    const mockRes = {};
    const mockNext = err => {
      if (err) {
        errors.push(err);
      } else {
        nextCalled = true;
      }
    };

    rejectPollutedRequestBody(mockReq, mockRes, mockNext);

    expect(errors).toHaveLength(0);
    expect(nextCalled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Equoria-qj3f: __proto__ Unicode-escape bypass in JsonScanner dup-key detection
// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-qj3f: Unicode-escape dup-key bypass in JsonScanner', () => {
  it('rejects {"a":"x","\\u0061":"y"} — Unicode-escaped "a" must be seen as duplicate', async () => {
    // a decodes to "a" — same key as the literal "a".
    // Without decode: scanner adds raw 6-char 'a' to Set → no dup → passes.
    // With JSON.parse decode in scanString: scanner sees two "a" → 400.
    const body = '{"a":"x","\\u0061":"y"}';
    const res = await request(app)
      .post(JSON_ENDPOINT)
      .set('Content-Type', 'application/json')
      .set('Origin', 'http://localhost:3000')
      .send(body);

    expect(res.status).toBe(400);
  });

  it('rejects body where "__proto__" key is literal in JSON string', async () => {
    // JSON.stringify({ '__proto__': ... }) produces "{}" because JS object
    // literal __proto__ sets the prototype, not an own property. We must
    // send the raw bytes instead.
    // V8 JSON.parse treats "__proto__" as an own enumerable property on the
    // resulting object — assertNoPollutingKeys catches it and returns 400.
    const res = await request(app)
      .post(JSON_ENDPOINT)
      .set('Content-Type', 'application/json')
      .set('Origin', 'http://localhost:3000')
      .send('{"__proto__": {"isAdmin": true}}');

    // The pollution guard (assertNoPollutingKeys) must block this payload.
    expect(res.status).toBe(400);
  });

  // The headline AC: the raw Unicode-escape variant. JSON-source bytes are
  // `__proto__` (24 chars). After scanString decode they
  // collapse to `__proto__` (8 chars), and after JSON.parse the parsed object
  // exposes `__proto__` as an own property. Both defenses then have a chance:
  //
  //   Layer 1 (scanner duplicate-key): only triggers on duplicates. A
  //     standalone Unicode-escape `__proto__` key with no literal twin won't
  //     be caught here. That's expected — duplicate detection is duplicate
  //     detection, not pollution detection.
  //   Layer 2 (assertNoPollutingKeys): walks parsed-body own keys. V8's
  //     JSON.parse stores the decoded `__proto__` as an own enumerable
  //     property — Object.entries enumerates it, FORBIDDEN_KEY check fires,
  //     400 is returned.
  //
  // This test is the cross-layer sentinel: it confirms the end-to-end
  // bypass is closed. If a future Node.js change altered JSON.parse's
  // __proto__ handling (e.g., dropped to prototype-only), this test would
  // suddenly start receiving non-400 responses — at which point we'd add a
  // scanner-side check too. Today, V8 spec compliance carries the load.
  it('rejects raw Unicode-escape __proto__ payload {"\\u005f\\u005fproto\\u005f\\u005f":...}', async () => {
    const body = '{"\\u005f\\u005fproto\\u005f\\u005f":{"isAdmin":true}}';
    const res = await request(app)
      .post(JSON_ENDPOINT)
      .set('Content-Type', 'application/json')
      .set('Origin', 'http://localhost:3000')
      .send(body);

    expect(res.status).toBe(400);
  });

  // Pinned at the unit level too — even if the integration path changed,
  // we want a guarantee that the scanner's decoded form would feed the
  // duplicate-key detector correctly if a sibling literal key appeared.
  // This protects the layered defense if a future refactor introduces a
  // regression in scanString that the integration test happens to miss.
  it('scanner duplicate-key Set treats \\u005f\\u005fproto\\u005f\\u005f and __proto__ as duplicates', () => {
    const source = '{"__proto__":1,"\\u005f\\u005fproto\\u005f\\u005f":2}';
    expect(() => {
      const scanner = new __TESTING_ONLY_JsonScanner(source);
      scanner.scanValue(0);
    }).toThrow(RequestBodySecurityError);
  });

  // Adjacent variants — partial-escape forms an attacker would try if the
  // exact `__proto__` form were blocked but a regex-based
  // gate happened to look for that exact 24-char shape. The decode is total
  // (handled by JSON.parse), so any subset of escaped chars decodes to the
  // same `__proto__`. Pinning this prevents a future "we'll just regex-match
  // the 24-char form" shortcut.
  it('rejects partial-escape __\\u0070roto__ payload', async () => {
    // Only the `p` is escaped — decodes to `__proto__`.
    const body = '{"__\\u0070roto__":{"isAdmin":true}}';
    const res = await request(app)
      .post(JSON_ENDPOINT)
      .set('Content-Type', 'application/json')
      .set('Origin', 'http://localhost:3000')
      .send(body);

    expect(res.status).toBe(400);
  });

  it('rejects per-char-escape __\\u0070\\u0072\\u006f\\u0074\\u006f__ payload', async () => {
    // Every letter of "proto" escaped individually — decodes to `__proto__`.
    const body = '{"__\\u0070\\u0072\\u006f\\u0074\\u006f__":{"isAdmin":true}}';
    const res = await request(app)
      .post(JSON_ENDPOINT)
      .set('Content-Type', 'application/json')
      .set('Origin', 'http://localhost:3000')
      .send(body);

    expect(res.status).toBe(400);
  });

  it('rejects mixed-case-hex escape \\u005F\\u005Fproto\\u005F\\u005F payload', async () => {
    // Uppercase hex digits — JSON spec accepts both cases.
    const body = '{"\\u005F\\u005Fproto\\u005F\\u005F":{"isAdmin":true}}';
    const res = await request(app)
      .post(JSON_ENDPOINT)
      .set('Content-Type', 'application/json')
      .set('Origin', 'http://localhost:3000')
      .send(body);

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Equoria-ifxg: 21R-SEC-7 — Scanner detects truncated string and throws
// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-ifxg: scanString() throws on truncated JSON payload', () => {
  it('returns 400 with malformed JSON message when body is a truncated string (no closing quote)', async () => {
    expect.assertions(2);
    const truncatedPayload = '{"name":"unclo'; // no closing quote or brace
    const res = await request(app)
      .post(JSON_ENDPOINT)
      .set('Content-Type', 'application/json')
      .set('Origin', 'http://localhost:3000')
      .send(truncatedPayload);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/malformed json/i);
  });

  it('returns 400 with malformed JSON message when body is only an open quote', async () => {
    expect.assertions(2);
    const res = await request(app)
      .post(JSON_ENDPOINT)
      .set('Content-Type', 'application/json')
      .set('Origin', 'http://localhost:3000')
      .send('"unclosed');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/malformed json/i);
  });

  it('scanner unit: scanString() throws RequestBodySecurityError on unterminated string', () => {
    expect.assertions(1);
    const scanner = new __TESTING_ONLY_JsonScanner('{"key":"unterminated');
    // advance past `{` and the key
    expect(() => scanner.scanValue(0)).toThrow(RequestBodySecurityError);
  });
});
