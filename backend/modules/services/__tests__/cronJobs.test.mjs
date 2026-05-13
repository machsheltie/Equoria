/**
 * CronJobService — pure branch-coverage tests (Equoria-jkht) +
 * transitionElectionStatuses integration tests (Equoria-ox9l)
 *
 * Targets branches reachable without any database call:
 *   start()  — isRunning guard (second call returns early)
 *   stop()   — !isRunning guard (call before start returns early)
 *   evaluateFoalTraits() — currentDay > 6 early return (no DB)
 *   getStatus() — before and after start (pure getter)
 *
 * Tests that would reach prisma.horse.update (currentDay <= 6 paths) are
 * intentionally omitted because evaluateTraitRevelation uses Math.random —
 * a revealed trait triggers a DB update for a non-existent ID, making those
 * paths non-deterministic and unsafe to assert against.
 *
 * transitionElectionStatuses() integration tests use real DB fixtures prefixed
 * 'cron-' and clean up after each test.
 */

import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import cronJobService from '../../../services/cronJobs.mjs';
import prisma from '../../../db/index.mjs';

// Restore singleton to clean state after every test so tests don't bleed.
afterEach(() => {
  if (cronJobService.isRunning) {
    cronJobService.stop();
  }
});

// ─── getStatus() ─────────────────────────────────────────────────────────────

describe('CronJobService.getStatus()', () => {
  it('returns serviceRunning:false and totalJobs:0 before start', () => {
    const status = cronJobService.getStatus();
    expect(status.serviceRunning).toBe(false);
    expect(status.totalJobs).toBe(0);
    expect(typeof status.jobs).toBe('object');
  });

  it('returns serviceRunning:true, totalJobs:3, and all job keys after start', () => {
    cronJobService.start();
    const status = cronJobService.getStatus();
    expect(status.serviceRunning).toBe(true);
    expect(status.totalJobs).toBe(3);
    expect(status.jobs).toHaveProperty('dailyTraitEvaluation');
    expect(status.jobs).toHaveProperty('dailyHorseAging');
    expect(status.jobs).toHaveProperty('electionStatusTransition');
  });
});

// ─── start() ─────────────────────────────────────────────────────────────────

describe('CronJobService.start()', () => {
  it('sets isRunning to true on first call', () => {
    cronJobService.start();
    expect(cronJobService.isRunning).toBe(true);
  });

  it('second start() call (isRunning branch) warns and returns without throwing', () => {
    cronJobService.start();
    expect(cronJobService.isRunning).toBe(true);

    // covers the `if (this.isRunning) { return; }` branch
    expect(() => cronJobService.start()).not.toThrow();

    // service remains running; no duplicate jobs added
    expect(cronJobService.isRunning).toBe(true);
    expect(cronJobService.getStatus().totalJobs).toBe(3);
  });
});

// ─── stop() ──────────────────────────────────────────────────────────────────

describe('CronJobService.stop()', () => {
  it('sets isRunning to false after a successful stop', () => {
    cronJobService.start();
    cronJobService.stop();
    expect(cronJobService.isRunning).toBe(false);
  });

  it('stop() before start (!isRunning branch) warns and returns without throwing', () => {
    // Precondition: service is not running
    expect(cronJobService.isRunning).toBe(false);

    // covers the `if (!this.isRunning) { return; }` branch
    expect(() => cronJobService.stop()).not.toThrow();

    expect(cronJobService.isRunning).toBe(false);
  });

  it('start → stop → getStatus reflects stopped state', () => {
    cronJobService.start();
    expect(cronJobService.getStatus().serviceRunning).toBe(true);

    cronJobService.stop();
    expect(cronJobService.getStatus().serviceRunning).toBe(false);
  });
});

// ─── evaluateFoalTraits() — pure early-exit branch ───────────────────────────

describe('CronJobService.evaluateFoalTraits() — currentDay > 6 early exit', () => {
  it('returns development_complete when currentDay is 7', async () => {
    const foal = {
      id: 999901,
      name: 'TestFoal-CronBranch-7',
      foalDevelopment: { currentDay: 7 },
      epigeneticModifiers: null,
    };
    const result = await cronJobService.evaluateFoalTraits(foal);
    expect(result).toEqual({ traitsRevealed: 0, reason: 'development_complete' });
  });

  it('returns development_complete when currentDay is 20', async () => {
    const foal = {
      id: 999902,
      name: 'TestFoal-CronBranch-20',
      foalDevelopment: { currentDay: 20 },
      epigeneticModifiers: { positive: ['resilient'], negative: [], hidden: [] },
    };
    const result = await cronJobService.evaluateFoalTraits(foal);
    expect(result.reason).toBe('development_complete');
    expect(result.traitsRevealed).toBe(0);
  });

  it('returns development_complete when currentDay is exactly boundary+1 (day 7)', async () => {
    // Boundary: day 6 is still in development; day 7 exits early
    const foal = {
      id: 999903,
      name: 'TestFoal-CronBranch-boundary',
      foalDevelopment: { currentDay: 7 },
      epigeneticModifiers: null,
    };
    const result = await cronJobService.evaluateFoalTraits(foal);
    expect(result).toEqual({ traitsRevealed: 0, reason: 'development_complete' });
  });
});

// ─── transitionElectionStatuses() — real DB integration ──────────────────────

const CRON_PREFIX = 'cron-elec';

async function createCronUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${CRON_PREFIX}-${uid}`,
      username: `${CRON_PREFIX}_${uid}`,
      email: `${CRON_PREFIX}-${uid}@example.com`,
      firstName: 'Cron',
      lastName: 'ElecTest',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

async function createCronClub(leaderId) {
  const uid = randomBytes(4).toString('hex');
  return prisma.club.create({
    data: {
      name: `${CRON_PREFIX}-${uid}`,
      type: 'discipline',
      category: 'racing',
      description: 'Cron test club',
      leader: { connect: { id: leaderId } },
      members: {
        create: { user: { connect: { id: leaderId } }, role: 'president' },
      },
    },
  });
}

async function cleanupCronElecSuite() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: CRON_PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) {
    return;
  }
  const userIds = users.map(u => u.id);
  await prisma.clubBallot.deleteMany({ where: { voterId: { in: userIds } } });
  await prisma.clubCandidate.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.clubMembership.deleteMany({ where: { userId: { in: userIds } } });
  const clubs = await prisma.club.findMany({
    where: { leaderId: { in: userIds } },
    select: { id: true },
  });
  const clubIds = clubs.map(c => c.id);
  if (clubIds.length > 0) {
    await prisma.clubElection.deleteMany({ where: { clubId: { in: clubIds } } });
  }
  await prisma.club.deleteMany({ where: { leaderId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('CronJobService.transitionElectionStatuses() — real DB', () => {
  beforeAll(cleanupCronElecSuite);
  afterAll(cleanupCronElecSuite);
  afterEach(cleanupCronElecSuite);

  it('transitions upcoming→open when startsAt has passed', async () => {
    const leader = await createCronUser();
    const club = await createCronClub(leader.id);
    const election = await prisma.clubElection.create({
      data: {
        club: { connect: { id: club.id } },
        position: 'vice-president',
        status: 'upcoming',
        startsAt: new Date(Date.now() - 60_000), // 1 min ago
        endsAt: new Date(Date.now() + 86_400_000), // tomorrow
      },
    });

    const result = await cronJobService.transitionElectionStatuses();

    expect(result.opened).toBeGreaterThanOrEqual(1);
    const updated = await prisma.clubElection.findUnique({ where: { id: election.id } });
    expect(updated.status).toBe('open');
  });

  it('transitions open→closed when endsAt has passed', async () => {
    const leader = await createCronUser();
    const club = await createCronClub(leader.id);
    const election = await prisma.clubElection.create({
      data: {
        club: { connect: { id: club.id } },
        position: 'vice-president',
        status: 'open',
        startsAt: new Date(Date.now() - 86_400_000), // yesterday
        endsAt: new Date(Date.now() - 60_000), // 1 min ago
      },
    });

    const result = await cronJobService.transitionElectionStatuses();

    expect(result.closed).toBeGreaterThanOrEqual(1);
    const updated = await prisma.clubElection.findUnique({ where: { id: election.id } });
    expect(updated.status).toBe('closed');
  });

  it('transitions upcoming→closed when both startsAt and endsAt have passed', async () => {
    // An election created as upcoming whose window has entirely passed
    const leader = await createCronUser();
    const club = await createCronClub(leader.id);
    const election = await prisma.clubElection.create({
      data: {
        club: { connect: { id: club.id } },
        position: 'vice-president',
        status: 'upcoming',
        startsAt: new Date(Date.now() - 7_200_000), // 2 hrs ago
        endsAt: new Date(Date.now() - 3_600_000), // 1 hr ago
      },
    });

    await cronJobService.transitionElectionStatuses();

    // The cron runs open-transition first, then closed-transition, so the
    // election ends up closed in one pass.
    const updated = await prisma.clubElection.findUnique({ where: { id: election.id } });
    expect(updated.status).toBe('closed');
  });

  it('does not close an election that is still running', async () => {
    const leader = await createCronUser();
    const club = await createCronClub(leader.id);
    const election = await prisma.clubElection.create({
      data: {
        club: { connect: { id: club.id } },
        position: 'vice-president',
        status: 'open',
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 86_400_000), // tomorrow
      },
    });

    await cronJobService.transitionElectionStatuses();

    const unchanged = await prisma.clubElection.findUnique({ where: { id: election.id } });
    expect(unchanged.status).toBe('open');
  });

  it('does not re-transition an already-closed election', async () => {
    const leader = await createCronUser();
    const club = await createCronClub(leader.id);
    const election = await prisma.clubElection.create({
      data: {
        club: { connect: { id: club.id } },
        position: 'vice-president',
        status: 'closed',
        startsAt: new Date(Date.now() - 172_800_000), // 2 days ago
        endsAt: new Date(Date.now() - 86_400_000), // yesterday
      },
    });

    const result = await cronJobService.transitionElectionStatuses();

    // The closed election must not appear in the closed count (it was already closed)
    const unchanged = await prisma.clubElection.findUnique({ where: { id: election.id } });
    expect(unchanged.status).toBe('closed');
    // closed count excludes already-closed rows
    expect(result.closed).toBe(0);
  });

  it('returns opened=0 closed=0 when no elections need transitions', async () => {
    const result = await cronJobService.transitionElectionStatuses();
    expect(result.opened).toBe(0);
    expect(result.closed).toBe(0);
  });
});
