/**
 * 🧪 Doc-Coverage Snapshot Cron — Real-DB Integration (Equoria-qr114)
 *
 * Equoria-zr9kl added DocCoverageSnapshot persistence + deriveCoverageTrend, but
 * nothing recorded a snapshot on a schedule — so the trend only populated if
 * something manually invoked the recorder. This wires a daily cron
 * (CronJobService.recordDocCoverageSnapshot) that records ONE snapshot row and
 * then purges expired rows (scoped DELETE, mirrors auditLogRetention).
 *
 * This suite proves, against the REAL database (no mocks):
 *
 *   1. Invoking the cron job function records a DocCoverageSnapshot row that is
 *      readable back.
 *   2. The retention purge inside the same job removes rows older than the
 *      window while retaining recent rows — a SCOPED delete (capturedAt < cutoff),
 *      never a bare deleteMany.
 *   3. The retention service's env-overridable window + floor behave correctly
 *      (mirrors auditLogRetentionService).
 *
 * Cleanup is id-scoped (CLAUDE.md §2): only the snapshot ids this suite creates
 * are deleted — never a bare deleteMany().
 */

import { describe, it, expect, afterEach, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import cronJobService from '../../../services/cronJobs.mjs';
import {
  purgeExpiredDocCoverageSnapshots,
  computeCutoff,
  getRetentionDays,
  DEFAULT_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
} from '../../../services/docCoverageSnapshotRetentionService.mjs';

// Track every snapshot id this suite touches so cleanup stays id-scoped.
const createdSnapshotIds = [];

async function seedSnapshot({ coveragePct, qualityScore, capturedAt }) {
  const row = await prisma.docCoverageSnapshot.create({
    data: {
      coveragePct,
      qualityScore,
      totalEndpoints: 100,
      documentedEndpoints: Math.round(coveragePct),
      capturedAt,
    },
  });
  createdSnapshotIds.push(row.id);
  return row;
}

async function cleanup() {
  if (createdSnapshotIds.length > 0) {
    await prisma.docCoverageSnapshot.deleteMany({
      where: { id: { in: createdSnapshotIds } },
    });
    createdSnapshotIds.length = 0;
  }
}

afterEach(async () => {
  await cleanup();
  delete process.env.DOC_COVERAGE_SNAPSHOT_RETENTION_DAYS;
});

afterAll(async () => {
  await cleanup();
  delete process.env.DOC_COVERAGE_SNAPSHOT_RETENTION_DAYS;
});

describe('getRetentionDays (Equoria-qr114)', () => {
  it('defaults to DEFAULT_RETENTION_DAYS when env unset', () => {
    delete process.env.DOC_COVERAGE_SNAPSHOT_RETENTION_DAYS;
    expect(getRetentionDays()).toBe(DEFAULT_RETENTION_DAYS);
  });

  it('honours a valid override', () => {
    process.env.DOC_COVERAGE_SNAPSHOT_RETENTION_DAYS = '30';
    expect(getRetentionDays()).toBe(30);
  });

  it('clamps to MIN_RETENTION_DAYS when env is below the floor', () => {
    process.env.DOC_COVERAGE_SNAPSHOT_RETENTION_DAYS = '1';
    expect(getRetentionDays()).toBe(MIN_RETENTION_DAYS);
  });

  it('falls back to default on a non-numeric / non-positive env', () => {
    process.env.DOC_COVERAGE_SNAPSHOT_RETENTION_DAYS = 'not-a-number';
    expect(getRetentionDays()).toBe(DEFAULT_RETENTION_DAYS);
    process.env.DOC_COVERAGE_SNAPSHOT_RETENTION_DAYS = '0';
    expect(getRetentionDays()).toBe(DEFAULT_RETENTION_DAYS);
  });
});

describe('computeCutoff (Equoria-qr114)', () => {
  it('subtracts retentionDays from the supplied now (UTC)', () => {
    const now = new Date('2026-06-12T00:00:00.000Z');
    const cutoff = computeCutoff(90, now);
    // 2026-06-12 minus 90 days = 2026-03-14
    expect(cutoff.toISOString()).toBe('2026-03-14T00:00:00.000Z');
  });
});

describe('CronJobService.recordDocCoverageSnapshot — real DB (Equoria-qr114)', () => {
  it('records a DocCoverageSnapshot row that is readable back', async () => {
    const result = await cronJobService.recordDocCoverageSnapshot();
    createdSnapshotIds.push(result.snapshotId);

    expect(result.snapshotId).toBeGreaterThan(0);
    expect(typeof result.coveragePct).toBe('number');
    expect(typeof result.qualityScore).toBe('number');
    expect(typeof result.deletedCount).toBe('number');
    expect(result.retentionDays).toBeGreaterThanOrEqual(MIN_RETENTION_DAYS);

    const fetched = await prisma.docCoverageSnapshot.findUnique({
      where: { id: result.snapshotId },
    });
    expect(fetched).not.toBeNull();
    expect(fetched.coveragePct).toBeCloseTo(result.coveragePct, 5);
    expect(fetched.qualityScore).toBe(result.qualityScore);
  });

  it('purges a snapshot older than the (clamped) window but retains a recent one', async () => {
    // Floor is 7 days; a sub-floor env clamps up to 7 so the cutoff is ~7 days
    // back. Seed one 30-day-old row (purged) and one 1-day-old row (retained).
    process.env.DOC_COVERAGE_SNAPSHOT_RETENTION_DAYS = '1';
    const now = Date.now();
    const oldRow = await seedSnapshot({
      coveragePct: 10,
      qualityScore: 5,
      capturedAt: new Date(now - 30 * 24 * 60 * 60 * 1000),
    });
    const recentRow = await seedSnapshot({
      coveragePct: 90,
      qualityScore: 80,
      capturedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
    });

    const result = await cronJobService.recordDocCoverageSnapshot();
    // The freshly-recorded row must also be tracked + cleaned up.
    createdSnapshotIds.push(result.snapshotId);

    // The clamped window is 7 days (floor), so the 30-day-old row is purged.
    expect(result.retentionDays).toBe(MIN_RETENTION_DAYS);
    expect(result.deletedCount).toBeGreaterThanOrEqual(1);

    const oldStillThere = await prisma.docCoverageSnapshot.findUnique({
      where: { id: oldRow.id },
    });
    expect(oldStillThere).toBeNull();

    const recentStillThere = await prisma.docCoverageSnapshot.findUnique({
      where: { id: recentRow.id },
    });
    expect(recentStillThere).not.toBeNull();

    // The freshly-recorded row is recent → retained.
    const fresh = await prisma.docCoverageSnapshot.findUnique({
      where: { id: result.snapshotId },
    });
    expect(fresh).not.toBeNull();
  });
});

describe('purgeExpiredDocCoverageSnapshots — real DB (Equoria-qr114)', () => {
  it('deletes rows older than the window and retains recent ones (scoped)', async () => {
    const now = new Date('2026-06-12T12:00:00.000Z');
    const old1 = await seedSnapshot({
      coveragePct: 10,
      qualityScore: 5,
      capturedAt: new Date('2026-01-01T00:00:00.000Z'), // ~160 days → purge
    });
    const recent = await seedSnapshot({
      coveragePct: 90,
      qualityScore: 80,
      capturedAt: new Date('2026-06-10T00:00:00.000Z'), // 2 days → retain
    });

    const result = await purgeExpiredDocCoverageSnapshots({ retentionDays: 90, now });

    expect(result.retentionDays).toBe(90);
    // deletedCount may include unrelated old rows in the canonical DB; assert
    // our specific fixtures' fate rather than an exact global count.
    expect(result.deletedCount).toBeGreaterThanOrEqual(1);

    expect(await prisma.docCoverageSnapshot.findUnique({ where: { id: old1.id } })).toBeNull();
    expect(await prisma.docCoverageSnapshot.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });

  it('clamps a sub-floor retentionDays so near-current rows are NOT wiped', async () => {
    const now = new Date('2026-06-12T12:00:00.000Z');
    // 5 days old. With retentionDays=1 clamped to MIN (7d) the cutoff is ~11
    // days back, so this row survives.
    const fiveDays = await seedSnapshot({
      coveragePct: 55,
      qualityScore: 40,
      capturedAt: new Date('2026-06-07T12:00:00.000Z'),
    });

    const result = await purgeExpiredDocCoverageSnapshots({ retentionDays: 1, now });
    expect(result.retentionDays).toBe(MIN_RETENTION_DAYS);

    expect(await prisma.docCoverageSnapshot.findUnique({ where: { id: fiveDays.id } })).not.toBeNull();
  });
});
