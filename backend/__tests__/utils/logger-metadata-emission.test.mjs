/**
 * Logger metadata emission test (21R-OBS-1 / Equoria-8m7j)
 *
 * Captures REAL transport output (not jest.spyOn) and asserts that metadata
 * passed as the second argument to logger calls reaches the formatted output.
 *
 * The original defect: backend/utils/logger.mjs:18 destructures only
 * `{ timestamp, level, message }` in its winston.format.printf, silently
 * dropping every other field. Tests written with jest.spyOn captured
 * `mock.calls` BEFORE the formatter ran, hiding the defect.
 *
 * This test attaches a Stream transport to the live logger so we observe
 * the formatted line that would actually reach stdout / SIEM.
 */

import { describe, beforeAll, afterAll, beforeEach, expect, test } from '@jest/globals';
import { Writable } from 'stream';
import winston from 'winston';
import logger from '../../utils/logger.mjs';

describe('logger metadata emission (21R-OBS-1)', () => {
  let captured = [];
  let captureTransport;

  beforeAll(() => {
    captureTransport = new winston.transports.Stream({
      stream: new Writable({
        write(chunk, encoding, cb) {
          captured.push(chunk.toString());
          cb();
        },
      }),
    });
    logger.add(captureTransport);
  });

  afterAll(() => {
    logger.remove(captureTransport);
  });

  beforeEach(() => {
    captured = [];
  });

  test('warn() with metadata object emits all metadata fields in transport output', () => {
    logger.warn('[obs1-sentinel] forensic warn', {
      unexpected: true,
      errorClass: 'TypeError',
      detail: 'sentinel-trace-id-deadbeef',
    });

    const line = captured.join('');

    // Sanity: the message itself must reach the transport.
    expect(line).toContain('[obs1-sentinel] forensic warn');

    // The defect: these metadata fields are silently discarded by the
    // current printf format. Any one failing here proves operators see
    // a bare line in production while tests claiming to verify forensic
    // logging pass on jest.spyOn call args.
    expect(line).toContain('unexpected');
    expect(line).toContain('errorClass');
    expect(line).toContain('TypeError');
    expect(line).toContain('sentinel-trace-id-deadbeef');
  });

  test('error() with metadata object emits all metadata fields', () => {
    logger.error('[obs1-sentinel] forensic error', {
      requestId: 'req-abc-123',
      userId: 42,
      route: '/api/test',
    });

    const line = captured.join('');
    expect(line).toContain('[obs1-sentinel] forensic error');
    expect(line).toContain('requestId');
    expect(line).toContain('req-abc-123');
    expect(line).toContain('userId');
    expect(line).toContain('route');
    expect(line).toContain('/api/test');
  });

  test('info() with metadata object emits all metadata fields', () => {
    logger.info('[obs1-sentinel] forensic info', {
      flagName: 'feature-x',
      enabled: false,
    });

    const line = captured.join('');
    expect(line).toContain('[obs1-sentinel] forensic info');
    expect(line).toContain('flagName');
    expect(line).toContain('feature-x');
    expect(line).toContain('enabled');
  });

  test('warn() without metadata emits only the message (no spurious empty-object JSON)', () => {
    logger.warn('[obs1-sentinel] no-meta line');

    const line = captured.join('');
    expect(line).toContain('[obs1-sentinel] no-meta line');
    // No empty {} suffix when there is no metadata.
    expect(line).not.toMatch(/\{\s*\}/);
  });
});
