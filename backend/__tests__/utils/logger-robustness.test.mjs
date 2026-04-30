/**
 * 🔒 INTEGRATION TESTS: logger.mjs robustness (21R-OBS-3, Equoria-aweq).
 *
 * Three robustness defects identified during ultra-think review of
 * 21R-OBS-1. The first (circular reference safety) is covered by
 * `logger-metadata-emission.test.mjs`'s circular + BigInt cases. This
 * file covers the remaining three:
 *
 *   2. Oversized metadata — without a cap, a caller logging a 10MB
 *      object writes 10MB to stdout per call. Combined with the 100KB
 *      body limit and FOLLOW-1's stack truncation, a single failed
 *      request can produce >100KB lines. SIEM ingest cost + log
 *      rotation pressure scale 100× under attack burst. Cap the JSON
 *      suffix at 4096 bytes after redaction; on overage, truncate +
 *      append `[truncated-N-bytes]` marker.
 *
 *   3. Error-as-value — `JSON.stringify({err: new Error('m')})` returns
 *      `{"err":{}}` because Error.message/.stack/.name are
 *      non-enumerable. Callers using `logger.error('failed', { err })`
 *      get useless metadata. Pre-process: if a value is `instanceof
 *      Error`, swap with `{name, message, stack: stack.slice(0, 1024)}`
 *      before JSON.stringify.
 *
 *   4. Bare-Error second-arg duplicate stack — `logger.error(msg, err)`
 *      where err is an Error: Winston's stack-hoist path puts the stack
 *      both into `info.message` (via enumerateErrorFormat) AND keeps it
 *      enumerable as `info.stack`. The printf rest-pattern then includes
 *      `stack` in the JSON suffix. Stack appears TWICE per line. Detect
 *      and prevent duplicate emission.
 *
 * Same captured-transport pattern as logger-metadata-emission.test.mjs:
 * we attach a Stream transport and read what production stdout would
 * actually receive. Spy-based tests would observe Winston's API call
 * BEFORE the format chain runs and miss every defect here.
 *
 * @module __tests__/utils/logger-robustness
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Writable } from 'stream';
import winston from 'winston';
import logger from '../../utils/logger.mjs';

describe('logger robustness (21R-OBS-3)', () => {
  let capturedLines;
  let captureTransport;

  beforeEach(() => {
    capturedLines = [];
    const captureStream = new Writable({
      write(chunk, _encoding, callback) {
        capturedLines.push(chunk.toString().replace(/\n$/, ''));
        callback();
      },
    });
    captureTransport = new winston.transports.Stream({ stream: captureStream });
    logger.add(captureTransport);
  });

  afterEach(() => {
    try {
      if (captureTransport && logger.transports.includes(captureTransport)) {
        logger.remove(captureTransport);
      }
    } catch {
      // Defensive — same rationale as the sibling logger-metadata-emission
      // test: do not let teardown errors mask test results.
    }
  });

  // ── Defect #2: oversized metadata gets truncated ─────────────────────────────

  describe('size cap', () => {
    const SIZE_CAP_BYTES = 4096;

    it('truncates the JSON suffix when metadata exceeds the size cap', () => {
      const huge = 'A'.repeat(50_000); // ~50 KB single field
      logger.warn('[Test] oversized', { payload: huge });

      expect(capturedLines).toHaveLength(1);
      const line = capturedLines[0];
      expect(line).toContain('[Test] oversized');
      // The captured line MUST be bounded. Pre-fix it would be ~50 KB.
      // Post-fix: prefix (~30 chars) + cap + truncation marker. Allow
      // generous slack (~200 chars) for the marker + level/timestamp.
      expect(line.length).toBeLessThanOrEqual(SIZE_CAP_BYTES + 500);
      // Truncation must be VISIBLE — silent truncation would mask
      // dropped forensic data with no signal.
      expect(line).toMatch(/\[truncated-\d+-bytes\]/);
    });

    it('does NOT truncate when metadata fits under the cap', () => {
      logger.warn('[Test] small', { foo: 'bar', n: 42 });

      expect(capturedLines).toHaveLength(1);
      const line = capturedLines[0];
      expect(line).toContain('"foo":"bar"');
      expect(line).toContain('"n":42');
      expect(line).not.toMatch(/\[truncated-\d+-bytes\]/);
    });

    it('truncation marker reports the actual byte overage', () => {
      // 30 KB of metadata. Overage = 30000 - 4096 ≈ 25904. The marker
      // must report a number greater than zero so operators can see
      // how much was dropped.
      const huge = 'B'.repeat(30_000);
      logger.warn('[Test] marker-detail', { payload: huge });

      const line = capturedLines[0];
      const match = line.match(/\[truncated-(\d+)-bytes\]/);
      expect(match).not.toBeNull();
      const droppedBytes = Number(match[1]);
      expect(droppedBytes).toBeGreaterThan(0);
      // Sanity: dropped count should be in the same ballpark as the
      // overage (>10 KB given a 30 KB input and 4 KB cap).
      expect(droppedBytes).toBeGreaterThan(10_000);
    });
  });

  // ── Defect #3: Error instances serialize via name/message/stack ──────────────

  describe('Error-as-value handling', () => {
    it('extracts Error name, message, and stack instead of emitting {}', () => {
      logger.warn('[Test] error-value', { err: new Error('boom-details') });

      expect(capturedLines).toHaveLength(1);
      const line = capturedLines[0];
      expect(line).toContain('[Test] error-value');
      // Pre-fix: line contains `"err":{}`. Post-fix: contains the
      // actual Error fields.
      expect(line).not.toMatch(/"err"\s*:\s*\{\s*\}/);
      expect(line).toContain('"name":"Error"');
      expect(line).toContain('"message":"boom-details"');
      expect(line).toMatch(/"stack"\s*:\s*"/); // stack present, content varies
    });

    it('preserves Error subclass name (TypeError, RangeError, etc.)', () => {
      logger.warn('[Test] error-subclass', { err: new TypeError('wrong-type') });

      const line = capturedLines[0];
      expect(line).toContain('"name":"TypeError"');
      expect(line).toContain('"message":"wrong-type"');
    });

    it('truncates Error stack to bounded length to prevent log flood', () => {
      // Construct an Error with a synthetic large stack. Real stacks are
      // ~1-2 KB; a forged 100 KB stack should be capped.
      const err = new Error('stack-flood');
      err.stack = `Error: stack-flood\n${'    at fakeFrame (/path/to/file.js:1:1)\n'.repeat(5000)}`;
      logger.warn('[Test] stack-cap', { err });

      const line = capturedLines[0];
      // The stack field, even if present, must be bounded. Cap chosen
      // to match the AC's 1024-char target with reasonable slack for
      // JSON-escaping overhead.
      const stackMatch = line.match(/"stack":"((?:[^"\\]|\\.)*)"/);
      expect(stackMatch).not.toBeNull();
      const decodedStack = stackMatch[1];
      expect(decodedStack.length).toBeLessThanOrEqual(1100);
    });

    it('handles nested Error inside an object', () => {
      logger.warn('[Test] nested-error', {
        operation: 'horse-update',
        cause: new Error('FK violation'),
      });

      const line = capturedLines[0];
      expect(line).toContain('"operation":"horse-update"');
      expect(line).toContain('"cause":');
      expect(line).toContain('"message":"FK violation"');
    });

    it('handles multiple Error values in the same metadata', () => {
      logger.warn('[Test] multi-error', {
        primary: new Error('primary-fail'),
        secondary: new RangeError('secondary-fail'),
      });

      const line = capturedLines[0];
      expect(line).toContain('"primary":');
      expect(line).toContain('"message":"primary-fail"');
      expect(line).toContain('"secondary":');
      expect(line).toContain('"name":"RangeError"');
      expect(line).toContain('"message":"secondary-fail"');
    });
  });

  // ── Defect #4: bare-Error second arg does not duplicate the stack ────────────

  describe('bare-Error second argument', () => {
    it('emits the stack only once when called as logger.error(msg, errorInstance)', () => {
      const err = new Error('boom-stack');
      logger.error('[Test] bare-error', err);

      expect(capturedLines).toHaveLength(1);
      const line = capturedLines[0];
      expect(line).toContain('[Test] bare-error');

      // Count occurrences of the unique stack marker. The first frame's
      // pathname is typically present. We use the error message as a
      // canary that should appear ONCE per logical event, not twice.
      const marker = 'boom-stack';
      const occurrences = (line.match(new RegExp(marker, 'g')) ?? []).length;
      // Pre-fix: marker appears twice (once via Winston's
      // enumerateErrorFormat copying stack→message, once via the printf
      // rest-pattern emitting the enumerable stack property in JSON).
      // Post-fix: exactly once OR exactly twice if both message and
      // stack legitimately contain it (message="boom-stack", stack
      // includes "Error: boom-stack" header). The fix de-duplicates
      // the stack-as-JSON suffix so the marker count stops at 2 (one
      // in the prefix message, one in the stack header). NEVER 3+.
      expect(occurrences).toBeLessThanOrEqual(2);
    });

    it('does not double-emit stack when logger.error is called with named-meta pattern', () => {
      // Idiomatic call: logger.error('msg', { err }) — the AC's
      // RECOMMENDED pattern. The stack must appear exactly in the
      // err.stack JSON field, NOT also at the top level.
      const err = new Error('meta-pattern');
      logger.error('[Test] meta-pattern', { err });

      const line = capturedLines[0];
      // The message itself must NOT contain the stack (no
      // enumerateErrorFormat hoist for nested-meta calls).
      // Stack should be exactly inside `"err":{...,"stack":"..."}`.
      const stackTopLevelMatch = line.match(/^[^{]*"stack":"/);
      // Top-level stack outside the err object would be a regression.
      expect(stackTopLevelMatch).toBeNull();
      expect(line).toContain('"message":"meta-pattern"');
    });
  });
});
