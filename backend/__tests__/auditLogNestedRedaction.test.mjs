/**
 * Audit-log redaction reaches nested secrets (Equoria-oierg).
 *
 * Defect: sanitizeLogData() shallow-copied its input and only checked
 * top-level keys, so `{ profile: { password } }` or `{ items: [{ token }] }`
 * was persisted unredacted into audit_logs.metadata for the 90-day retention
 * window. Arrays were also spread into index-keyed objects.
 *
 * The pure cases pin the redactor's contract (recursion, arrays preserved,
 * non-plain values left alone, cycle and depth safety). The last case drives
 * the real app: an anonymous POST to a sensitive prefix is written to the real
 * audit_logs table by globalAuditTrail, and the stored row is read back.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import supertest from 'supertest';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { sanitizeLogData } from '../middleware/auditLog.mjs';
import { fetchCsrf, attachCsrf } from '../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

const REDACTED = '[REDACTED]';

describe('sanitizeLogData — nested redaction (Equoria-oierg)', () => {
  it('redacts a secret nested under a non-sensitive key', () => {
    const result = sanitizeLogData({ data: { password: 'hunter2', name: 'Moonflower' } });
    expect(result).toEqual({ data: { password: REDACTED, name: 'Moonflower' } });
  });

  it('redacts a deeply nested token', () => {
    const result = sanitizeLogData({ a: { b: { c: { d: { refreshToken: 'tok' } } } } });
    expect(result.a.b.c.d.refreshToken).toBe(REDACTED);
  });

  it('redacts inside arrays of objects and keeps arrays as arrays', () => {
    const result = sanitizeLogData({ items: [{ token: 'tok' }, { name: 'Halcyon' }] });
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items).toEqual([{ token: REDACTED }, { name: 'Halcyon' }]);
  });

  it('keeps a top-level array an array', () => {
    const result = sanitizeLogData([{ password: 'x' }, 'plain']);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([{ password: REDACTED }, 'plain']);
  });

  it('still redacts a whole subtree when its own key is sensitive', () => {
    expect(sanitizeLogData({ credentials: { user: 'a', extra: 1 } })).toEqual({ credentials: REDACTED });
  });

  it('leaves non-plain values such as Date untouched', () => {
    const when = new Date('2026-10-22T00:00:00Z');
    const result = sanitizeLogData({ meta: { when } });
    expect(result.meta.when).toBe(when);
  });

  it('does not mutate the input', () => {
    const input = { profile: { password: 'secret' }, items: [{ token: 't' }] };
    sanitizeLogData(input);
    expect(input).toEqual({ profile: { password: 'secret' }, items: [{ token: 't' }] });
  });

  it('survives a cyclic object and still redacts beside the cycle', () => {
    const node = { name: 'loop', inner: { apiKey: 'k' } };
    node.self = node;
    const result = sanitizeLogData(node);
    expect(result.inner.apiKey).toBe(REDACTED);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('caps depth: a secret below the cap is never emitted', () => {
    let deep = { password: 'buried-secret' };
    for (let i = 0; i < 50; i += 1) {
      deep = { next: deep };
    }
    const result = sanitizeLogData(deep);
    expect(JSON.stringify(result)).not.toContain('buried-secret');
  });

  it('processes a shared (non-cyclic) reference at every position', () => {
    const shared = { token: 't' };
    const result = sanitizeLogData({ a: shared, b: shared });
    expect(result).toEqual({ a: { token: REDACTED }, b: { token: REDACTED } });
  });
});

describe('globalAuditTrail persists nested secrets redacted (Equoria-oierg)', () => {
  const TAG = `oierg${randomBytes(5).toString('hex')}`;
  const email = `${TAG}@example.com`;
  const cleanup = createCleanupTracker();
  cleanup.add(
    () => prisma.auditLog.deleteMany({ where: { metadata: { path: ['body', 'email'], equals: email } } }),
    'auditLogs(emailTag)',
  );

  afterAll(() => cleanup.run(), 60000);

  it('stores [REDACTED] at nested object and array positions with no secret bytes', async () => {
    const origin = 'http://localhost:3000';
    const before = new Date();
    const csrf = await fetchCsrf(app, { origin });
    await attachCsrf(supertest(app).post('/api/v1/auth/login').set('Origin', origin), csrf).send({
      email,
      password: 'TestFixture-top-secret',
      profile: { password: 'TestFixture-secret' },
      items: [{ token: 'TestFixture-tok' }],
    });

    // The trail is written fire-and-forget on response finish.
    let rows = [];
    for (let attempt = 0; attempt < 20 && rows.length === 0; attempt += 1) {
      await new Promise(r => setTimeout(r, 100));
      rows = await prisma.auditLog.findMany({
        where: {
          path: '/api/v1/auth/login',
          createdAt: { gte: before },
          metadata: { path: ['body', 'email'], equals: email },
        },
      });
    }

    expect(rows).toHaveLength(1);
    const { body } = rows[0].metadata;
    expect(body.password).toBe(REDACTED);
    expect(body.profile.password).toBe(REDACTED);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items[0].token).toBe(REDACTED);
    expect(JSON.stringify(rows[0].metadata)).not.toMatch(/TestFixture-(secret|tok|top-secret)/);
  });
});
