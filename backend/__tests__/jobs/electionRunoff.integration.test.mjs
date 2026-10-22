/**
 * Club election run-off (Equoria-bvddn.22) — real DB, real closing job.
 *
 * Owner ruling 2026-10-22 (Stacey): a tied club election goes to a 1-day
 * run-off between the tied candidates; the run-off winner takes the seat.
 * The run-off runs for one Eastern game day. A run-off that is itself tied has
 * no rule yet (returned to the owner): it fails safe — no seat is assigned, no
 * further round is invented, and the election records an explicit `tied`
 * outcome that the job summary reports.
 *
 * Scoped cleanup only: every fixture user/club uses the PREFIX and is removed in
 * FK order by id.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { transitionElectionStatuses } from '../../services/jobs/impl/electionTransition.mjs';
import { gameDateParts, gameDayIndex, sameGameClockDaysLater } from '../../utils/gameTime.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';

const PREFIX = 'elec-runoff';
const ORIGIN = 'http://localhost:3000';
const HOUR = 3_600_000;

async function createUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${PREFIX}-${uid}`,
      username: `${PREFIX}_${uid}`,
      email: `${PREFIX}-${uid}@example.com`,
      firstName: 'Run',
      lastName: 'Off',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

/** A club whose members are `users` (the first is president). */
async function createClub(users) {
  return prisma.club.create({
    data: {
      name: `${PREFIX}-${randomBytes(4).toString('hex')}`,
      type: 'discipline',
      category: 'dressage',
      description: 'Run-off test club',
      leader: { connect: { id: users[0].id } },
      members: {
        create: users.map((u, i) => ({
          user: { connect: { id: u.id } },
          role: i === 0 ? 'president' : 'member',
        })),
      },
    },
  });
}

/**
 * An election that has just ended, with one candidacy per entry of `votes`
 * (candidate user, number of ballots). Voters are drawn from `voters`.
 */
async function endedElection(club, votes, voters, extra = {}) {
  const election = await prisma.clubElection.create({
    data: {
      clubId: club.id,
      position: 'president',
      status: 'open',
      startsAt: new Date(Date.now() - 48 * HOUR),
      endsAt: new Date(Date.now() - 60_000),
      ...extra,
    },
  });
  let v = 0;
  for (const [candidateUser, count] of votes) {
    const candidate = await prisma.clubCandidate.create({
      data: {
        electionId: election.id,
        userId: candidateUser.id,
        statement: `statement of ${candidateUser.username}`,
      },
    });
    for (let i = 0; i < count; i++) {
      await prisma.clubBallot.create({
        data: { electionId: election.id, candidateId: candidate.id, voterId: voters[v++].id },
      });
    }
  }
  return election;
}

async function cleanupSuite() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) {
    return;
  }
  const userIds = users.map(u => u.id);
  const clubs = await prisma.club.findMany({
    where: { leaderId: { in: userIds } },
    select: { id: true },
  });
  const clubIds = clubs.map(c => c.id);
  await prisma.clubBallot.deleteMany({ where: { voterId: { in: userIds } } });
  // winnerCandidateId and runoffOfId are ON DELETE SET NULL, so candidates and
  // linked rounds delete in this order without unlinking first.
  await prisma.clubCandidate.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.clubMembership.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.clubElection.deleteMany({ where: { clubId: { in: clubIds } } });
  await prisma.club.deleteMany({ where: { id: { in: clubIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

/** Five members: three candidates (a, b, c) and voters drawn from all five. */
async function setup() {
  const users = [];
  for (let i = 0; i < 5; i++) {
    users.push(await createUser());
  }
  const club = await createClub(users);
  const [a, b, c] = users;
  return { users, club, a, b, c };
}

const runoffOf = parentId => prisma.clubElection.findFirst({ where: { runoffOfId: parentId } });

describe('Club election run-off (Equoria-bvddn.22) — real DB', () => {
  beforeAll(cleanupSuite);
  afterEach(cleanupSuite);
  afterAll(cleanupSuite);

  it('sends a tied election to a one-Eastern-day run-off between ONLY the tied candidates', async () => {
    const { users, club, a, b, c } = await setup();
    const election = await endedElection(
      club,
      [
        [a, 2],
        [b, 2],
        [c, 1],
      ],
      users,
    );

    const before = Date.now();
    const result = await transitionElectionStatuses();

    const parent = await prisma.clubElection.findUnique({ where: { id: election.id } });
    expect(parent.status).toBe('closed');
    expect(parent.outcome).toBe('runoff');
    expect(parent.winnerCandidateId).toBeNull();

    const runoff = await runoffOf(election.id);
    expect(runoff).not.toBeNull();
    expect(runoff.clubId).toBe(club.id);
    expect(runoff.position).toBe('president');
    expect(runoff.status).toBe('open');
    expect(runoff.startsAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    // One Eastern game day: the next Eastern calendar day, same Eastern clock.
    expect(gameDayIndex(runoff.endsAt)).toBe(gameDayIndex(runoff.startsAt) + 1);
    expect(runoff.endsAt).toEqual(sameGameClockDaysLater(runoff.startsAt, 1));

    const runoffCandidates = await prisma.clubCandidate.findMany({
      where: { electionId: runoff.id },
      orderBy: { id: 'asc' },
    });
    expect(runoffCandidates.map(rc => rc.userId).sort()).toEqual([a.id, b.id].sort());
    expect(runoffCandidates.find(rc => rc.userId === a.id).statement).toBe(`statement of ${a.username}`);
    expect(result.runoffs).toBeGreaterThanOrEqual(1);
  }, 60000);

  it('creates the run-off once, however often the job runs', async () => {
    const { users, club, a, b } = await setup();
    const election = await endedElection(
      club,
      [
        [a, 1],
        [b, 1],
      ],
      users,
    );

    await transitionElectionStatuses();
    await transitionElectionStatuses();

    const rounds = await prisma.clubElection.count({ where: { runoffOfId: election.id } });
    expect(rounds).toBe(1);
  }, 60000);

  it('gives the seat to the run-off winner, on the run-off and on the tied election', async () => {
    const { users, club, a, b } = await setup();
    const election = await endedElection(
      club,
      [
        [a, 1],
        [b, 1],
      ],
      users,
    );
    await transitionElectionStatuses();
    const runoff = await runoffOf(election.id);

    // The run-off is voted 2-1 for b, then its day ends.
    const [ra, rb] = await Promise.all(
      [a, b].map(u =>
        prisma.clubCandidate.findUnique({
          where: { electionId_userId: { electionId: runoff.id, userId: u.id } },
        }),
      ),
    );
    await prisma.clubBallot.createMany({
      data: [
        { electionId: runoff.id, candidateId: rb.id, voterId: users[2].id },
        { electionId: runoff.id, candidateId: rb.id, voterId: users[3].id },
        { electionId: runoff.id, candidateId: ra.id, voterId: users[4].id },
      ],
    });
    await prisma.clubElection.update({
      where: { id: runoff.id },
      data: { endsAt: new Date(Date.now() - 60_000) },
    });

    await transitionElectionStatuses();

    const decided = await prisma.clubElection.findUnique({ where: { id: runoff.id } });
    expect(decided.status).toBe('closed');
    expect(decided.outcome).toBe('won');
    expect(decided.winnerCandidateId).toBe(rb.id);

    const parent = await prisma.clubElection.findUnique({ where: { id: election.id } });
    const parentB = await prisma.clubCandidate.findUnique({
      where: { electionId_userId: { electionId: election.id, userId: b.id } },
    });
    expect(parent.outcome).toBe('runoff');
    expect(parent.winnerCandidateId).toBe(parentB.id);
  }, 60000);

  it('fails safe on a tied run-off: explicit tied outcome, no seat, no further round', async () => {
    const { users, club, a, b } = await setup();
    const election = await endedElection(
      club,
      [
        [a, 1],
        [b, 1],
      ],
      users,
    );
    await transitionElectionStatuses();
    const runoff = await runoffOf(election.id);
    const [ra, rb] = await Promise.all(
      [a, b].map(u =>
        prisma.clubCandidate.findUnique({
          where: { electionId_userId: { electionId: runoff.id, userId: u.id } },
        }),
      ),
    );
    await prisma.clubBallot.createMany({
      data: [
        { electionId: runoff.id, candidateId: ra.id, voterId: users[2].id },
        { electionId: runoff.id, candidateId: rb.id, voterId: users[3].id },
      ],
    });
    await prisma.clubElection.update({
      where: { id: runoff.id },
      data: { endsAt: new Date(Date.now() - 60_000) },
    });

    const result = await transitionElectionStatuses();

    const tied = await prisma.clubElection.findUnique({ where: { id: runoff.id } });
    expect(tied.status).toBe('closed');
    expect(tied.outcome).toBe('tied');
    expect(tied.winnerCandidateId).toBeNull();
    expect(await runoffOf(runoff.id)).toBeNull();
    const parent = await prisma.clubElection.findUnique({ where: { id: election.id } });
    expect(parent.winnerCandidateId).toBeNull();
    expect(result.tiedElectionIds).toContain(runoff.id);
  }, 60000);

  it('records the outright winner of an untied election and creates no run-off', async () => {
    const { users, club, a, b } = await setup();
    const election = await endedElection(
      club,
      [
        [a, 1],
        [b, 3],
      ],
      users,
    );

    await transitionElectionStatuses();

    const closed = await prisma.clubElection.findUnique({ where: { id: election.id } });
    const cb = await prisma.clubCandidate.findUnique({
      where: { electionId_userId: { electionId: election.id, userId: b.id } },
    });
    expect(closed.outcome).toBe('won');
    expect(closed.winnerCandidateId).toBe(cb.id);
    expect(await runoffOf(election.id)).toBeNull();
  }, 60000);

  it('closes an election with no candidates without an outcome or run-off', async () => {
    const { users, club } = await setup();
    const election = await endedElection(club, [], users);

    await transitionElectionStatuses();

    const closed = await prisma.clubElection.findUnique({ where: { id: election.id } });
    expect(closed.status).toBe('closed');
    expect(closed.outcome).toBeNull();
    expect(await runoffOf(election.id)).toBeNull();
  }, 60000);

  it('refuses new nominations into a run-off — its candidates are the tied ones', async () => {
    const { users, club, a, b, c } = await setup();
    const election = await endedElection(
      club,
      [
        [a, 1],
        [b, 1],
      ],
      users,
    );
    await transitionElectionStatuses();
    const runoff = await runoffOf(election.id);

    const token = generateTestToken({ id: c.id, email: c.email, role: 'user' });
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/clubs/elections/${runoff.id}/nominate`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ statement: 'let me in' });

    expect(res.status).toBe(400);
    expect(await prisma.clubCandidate.count({ where: { electionId: runoff.id } })).toBe(2);
  }, 60000);
});

describe('sameGameClockDaysLater — one Eastern game day (Equoria-bvddn.22)', () => {
  it('keeps the Eastern wall clock across the spring daylight-saving change', () => {
    // 2026-03-07 10:30 EST -> 2026-03-08 10:30 EDT (a 23-hour day).
    const end = sameGameClockDaysLater(new Date('2026-03-07T15:30:00Z'), 1);
    expect(end.toISOString()).toBe('2026-03-08T14:30:00.000Z');
  });

  it('keeps the Eastern wall clock across the autumn daylight-saving change', () => {
    // 2026-10-31 21:15 EDT -> 2026-11-01 21:15 EST (a 25-hour day).
    const end = sameGameClockDaysLater(new Date('2026-11-01T01:15:00Z'), 1);
    expect(end.toISOString()).toBe('2026-11-02T02:15:00.000Z');
    const p = gameDateParts(end);
    expect([p.hour, p.minute]).toEqual([21, 15]);
  });
});
