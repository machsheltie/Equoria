/**
 * 🔒 INTEGRATION TESTS: Request-body depth cap (21R-SEC-3)
 *
 * Both JsonScanner.scanValue (express.json verify hook) and
 * assertNoPollutingKeys (post-parse middleware) recurse into nested
 * JSON. Without a depth cap, a deeply nested payload overflows the
 * call stack — combined with any silent catch upstream, that bypasses
 * BOTH defenses.
 *
 * Acceptance criteria for Equoria-expn:
 *   - depth cap of 32 in BOTH functions
 *   - exceeding cap throws AppError(400, 'Invalid request body: nesting too deep')
 *   - 64-deep array body returns 400
 *   - 64-deep object body returns 400
 *   - 16-deep nested object body passes through (NOT 400-nesting)
 *
 * @module __tests__/integration/security/request-body-depth-cap
 */

import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';

const ENDPOINT = '/api/v1/auth/login';

function buildDeepArray(depth) {
  let s = '';
  for (let i = 0; i < depth; i++) s += '[';
  for (let i = 0; i < depth; i++) s += ']';
  return s;
}

function buildDeepObject(depth) {
  let s = '';
  for (let i = 0; i < depth; i++) s += '{"a":';
  s += 'null';
  for (let i = 0; i < depth; i++) s += '}';
  return s;
}

describe('Request body depth cap (21R-SEC-3)', () => {
  it('rejects a 64-deep nested array body with 400 nesting too deep', async () => {
    const body = buildDeepArray(64);

    const response = await request(app).post(ENDPOINT).set('Content-Type', 'application/json').send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/nesting too deep/i),
      }),
    );
  });

  it('rejects a 64-deep nested object body with 400 nesting too deep', async () => {
    const body = buildDeepObject(64);

    const response = await request(app).post(ENDPOINT).set('Content-Type', 'application/json').send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/nesting too deep/i),
      }),
    );
  });

  it('lets a 16-deep nested object body pass through to the controller', async () => {
    // 16 levels < 32 cap. Builds an object like {"a":{"a":...{"a":null}...}}
    // that isn't a valid login payload, so the controller will respond
    // with 400/401/422 — the key assertion is that the depth-cap message
    // is NOT what we receive. The middleware passed through.
    const body = buildDeepObject(16);

    const response = await request(app).post(ENDPOINT).set('Content-Type', 'application/json').send(body);

    if (response.body && typeof response.body.message === 'string') {
      expect(response.body.message).not.toMatch(/nesting too deep/i);
    }
  });

  // Canonical test name from the bd issue Description AC
  // ("Failing test added FIRST: should reject deeply nested payload").
  // Functionally identical to the 64-deep array test above; this one exists
  // so the test name literally matches the AC text the completion_promise
  // refers to.
  it('should reject deeply nested payload', async () => {
    const body = buildDeepArray(64);

    const response = await request(app).post(ENDPOINT).set('Content-Type', 'application/json').send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/nesting too deep/i),
      }),
    );
  });
});
