/**
 * Integration test: election-transition impl module (Equoria-urqic.3)
 *
 * Proves the EXTRACTED impl module
 * (backend/services/jobs/impl/electionTransition.mjs) is individually testable
 * against the REAL database (no mocks), independent of the CronJobService
 * orchestrator. cronJobs.test.mjs continues to exercise the singleton delegator
 * (cronJobService.transitionElectionStatuses); this suite locks the free
 * function directly.
 *
 * Scoped cleanup only (CLAUDE.md §2): every fixture user/club/election uses the
 * CRON_PREFIX and is deleted in FK order, scoped to the ids this suite created.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';
import { transitionElectionStatuses } from '../../services/jobs/impl/electionTransition.mjs';

const CRON_PREFIX = 'cron-elec-impl';

async function createUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${CRON_PREFIX}-${uid}`,
      username: `${CRON_PREFIX}_${uid}`,
      email: `${CRON_PREFIX}-${uid}@example.com`,
      firstName: 'Cron',
      lastName: 'ElecImpl',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

async function createClub(leaderId) {
  const uid = randomBytes(4).toString('hex');
  return prisma.club.create({
    data: {
      name: `${CRON_PREFIX}-${uid}`,
      type: 'discipline',
      category: 'racing',
      description: 'Cron impl test club',
      leader: { connect: { id: leaderId } },
      members: { create: { user: { connect: { id: leaderId } }, role: 'president' } },
    },
  });
}

async function cleanupSuite() {
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

describe('INTEGRATION: electionTransition impl (Equoria-urqic.3) — real DB', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  it('transitions upcoming -> open when startsAt has passed', async () => {
    const leader = await createUser();
    const club = await createClub(leader.id);
    const election = await prisma.clubElection.create({
      data: {
        club: { connect: { id: club.id } },
        position: 'vice-president',
        status: 'upcoming',
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 86_400_000),
      },
    });

    const result = await transitionElectionStatuses();

    expect(result.opened).toBeGreaterThanOrEqual(1);
    const updated = await prisma.clubElection.findUnique({ where: { id: election.id } });
    expect(updated.status).toBe('open');
  }, 60000);

  it('transitions open -> closed when endsAt has passed', async () => {
    const leader = await createUser();
    const club = await createClub(leader.id);
    const election = await prisma.clubElection.create({
      data: {
        club: { connect: { id: club.id } },
        position: 'president',
        status: 'open',
        startsAt: new Date(Date.now() - 172_800_000),
        endsAt: new Date(Date.now() - 60_000),
      },
    });

    const result = await transitionElectionStatuses();

    expect(result.closed).toBeGreaterThanOrEqual(1);
    const updated = await prisma.clubElection.findUnique({ where: { id: election.id } });
    expect(updated.status).toBe('closed');
  }, 60000);

  it('leaves a not-yet-due upcoming election untouched', async () => {
    const leader = await createUser();
    const club = await createClub(leader.id);
    const election = await prisma.clubElection.create({
      data: {
        club: { connect: { id: club.id } },
        position: 'secretary',
        status: 'upcoming',
        startsAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 172_800_000),
      },
    });

    await transitionElectionStatuses();

    const updated = await prisma.clubElection.findUnique({ where: { id: election.id } });
    expect(updated.status).toBe('upcoming');
  }, 60000);

  it('returns numeric { opened, closed } counts', async () => {
    const result = await transitionElectionStatuses();
    expect(typeof result.opened).toBe('number');
    expect(typeof result.closed).toBe('number');
  }, 60000);
});
