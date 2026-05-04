/**
 * 🔒 BOUNDARY TESTS: depth-cap symmetry between scanner and assertNoPollutingKeys
 *
 * 21R-SEC-3-REVIEW-2 (Equoria-ncbs): the original story added a depth
 * cap of 32 to BOTH JsonScanner.scanValue (parser-layer, called via
 * verifyJsonBody) AND assertNoPollutingKeys (post-parse, called via
 * rejectPollutedRequestBody). The original test fixtures only exercised
 * depth=64 (well above cap) and depth=16 (well below cap). There was
 * zero coverage at the boundary depth=MAX_DEPTH-1 / MAX_DEPTH /
 * MAX_DEPTH+1. Off-by-one regressions in either function would not be
 * caught.
 *
 * The story description further hypothesised that the two functions
 * counted depth asymmetrically — same JSON input would yield different
 * `depth` values in the two functions, so they cap at MAX_DEPTH but
 * reject DIFFERENT payloads. This file proves empirically that the
 * semantics ARE symmetric for non-empty-leaf payloads — both functions
 * reach depth=N for an N-level nested input ending in a primitive.
 * Documenting that contract here pins it; any future change that
 * desyncs the counters would break exactly one of these assertions.
 *
 * Counting rules (same in both functions, for non-empty-leaf inputs):
 *   - Top-level value enters depth=0.
 *   - Each container (object/array) increments depth by 1 before
 *     recursing into its children.
 *   - A primitive leaf is a recursion target: assertNoPollutingKeys
 *     recurses on EVERY child including primitives (depth+1) and the
 *     check fires before the typeof-object guard returns. Scanner
 *     similarly reaches scanValue(N) for the leaf at level N.
 *   - The depth check is `depth > MAX_DEPTH`, so depth=MAX_DEPTH passes
 *     and depth=MAX_DEPTH+1 fails.
 *
 * Empty-leaf inputs (e.g. `[[[]]]`) are off by one — the empty array's
 * forEach has no children to recurse into, and the scanner's scanArray
 * sees `]` immediately so it never calls scanValue at the innermost
 * level. We deliberately use non-empty-leaf inputs in this file so the
 * boundary math is identical for both functions and both data shapes
 * (array, object).
 *
 * @module __tests__/integration/security/request-body-depth-cap-boundary
 */

import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_MAX_DEPTH,
  verifyJsonBody,
  rejectPollutedRequestBody,
} from '../../../middleware/requestBodySecurity.mjs';

const MAX_DEPTH = DEFAULT_MAX_DEPTH; // env var unset in this suite → resolves to default

// Build a JSON array buffer of N nested arrays with `null` as the
// innermost leaf. For N=3 the source is `[[[null]]]`. The scanner's
// scanValue is called at depths 0..N, so the max depth check is N.
function buildArrayBufferNonEmptyLeaf(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += '[';
  s += 'null';
  for (let i = 0; i < n; i++) s += ']';
  return Buffer.from(s, 'utf8');
}

// Build a JSON object buffer of N nested objects with `null` as the
// innermost leaf. For N=3 the source is `{"a":{"a":{"a":null}}}`.
// Same depth math as the array version.
function buildObjectBufferNonEmptyLeaf(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += '{"a":';
  s += 'null';
  for (let i = 0; i < n; i++) s += '}';
  return Buffer.from(s, 'utf8');
}

// Build a parsed JS array of N nested arrays with `null` as the
// innermost leaf. Mirrors buildArrayBufferNonEmptyLeaf so the SAME
// effective depth N is exercised by both scanner and
// assertNoPollutingKeys for parity comparisons.
function buildParsedArrayNonEmptyLeaf(n) {
  let val = null;
  for (let i = 0; i < n; i++) val = [val];
  return val;
}

// Build a parsed JS object of N nested objects with `null` as the
// innermost leaf. Mirrors buildObjectBufferNonEmptyLeaf.
function buildParsedObjectNonEmptyLeaf(n) {
  let val = null;
  for (let i = 0; i < n; i++) val = { a: val };
  return val;
}

function makeReq() {
  return { headers: { 'content-type': 'application/json' } };
}

// Run rejectPollutedRequestBody synchronously and return the error
// (if any) it forwarded to next(). assertNoPollutingKeys throws via
// AppError; the middleware catches and forwards through next(err).
function runRejectPolluted(body) {
  const req = { body };
  let captured = null;
  rejectPollutedRequestBody(req, {}, err => {
    if (err) captured = err;
  });
  return captured;
}

describe('Depth-cap boundary (21R-SEC-3-REVIEW-2)', () => {
  // Sanity: env-resolved MAX_DEPTH is the doctrine default.
  it('test setup: MAX_DEPTH resolves to DEFAULT_MAX_DEPTH (32)', () => {
    expect(MAX_DEPTH).toBe(32);
  });

  describe('JsonScanner via verifyJsonBody', () => {
    describe('array buffer (non-empty leaf)', () => {
      it(`accepts depth = MAX_DEPTH-1 (=${MAX_DEPTH - 1})`, () => {
        expect(() => verifyJsonBody(makeReq(), {}, buildArrayBufferNonEmptyLeaf(MAX_DEPTH - 1))).not.toThrow();
      });

      it(`accepts depth = MAX_DEPTH (=${MAX_DEPTH}) — boundary`, () => {
        expect(() => verifyJsonBody(makeReq(), {}, buildArrayBufferNonEmptyLeaf(MAX_DEPTH))).not.toThrow();
      });

      it(`rejects depth = MAX_DEPTH+1 (=${MAX_DEPTH + 1}) — boundary`, () => {
        expect(() => verifyJsonBody(makeReq(), {}, buildArrayBufferNonEmptyLeaf(MAX_DEPTH + 1))).toThrow(
          /nesting too deep/i,
        );
      });
    });

    describe('object buffer (non-empty leaf)', () => {
      it(`accepts depth = MAX_DEPTH-1 (=${MAX_DEPTH - 1})`, () => {
        expect(() => verifyJsonBody(makeReq(), {}, buildObjectBufferNonEmptyLeaf(MAX_DEPTH - 1))).not.toThrow();
      });

      it(`accepts depth = MAX_DEPTH (=${MAX_DEPTH}) — boundary`, () => {
        expect(() => verifyJsonBody(makeReq(), {}, buildObjectBufferNonEmptyLeaf(MAX_DEPTH))).not.toThrow();
      });

      it(`rejects depth = MAX_DEPTH+1 (=${MAX_DEPTH + 1}) — boundary`, () => {
        expect(() => verifyJsonBody(makeReq(), {}, buildObjectBufferNonEmptyLeaf(MAX_DEPTH + 1))).toThrow(
          /nesting too deep/i,
        );
      });
    });
  });

  describe('assertNoPollutingKeys via rejectPollutedRequestBody', () => {
    describe('parsed array (non-empty leaf)', () => {
      it(`accepts depth = MAX_DEPTH-1 (=${MAX_DEPTH - 1})`, () => {
        expect(runRejectPolluted(buildParsedArrayNonEmptyLeaf(MAX_DEPTH - 1))).toBeNull();
      });

      it(`accepts depth = MAX_DEPTH (=${MAX_DEPTH}) — boundary`, () => {
        expect(runRejectPolluted(buildParsedArrayNonEmptyLeaf(MAX_DEPTH))).toBeNull();
      });

      it(`rejects depth = MAX_DEPTH+1 (=${MAX_DEPTH + 1}) — boundary`, () => {
        const err = runRejectPolluted(buildParsedArrayNonEmptyLeaf(MAX_DEPTH + 1));
        expect(err).not.toBeNull();
        expect(err?.message).toMatch(/nesting too deep/i);
        expect(err?.statusCode ?? err?.status).toBe(400);
      });
    });

    describe('parsed object (non-empty leaf)', () => {
      it(`accepts depth = MAX_DEPTH-1 (=${MAX_DEPTH - 1})`, () => {
        expect(runRejectPolluted(buildParsedObjectNonEmptyLeaf(MAX_DEPTH - 1))).toBeNull();
      });

      it(`accepts depth = MAX_DEPTH (=${MAX_DEPTH}) — boundary`, () => {
        expect(runRejectPolluted(buildParsedObjectNonEmptyLeaf(MAX_DEPTH))).toBeNull();
      });

      it(`rejects depth = MAX_DEPTH+1 (=${MAX_DEPTH + 1}) — boundary`, () => {
        const err = runRejectPolluted(buildParsedObjectNonEmptyLeaf(MAX_DEPTH + 1));
        expect(err).not.toBeNull();
        expect(err?.message).toMatch(/nesting too deep/i);
        expect(err?.statusCode ?? err?.status).toBe(400);
      });
    });
  });

  describe('cross-function symmetry', () => {
    // For the SAME nesting depth N (non-empty-leaf), scanner and
    // assertNoPollutingKeys must produce identical accept/reject
    // outcomes. If the two functions ever desync, exactly one
    // assertion in this block will break — pinning the contract.
    for (const n of [MAX_DEPTH - 1, MAX_DEPTH, MAX_DEPTH + 1]) {
      it(`array N=${n}: scanner and assertNoPollutingKeys agree`, () => {
        let scannerThrew = false;
        try {
          verifyJsonBody(makeReq(), {}, buildArrayBufferNonEmptyLeaf(n));
        } catch (e) {
          if (e?.message?.match(/nesting too deep/i)) scannerThrew = true;
        }
        const assertErr = runRejectPolluted(buildParsedArrayNonEmptyLeaf(n));
        const assertRejected = !!assertErr?.message?.match(/nesting too deep/i);
        expect(scannerThrew).toBe(assertRejected);
      });

      it(`object N=${n}: scanner and assertNoPollutingKeys agree`, () => {
        let scannerThrew = false;
        try {
          verifyJsonBody(makeReq(), {}, buildObjectBufferNonEmptyLeaf(n));
        } catch (e) {
          if (e?.message?.match(/nesting too deep/i)) scannerThrew = true;
        }
        const assertErr = runRejectPolluted(buildParsedObjectNonEmptyLeaf(n));
        const assertRejected = !!assertErr?.message?.match(/nesting too deep/i);
        expect(scannerThrew).toBe(assertRejected);
      });
    }
  });
});
