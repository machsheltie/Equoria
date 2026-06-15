/**
 * Validation-detail exposure policy — sentinel coverage (Equoria-hga9h).
 *
 * Proves the EXPLICIT EXPOSE_VALIDATION_DETAILS flag controls whether
 * handleValidationErrors echoes the full express-validator error array
 * (field paths, attempted values, validator metadata — CWE-209) INDEPENDENT
 * of NODE_ENV, and that the default is CLOSED for deployable envs
 * (production / beta / staging / unknown) while staying verbose for the
 * non-deployable local envs (development / test).
 *
 * Two layers:
 *   1. Pure-resolver unit tests — NODE_ENV held constant via an explicit
 *      argument (the whole point: the boundary must be controllable by a flag,
 *      not an implicit NODE_ENV read).
 *   2. A handler integration test that drives a REAL express-validator chain
 *      and asserts the CLOSED branch narrows `errors` to `[{ message }]` when
 *      EXPOSE_VALIDATION_DETAILS=false — proving the resolver is actually wired
 *      into the response, not just exported. Env mutation is scoped + restored.
 */
import { describe, it, expect, afterEach } from '@jest/globals';
import { body } from 'express-validator';
import { resolveExposeValidationDetails } from '../utils/validationDetailPolicy.mjs';
import { handleValidationErrors } from '../middleware/validationErrorHandler.mjs';

describe('resolveExposeValidationDetails — explicit flag controls behavior independent of NODE_ENV', () => {
  it('EXPOSE_VALIDATION_DETAILS=false forces CLOSED even in development/test (verbose-by-default envs)', () => {
    // Core sentinel direction A: an operator can suppress detail anywhere.
    expect(resolveExposeValidationDetails({ nodeEnv: 'development', exposeValidationDetailsEnv: 'false' })).toBe(false);
    expect(resolveExposeValidationDetails({ nodeEnv: 'test', exposeValidationDetailsEnv: 'false' })).toBe(false);
  });

  it('EXPOSE_VALIDATION_DETAILS=true forces OPEN even in production (closed-by-default env)', () => {
    // Core sentinel direction B: the flag is authoritative in both directions.
    expect(resolveExposeValidationDetails({ nodeEnv: 'production', exposeValidationDetailsEnv: 'true' })).toBe(true);
    expect(resolveExposeValidationDetails({ nodeEnv: 'beta', exposeValidationDetailsEnv: 'true' })).toBe(true);
  });

  it('is case-insensitive and trims whitespace on the flag', () => {
    expect(resolveExposeValidationDetails({ nodeEnv: 'production', exposeValidationDetailsEnv: '  TRUE ' })).toBe(true);
    expect(resolveExposeValidationDetails({ nodeEnv: 'test', exposeValidationDetailsEnv: 'False' })).toBe(false);
  });

  describe('default (flag unset) — CLOSED for deployable envs, verbose only for dev/test', () => {
    it('production / beta / staging / unknown / undefined default CLOSED (the leak fix)', () => {
      expect(resolveExposeValidationDetails({ nodeEnv: 'production' })).toBe(false);
      // beta is the regression this issue fixes: it used to leak (NODE_ENV !== production).
      expect(resolveExposeValidationDetails({ nodeEnv: 'beta' })).toBe(false);
      expect(resolveExposeValidationDetails({ nodeEnv: 'staging' })).toBe(false);
      expect(resolveExposeValidationDetails({ nodeEnv: 'whatever-typo' })).toBe(false);
      expect(resolveExposeValidationDetails({ nodeEnv: undefined })).toBe(false);
      expect(resolveExposeValidationDetails({})).toBe(false);
    });

    it('development / test default verbose (debugging + backend jest assertions rely on it)', () => {
      expect(resolveExposeValidationDetails({ nodeEnv: 'development' })).toBe(true);
      expect(resolveExposeValidationDetails({ nodeEnv: 'test' })).toBe(true);
    });

    it('a garbage flag value falls back to the NODE_ENV default (not silently honored)', () => {
      // 'yes' is neither 'true' nor 'false' → fall through to the default.
      expect(resolveExposeValidationDetails({ nodeEnv: 'beta', exposeValidationDetailsEnv: 'yes' })).toBe(false);
      expect(resolveExposeValidationDetails({ nodeEnv: 'test', exposeValidationDetailsEnv: 'maybe' })).toBe(true);
    });
  });
});

describe('handleValidationErrors — EXPOSE_VALIDATION_DETAILS=false narrows the response (wiring proof)', () => {
  const prev = process.env.EXPOSE_VALIDATION_DETAILS;
  afterEach(() => {
    if (prev === undefined) {
      delete process.env.EXPOSE_VALIDATION_DETAILS;
    } else {
      process.env.EXPOSE_VALIDATION_DETAILS = prev;
    }
  });

  function makeHarness(req = {}) {
    let statusValue;
    let jsonValue;
    const baseReq = {
      body: {},
      query: {},
      params: {},
      headers: {},
      originalUrl: '/test',
      method: 'POST',
      ip: '127.0.0.1',
      get(name) {
        return this.headers[name?.toLowerCase()];
      },
      ...req,
    };
    return {
      req: baseReq,
      res: {
        status(code) {
          statusValue = code;
          return this;
        },
        json(b) {
          jsonValue = b;
          return this;
        },
        get statusValue() {
          return statusValue;
        },
        get jsonValue() {
          return jsonValue;
        },
      },
      next() {},
    };
  }

  it('returns only [{ message }] (no field path / value) when the flag is false, even under NODE_ENV=test', async () => {
    // NODE_ENV is 'test' in the jest suite (which would normally be verbose);
    // the explicit flag must override that and CLOSE the detail.
    process.env.EXPOSE_VALIDATION_DETAILS = 'false';

    const h = makeHarness({ body: { email: 'not-an-email' } });
    await body('email').isEmail().withMessage('Email is required').run(h.req);

    handleValidationErrors(h.req, h.res, h.next);

    expect(h.res.statusValue).toBe(400);
    expect(h.res.jsonValue.message).toBe('Email is required');
    expect(h.res.jsonValue.errors).toEqual([{ message: 'Email is required' }]);
    // The leak surface must be gone: no validator-internal keys echoed back.
    expect(h.res.jsonValue.errors[0]).not.toHaveProperty('path');
    expect(h.res.jsonValue.errors[0]).not.toHaveProperty('value');
  });

  it('returns the verbose array (with path) when the flag is true', async () => {
    process.env.EXPOSE_VALIDATION_DETAILS = 'true';

    const h = makeHarness({ body: { email: 'not-an-email' } });
    await body('email').isEmail().withMessage('Email is required').run(h.req);

    handleValidationErrors(h.req, h.res, h.next);

    expect(h.res.statusValue).toBe(400);
    expect(h.res.jsonValue.errors.length).toBeGreaterThan(0);
    expect(h.res.jsonValue.errors[0]).toHaveProperty('path');
  });
});
