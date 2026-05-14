/**
 * validatePing — middleware unit tests (Equoria-rr7)
 *
 * Tests the express-validator chain exported from
 * backend/middleware/validatePing.mjs.
 *
 * The chain accepts an optional `name` query parameter that must be:
 *   - a string
 *   - trimmed length 2-30
 *   - matching /^[a-zA-Z0-9\s]+$/ (letters, numbers, spaces only)
 *
 * Pattern: run real express-validator chain via `chain.run(req)` then call
 * handleValidationErrors directly. No supertest, no mocks, no DB needed.
 */

import { describe, it, expect } from '@jest/globals';
import { validationResult } from 'express-validator';
import { validatePing } from '../../../middleware/validatePing.mjs';

// ---------------------------------------------------------------------------
// Harness helpers
// ---------------------------------------------------------------------------

function makeReq({ query = {} } = {}) {
  return {
    body: {},
    params: {},
    query,
    headers: {},
    originalUrl: '/ping',
    method: 'GET',
    ip: '127.0.0.1',
    get(name) {
      return this.headers[name?.toLowerCase()] ?? '';
    },
  };
}

async function runChain(chain, req) {
  const validators = chain.slice(0, -1);
  const handler = chain[chain.length - 1];

  for (const v of validators) {
    if (v && typeof v.run === 'function') {
      await v.run(req);
    }
  }

  const errors = validationResult(req);
  let nextCalled = false;
  let statusCode;
  let jsonBody;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      jsonBody = body;
      return this;
    },
  };

  handler(req, res, () => {
    nextCalled = true;
  });

  return { errors, nextCalled, statusCode, jsonBody };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validatePing middleware', () => {
  it('exports an array (express-validator chain + handler)', () => {
    expect(Array.isArray(validatePing)).toBe(true);
    expect(validatePing.length).toBeGreaterThanOrEqual(2);
  });

  it('passes when no name query is provided (optional field)', async () => {
    const req = makeReq({ query: {} });
    const { nextCalled, statusCode, errors } = await runChain(validatePing, req);
    expect(errors.isEmpty()).toBe(true);
    expect(nextCalled).toBe(true);
    expect(statusCode).toBeUndefined();
  });

  it('passes when name is valid (alphanumeric)', async () => {
    const req = makeReq({ query: { name: 'Alice' } });
    const { nextCalled, errors } = await runChain(validatePing, req);
    expect(errors.isEmpty()).toBe(true);
    expect(nextCalled).toBe(true);
  });

  it('passes when name contains numbers and spaces', async () => {
    const req = makeReq({ query: { name: 'Bob 123' } });
    const { nextCalled, errors } = await runChain(validatePing, req);
    expect(errors.isEmpty()).toBe(true);
    expect(nextCalled).toBe(true);
  });

  it('passes at boundary length 2', async () => {
    const req = makeReq({ query: { name: 'Al' } });
    const { nextCalled, errors } = await runChain(validatePing, req);
    expect(errors.isEmpty()).toBe(true);
    expect(nextCalled).toBe(true);
  });

  it('passes at boundary length 30', async () => {
    const req = makeReq({ query: { name: 'A'.repeat(30) } });
    const { nextCalled, errors } = await runChain(validatePing, req);
    expect(errors.isEmpty()).toBe(true);
    expect(nextCalled).toBe(true);
  });

  it('fails when name is too short (1 char)', async () => {
    const req = makeReq({ query: { name: 'A' } });
    const { nextCalled, statusCode, jsonBody, errors } = await runChain(validatePing, req);
    expect(errors.isEmpty()).toBe(false);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
    expect(jsonBody).toMatchObject({ success: false });
  });

  it('fails when name is too long (31 chars)', async () => {
    const req = makeReq({ query: { name: 'A'.repeat(31) } });
    const { nextCalled, statusCode, errors } = await runChain(validatePing, req);
    expect(errors.isEmpty()).toBe(false);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('fails when name contains illegal characters', async () => {
    const req = makeReq({ query: { name: 'Alice<script>' } });
    const { nextCalled, statusCode, jsonBody, errors } = await runChain(validatePing, req);
    expect(errors.isEmpty()).toBe(false);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
    expect(jsonBody.message).toMatch(/letters, numbers, and spaces/i);
  });

  it('fails when name contains punctuation', async () => {
    const req = makeReq({ query: { name: 'Alice!' } });
    const { nextCalled, errors } = await runChain(validatePing, req);
    expect(errors.isEmpty()).toBe(false);
    expect(nextCalled).toBe(false);
  });

  it('trims whitespace before length validation', async () => {
    // "  AB  " (length 6 with spaces, 2 trimmed) should pass
    const req = makeReq({ query: { name: '  AB  ' } });
    const { nextCalled, errors } = await runChain(validatePing, req);
    expect(errors.isEmpty()).toBe(true);
    expect(nextCalled).toBe(true);
  });
});
