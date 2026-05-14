/**
 * validateHorse — middleware unit tests (Equoria-rr7)
 *
 * Tests the three express-validator chains exported from
 * backend/middleware/validateHorse.mjs:
 *   - validateCreateHorse  (required + optional body fields)
 *   - validateUpdateHorse  (param :id validation)
 *   - validateGetHorseById (param :id validation)
 *
 * Pattern: run real express-validator chains via `chain.run(req)` then call
 * handleValidationErrors() directly.  No supertest, no mocks, no DB needed.
 *
 * HORSE_SEX_VALUES = ['Stallion', 'Mare', 'Colt', 'Filly', 'Rig']
 */

import { describe, it, expect } from '@jest/globals';
import { validationResult } from 'express-validator';
import { validateCreateHorse, validateUpdateHorse, validateGetHorseById } from '../../../middleware/validateHorse.mjs';

// ---------------------------------------------------------------------------
// Harness helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Express-shaped req object.
 */
function makeReq({ body = {}, params = {}, query = {} } = {}) {
  return {
    body,
    params,
    query,
    headers: {},
    originalUrl: '/test',
    method: 'POST',
    ip: '127.0.0.1',
    get(name) {
      return this.headers[name?.toLowerCase()] ?? '';
    },
  };
}

/**
 * Run every middleware in the chain (all are express-validator ValidationChain
 * instances except the last, which is handleValidationErrors).
 *
 * Returns `{ errors, nextCalled, statusCode, jsonBody }`.
 */
async function runChain(chain, req) {
  // Run all validator items that expose `.run()` (express-validator chains).
  // The last item is handleValidationErrors (plain middleware function).
  const validators = chain.slice(0, -1);
  const handler = chain[chain.length - 1];

  for (const validator of validators) {
    // The validateCreateHorse chain uses .forEach() inside an array literal
    // which inserts `undefined` for those stat validators (forEach returns undefined).
    // Skip nullish items and non-runnable items safely.
    if (validator != null && typeof validator.run === 'function') {
      await validator.run(req);
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
// Minimal valid body for validateCreateHorse
// ---------------------------------------------------------------------------
const VALID_BODY = {
  name: 'TestFixture-Stallion',
  sex: 'Stallion',
  date_of_birth: '2018-05-01',
  breed_id: 1,
  owner_id: 1,
  stable_id: 1,
};

// ---------------------------------------------------------------------------
// validateCreateHorse
// ---------------------------------------------------------------------------
describe('validateCreateHorse', () => {
  // Required fields — happy path
  it('passes with a minimal valid body', async () => {
    const req = makeReq({ body: { ...VALID_BODY } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(true);
    expect(statusCode).toBeUndefined();
  });

  // name field
  it('rejects missing name', async () => {
    const req = makeReq({ body: { ...VALID_BODY, name: undefined } });
    const { nextCalled, statusCode, jsonBody } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
    expect(jsonBody.success).toBe(false);
    expect(jsonBody.message).toMatch(/name/i);
  });

  it('rejects name that is too short (< 2 chars)', async () => {
    const req = makeReq({ body: { ...VALID_BODY, name: 'X' } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('rejects name that is too long (> 100 chars)', async () => {
    const req = makeReq({ body: { ...VALID_BODY, name: 'A'.repeat(101) } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  // sex field
  it('rejects missing sex', async () => {
    const req = makeReq({ body: { ...VALID_BODY, sex: undefined } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('rejects invalid sex value', async () => {
    const req = makeReq({ body: { ...VALID_BODY, sex: 'Gelding' } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('accepts all valid HORSE_SEX_VALUES', async () => {
    const validSexValues = ['Stallion', 'Mare', 'Colt', 'Filly', 'Rig'];
    for (const sex of validSexValues) {
      const req = makeReq({ body: { ...VALID_BODY, sex } });
      const { nextCalled } = await runChain(validateCreateHorse, req);
      expect(nextCalled).toBe(true);
    }
  });

  // date_of_birth field
  it('rejects missing date_of_birth', async () => {
    const req = makeReq({ body: { ...VALID_BODY, date_of_birth: undefined } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('rejects non-ISO8601 date_of_birth', async () => {
    const req = makeReq({ body: { ...VALID_BODY, date_of_birth: 'not-a-date' } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  // breed_id, owner_id, stable_id
  it('rejects missing breed_id', async () => {
    const req = makeReq({ body: { ...VALID_BODY, breed_id: undefined } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('rejects breed_id = 0 (must be positive integer)', async () => {
    const req = makeReq({ body: { ...VALID_BODY, breed_id: 0 } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('rejects missing owner_id', async () => {
    const req = makeReq({ body: { ...VALID_BODY, owner_id: undefined } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('rejects missing stable_id', async () => {
    const req = makeReq({ body: { ...VALID_BODY, stable_id: undefined } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  // Optional fields
  it('accepts valid optional genotype object', async () => {
    const req = makeReq({ body: { ...VALID_BODY, genotype: { E: 'Ee', A: 'AA' } } });
    const { nextCalled } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(true);
  });

  it('rejects non-object genotype', async () => {
    const req = makeReq({ body: { ...VALID_BODY, genotype: 'not-an-object' } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('accepts valid optional final_display_color', async () => {
    const req = makeReq({ body: { ...VALID_BODY, final_display_color: 'Bay Roan' } });
    const { nextCalled } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(true);
  });

  it('rejects final_display_color that is too short (< 2 chars)', async () => {
    const req = makeReq({ body: { ...VALID_BODY, final_display_color: 'X' } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('accepts valid optional stud_status', async () => {
    const req = makeReq({ body: { ...VALID_BODY, stud_status: 'Public Stud' } });
    const { nextCalled } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(true);
  });

  it('rejects invalid stud_status value', async () => {
    const req = makeReq({ body: { ...VALID_BODY, stud_status: 'Available' } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  // Note: The stat validators (precision, strength, speed, etc.) in validateCreateHorse
  // are added via .forEach() which inserts undefined into the chain array and discards
  // the actual ValidationChain objects. Stat validation does not fire through this
  // chain — this is a pre-existing issue in the source file.
  it('accepts extra stat fields without rejection (stat chains not attached)', async () => {
    // speed: 50 is passed — no rejection since stat validators were not attached
    const req = makeReq({ body: { ...VALID_BODY, speed: 50 } });
    const { nextCalled } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(true);
  });

  it('rejects non-boolean for_sale value', async () => {
    const req = makeReq({ body: { ...VALID_BODY, for_sale: 'yes' } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('accepts boolean for_sale = true', async () => {
    const req = makeReq({ body: { ...VALID_BODY, for_sale: true } });
    const { nextCalled } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(true);
  });

  it('rejects negative total_earnings', async () => {
    const req = makeReq({ body: { ...VALID_BODY, total_earnings: -10 } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('rejects invalid image_url', async () => {
    const req = makeReq({ body: { ...VALID_BODY, image_url: 'not-a-url' } });
    const { nextCalled, statusCode } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('accepts valid image_url', async () => {
    const req = makeReq({ body: { ...VALID_BODY, image_url: 'https://example.com/horse.jpg' } });
    const { nextCalled } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(true);
  });

  it('returns 400 with success=false and message on validation failure', async () => {
    const req = makeReq({ body: {} }); // all required fields missing
    const { nextCalled, statusCode, jsonBody } = await runChain(validateCreateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
    expect(jsonBody).toMatchObject({ success: false, message: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// validateUpdateHorse
// ---------------------------------------------------------------------------
describe('validateUpdateHorse', () => {
  it('passes for valid integer param id', async () => {
    const req = makeReq({ params: { id: '5' } });
    const { nextCalled, statusCode } = await runChain(validateUpdateHorse, req);
    expect(nextCalled).toBe(true);
    expect(statusCode).toBeUndefined();
  });

  it('rejects non-integer param id', async () => {
    const req = makeReq({ params: { id: 'abc' } });
    const { nextCalled, statusCode, jsonBody } = await runChain(validateUpdateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
    expect(jsonBody.success).toBe(false);
  });

  it('rejects param id = 0 (must be positive)', async () => {
    const req = makeReq({ params: { id: '0' } });
    const { nextCalled, statusCode } = await runChain(validateUpdateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('rejects negative param id', async () => {
    const req = makeReq({ params: { id: '-1' } });
    const { nextCalled, statusCode } = await runChain(validateUpdateHorse, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// validateGetHorseById
// ---------------------------------------------------------------------------
describe('validateGetHorseById', () => {
  it('passes for valid integer param id', async () => {
    const req = makeReq({ params: { id: '42' } });
    const { nextCalled, statusCode } = await runChain(validateGetHorseById, req);
    expect(nextCalled).toBe(true);
    expect(statusCode).toBeUndefined();
  });

  it('rejects non-integer param id', async () => {
    const req = makeReq({ params: { id: 'horse' } });
    const { nextCalled, statusCode, jsonBody } = await runChain(validateGetHorseById, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
    expect(jsonBody.success).toBe(false);
    expect(jsonBody.message).toMatch(/positive integer/i);
  });

  it('rejects param id = 0', async () => {
    const req = makeReq({ params: { id: '0' } });
    const { nextCalled, statusCode } = await runChain(validateGetHorseById, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('rejects missing param id', async () => {
    const req = makeReq({ params: {} });
    const { nextCalled, statusCode } = await runChain(validateGetHorseById, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('rejects floating-point param id', async () => {
    const req = makeReq({ params: { id: '1.5' } });
    const { nextCalled, statusCode } = await runChain(validateGetHorseById, req);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
  });

  it('accepts large valid id', async () => {
    const req = makeReq({ params: { id: '99999' } });
    const { nextCalled } = await runChain(validateGetHorseById, req);
    expect(nextCalled).toBe(true);
  });
});
