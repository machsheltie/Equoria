/**
 * 🔒 UNIT TEST: JsonScanner.scanString JSON-escape decoding (21R-SEC-1)
 *
 * Equoria-w45l: scanString() must return the decoded string (post-escape-
 * collapse) so scanObject's duplicate-key Set compares semantically equal
 * keys. The integration suite (parameter-pollution.test.mjs) covers the
 * end-to-end attack path. This unit suite pins the scanner contract
 * directly so a future regression in scanString that doesn't change the
 * end-to-end shape (e.g., a refactor that breaks one escape class) gets
 * caught here.
 *
 * The malformed-escape recovery branch (catch in scanString) is
 * unreachable from supertest because Express's body-parser receives the
 * raw payload before our middleware. To exercise that branch we have
 * to drive the scanner directly via the NODE_ENV-gated test export.
 */

import { describe, it, expect } from '@jest/globals';
import { __TESTING_ONLY_JsonScanner } from '../../../middleware/requestBodySecurity.mjs';

// scanString consumes the source from `this.index`, expects opening `"`
// at that position, and returns the decoded body. Each test constructs
// a fresh scanner positioned at index 0 of a valid JSON string literal.
function decodeJsonString(source) {
  const scanner = new __TESTING_ONLY_JsonScanner(source);
  return scanner.scanString();
}

describe('JsonScanner.scanString — JSON-escape decoding (21R-SEC-1 / Equoria-w45l)', () => {
  describe('happy-path single-char escapes', () => {
    const cases = [
      ['quote', '"\\""', '"'],
      ['backslash', '"\\\\"', '\\'],
      ['slash', '"\\/"', '/'],
      ['backspace', '"\\b"', '\b'],
      ['form-feed', '"\\f"', '\f'],
      ['newline', '"\\n"', '\n'],
      ['carriage-return', '"\\r"', '\r'],
      ['tab', '"\\t"', '\t'],
    ];
    for (const [name, input, expected] of cases) {
      it(`decodes ${name} (${JSON.stringify(input)} → ${JSON.stringify(expected)})`, () => {
        expect(decodeJsonString(input)).toBe(expected);
      });
    }
  });

  describe('Unicode \\uXXXX escapes', () => {
    it('decodes lowercase hex (\\u006e → n)', () => {
      expect(decodeJsonString('"\\u006e"')).toBe('n');
    });
    it('decodes uppercase hex (\\u006E → n)', () => {
      expect(decodeJsonString('"\\u006E"')).toBe('n');
    });
    it('decodes mixed hex case (\\u0061 → a)', () => {
      expect(decodeJsonString('"\\u0061"')).toBe('a');
    });
    it('decodes mid-string escape (n\\u0061me → name)', () => {
      expect(decodeJsonString('"n\\u0061me"')).toBe('name');
    });
    it('decodes adjacent escapes (\\u006eame → name)', () => {
      expect(decodeJsonString('"\\u006eame"')).toBe('name');
    });
    it('decodes BMP-range character (\\u00FF → ÿ)', () => {
      expect(decodeJsonString('"\\u00FF"')).toBe('ÿ');
    });
    it('decodes surrogate-pair emoji (\\uD83D\\uDE00 → 😀)', () => {
      expect(decodeJsonString('"\\uD83D\\uDE00"')).toBe('😀');
    });
  });

  describe('non-escape characters pass through verbatim', () => {
    it('returns unescaped ASCII as-is', () => {
      expect(decodeJsonString('"hello"')).toBe('hello');
    });
    it('returns unescaped Unicode as-is', () => {
      expect(decodeJsonString('"héllo"')).toBe('héllo');
    });
    it('preserves embedded slashes', () => {
      expect(decodeJsonString('"a/b/c"')).toBe('a/b/c');
    });
  });

  describe('escape boundary cases (must NOT collapse)', () => {
    it('literal-backslash key is distinct from decoded key', () => {
      // `"\\\\u006eame"` in source → JS literal `"\\u006eame"` → 12 chars in
      // raw JSON: `"`, `\`, `\`, `u`, `0`, `0`, `6`, `e`, `a`, `m`, `e`, `"`.
      // JSON.parse decodes to `\u006eame` (10 chars, with literal backslash).
      // This is distinct from `name` and so cannot duplicate-collide.
      const decoded = decodeJsonString('"\\\\u006eame"');
      expect(decoded).toBe('\\u006eame');
      expect(decoded).not.toBe('name');
    });
  });

  describe('malformed-escape recovery (defensive fallback)', () => {
    it('returns the raw body without throwing when JSON.parse rejects the slice', () => {
      // `\u` followed by non-hex digits is invalid JSON. JSON.parse on
      // the captured slice throws; the catch clause returns the slice
      // body without surrounding quotes. The full payload's body parser
      // (Express) will reject the request downstream — this fallback
      // exists only to prevent the scanner from itself crashing.
      const result = decodeJsonString('"\\uXYZW"');
      expect(typeof result).toBe('string');
      // The fallback returns the raw slice body unmodified.
      expect(result).toBe('\\uXYZW');
    });
  });
});
