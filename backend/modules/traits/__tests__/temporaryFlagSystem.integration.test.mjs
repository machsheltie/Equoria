/**
 * temporaryFlagSystem.integration.test.mjs (Equoria-yzqhj.5)
 *
 * Real-DB integration proof for temporary / environment-triggered epigenetic
 * flags. No mocks (CLAUDE.md Testing Philosophy). Scoped cleanup via collected
 * ids + TestFixture- naming (CLAUDE.md §2).
 *
 * Coverage (the full set → expire lifecycle):
 *   (a) An environmental event (startle / routine_change) SETS a temporary flag
 *       with a FUTURE expiresAt in the new Horse.temporaryEpigeneticFlags
 *       column (and never touches the permanent epigeneticFlags String[]).
 *   (b) Dedup: re-triggering the same event REFRESHES expiresAt rather than
 *       appending a duplicate entry.
 *   (c) Sentinel: a flag whose expiresAt is already in the PAST is removed by
 *       sweepExpiredTemporaryFlags(), while a still-future flag (on the same
 *       horse AND on another horse) is RETAINED — proving the sweep only
 *       removes expired entries, not all of them.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../db/index.mjs';
import {
  applyTemporaryFlag,
  sweepExpiredTemporaryFlags,
  normalizeTempFlags,
  TEMPORARY_FLAG_DURATION_DAYS,
} from '../../../services/temporaryFlagSystem.mjs';
import { applyEnvironmentalEventFlag } from '../../../services/environmentalTriggerSystem.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';

const randHex = () => Math.random().toString(16).slice(2, 10);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('temporary epigenetic flags — real DB (Equoria-yzqhj.5)', () => {
  const created = [];
  let user;
  let horseAId;
  let horseBId;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        username: `TestFixture-tempflag-${randHex()}`,
        email: `testfixture-tempflag-${randHex()}@example.com`,
        password: 'x',
        firstName: 'TestFixture',
        lastName: 'TempFlag',
      },
    });

    const dob = new Date(Date.now() - 7 * MS_PER_DAY);
    const horseA = await createTestHorse(
      prisma,
      {
        name: `TestFixture-tempflag-A-${randHex()}`,
        sex: 'Filly',
        dateOfBirth: dob,
        userId: user.id,
        epigeneticFlags: [],
      },
      created,
    );
    horseAId = horseA.id;

    const horseB = await createTestHorse(
      prisma,
      {
        name: `TestFixture-tempflag-B-${randHex()}`,
        sex: 'Colt',
        dateOfBirth: dob,
        userId: user.id,
        epigeneticFlags: [],
      },
      created,
    );
    horseBId = horseB.id;
  });

  afterAll(async () => {
    await cleanupTestHorses(prisma, created);
    if (user) {
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });

  it('(a) a startle environmental event sets a temporary flag with a future expiresAt', async () => {
    const now = new Date();
    const result = await applyEnvironmentalEventFlag(horseAId, 'startle', { now });

    expect(result).not.toBeNull();
    expect(result.flag).toBe('startled');
    // expiresAt is in the future, ~3 days out per the catalog.
    const expiresMs = new Date(result.expiresAt).getTime();
    expect(expiresMs).toBeGreaterThan(now.getTime());
    const expectedMs = now.getTime() + TEMPORARY_FLAG_DURATION_DAYS.startled * MS_PER_DAY;
    expect(Math.abs(expiresMs - expectedMs)).toBeLessThan(5000);

    // Persisted to the NEW column, and the permanent String[] is untouched.
    const horse = await prisma.horse.findUnique({
      where: { id: horseAId },
      select: { temporaryEpigeneticFlags: true, epigeneticFlags: true },
    });
    const temp = normalizeTempFlags(horse.temporaryEpigeneticFlags);
    expect(temp.map(e => e.flag)).toContain('startled');
    expect(temp.find(e => e.flag === 'startled').source).toBe('environmental_event:startle');
    expect(horse.epigeneticFlags).toEqual([]); // permanent flags NOT touched
  });

  it('(b) re-triggering the same event refreshes expiresAt without duplicating', async () => {
    const t1 = new Date();
    await applyTemporaryFlag(horseAId, 'startled', { source: 'manual', now: t1 });
    const t2 = new Date(t1.getTime() + 60 * 1000); // 1 minute later
    await applyTemporaryFlag(horseAId, 'startled', { source: 'manual', now: t2 });

    const horse = await prisma.horse.findUnique({
      where: { id: horseAId },
      select: { temporaryEpigeneticFlags: true },
    });
    const temp = normalizeTempFlags(horse.temporaryEpigeneticFlags);
    const startledEntries = temp.filter(e => e.flag === 'startled');
    expect(startledEntries).toHaveLength(1); // deduped, not duplicated
    // Refreshed to the later trigger's expiry.
    const expectedMs = t2.getTime() + TEMPORARY_FLAG_DURATION_DAYS.startled * MS_PER_DAY;
    expect(Math.abs(new Date(startledEntries[0].expiresAt).getTime() - expectedMs)).toBeLessThan(5000);
  });

  it('(c) sweep removes only expired flags, retaining still-future ones (sentinel)', async () => {
    const now = new Date();

    // Horse A: one ALREADY-EXPIRED flag + one STILL-FUTURE flag.
    const pastExpiry = new Date(now.getTime() - 1 * MS_PER_DAY).toISOString();
    const futureExpiry = new Date(now.getTime() + 2 * MS_PER_DAY).toISOString();
    await prisma.horse.update({
      where: { id: horseAId },
      data: {
        temporaryEpigeneticFlags: [
          { flag: 'startled', expiresAt: pastExpiry, source: 'test-expired' },
          { flag: 'unsettled', expiresAt: futureExpiry, source: 'test-future' },
        ],
      },
    });

    // Horse B: a still-future flag that must survive the sweep untouched.
    const horseBFuture = new Date(now.getTime() + 5 * MS_PER_DAY).toISOString();
    await prisma.horse.update({
      where: { id: horseBId },
      data: {
        temporaryEpigeneticFlags: [{ flag: 'unsettled', expiresAt: horseBFuture, source: 'test-future-b' }],
      },
    });

    const summary = await sweepExpiredTemporaryFlags({ now });

    expect(summary.flagsRemoved).toBeGreaterThanOrEqual(1);
    expect(summary.horsesUpdated).toBeGreaterThanOrEqual(1);

    // Horse A: expired 'startled' gone, future 'unsettled' retained.
    const a = await prisma.horse.findUnique({
      where: { id: horseAId },
      select: { temporaryEpigeneticFlags: true },
    });
    const aFlags = normalizeTempFlags(a.temporaryEpigeneticFlags).map(e => e.flag);
    expect(aFlags).not.toContain('startled'); // expired → removed
    expect(aFlags).toContain('unsettled'); // future → retained

    // Horse B: untouched future flag still present.
    const b = await prisma.horse.findUnique({
      where: { id: horseBId },
      select: { temporaryEpigeneticFlags: true },
    });
    const bFlags = normalizeTempFlags(b.temporaryEpigeneticFlags).map(e => e.flag);
    expect(bFlags).toContain('unsettled'); // sweep did not remove a non-expired flag
  });
});
