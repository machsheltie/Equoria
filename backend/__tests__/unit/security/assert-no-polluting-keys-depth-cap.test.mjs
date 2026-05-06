/**
 * Unit tests for assertNoPollutingKeys depth cap.
 *
 * 21R-SEC-3-FOLLOW-4 (Equoria-q4jk): the depth cap inside assertNoPollutingKeys
 * was identified as dead code from the test suite's perspective because
 * verifyJsonBody (the express.json verify hook) intercepts deeply nested bodies
 * before assertNoPollutingKeys ever runs. These tests call assertNoPollutingKeys
 * DIRECTLY, bypassing verifyJsonBody, and prove the cap fires at the correct
 * boundary.
 *
 * The export is test-only (__TESTING_ONLY_assertNoPollutingKeys), gated on
 * NODE_ENV=test so production code cannot access the internal function.
 */

import { describe, expect, it } from '@jest/globals';
import { __TESTING_ONLY_assertNoPollutingKeys as assertNoPollutingKeys } from '../../../middleware/requestBodySecurity.mjs';

function buildDeepObject(n) {
  let val = null;
  for (let i = 0; i < n; i++) {
    val = { a: val };
  }
  return val;
}

function buildDeepArray(n) {
  let val = null;
  for (let i = 0; i < n; i++) {
    val = [val];
  }
  return val;
}

describe('assertNoPollutingKeys depth cap — direct-call unit tests (21R-SEC-3-FOLLOW-4)', () => {
  it('test setup: export resolves to the function in NODE_ENV=test', () => {
    expect(typeof assertNoPollutingKeys).toBe('function');
  });

  describe('64-deep object — throws "nesting too deep" with status 400', () => {
    it('throws with /nesting too deep/ message', () => {
      expect(() => assertNoPollutingKeys(buildDeepObject(64))).toThrow(/nesting too deep/i);
    });

    it('thrown error has statusCode 400', () => {
      let caught;
      try {
        assertNoPollutingKeys(buildDeepObject(64));
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeDefined();
      expect(caught.statusCode).toBe(400);
    });
  });

  describe('64-deep array — Array.isArray branch — throws "nesting too deep" with status 400', () => {
    it('throws with /nesting too deep/ message', () => {
      expect(() => assertNoPollutingKeys(buildDeepArray(64))).toThrow(/nesting too deep/i);
    });

    it('thrown error has statusCode 400', () => {
      let caught;
      try {
        assertNoPollutingKeys(buildDeepArray(64));
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeDefined();
      expect(caught.statusCode).toBe(400);
    });
  });

  describe('16-deep object — below cap — does not throw', () => {
    it('does not throw for 16-deep object', () => {
      expect(() => assertNoPollutingKeys(buildDeepObject(16))).not.toThrow();
    });
  });
});
