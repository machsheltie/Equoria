/**
 * auditLog() factory — SSE / size-cap / success-skip sentinel (Equoria-97ikc).
 *
 * The auditLog factory wraps res.send to forward the response body into
 * logOperation (and from there into Sentry telemetry + future audit DB rows).
 * Three regressions the wrapper used to enable:
 *
 *   1) SSE: a future contributor mounting auditLog on a route that returns
 *      text/event-stream would have each streamed event buffered into the
 *      audit log + Sentry.
 *   2) Success bodies were forwarded to logOperation even though the only
 *      consumer of `responseData` is `if (res.statusCode >= 400)
 *      logEntry.errorResponse = sanitizeLogData(responseData)`. Successes
 *      were paying the cost (Sentry pipe, redactor cycles, PII surface)
 *      for nothing.
 *   3) Oversize payloads (lists, blobs) would dump the full body into the
 *      audit log + Sentry without bound.
 *
 * This sentinel takes two angles:
 *   - Source-structural check: the wrapper code contains the SSE skip,
 *     success skip, and size-cap call. A regression that removes any one
 *     of them fails the assertion.
 *   - Behavioral check: the wrapper itself never mutates the data it
 *     forwards to res.send — clients always see the full body, only the
 *     audit-log-bound copy is shrunk.
 *
 * Pure unit — no DB, no HTTP, no real audit row.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_SRC = path.resolve(HERE, '..', 'middleware', 'auditLog.mjs');

let auditLog;

beforeAll(async () => {
  // Bypass the NODE_ENV=test short-circuit so the wrapper actually runs.
  delete process.env.NODE_ENV;
  delete process.env.JEST_WORKER_ID;
  const mod = await import('../middleware/auditLog.mjs');
  auditLog = mod.auditLog;
});

describe('auditLog() body-capture wrapper (Equoria-97ikc) — structural sentinel', () => {
  it('SENTINEL: the wrapper source contains the SSE skip on text/event-stream content-type', () => {
    const src = fs.readFileSync(AUDIT_SRC, 'utf8');
    // The wrapper must check content-type for text/event-stream before
    // forwarding the body to logOperation.
    expect(src).toMatch(/text\/event-stream/);
    expect(src).toMatch(/isSse/);
  });

  it('SENTINEL: the wrapper source contains the success-skip (statusCode >= 400 gate)', () => {
    const src = fs.readFileSync(AUDIT_SRC, 'utf8');
    expect(src).toMatch(/isFailure\s*=\s*res\.statusCode\s*>=\s*400/);
    // The bodyToLog computation must short-circuit to null when !isFailure.
    expect(src).toMatch(/isFailure\s*&&\s*!isSse\s*\?\s*truncateForAuditLog\(data\)\s*:\s*null/);
  });

  it('SENTINEL: the wrapper source contains the size cap (8KB) and the truncate helper', () => {
    const src = fs.readFileSync(AUDIT_SRC, 'utf8');
    expect(src).toMatch(/AUDIT_LOG_BODY_CAPTURE_CAP_BYTES\s*=\s*8\s*\*\s*1024/);
    expect(src).toMatch(/function truncateForAuditLog/);
    expect(src).toMatch(/\[truncated\]/);
  });
});

describe('auditLog() body-capture wrapper (Equoria-97ikc) — behavioral sentinel', () => {
  it('client always sees full body — wrapper never mutates res.send arg (success JSON)', async () => {
    const middleware = auditLog('test');
    const sentCalls = [];
    const req = { user: null, headers: {}, body: {}, params: {}, query: {} };
    const res = {
      statusCode: 200,
      getHeader: () => 'application/json',
      send(d) {
        sentCalls.push(d);
      },
    };
    await middleware(req, res, () => {});
    const original = { ok: true, data: { foo: 'bar' } };
    res.send(original);
    expect(sentCalls).toHaveLength(1);
    expect(sentCalls[0]).toBe(original);
  });

  it('client always sees full body — wrapper never mutates res.send arg (failure + oversize)', async () => {
    const middleware = auditLog('test');
    const sentCalls = [];
    const req = { user: null, headers: {}, body: {}, params: {}, query: {} };
    const res = {
      statusCode: 500,
      getHeader: () => 'application/json',
      send(d) {
        sentCalls.push(d);
      },
    };
    await middleware(req, res, () => {});
    // 100KB — well over the 8KB cap. The client must still see all of it;
    // only the audit-log copy is truncated.
    const big = 'x'.repeat(100000);
    res.send(big);
    expect(sentCalls).toHaveLength(1);
    expect(sentCalls[0]).toBe(big);
    expect(sentCalls[0].length).toBe(100000);
  });

  it('client always sees full body — wrapper never mutates res.send arg (SSE chunk)', async () => {
    const middleware = auditLog('test');
    const sentCalls = [];
    const req = { user: null, headers: {}, body: {}, params: {}, query: {} };
    const res = {
      statusCode: 200,
      getHeader: () => 'text/event-stream',
      send(d) {
        sentCalls.push(d);
      },
    };
    await middleware(req, res, () => {});
    const eventChunk = 'event: leadership_transfer\ndata: {"foo":"bar"}\n\n';
    res.send(eventChunk);
    expect(sentCalls).toHaveLength(1);
    expect(sentCalls[0]).toBe(eventChunk);
  });
});
