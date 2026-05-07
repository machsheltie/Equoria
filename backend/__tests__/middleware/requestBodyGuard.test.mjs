/**
 * requestBodyGuard — unit tests (Equoria-rr7)
 *
 * Tests the two pure exported functions:
 *   - detectDuplicateJsonKeys(raw) — string tokenizer, no I/O
 *   - findPollutionKey(root)       — object DFS walker, no I/O
 *
 * No DB, no HTTP, no Express required.
 */

import { describe, it, expect } from '@jest/globals';
import { detectDuplicateJsonKeys, findPollutionKey } from '../../middleware/requestBodyGuard.mjs';

// ---------------------------------------------------------------------------
// detectDuplicateJsonKeys
// ---------------------------------------------------------------------------
describe('detectDuplicateJsonKeys', () => {
  it('returns without throwing for valid unique-key JSON', () => {
    expect(() => detectDuplicateJsonKeys('{"a":1,"b":2,"c":3}')).not.toThrow();
  });

  it('returns without throwing for empty string', () => {
    expect(() => detectDuplicateJsonKeys('')).not.toThrow();
  });

  it('returns without throwing for non-string input', () => {
    expect(() => detectDuplicateJsonKeys(null)).not.toThrow();
    expect(() => detectDuplicateJsonKeys(undefined)).not.toThrow();
    expect(() => detectDuplicateJsonKeys(123)).not.toThrow();
  });

  it('throws DUPLICATE_JSON_KEY for top-level duplicate key', () => {
    let err;
    try {
      detectDuplicateJsonKeys('{"a":1,"a":2}');
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('DUPLICATE_JSON_KEY');
    expect(err.statusCode).toBe(400);
  });

  it('throws DUPLICATE_JSON_KEY for nested duplicate key', () => {
    let err;
    try {
      detectDuplicateJsonKeys('{"outer":{"inner":1,"inner":2}}');
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('DUPLICATE_JSON_KEY');
  });

  it('does NOT throw for duplicate values in arrays (only keys matter)', () => {
    expect(() => detectDuplicateJsonKeys('[1,1,2]')).not.toThrow();
    expect(() => detectDuplicateJsonKeys('{"arr":[1,1,2]}')).not.toThrow();
  });

  it('handles repeated keys in sibling objects without throwing', () => {
    // Same key in different objects is allowed: {"a":{"x":1},"b":{"x":2}}
    expect(() => detectDuplicateJsonKeys('{"a":{"x":1},"b":{"x":2}}')).not.toThrow();
  });

  it('throws for unicode-escaped duplicate key (\\u006eame = "name")', () => {
    // n = 'n', so name = "name"
    const payload = JSON.stringify({ name: 'a' }).slice(0, -1) + ',"name":"b"}';
    let err;
    try {
      detectDuplicateJsonKeys(payload);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('DUPLICATE_JSON_KEY');
  });

  it('throws MALFORMED_JSON_BODY for unterminated string literal', () => {
    let err;
    try {
      detectDuplicateJsonKeys('{"key": "unterminated');
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('MALFORMED_JSON_BODY');
    expect(err.statusCode).toBe(400);
  });

  it('does not throw for valid JSON with string values containing colons', () => {
    expect(() => detectDuplicateJsonKeys('{"url":"http://example.com","path":"/api"}')).not.toThrow();
  });

  it('does not throw for valid nested object with unique keys', () => {
    expect(() => detectDuplicateJsonKeys('{"a":{"x":1,"y":2},"b":{"x":3,"z":4}}')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// findPollutionKey
// ---------------------------------------------------------------------------
describe('findPollutionKey', () => {
  it('returns null for a clean flat object', () => {
    expect(findPollutionKey({ a: 1, b: 'hello', c: true })).toBeNull();
  });

  it('returns null for null', () => {
    expect(findPollutionKey(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(findPollutionKey(undefined)).toBeNull();
  });

  it('returns null for primitive (string)', () => {
    expect(findPollutionKey('hello')).toBeNull();
  });

  it('returns null for empty object', () => {
    expect(findPollutionKey({})).toBeNull();
  });

  it('detects __proto__ at top level', () => {
    // JSON.parse attaches __proto__ as own data property
    const obj = JSON.parse('{"__proto__":{"isAdmin":true}}');
    const result = findPollutionKey(obj);
    expect(result).toBe('__proto__');
  });

  it('detects constructor at top level', () => {
    const obj = { constructor: { isAdmin: true } };
    const result = findPollutionKey(obj);
    expect(result).toBe('constructor');
  });

  it('detects prototype at top level', () => {
    const obj = { prototype: { evil: true } };
    const result = findPollutionKey(obj);
    expect(result).toBe('prototype');
  });

  it('detects __proto__ nested inside a safe key (JSON.parse creates own property)', () => {
    const obj = JSON.parse('{"user":{"data":{"__proto__":{"isAdmin":true}}}}');
    const result = findPollutionKey(obj);
    expect(result).toMatch('__proto__');
  });

  it('returns null for object with "constructor" as a string value', () => {
    const obj = { type: 'constructor', name: 'test' };
    expect(findPollutionKey(obj)).toBeNull();
  });

  it('returns null for clean nested object', () => {
    const obj = { a: { b: { c: { d: 'value' } } } };
    expect(findPollutionKey(obj)).toBeNull();
  });

  it('returns null for array input', () => {
    expect(findPollutionKey([1, 2, 3])).toBeNull();
  });

  it('detects pollution inside array elements', () => {
    const obj = { items: [{ __proto__: { evil: true } }] };
    // JSON.parse version for reliable own-property testing
    const parsed = JSON.parse('{"items":[{"__proto__":{"evil":true}}]}');
    const result = findPollutionKey(parsed);
    expect(result).toMatch('__proto__');
  });

  it('throws BODY_DEPTH_EXCEEDED for deeply nested object (>200 levels)', () => {
    // Build a 202-level deep object
    let deep = { leaf: true };
    for (let i = 0; i < 202; i++) {
      deep = { child: deep };
    }
    let err;
    try {
      findPollutionKey(deep);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('BODY_DEPTH_EXCEEDED');
  });

  it('does NOT throw for object nested exactly at 200 levels', () => {
    let deep = { leaf: true };
    for (let i = 0; i < 199; i++) {
      deep = { child: deep };
    }
    expect(() => findPollutionKey(deep)).not.toThrow();
  });
});
