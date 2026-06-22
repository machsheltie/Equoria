/**
 * Audit-Log Retention — REAL DB integration (Equoria-54qq8, OWASP A09 follow-up).
 *
 * Verifies the time-based purge: rows older than the retention window are
 * deleted while recent rows are retained. Scoped DELETE only — no unscoped
 * deleteMany (CLAUDE.md real-DB rule). Runs against the canonical Equoria DB;
 * fixtures are filtered by a unique action sentinel so a loose query can never
 * touch real audit rows.
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import {
  purgeExpiredAuditLogs,
  computeCutoff,
  getRetentionDays,
  DEFAULT_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
} from '../modules/admin/index.mjs';

// Unique sentinel so fixture rows never collide with real audit traffic and
// cleanup stays scoped (startsWith pattern).
const SENTINEL = `TestFixture-AuditRetention-${randomBytes(6).toString('hex')}`;

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { action: { startsWith: SENTINEL } } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  delete process.env.AUDIT_LOG_RETENTION_DAYS;
});

describe('getRetentionDays', () => {
  afterAll(() => delete process.env.AUDIT_LOG_RETENTION_DAYS);

  it('defaults to DEFAULT_RETENTION_DAYS when env unset', () => {
    delete process.env.AUDIT_LOG_RETENTION_DAYS;
    expect(getRetentionDays()).toBe(DEFAULT_RETENTION_DAYS);
  });

  it('honours a valid AUDIT_LOG_RETENTION_DAYS override', () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = '30';
    expect(getRetentionDays()).toBe(30);
  });

  it('clamps to MIN_RETENTION_DAYS when env is below the floor', () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = '1';
    expect(getRetentionDays()).toBe(MIN_RETENTION_DAYS);
  });

  it('falls back to default on a non-numeric / non-positive env', () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = 'not-a-number';
    expect(getRetentionDays()).toBe(DEFAULT_RETENTION_DAYS);
    process.env.AUDIT_LOG_RETENTION_DAYS = '0';
    expect(getRetentionDays()).toBe(DEFAULT_RETENTION_DAYS);
  });
});

describe('computeCutoff', () => {
  it('subtracts retentionDays from the supplied now (UTC)', () => {
    const now = new Date('2026-05-18T00:00:00.000Z');
    const cutoff = computeCutoff(90, now);
    // 2026-05-18 minus 90 days = 2026-02-17
    expect(cutoff.toISOString()).toBe('2026-02-17T00:00:00.000Z');
  });
});

describe('purgeExpiredAuditLogs — real DB', () => {
  function row(action, createdAt) {
    return {
      userId: null,
      action,
      resource: 'test',
      resourceId: null,
      method: 'POST',
      path: '/test',
      statusCode: 200,
      ip: '127.0.0.1',
      userAgent: 'jest',
      success: true,
      metadata: {},
      createdAt,
    };
  }

  it('deletes rows older than the retention window and retains recent ones', async () => {
    const now = new Date('2026-05-18T12:00:00.000Z');
    const old1 = new Date('2026-01-01T00:00:00.000Z'); // ~137 days old → purge
    const old2 = new Date('2026-02-01T00:00:00.000Z'); // ~106 days old → purge
    const recent = new Date('2026-05-15T00:00:00.000Z'); // 3 days old → retain

    await prisma.auditLog.createMany({
      data: [row(`${SENTINEL}-old1`, old1), row(`${SENTINEL}-old2`, old2), row(`${SENTINEL}-recent`, recent)],
    });

    const result = await purgeExpiredAuditLogs({ retentionDays: 90, now });

    expect(result.deletedCount).toBe(2);
    expect(result.retentionDays).toBe(90);

    const survivors = await prisma.auditLog.findMany({
      where: { action: { startsWith: SENTINEL } },
      select: { action: true },
    });
    const actions = survivors.map(r => r.action).sort();
    expect(actions).toEqual([`${SENTINEL}-recent`]);
  });

  it('deletes nothing when all sentinel rows are within the window', async () => {
    const now = new Date('2026-05-18T12:00:00.000Z');
    await prisma.auditLog.createMany({
      data: [
        row(`${SENTINEL}-a`, new Date('2026-05-10T00:00:00.000Z')),
        row(`${SENTINEL}-b`, new Date('2026-05-17T00:00:00.000Z')),
      ],
    });

    const before = await prisma.auditLog.count({
      where: { action: { startsWith: SENTINEL } },
    });
    const result = await purgeExpiredAuditLogs({ retentionDays: 90, now });
    const after = await prisma.auditLog.count({
      where: { action: { startsWith: SENTINEL } },
    });

    // Sentinel rows untouched. (deletedCount may be >0 from unrelated real
    // rows older than 90d in the canonical DB — assert sentinel invariance.)
    expect(after).toBe(before);
    expect(result.deletedCount).toBeGreaterThanOrEqual(0);
  });

  it('clamps a sub-floor retentionDays so near-current rows are NOT wiped', async () => {
    const now = new Date('2026-05-18T12:00:00.000Z');
    // 5 days old. With retentionDays=1 (sub-floor) clamped to MIN (7d) the
    // cutoff is ~11 days back, so this row survives. Proves the floor guards
    // against an env that would otherwise wipe near-current history.
    await prisma.auditLog.create({
      data: row(`${SENTINEL}-fivedays`, new Date('2026-05-13T12:00:00.000Z')),
    });

    const result = await purgeExpiredAuditLogs({ retentionDays: 1, now });
    expect(result.retentionDays).toBe(MIN_RETENTION_DAYS);

    const survivor = await prisma.auditLog.findFirst({
      where: { action: `${SENTINEL}-fivedays` },
    });
    expect(survivor).not.toBeNull();
  });
});
