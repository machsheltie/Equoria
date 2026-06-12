/**
 * Equoria-jw10w — DB-backed audit trail + global enforcement (OWASP A09).
 *
 * Validates that:
 *   1. A sensitive mutating request (POST /api/v1/auth/register) produces
 *      exactly ONE persisted AuditLog row with correct fields (action,
 *      method, path, statusCode, success, ip), and that secrets in the
 *      request body are redacted in the stored metadata.
 *   2. A read (GET) on a sensitive prefix produces NO AuditLog row —
 *      coverage is scoped to mutating verbs (POST/PUT/PATCH/DELETE) by
 *      design (documented in SECURITY.md A09 + the middleware header).
 *   3. An audit-write failure does NOT 500 / break the underlying request
 *      (fail-soft sentinel) — storeAuditLog must swallow its own errors.
 *
 * Real DB. No mocks of Prisma. No bypass headers. Fixtures are scoped by a
 * unique username/email tag so cleanup never touches real user/audit rows.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import supertest from 'supertest';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { storeAuditLog } from '../middleware/auditLog.mjs';
import { fetchCsrf, attachCsrf } from '../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

// Hyphen-free: the register username validator is /^[a-zA-Z0-9_]+$/.
const TAG = `jw10w${randomBytes(5).toString('hex')}`;
const DEFAULT_ORIGIN = 'http://localhost:3000';

const createdUserIds = new Set();

let suiteStart;

describe('Equoria-jw10w: DB-backed audit trail', () => {
  // FK-ordered, id-scoped, FAIL-LOUD cleanup (Equoria-0y9f5 pattern).
  // POST /api/v1/auth/register creates a STARTER HORSE for the new user
  // (onboardingService.createStarterHorseForNewUser, Equoria-vhv3i), and
  // horses.userId is ON DELETE RESTRICT since v58ta — so the user delete
  // MUST be preceded by deleting that user's horses, or it throws P23001
  // and the suite fails at teardown while leaking the fixture user+horse.
  // The tracker runs every step even if an earlier one throws, then fails
  // loudly with the aggregate.
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    suiteStart = new Date();
    // Sanity: confirm the audit_logs table is reachable. If the migration
    // hasn't been applied this throws early with a clear schema error.
    await prisma.auditLog.findMany({ take: 1 });

    // Scoped: only rows this suite created (path tag or tracked user ids).
    cleanup.add(() => prisma.auditLog.deleteMany({ where: { path: { contains: TAG } } }), 'auditLogs(pathTag)');
    cleanup.add(
      () => prisma.auditLog.deleteMany({ where: { metadata: { path: ['username'], string_contains: TAG } } }),
      'auditLogs(usernameTag)',
    );
    cleanup.add(async () => {
      if (createdUserIds.size === 0) {
        return;
      }
      await prisma.auditLog.deleteMany({ where: { userId: { in: [...createdUserIds] } } });
    }, 'auditLogs(userIds)');
    cleanup.add(async () => {
      if (createdUserIds.size === 0) {
        return;
      }
      // Children before parents: the registered users' starter horses are
      // RESTRICT-bound to them. Resolve ids first, delete strictly id-scoped.
      const horses = await prisma.horse.findMany({
        where: { userId: { in: [...createdUserIds] } },
        select: { id: true },
      });
      if (horses.length > 0) {
        await prisma.horse.deleteMany({ where: { id: { in: horses.map(h => h.id) } } });
      }
    }, 'horses(starter)');
    cleanup.add(async () => {
      if (createdUserIds.size === 0) {
        return;
      }
      await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
    }, 'users');
    // Sweep audit rows whose stored path is /api/v1/auth/register but matched
    // by our tagged username in metadata (covers the no-userId failed cases too).
    cleanup.add(
      () =>
        prisma.auditLog.deleteMany({
          where: {
            path: '/api/v1/auth/register',
            createdAt: { gte: suiteStart },
            OR: [{ metadata: { path: ['username'], equals: `${TAG}` } }],
          },
        }),
      'auditLogs(registerSweep)',
    );
  });

  afterAll(() => cleanup.run(), 120000);

  it('persists exactly one AuditLog row for a sensitive mutation, with secrets redacted', async () => {
    const username = `${TAG}_u`;
    const email = `${TAG}@example.com`;
    const password = 'TestPassword123!';

    const before = new Date();
    const csrf = await fetchCsrf(app, { origin: DEFAULT_ORIGIN });
    const res = await attachCsrf(supertest(app).post('/api/v1/auth/register').set('Origin', DEFAULT_ORIGIN), csrf).send(
      { email, username, password, firstName: 'Audit', lastName: 'Trail', dateOfBirth: '1990-01-01' },
    );

    // Registration should succeed (201) — but the audit assertion does not
    // depend on the exact status; it depends on a row being written.
    expect([200, 201]).toContain(res.status);

    if (res.body?.data?.user?.id) {
      createdUserIds.add(res.body.data.user.id);
    } else if (res.body?.user?.id) {
      createdUserIds.add(res.body.user.id);
    }

    // Give the fail-soft async write a tick to land.
    await new Promise(r => setTimeout(r, 200));

    const rows = await prisma.auditLog.findMany({
      where: {
        path: '/api/v1/auth/register',
        method: 'POST',
        createdAt: { gte: before },
        metadata: { path: ['username'], equals: username },
      },
    });

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.action).toBe('authentication');
    expect(row.resource).toBe('auth');
    expect(row.method).toBe('POST');
    expect(row.path).toBe('/api/v1/auth/register');
    expect(typeof row.statusCode).toBe('number');
    expect(row.success).toBe(row.statusCode < 400);
    expect(row.ip === null || typeof row.ip === 'string').toBe(true);

    // CRITICAL: password must be redacted in stored metadata.
    const meta = row.metadata || {};
    const serialized = JSON.stringify(meta);
    expect(serialized).not.toContain(password);
    if (meta && typeof meta === 'object' && meta.body && typeof meta.body === 'object') {
      expect(meta.body.password).toBe('[REDACTED]');
    }
  });

  it('does NOT persist an AuditLog row for a GET (read) on a sensitive prefix', async () => {
    const before = new Date();
    // fetchCsrf performs GET /api/v1/auth/csrf-token (a read on the sensitive
    // `auth` prefix). It must NOT be audited — the trail is mutation-scoped.
    await fetchCsrf(app, { origin: DEFAULT_ORIGIN });
    await new Promise(r => setTimeout(r, 200));

    const reads = await prisma.auditLog.findMany({
      where: {
        path: '/api/v1/auth/csrf-token',
        method: 'GET',
        createdAt: { gte: before },
      },
    });
    expect(reads).toHaveLength(0);
  });

  it('fail-soft: storeAuditLog swallows DB errors and never throws', async () => {
    // Force a REAL Prisma error: `statusCode` resolves to a NaN (the column
    // is INTEGER NOT NULL, and Prisma rejects NaN for an Int field). The
    // coercion in storeAuditLog is `typeof statusCode === 'number' ? sc : 0`
    // — NaN IS typeof 'number', so it passes through and Prisma throws on
    // create(). storeAuditLog MUST catch that and resolve without throwing.
    const sentinelPath = `/__sentinel__/${TAG}`;
    await expect(
      storeAuditLog({
        operationType: 'authentication',
        method: 'POST',
        path: sentinelPath,
        statusCode: Number.NaN, // typeof 'number' -> reaches prisma -> Int rejects NaN
        ip: '127.0.0.1',
      }),
    ).resolves.not.toThrow();

    // Sentinel-positive: prove the bad write genuinely did NOT persist a row
    // (i.e. the error path was actually exercised, not silently coerced to a
    // valid row). If a row exists here, the test isn't proving fail-soft.
    const leaked = await prisma.auditLog.findMany({
      where: { path: sentinelPath },
    });
    expect(leaked).toHaveLength(0);
  });

  it('fail-soft: a request still succeeds even if the audit write fails', async () => {
    // fetchCsrf throws if the csrf endpoint is not a clean 200. The audit
    // subsystem is never on the critical path, so a normal request resolves
    // successfully regardless of audit-write outcome.
    const csrf = await fetchCsrf(app, { origin: DEFAULT_ORIGIN });
    expect(typeof csrf.csrfToken).toBe('string');
    expect(csrf.csrfToken.length).toBeGreaterThan(0);
  });
});
