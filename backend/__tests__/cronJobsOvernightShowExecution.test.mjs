/**
 * Equoria-aghl (FR-CN8): Integration test for nightly show execution cron.
 *
 * Sentinel-positive test: seeds a Show with status='open' and closeDate in the
 * past, calls cronJobService.executeOvernightShows(), and asserts the show is
 * marked 'completed' with executedAt populated and a CompetitionResult row
 * created.
 *
 * Without the cron change in this commit, this test would never observe the
 * scoring/prize/completion pipeline executing without a manual HTTP admin call.
 *
 * Real DB. No mocks. Cleanup is scoped by TestFixture- prefix per CLAUDE.md
 * "REAL DB ONLY" rule.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import cronJobService from '../services/cronJobs.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';

const FIXTURE_PREFIX = 'TestFixture-CronOvernightExec';

let execUser;
let execHorse;
let pastShowId;

beforeAll(async () => {
  const uid = randomBytes(4).toString('hex');

  execUser = await prisma.user.create({
    data: {
      email: `${FIXTURE_PREFIX}-${uid}@test.com`,
      username: `${FIXTURE_PREFIX}-${uid}`,
      password: 'irrelevant-hash',
      firstName: 'Cron',
      lastName: 'OvernightExec',
      money: 10000,
      level: 1,
      xp: 0,
    },
  });

  execHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-Horse-${uid}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: execUser.id,
      healthStatus: 'healthy',
      speed: 60,
      stamina: 60,
      agility: 60,
      balance: 60,
      precision: 60,
      boldness: 60,
    },
  });

  const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

  const pastShow = await prisma.show.create({
    data: {
      name: `${FIXTURE_PREFIX}-Show-${uid}`,
      discipline: 'Dressage',
      entryFee: 0,
      levelMin: 1,
      levelMax: 999,
      prize: 1000,
      runDate: pastDate,
      status: 'open',
      openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      closeDate: pastDate,
      createdByUserId: execUser.id,
    },
  });
  pastShowId = pastShow.id;

  await prisma.showEntry.create({
    data: {
      showId: pastShowId,
      horseId: execHorse.id,
      userId: execUser.id,
      feePaid: 0,
    },
  });
}, 30000);

afterAll(async () => {
  if (pastShowId) {
    await prisma.competitionResult.deleteMany({ where: { showId: pastShowId } }).catch(() => {});
    await prisma.showEntry.deleteMany({ where: { showId: pastShowId } }).catch(() => {});
    await prisma.show.delete({ where: { id: pastShowId } }).catch(() => {});
  }
  if (execHorse) {
    await prisma.horse.delete({ where: { id: execHorse.id } }).catch(() => {});
  }
  if (execUser) {
    await prisma.user.delete({ where: { id: execUser.id } }).catch(() => {});
  }
  // Defensive cleanup in case test was interrupted earlier.
  await prisma.user
    .deleteMany({
      where: { username: { startsWith: FIXTURE_PREFIX } },
    })
    .catch(() => {});
}, 30000);

describe('CronJobService.executeOvernightShows() — Equoria-aghl', () => {
  it('marks an open show with past closeDate as completed and creates CompetitionResult rows', async () => {
    // Sanity: precondition holds — show is still 'open'.
    const beforeShow = await prisma.show.findUnique({ where: { id: pastShowId } });
    expect(beforeShow.status).toBe('open');
    expect(beforeShow.executedAt).toBeNull();

    // Action: run the cron handler exactly as the scheduler would.
    await cronJobService.executeOvernightShows();

    // Assert: show is now completed, executedAt populated, results created.
    const afterShow = await prisma.show.findUnique({ where: { id: pastShowId } });
    expect(afterShow.status).toBe('completed');
    // executedAt is a Date from Prisma — check truthiness + parseable timestamp
    // instead of toBeInstanceOf(Date) (cross-realm Date prototype mismatch).
    expect(afterShow.executedAt).toBeTruthy();
    expect(Number.isFinite(new Date(afterShow.executedAt).getTime())).toBe(true);

    const results = await prisma.competitionResult.findMany({
      where: { showId: pastShowId },
    });
    expect(results.length).toBe(1);
    expect(results[0].horseId).toBe(execHorse.id);
    expect(results[0].placement).toBe('1');
    // Prize for 1st place = floor(1000 * 0.5) = 500
    // prizeWon may be Prisma Decimal — coerce via Number() before comparison.
    expect(Number(results[0].prizeWon)).toBe(500);
  }, 30000);
});

describe('CronJobService — Equoria-aghl: cron registration', () => {
  it('registers nightlyShowExecution in the job map when started', () => {
    cronJobService.start();
    const status = cronJobService.getStatus();
    expect(status.serviceRunning).toBe(true);
    expect(status.jobs).toHaveProperty('nightlyShowExecution');
    cronJobService.stop();
  });
});
