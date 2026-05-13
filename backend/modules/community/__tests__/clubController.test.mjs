/**
 * clubController.test.mjs — real DB
 *
 * NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted from
 * jest.unstable_mockModule of prismaClient + logger to a real-DB integration
 * test against the equoria_test database.
 *
 * Coverage: getClubs, getMyClubs, createClub, getClub, joinClub, leaveClub,
 * getElections, createElection, nominate, vote, getElectionResults,
 * transferLeadership.
 *
 * Removed (per doctrine):
 *   - "returns 500 on database error" tests that mocked Prisma to reject
 *     — synthetic Prisma fault injection forbidden.
 *   - The "P2002 unique constraint" test for double-vote — real DB enforces
 *     the uniqueness organically, so we test the real second-vote path.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../db/index.mjs';
import {
  getClubs,
  getMyClubs,
  createClub,
  getClub,
  joinClub,
  leaveClub,
  getElections,
  createElection,
  nominate,
  vote,
  getElectionResults,
  transferLeadership,
} from '../controllers/clubController.mjs';

const SUITE_PREFIX = 'club';

function makeReqRes(userId, overrides = {}) {
  let _status = 200;
  let _body = null;
  return {
    req: { user: { id: userId }, body: {}, params: {}, query: {}, ...overrides },
    res: {
      status(c) {
        _status = c;
        return this;
      },
      json(b) {
        _body = b;
        return this;
      },
      get statusValue() {
        return _status;
      },
      get jsonValue() {
        return _body;
      },
    },
  };
}

async function createUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'Club',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

async function createClubInDb(leaderId, overrides = {}) {
  return prisma.club.create({
    data: {
      name: overrides.name ?? `${SUITE_PREFIX}-${randomBytes(4).toString('hex')}`,
      type: overrides.type ?? 'discipline',
      category: overrides.category ?? 'racing',
      description: overrides.description ?? 'Test club',
      leader: { connect: { id: leaderId } },
      members: {
        create: {
          user: { connect: { id: leaderId } },
          role: 'president',
        },
      },
    },
  });
}

async function joinClubInDb(clubId, userId, role = 'member') {
  return prisma.clubMembership.create({
    data: {
      club: { connect: { id: clubId } },
      user: { connect: { id: userId } },
      role,
    },
  });
}

async function createElectionInDb(clubId, overrides = {}) {
  return prisma.clubElection.create({
    data: {
      club: { connect: { id: clubId } },
      position: overrides.position ?? 'vice-president',
      status: overrides.status ?? 'open',
      startsAt: overrides.startsAt ?? new Date(Date.now() - 1000),
      endsAt: overrides.endsAt ?? new Date(Date.now() + 86400000),
    },
  });
}

async function createCandidateInDb(electionId, userId, statement = 'My pledge') {
  return prisma.clubCandidate.create({
    data: {
      election: { connect: { id: electionId } },
      user: { connect: { id: userId } },
      statement,
    },
  });
}

async function cleanupSuite() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) {
    return;
  }
  const userIds = users.map(u => u.id);
  // Cascade order: ballots → candidates → memberships → elections → clubs → users
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

describe('clubController (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  describe('getClubs', () => {
    it('returns clubs list with memberCount and stripped _count', async () => {
      const leader = await createUser();
      const club = await createClubInDb(leader.id, {
        name: `${SUITE_PREFIX}-dressage-${randomBytes(4).toString('hex')}`,
      });

      const h = makeReqRes(leader.id, { query: {} });
      await getClubs(h.req, h.res);

      const body = h.res.jsonValue;
      expect(body.success).toBe(true);
      const matched = body.data.clubs.find(c => c.id === club.id);
      expect(matched).toMatchObject({ memberCount: 1 });
      expect(matched._count).toBeUndefined();
    });

    it('filters by type query param', async () => {
      const leader = await createUser();
      const discipline = await createClubInDb(leader.id, { type: 'discipline' });
      const breed = await createClubInDb(leader.id, { type: 'breed' });

      const h = makeReqRes(leader.id, { query: { type: 'breed' } });
      await getClubs(h.req, h.res);

      const ids = h.res.jsonValue.data.clubs.map(c => c.id);
      expect(ids).toContain(breed.id);
      expect(ids).not.toContain(discipline.id);
    });
  });

  describe('createClub', () => {
    it('creates club and membership atomically, returns 201', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, {
        body: {
          name: `${SUITE_PREFIX}-Speed-${randomBytes(4).toString('hex')}`,
          type: 'discipline',
          category: 'racing',
          description: 'Fast horses',
        },
      });
      await createClub(h.req, h.res);

      expect(h.res.statusValue).toBe(201);
      expect(h.res.jsonValue.success).toBe(true);
      const newClub = h.res.jsonValue.data.club;

      // Verify the club + membership were created.
      const clubInDb = await prisma.club.findUnique({ where: { id: newClub.id } });
      expect(clubInDb).not.toBeNull();
      const membership = await prisma.clubMembership.findFirst({
        where: { clubId: newClub.id, userId: user.id },
      });
      expect(membership).not.toBeNull();
      expect(membership.role).toBe('president');
    });

    it('returns 409 when club name already taken', async () => {
      const user = await createUser();
      const taken = await createClubInDb(user.id, { name: `${SUITE_PREFIX}-Taken-${randomBytes(4).toString('hex')}` });

      const h = makeReqRes(user.id, { body: { name: taken.name } });
      await createClub(h.req, h.res);

      expect(h.res.statusValue).toBe(409);
      expect(h.res.jsonValue).toMatchObject({
        success: false,
        message: expect.stringContaining('taken'),
      });
    });
  });

  describe('getClub', () => {
    it('returns club with members when found', async () => {
      const user = await createUser();
      const club = await createClubInDb(user.id);

      const h = makeReqRes(user.id, { params: { id: String(club.id) } });
      await getClub(h.req, h.res);

      expect(h.res.jsonValue.success).toBe(true);
      expect(h.res.jsonValue.data.club.id).toBe(club.id);
    });

    it('returns 404 when club does not exist', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '999999999' } });
      await getClub(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue.message).toMatch(/not found/i);
    });

    it('returns 400 for invalid club ID', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: 'abc' } });
      await getClub(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
    });
  });

  describe('joinClub', () => {
    it('creates membership and returns 201', async () => {
      const owner = await createUser();
      const joiner = await createUser();
      const club = await createClubInDb(owner.id);

      const h = makeReqRes(joiner.id, { params: { id: String(club.id) } });
      await joinClub(h.req, h.res);

      expect(h.res.statusValue).toBe(201);
      const membership = await prisma.clubMembership.findFirst({
        where: { clubId: club.id, userId: joiner.id },
      });
      expect(membership).not.toBeNull();
      expect(membership.role).toBe('member');
    });

    it('returns 409 when user is already a member', async () => {
      const user = await createUser();
      const club = await createClubInDb(user.id); // user is auto-president

      const h = makeReqRes(user.id, { params: { id: String(club.id) } });
      await joinClub(h.req, h.res);

      expect(h.res.statusValue).toBe(409);
      expect(h.res.jsonValue.message).toMatch(/Already/);
    });

    it('returns 404 when club does not exist', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '999999999' } });
      await joinClub(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
    });
  });

  describe('leaveClub', () => {
    it('removes membership and returns success', async () => {
      const owner = await createUser();
      const member = await createUser();
      const club = await createClubInDb(owner.id);
      await joinClubInDb(club.id, member.id);

      const h = makeReqRes(member.id, { params: { id: String(club.id) } });
      await leaveClub(h.req, h.res);

      expect(h.res.jsonValue.success).toBe(true);
      const after = await prisma.clubMembership.findFirst({
        where: { clubId: club.id, userId: member.id },
      });
      expect(after).toBeNull();
    });

    it('returns 400 when president tries to leave without transferring first', async () => {
      const president = await createUser();
      const club = await createClubInDb(president.id);

      const h = makeReqRes(president.id, { params: { id: String(club.id) } });
      await leaveClub(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toMatch(/President/);

      // Membership should NOT have been deleted.
      const stillThere = await prisma.clubMembership.findFirst({
        where: { clubId: club.id, userId: president.id },
      });
      expect(stillThere).not.toBeNull();
    });

    it('returns 404 when user is not a member', async () => {
      const owner = await createUser();
      const stranger = await createUser();
      const club = await createClubInDb(owner.id);

      const h = makeReqRes(stranger.id, { params: { id: String(club.id) } });
      await leaveClub(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
    });
  });

  describe('getMyClubs', () => {
    it('returns memberships for authenticated user', async () => {
      const user = await createUser();
      const club = await createClubInDb(user.id, { name: `${SUITE_PREFIX}-mine-${randomBytes(4).toString('hex')}` });

      const h = makeReqRes(user.id);
      await getMyClubs(h.req, h.res);

      const body = h.res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.memberships.length).toBe(1);
      expect(body.data.memberships[0].club.id).toBe(club.id);
      expect(body.data.memberships[0].role).toBe('president');
    });

    it('returns empty memberships when user has joined no clubs', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id);
      await getMyClubs(h.req, h.res);

      expect(h.res.jsonValue.data.memberships).toHaveLength(0);
    });
  });

  describe('getElections', () => {
    it('returns elections for a club', async () => {
      const user = await createUser();
      const club = await createClubInDb(user.id);
      const election = await createElectionInDb(club.id);

      const h = makeReqRes(user.id, { params: { id: String(club.id) } });
      await getElections(h.req, h.res);

      const body = h.res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.elections.length).toBe(1);
      expect(body.data.elections[0].id).toBe(election.id);
    });

    it('returns 400 for invalid club ID', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '0' } });
      await getElections(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
    });

    it('resolves status to closed for election past endsAt (DB status = open)', async () => {
      const user = await createUser();
      const club = await createClubInDb(user.id);
      const election = await createElectionInDb(club.id, {
        status: 'open',
        startsAt: new Date(Date.now() - 7200000), // 2 h ago
        endsAt: new Date(Date.now() - 3600000), // 1 h ago
      });

      const h = makeReqRes(user.id, { params: { id: String(club.id) } });
      await getElections(h.req, h.res);

      const found = h.res.jsonValue.data.elections.find(e => e.id === election.id);
      expect(found).toBeDefined();
      expect(found.status).toBe('closed');
    });

    it('resolves status to open for upcoming election whose startsAt has passed', async () => {
      const user = await createUser();
      const club = await createClubInDb(user.id);
      const election = await createElectionInDb(club.id, {
        status: 'upcoming',
        startsAt: new Date(Date.now() - 3600000), // 1 h ago
        endsAt: new Date(Date.now() + 86400000), // 1 day from now
      });

      const h = makeReqRes(user.id, { params: { id: String(club.id) } });
      await getElections(h.req, h.res);

      const found = h.res.jsonValue.data.elections.find(e => e.id === election.id);
      expect(found).toBeDefined();
      expect(found.status).toBe('open');
    });
  });

  describe('createElection', () => {
    it('creates election when requester is president, returns 201', async () => {
      const user = await createUser();
      const club = await createClubInDb(user.id);

      const h = makeReqRes(user.id, {
        params: { id: String(club.id) },
        body: {
          position: 'vice-president',
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          endsAt: new Date(Date.now() + 172800000).toISOString(),
        },
      });
      await createElection(h.req, h.res);

      expect(h.res.statusValue).toBe(201);
      expect(h.res.jsonValue.data.election.position).toBe('vice-president');

      const persisted = await prisma.clubElection.findFirst({
        where: { clubId: club.id, position: 'vice-president' },
      });
      expect(persisted).not.toBeNull();
    });

    it('returns 403 when requester is just a member', async () => {
      const president = await createUser();
      const member = await createUser();
      const club = await createClubInDb(president.id);
      await joinClubInDb(club.id, member.id);

      const h = makeReqRes(member.id, {
        params: { id: String(club.id) },
        body: {
          position: 'officer',
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      await createElection(h.req, h.res);

      expect(h.res.statusValue).toBe(403);
    });

    it('returns 403 when requester has no membership', async () => {
      const president = await createUser();
      const stranger = await createUser();
      const club = await createClubInDb(president.id);

      const h = makeReqRes(stranger.id, {
        params: { id: String(club.id) },
        body: {
          position: 'officer',
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      await createElection(h.req, h.res);

      expect(h.res.statusValue).toBe(403);
    });

    it('sets status to open when startsAt is in the past', async () => {
      const user = await createUser();
      const club = await createClubInDb(user.id);

      const h = makeReqRes(user.id, {
        params: { id: String(club.id) },
        body: {
          position: 'vice-president',
          startsAt: new Date(Date.now() - 1000).toISOString(),
          endsAt: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      await createElection(h.req, h.res);

      const persisted = await prisma.clubElection.findFirst({
        where: { clubId: club.id, position: 'vice-president' },
      });
      expect(persisted.status).toBe('open');
    });
  });

  describe('nominate', () => {
    it('creates candidacy and returns 201', async () => {
      const user = await createUser();
      const club = await createClubInDb(user.id);
      const election = await createElectionInDb(club.id);

      const h = makeReqRes(user.id, { params: { id: String(election.id) }, body: { statement: 'My pledge' } });
      await nominate(h.req, h.res);

      expect(h.res.statusValue).toBe(201);
      const persisted = await prisma.clubCandidate.findFirst({
        where: { electionId: election.id, userId: user.id },
      });
      expect(persisted).not.toBeNull();
      expect(persisted.statement).toBe('My pledge');
    });

    it('returns 404 when election does not exist', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '999999999' }, body: {} });
      await nominate(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
    });

    it('returns 400 when election is closed', async () => {
      const user = await createUser();
      const club = await createClubInDb(user.id);
      const election = await createElectionInDb(club.id, { status: 'closed' });

      const h = makeReqRes(user.id, { params: { id: String(election.id) }, body: {} });
      await nominate(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toBe('Election is closed');
    });

    it('returns 400 when election endsAt has passed even though DB status is open', async () => {
      const user = await createUser();
      const club = await createClubInDb(user.id);
      const election = await createElectionInDb(club.id, {
        status: 'open',
        startsAt: new Date(Date.now() - 7200000), // 2 h ago
        endsAt: new Date(Date.now() - 3600000), // 1 h ago
      });

      const h = makeReqRes(user.id, { params: { id: String(election.id) }, body: { statement: 'Late entry' } });
      await nominate(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toBe('Election is closed');
    });

    it('returns 404 when user is not a club member (CWE-639 Equoria-w386)', async () => {
      const president = await createUser();
      const stranger = await createUser();
      const club = await createClubInDb(president.id);
      const election = await createElectionInDb(club.id);

      const h = makeReqRes(stranger.id, { params: { id: String(election.id) }, body: {} });
      await nominate(h.req, h.res);

      // CWE-639: non-member of the election's club must look identical to a
      // not-found election so attackers cannot enumerate open election IDs.
      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue).toMatchObject({ success: false, message: 'Election not found' });
    });

    it('returns 409 when user is already a candidate', async () => {
      const user = await createUser();
      const club = await createClubInDb(user.id);
      const election = await createElectionInDb(club.id);
      await createCandidateInDb(election.id, user.id);

      const h = makeReqRes(user.id, { params: { id: String(election.id) }, body: { statement: 'Again' } });
      await nominate(h.req, h.res);

      expect(h.res.statusValue).toBe(409);
    });
  });

  describe('vote', () => {
    it('casts ballot and returns 201', async () => {
      const president = await createUser();
      const voter = await createUser();
      const club = await createClubInDb(president.id);
      await joinClubInDb(club.id, voter.id);
      const election = await createElectionInDb(club.id);
      const candidate = await createCandidateInDb(election.id, president.id);

      const h = makeReqRes(voter.id, { params: { id: String(election.id) }, body: { candidateId: candidate.id } });
      await vote(h.req, h.res);

      expect(h.res.statusValue).toBe(201);
      const ballot = await prisma.clubBallot.findFirst({
        where: { electionId: election.id, voterId: voter.id },
      });
      expect(ballot).not.toBeNull();
      expect(ballot.candidateId).toBe(candidate.id);
    });

    it('returns 400 when election is not open (upcoming, startsAt in the future)', async () => {
      const user = await createUser();
      const club = await createClubInDb(user.id);
      const election = await createElectionInDb(club.id, {
        status: 'upcoming',
        startsAt: new Date(Date.now() + 86400000), // 1 day from now — not yet open
        endsAt: new Date(Date.now() + 172800000),
      });

      const h = makeReqRes(user.id, { params: { id: String(election.id) }, body: { candidateId: 1 } });
      await vote(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toBe('Election is not open');
    });

    it('returns 400 when election endsAt has passed even though DB status is open', async () => {
      const user = await createUser();
      const club = await createClubInDb(user.id);
      const election = await createElectionInDb(club.id, {
        status: 'open',
        startsAt: new Date(Date.now() - 7200000), // 2 h ago
        endsAt: new Date(Date.now() - 3600000), // 1 h ago
      });
      const candidate = await createCandidateInDb(election.id, user.id);

      const h = makeReqRes(user.id, { params: { id: String(election.id) }, body: { candidateId: candidate.id } });
      await vote(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toBe('Election is not open');
    });

    it('accepts vote on election with startsAt past and status upcoming (auto-opens)', async () => {
      const president = await createUser();
      const voter = await createUser();
      const club = await createClubInDb(president.id);
      await joinClubInDb(club.id, voter.id);
      const election = await createElectionInDb(club.id, {
        status: 'upcoming',
        startsAt: new Date(Date.now() - 3600000), // 1 h ago — should resolve to open
        endsAt: new Date(Date.now() + 86400000), // 1 day from now
      });
      const candidate = await createCandidateInDb(election.id, president.id);

      const h = makeReqRes(voter.id, { params: { id: String(election.id) }, body: { candidateId: candidate.id } });
      await vote(h.req, h.res);

      expect(h.res.statusValue).toBe(201);
    });

    it('returns 404 when voter is not a club member (CWE-639 Equoria-c1cv)', async () => {
      const president = await createUser();
      const stranger = await createUser();
      const club = await createClubInDb(president.id);
      const election = await createElectionInDb(club.id);
      const candidate = await createCandidateInDb(election.id, president.id);

      const h = makeReqRes(stranger.id, { params: { id: String(election.id) }, body: { candidateId: candidate.id } });
      await vote(h.req, h.res);

      // CWE-639: non-member must look identical to not-found.
      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue).toMatchObject({ success: false, message: 'Election not found' });
    });

    it('returns 400 when candidate does not belong to this election', async () => {
      const user = await createUser();
      const club1 = await createClubInDb(user.id);
      const club2 = await createClubInDb(user.id);
      const election1 = await createElectionInDb(club1.id);
      const election2 = await createElectionInDb(club2.id);
      const candidateForOther = await createCandidateInDb(election2.id, user.id);

      const h = makeReqRes(user.id, {
        params: { id: String(election1.id) },
        body: { candidateId: candidateForOther.id },
      });
      await vote(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toMatch(/Invalid candidate/);
    });

    it('returns 409 when user has already voted (real DB unique constraint)', async () => {
      const president = await createUser();
      const voter = await createUser();
      const club = await createClubInDb(president.id);
      await joinClubInDb(club.id, voter.id);
      const election = await createElectionInDb(club.id);
      const candidate = await createCandidateInDb(election.id, president.id);

      // First vote: success.
      const h1 = makeReqRes(voter.id, { params: { id: String(election.id) }, body: { candidateId: candidate.id } });
      await vote(h1.req, h1.res);
      expect(h1.res.statusValue).toBe(201);

      // Second vote: real DB unique constraint fires.
      const h2 = makeReqRes(voter.id, { params: { id: String(election.id) }, body: { candidateId: candidate.id } });
      await vote(h2.req, h2.res);
      expect(h2.res.statusValue).toBe(409);
      expect(h2.res.jsonValue.message).toBe('Already voted in this election');
    });
  });

  describe('getElectionResults', () => {
    it('returns election and ranked candidates with vote counts', async () => {
      const president = await createUser();
      const c1 = await createUser();
      const c2 = await createUser();
      const voter1 = await createUser();
      const voter2 = await createUser();
      const voter3 = await createUser();
      const club = await createClubInDb(president.id);
      await joinClubInDb(club.id, c1.id);
      await joinClubInDb(club.id, c2.id);
      await joinClubInDb(club.id, voter1.id);
      await joinClubInDb(club.id, voter2.id);
      await joinClubInDb(club.id, voter3.id);
      const election = await createElectionInDb(club.id, { status: 'closed' });
      const cand1 = await createCandidateInDb(election.id, c1.id, 'I will lead well');
      const cand2 = await createCandidateInDb(election.id, c2.id, 'Vote for me');

      // 2 ballots for c1, 1 for c2
      await prisma.clubBallot.create({
        data: {
          electionId: election.id,
          candidate: { connect: { id: cand1.id } },
          voter: { connect: { id: voter1.id } },
        },
      });
      await prisma.clubBallot.create({
        data: {
          electionId: election.id,
          candidate: { connect: { id: cand1.id } },
          voter: { connect: { id: voter2.id } },
        },
      });
      await prisma.clubBallot.create({
        data: {
          electionId: election.id,
          candidate: { connect: { id: cand2.id } },
          voter: { connect: { id: voter3.id } },
        },
      });

      const h = makeReqRes(president.id, { params: { id: String(election.id) } });
      await getElectionResults(h.req, h.res);

      const body = h.res.jsonValue;
      expect(body.success).toBe(true);
      const found1 = body.data.candidates.find(c => c.id === cand1.id);
      const found2 = body.data.candidates.find(c => c.id === cand2.id);
      expect(found1.voteCount).toBe(2);
      expect(found2.voteCount).toBe(1);
      // _count stripped
      body.data.candidates.forEach(c => expect(c._count).toBeUndefined());
    });

    it('returns resolved status closed for expired election', async () => {
      const user = await createUser();
      const club = await createClubInDb(user.id);
      const election = await createElectionInDb(club.id, {
        status: 'open',
        startsAt: new Date(Date.now() - 7200000), // 2 h ago
        endsAt: new Date(Date.now() - 3600000), // 1 h ago
      });

      const h = makeReqRes(user.id, { params: { id: String(election.id) } });
      await getElectionResults(h.req, h.res);

      expect(h.res.jsonValue.success).toBe(true);
      expect(h.res.jsonValue.data.election.status).toBe('closed');
    });

    it('returns 404 when election does not exist', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '999999999' } });
      await getElectionResults(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
    });

    it('returns 400 for invalid election ID', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '0' } });
      await getElectionResults(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
    });
  });

  describe('transferLeadership', () => {
    it('transfers president role atomically, returns success', async () => {
      const president = await createUser();
      const target = await createUser();
      const club = await createClubInDb(president.id);
      await joinClubInDb(club.id, target.id);

      const h = makeReqRes(president.id, {
        params: { id: String(club.id) },
        body: { newPresidentId: target.id },
      });
      await transferLeadership(h.req, h.res);

      expect(h.res.jsonValue.success).toBe(true);

      // Verify the roles flipped.
      const presMembership = await prisma.clubMembership.findFirst({
        where: { clubId: club.id, userId: president.id },
      });
      expect(presMembership.role).toBe('member');
      const targetMembership = await prisma.clubMembership.findFirst({
        where: { clubId: club.id, userId: target.id },
      });
      expect(targetMembership.role).toBe('president');
      // Verify Club.leaderId updated.
      const clubAfter = await prisma.club.findUnique({ where: { id: club.id } });
      expect(clubAfter.leaderId).toBe(target.id);
    });

    it('returns 403 when caller is not the current president', async () => {
      const president = await createUser();
      const officer = await createUser();
      const target = await createUser();
      const club = await createClubInDb(president.id);
      await joinClubInDb(club.id, officer.id, 'officer');
      await joinClubInDb(club.id, target.id);

      const h = makeReqRes(officer.id, {
        params: { id: String(club.id) },
        body: { newPresidentId: target.id },
      });
      await transferLeadership(h.req, h.res);

      expect(h.res.statusValue).toBe(403);
      // Verify nothing changed.
      const clubAfter = await prisma.club.findUnique({ where: { id: club.id } });
      expect(clubAfter.leaderId).toBe(president.id);
    });

    it('returns 403 when caller has no membership', async () => {
      const president = await createUser();
      const stranger = await createUser();
      const target = await createUser();
      const club = await createClubInDb(president.id);
      await joinClubInDb(club.id, target.id);

      const h = makeReqRes(stranger.id, {
        params: { id: String(club.id) },
        body: { newPresidentId: target.id },
      });
      await transferLeadership(h.req, h.res);

      expect(h.res.statusValue).toBe(403);
    });

    it('returns 404 when target user is not a club member', async () => {
      const president = await createUser();
      const outsider = await createUser();
      const club = await createClubInDb(president.id);

      const h = makeReqRes(president.id, {
        params: { id: String(club.id) },
        body: { newPresidentId: outsider.id },
      });
      await transferLeadership(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue.message).toBe('Target user is not a club member');
    });

    it('returns 400 when trying to transfer leadership to yourself', async () => {
      const user = await createUser();

      const h = makeReqRes(user.id, {
        params: { id: '1' },
        body: { newPresidentId: user.id },
      });
      await transferLeadership(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toMatch(/yourself/);
    });

    it('returns 400 when newPresidentId is missing', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '1' }, body: {} });
      await transferLeadership(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue.message).toBe('newPresidentId is required');
    });
  });
});
