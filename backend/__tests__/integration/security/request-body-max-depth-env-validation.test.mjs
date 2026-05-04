/**
 * 🔒 UNIT TEST: REQUEST_BODY_MAX_DEPTH env-var validation
 *
 * 21R-SEC-3-REVIEW-1 (Equoria-h50v): the original parse path was
 *   const MAX_DEPTH = Number.parseInt(process.env.REQUEST_BODY_MAX_DEPTH ?? '32', 10);
 * which silently produces NaN for any non-numeric env value (`invalid`,
 * `abc`, empty string, `NaN`, ...). Every `if (depth > MAX_DEPTH)` check
 * against NaN evaluates false, so the entire depth-cap defense regresses
 * to pre-fix state on a single bad env var. This is the opposite of
 * fail-closed and contradicts the 21R doctrine.
 *
 * This test sets a hostile env value, dynamic-imports the middleware
 * (jest.resetModules forces a fresh evaluation so the module-load-time
 * MAX_DEPTH parse runs again), then synchronously calls verifyJsonBody
 * and asserts on the boundary effect.
 *
 * Sentinel-strength: the TRUE_BYPASS_VALUES list contains only env
 * strings that produce NaN under the original parseInt (cap fully
 * disabled pre-fix). The COINCIDENTALLY_HARDENED_VALUES list contains
 * env strings that the original parseInt clamped to a small finite
 * number; we additionally use jest.spyOn(realLogger, 'error') to
 * observe the real logger's call args, proving the validator's
 * rejection branch fired with the offending value (only the rejection
 * path logs that shape).
 *
 * NO MOCKS. Rewritten 2026-04-30 (Equoria-p6fx, no-mocks doctrine
 * epic) from a jest.unstable_mockModule-of-logger pattern to a
 * jest.spyOn-on-real-logger-instance pattern. The real logger module
 * is imported normally and its `error` method is spied on without
 * being replaced — `jest.spyOn` without `.mockImplementation()`
 * preserves the real implementation while recording call args. The
 * production path is exercised end-to-end (real winston transport
 * fires) AND the test observes the rejection branch's call shape.
 *
 * @module __tests__/integration/security/request-body-max-depth-env-validation
 */

import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

// Module path used for dynamic import — resolves relative to THIS file.
const MIDDLEWARE_PATH = '../../../middleware/requestBodySecurity.mjs';
const LOGGER_PATH = '../../../utils/logger.mjs';

function buildDeepArrayBuffer(depth) {
  let s = '';
  for (let i = 0; i < depth; i++) {
    s += '[';
  }
  for (let i = 0; i < depth; i++) {
    s += ']';
  }
  return Buffer.from(s, 'utf8');
}

function makeReq() {
  return { headers: { 'content-type': 'application/json' } };
}

describe('REQUEST_BODY_MAX_DEPTH env-var validation (21R-SEC-3-REVIEW-1)', () => {
  // Capture ORIGINAL inside beforeAll so the snapshot is taken AFTER any
  // earlier suite in the same Jest worker has run its afterAll/afterEach
  // restore hooks (Edge Case Hunter F9 / REVIEW-1 review-feedback-4).
  let ORIGINAL;

  beforeAll(() => {
    ORIGINAL = Object.prototype.hasOwnProperty.call(process.env, 'REQUEST_BODY_MAX_DEPTH')
      ? process.env.REQUEST_BODY_MAX_DEPTH
      : null;
  });

  afterEach(() => {
    if (ORIGINAL === null) {
      delete process.env.REQUEST_BODY_MAX_DEPTH;
    } else {
      process.env.REQUEST_BODY_MAX_DEPTH = ORIGINAL;
    }
    jest.resetModules();
    jest.restoreAllMocks();
  });

  // Pre-fix: each value parses to NaN. `if (depth > NaN)` is always
  // false, so the depth cap is fully disabled. These tests fail RED
  // before the fix and PASS GREEN after. This is the genuine sentinel
  // set for the original defect.
  const TRUE_BYPASS_VALUES = ['invalid', '', '   ', 'NaN', 'abc123', 'Infinity', '-Infinity'];

  for (const bad of TRUE_BYPASS_VALUES) {
    it(`true-bypass: rejects 64-deep when REQUEST_BODY_MAX_DEPTH=${JSON.stringify(bad)} (NaN pre-fix)`, async () => {
      process.env.REQUEST_BODY_MAX_DEPTH = bad;
      jest.resetModules();

      const { verifyJsonBody } = await import(MIDDLEWARE_PATH);
      const buffer = buildDeepArrayBuffer(64);

      let thrown = null;
      try {
        verifyJsonBody(makeReq(), {}, buffer);
      } catch (e) {
        thrown = e;
      }

      expect(thrown).not.toBeNull();
      expect(thrown?.message).toMatch(/nesting too deep/i);
      expect(thrown?.statusCode ?? thrown?.status).toBe(400);
    });
  }

  // Pre-fix these values produced a small finite number from parseInt
  // (e.g. parseInt('3.14') = 3, parseInt('-5') = -5, parseInt('32abc') = 32).
  // The 64-deep payload would have been rejected pre-fix anyway because
  // 64 > whatever-small-number, so a "throws on 64-deep" assertion alone
  // would silently pass with or without the fix — a sentinel placebo.
  // Iteration-3: use jest.unstable_mockModule so the middleware's
  // `import logger from ...` resolves to the mock by construction.
  // The mock's error fn captures every logger.error invocation; the
  // assertion proves the validator's rejection branch fired with the
  // offending value (only the rejection path logs that shape).
  const COINCIDENTALLY_HARDENED_VALUES = ['0', '-5', '-1', '32abc', '0x20', '3.14'];

  for (const bad of COINCIDENTALLY_HARDENED_VALUES) {
    it(`hardened: validator rejection branch fires when REQUEST_BODY_MAX_DEPTH=${JSON.stringify(bad)} (real logger spied for call args)`, async () => {
      process.env.REQUEST_BODY_MAX_DEPTH = bad;
      jest.resetModules();

      // Import the real logger module FIRST, then spy on its `error`
      // method. jest.spyOn (without .mockImplementation) preserves the
      // real winston transport — production code path fires end-to-end
      // — while recording the call args for assertion. This is NOT
      // module mocking; the logger module is the real one. (Per
      // Equoria-p6fx no-mocks doctrine; jest.spyOn-on-real-instance
      // is permitted as observation, not replacement.)
      const loggerMod = await import(LOGGER_PATH);
      const realLogger = loggerMod.default ?? loggerMod;
      const errorSpy = jest.spyOn(realLogger, 'error');

      const { verifyJsonBody } = await import(MIDDLEWARE_PATH);

      // The validator's rejection branch logs with the offending raw
      // value in `provided`. Either log shape (regex-fail or
      // parse-fail) is acceptable — both prove rejection ran.
      const matched = errorSpy.mock.calls.some(call => {
        const [msg, ctx] = call;
        return typeof msg === 'string' && msg.includes('REQUEST_BODY_MAX_DEPTH') && ctx && ctx.provided === bad;
      });
      expect(matched).toBe(true);

      const buffer = buildDeepArrayBuffer(64);
      expect(() => verifyJsonBody(makeReq(), {}, buffer)).toThrow(/nesting too deep/i);
    });
  }

  // 21R-SEC-3-REVIEW-1 iteration-2 sentinel: very large numeric strings
  // pass /^[1-9]\d*$/ and parseInt to integer-valued floats. Pre-iter-2
  // the validator returned them directly and the cap was effectively
  // disabled. Iteration-3 hardening: we don't just assert 64-deep
  // throws — we bracket the boundary at DEFAULT_MAX_DEPTH so the test
  // proves fallback is exactly the default (not just <64). Builder
  // semantics: builder(N) → max scanValue depth = N-1. With
  // DEFAULT_MAX_DEPTH=32 the boundary is builder(33) accepts /
  // builder(34) rejects. This pins fallback to exactly 32; a wrong
  // fallback (e.g. 200) would break exactly one of the two assertions.
  const UPPER_BOUND_BYPASS_VALUES = [
    '999999999999999999999999', // ~1e24, well above MAX_SAFE_INTEGER
    '1000000000000000', // 1e15, below MAX_SAFE_INTEGER but absurdly large
    '10000', // 1e4, sane integer but above any defensible operator setting
  ];

  for (const big of UPPER_BOUND_BYPASS_VALUES) {
    it(`upper-bound: REQUEST_BODY_MAX_DEPTH=${JSON.stringify(big)} falls back to exactly DEFAULT_MAX_DEPTH (boundary bracketed)`, async () => {
      process.env.REQUEST_BODY_MAX_DEPTH = big;
      jest.resetModules();

      const { verifyJsonBody } = await import(MIDDLEWARE_PATH);

      // builder(33) → max scanValue depth 32 → 32 > 32 false → accepted
      expect(() => verifyJsonBody(makeReq(), {}, buildDeepArrayBuffer(33))).not.toThrow();
      // builder(34) → max scanValue depth 33 → 33 > 32 true → rejected
      expect(() => verifyJsonBody(makeReq(), {}, buildDeepArrayBuffer(34))).toThrow(/nesting too deep/i);
    });
  }

  // Iteration-3 sentinel: env value within the OLD ceiling (1024) but
  // ABOVE the tightened ceiling (256). Pre-iteration-3 this value was
  // accepted as-is (cap silently became 300 — a 9.4× expansion of the
  // attack surface). Post-iteration-3 it falls back to default 32. The
  // bracketing pins fallback to exactly DEFAULT_MAX_DEPTH; a regression
  // that loosened MAX_ALLOWED_OVERRIDE back to a value ≥300 would
  // break this test. (Blind Hunter F3 / Edge Case Hunter F3.)
  it("tightened-ceiling: REQUEST_BODY_MAX_DEPTH='300' (between old/new ceiling) falls back to default", async () => {
    process.env.REQUEST_BODY_MAX_DEPTH = '300';
    jest.resetModules();

    const { verifyJsonBody } = await import(MIDDLEWARE_PATH);

    // Bracketed at default boundary — proves fallback is exactly 32, not 300.
    expect(() => verifyJsonBody(makeReq(), {}, buildDeepArrayBuffer(33))).not.toThrow();
    expect(() => verifyJsonBody(makeReq(), {}, buildDeepArrayBuffer(34))).toThrow(/nesting too deep/i);
  });

  // Iteration-3 boundary test for MAX_ALLOWED_OVERRIDE itself. Pins the
  // ceiling: env = str(MAX_ALLOWED_OVERRIDE) accepted (cap = override),
  // env = str(MAX_ALLOWED_OVERRIDE+1) rejected (falls back). A regression
  // that flipped `>` to `>=` (or shifted the constant by 1) would break
  // exactly one assertion. (Blind Hunter F7.)
  //
  // We import the constant from the middleware module so the test
  // tracks the source of truth; a config change that legitimately moves
  // the ceiling won't require a test edit beyond the import.
  it('ceiling: env=str(MAX_ALLOWED_OVERRIDE) accepts; env=str(MAX_ALLOWED_OVERRIDE+1) falls back to default', async () => {
    jest.resetModules();
    const { MAX_ALLOWED_OVERRIDE } = await import(MIDDLEWARE_PATH);
    expect(typeof MAX_ALLOWED_OVERRIDE).toBe('number');
    expect(MAX_ALLOWED_OVERRIDE).toBeGreaterThan(0);

    // env at exactly the ceiling: accepted, cap = override.
    // builder(MAX_ALLOWED_OVERRIDE + 1) → max scanValue depth =
    // MAX_ALLOWED_OVERRIDE → not > MAX_ALLOWED_OVERRIDE → accepted.
    process.env.REQUEST_BODY_MAX_DEPTH = String(MAX_ALLOWED_OVERRIDE);
    jest.resetModules();
    {
      const { verifyJsonBody } = await import(MIDDLEWARE_PATH);
      expect(() => verifyJsonBody(makeReq(), {}, buildDeepArrayBuffer(MAX_ALLOWED_OVERRIDE + 1))).not.toThrow();
      expect(() => verifyJsonBody(makeReq(), {}, buildDeepArrayBuffer(MAX_ALLOWED_OVERRIDE + 2))).toThrow(
        /nesting too deep/i,
      );
    }

    // env one above ceiling: falls back to DEFAULT_MAX_DEPTH (32).
    // Bracketed at default boundary to prove fallback is exactly default.
    process.env.REQUEST_BODY_MAX_DEPTH = String(MAX_ALLOWED_OVERRIDE + 1);
    jest.resetModules();
    {
      const { verifyJsonBody } = await import(MIDDLEWARE_PATH);
      expect(() => verifyJsonBody(makeReq(), {}, buildDeepArrayBuffer(33))).not.toThrow();
      expect(() => verifyJsonBody(makeReq(), {}, buildDeepArrayBuffer(34))).toThrow(/nesting too deep/i);
    }
  });

  it("canary: doctrine default REQUEST_BODY_MAX_DEPTH='32' is accepted; pins effective cap by bracketing the boundary", async () => {
    process.env.REQUEST_BODY_MAX_DEPTH = '32';
    jest.resetModules();

    const { verifyJsonBody } = await import(MIDDLEWARE_PATH);

    // Off-by-one note: buildDeepArrayBuffer(N) produces N nested
    // brackets; max scanValue depth = N-1 (innermost `[]` exits via
    // scanArray seeing `]` immediately, never recursing back into
    // scanValue). With MAX_DEPTH=32 the boundary is builder(33)
    // accepts / builder(34) rejects. A regex typo (e.g. /^[1-9]\d?$/
    // capping at 99) would shift the boundary and break exactly one.
    // (Asymmetric depth counting between scanner and
    // assertNoPollutingKeys is tracked by 21R-SEC-3-REVIEW-2,
    // Equoria-ncbs.)
    expect(() => verifyJsonBody(makeReq(), {}, buildDeepArrayBuffer(33))).not.toThrow();
    expect(() => verifyJsonBody(makeReq(), {}, buildDeepArrayBuffer(34))).toThrow(/nesting too deep/i);
  });

  it('valid override REQUEST_BODY_MAX_DEPTH=8 rejects 16-deep', async () => {
    process.env.REQUEST_BODY_MAX_DEPTH = '8';
    jest.resetModules();

    const { verifyJsonBody } = await import(MIDDLEWARE_PATH);
    expect(() => verifyJsonBody(makeReq(), {}, buildDeepArrayBuffer(16))).toThrow(/nesting too deep/i);
  });

  it('valid override REQUEST_BODY_MAX_DEPTH=8 passes 4-deep', async () => {
    process.env.REQUEST_BODY_MAX_DEPTH = '8';
    jest.resetModules();

    const { verifyJsonBody } = await import(MIDDLEWARE_PATH);
    expect(() => verifyJsonBody(makeReq(), {}, buildDeepArrayBuffer(4))).not.toThrow();
  });
});
