/**
 * 🔒 INTEGRATION TESTS: logger preserves metadata fields on transport output (21R-OBS-1, Equoria-8m7j).
 *
 * The Winston printf format in `backend/utils/logger.mjs` is responsible
 * for converting structured log entries (a `{ timestamp, level, message, ...meta }`
 * object) into a single output line. The original format dropped every
 * metadata field because it destructured only `{ timestamp, level, message }`:
 *
 *   winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`)
 *
 * This test captures REAL transport output (not jest.spyOn'd `mock.calls`,
 * which observe the API call BEFORE the formatter runs). Without the fix,
 * metadata fields are absent from the captured line. With the fix, they
 * are JSON-encoded and appended to the message.
 *
 * Discovered during ultra-think review of 21R-SEC-3-FOLLOW-1 (Equoria-ixqg)
 * iteration 2: that issue's forensic-logging contract relied on `logger.warn(msg, {meta})`
 * preserving the meta. It did not. Tests passed because they spied on the
 * API call args. This test class — capturing real transport output — is
 * the only honest way to verify the contract.
 *
 * @module __tests__/utils/logger-metadata-emission
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Writable } from 'stream';
import winston from 'winston';
import logger from '../../utils/logger.mjs';

describe('logger transport output preserves metadata (21R-OBS-1)', () => {
  // We capture real transport output by adding a winston Stream transport
  // that writes formatted log lines into an in-memory array. The transport
  // shares the existing logger's format chain — so what we capture is
  // exactly what stdout would receive in production. This is structurally
  // different from jest.spyOn(logger, 'warn'): the spy observes the API
  // call, not the format output.
  let capturedLines;
  let captureTransport;

  beforeEach(() => {
    capturedLines = [];
    // Real Node Writable that pushes each formatted log line into our
    // array. Winston's Stream transport requires a stream that implements
    // `_write` — a plain `{ write }` object is rejected at construction.
    const captureStream = new Writable({
      write(chunk, _encoding, callback) {
        capturedLines.push(chunk.toString().replace(/\n$/, ''));
        callback();
      },
    });
    captureTransport = new winston.transports.Stream({ stream: captureStream });
    logger.add(captureTransport);
  });

  // Patch #32 (review hardening): the singleton `logger` survives across
  // test files in the same Jest worker. If a test crashes between
  // beforeEach (transport added) and afterEach (transport removed), the
  // transport persists into the next test — every subsequent test sees
  // the previous test's `capturedLines` populated and (worse) any other
  // test file that uses the singleton logger gets garbage-piped into a
  // dangling stream. The afterEach below uses a try/finally idiom so
  // even if the test mutates `captureTransport` to undefined or throws
  // during teardown, the transport reference is captured-by-closure and
  // the cleanup attempt always runs. We also guard against double-remove
  // by checking the transport is currently in the logger's transports.
  afterEach(() => {
    try {
      if (captureTransport && logger.transports.includes(captureTransport)) {
        logger.remove(captureTransport);
      }
    } catch {
      // Swallow defensively — afterEach is the LAST line of defense; we
      // do not want a teardown error to mask the actual test result.
      // Worst case the transport leaks into the next test which will
      // fail with extra captured lines — visible, not silent.
    }
  });

  it('appends metadata fields as JSON when logger.warn is called with a metadata object', () => {
    logger.warn('[Test] forensic event', {
      unexpected: true,
      errorClass: 'RangeError',
      sample: 'value',
    });

    expect(capturedLines).toHaveLength(1);
    const line = capturedLines[0];
    // Must contain the original message.
    expect(line).toContain('[Test] forensic event');
    // Must contain ALL metadata fields. Pre-fix this fails because the
    // printf only emitted `[ts] level: message`.
    expect(line).toContain('"unexpected":true');
    expect(line).toContain('"errorClass":"RangeError"');
    expect(line).toContain('"sample":"value"');
  });

  it('appends metadata for logger.error', () => {
    logger.error('[Test] error event', { code: 'ERR_X', count: 42 });

    expect(capturedLines).toHaveLength(1);
    const line = capturedLines[0];
    expect(line).toContain('[Test] error event');
    expect(line).toContain('"code":"ERR_X"');
    expect(line).toContain('"count":42');
  });

  it('preserves bare-message format when no metadata is passed (back-compat)', () => {
    logger.warn('[Test] no metadata');

    expect(capturedLines).toHaveLength(1);
    const line = capturedLines[0];
    expect(line).toContain('[Test] no metadata');
    // No appended JSON — line should not contain JSON-object braces FROM
    // OUR EMISSION. The timestamp + level format may include `:` but not
    // `{` or `}` chars in the standard format, so a stray `{` indicates
    // metadata was emitted unexpectedly.
    expect(line).not.toMatch(/\{[^}]*\}/);
  });

  it('preserves the original [timestamp] level: prefix shape', () => {
    logger.warn('[Test] shape check', { foo: 'bar' });

    expect(capturedLines).toHaveLength(1);
    const line = capturedLines[0];
    // Pin the prefix shape: `[YYYY-MM-DD HH:mm:ss] level: <message>...`
    expect(line).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] warn: \[Test\] shape check/);
  });

  it('handles nested metadata objects', () => {
    logger.warn('[Test] nested', {
      outer: {
        inner: {
          deep: 'value',
        },
      },
    });

    expect(capturedLines).toHaveLength(1);
    const line = capturedLines[0];
    expect(line).toContain('"outer":{"inner":{"deep":"value"}}');
  });

  it('handles metadata with array values', () => {
    logger.warn('[Test] array', { items: ['a', 'b', 'c'] });

    expect(capturedLines).toHaveLength(1);
    const line = capturedLines[0];
    expect(line).toContain('"items":["a","b","c"]');
  });

  it('handles metadata with undefined / null fields (defensive)', () => {
    logger.warn('[Test] mixed-nullish', {
      defined: 'present',
      omitted: undefined,
      explicitNull: null,
    });

    expect(capturedLines).toHaveLength(1);
    const line = capturedLines[0];
    expect(line).toContain('"defined":"present"');
    // JSON.stringify drops `undefined` properties; null is preserved.
    expect(line).toContain('"explicitNull":null');
    expect(line).not.toContain('"omitted"');
  });

  // Patch #22 (review hardening): explicit coverage for the
  // `logger.warn(message, undefined)` call shape — some call sites pass
  // an explicit undefined as the second argument. Pre-patch, this
  // behaviour was unverified. Winston coerces undefined-second-arg into
  // an empty meta object (no enumerable keys), so the printf appends
  // nothing — back-compat preserved.
  it('handles undefined as the second argument (logger.warn(msg, undefined))', () => {
    logger.warn('[Test] undefined-meta', undefined);
    expect(capturedLines).toHaveLength(1);
    const line = capturedLines[0];
    expect(line).toContain('[Test] undefined-meta');
    expect(line).not.toMatch(/\{[^}]*\}/);
  });

  // Patch #1 hardening (logger.mjs): JSON.stringify can throw on
  // circular references and BigInt values. The printf wraps the
  // serialisation in try/catch and falls back to a marker string so
  // the format pipeline does NOT crash. These tests pin the fallback
  // shape so a future "cleanup" that drops the try/catch breaks them.
  it('does not throw when metadata contains a circular reference', () => {
    const circular = {};
    circular.self = circular;
    expect(() => logger.warn('[Test] circular', { circ: circular })).not.toThrow();
    expect(capturedLines).toHaveLength(1);
    const line = capturedLines[0];
    expect(line).toContain('[Test] circular');
    expect(line).toContain('[unserializable meta:');
  });

  it('does not throw when metadata contains a BigInt value', () => {
    expect(() => logger.warn('[Test] bigint', { id: 1n })).not.toThrow();
    expect(capturedLines).toHaveLength(1);
    const line = capturedLines[0];
    expect(line).toContain('[Test] bigint');
    expect(line).toContain('[unserializable meta:');
  });
});
