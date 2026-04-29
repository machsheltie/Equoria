/**
 * clubController.test.mjs
 *
 * Unit tests for backend/modules/community/controllers/clubController.mjs
 * Co-located per the backend/modules/<domain>/__tests__/ convention (Story 21-1).
 *
 * Coverage: getClubs, createClub, getClub, joinClub, leaveClub
 * Mocks: prisma, logger (external deps only — balanced mocking strategy)
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';

// ── Mock setup ────────────────────────────────────────────────────────────────

const mockPrisma = {
  club: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  clubMembership: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  },
  clubElection: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  clubCandidate: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  clubBallot: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule('../../packages/database/prismaClient.mjs', () => ({
  default: mockPrisma,
}));
jest.unstable_mockModule('../utils/logger.mjs', () => ({
  default: mockLogger,
}));

const {
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
} = await import('../controllers/clubController.mjs');

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockReqRes(overrides = {}) {
  const req = {
    user: { id: 'user-uuid-1' },
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

// ── getClubs ──────────────────────────────────────────────────────────────────

describe('getClubs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns clubs list with memberCount shaped from _count', async () => {
    const rawClub = {
      id: 1,
      name: 'Dressage Society',
      type: 'discipline',
      category: 'dressage',
      leader: { id: 'user-uuid-1', username: 'heirr' },
      _count: { members: 5 },
    };
    mockPrisma.club.findMany.mockResolvedValue([rawClub]);

    const { req, res } = mockReqRes({ query: {} });
    await getClubs(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          clubs: expect.arrayContaining([expect.objectContaining({ memberCount: 5 })]),
        }),
      }),
    );
    // _count should be stripped from the response
    const returnedClub = res.json.mock.calls[0][0].data.clubs[0];
    expect(returnedClub._count).toBeUndefined();
  });

  it('filters by type query param', async () => {
    mockPrisma.club.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes({ query: { type: 'breed' } });
    await getClubs(req, res);

    expect(mockPrisma.club.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: 'breed' }) }),
    );
  });

  it('returns 500 on database error', async () => {
    mockPrisma.club.findMany.mockRejectedValue(new Error('db down'));
    const { req, res } = mockReqRes();
    await getClubs(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

// ── createClub ────────────────────────────────────────────────────────────────

describe('createClub', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates club and membership atomically, returns 201', async () => {
    const newClub = { id: 2, name: 'Speed Demons', type: 'discipline', leaderId: 'user-uuid-1' };
    mockPrisma.club.findUnique.mockResolvedValue(null); // name not taken
    mockPrisma.$transaction.mockImplementation(fn => fn(mockPrisma));
    mockPrisma.club.create.mockResolvedValue(newClub);
    mockPrisma.clubMembership.create.mockResolvedValue({});

    const { req, res } = mockReqRes({
      body: { name: 'Speed Demons', type: 'discipline', category: 'racing', description: 'Fast horses' },
    });
    await createClub(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ club: newClub }) }),
    );
  });

  it('returns 409 when club name already taken', async () => {
    mockPrisma.club.findUnique.mockResolvedValue({ id: 99, name: 'Speed Demons' });

    const { req, res } = mockReqRes({ body: { name: 'Speed Demons' } });
    await createClub(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('taken') }),
    );
  });

  it('returns 500 on unexpected error', async () => {
    mockPrisma.club.findUnique.mockRejectedValue(new Error('connection lost'));
    const { req, res } = mockReqRes({ body: { name: 'NewClub' } });
    await createClub(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

// ── getClub ───────────────────────────────────────────────────────────────────

describe('getClub', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns club with members when found', async () => {
    const club = { id: 1, name: 'Test Club', leader: {}, members: [] };
    mockPrisma.club.findUnique.mockResolvedValue(club);

    const { req, res } = mockReqRes({ params: { id: '1' } });
    await getClub(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ club }) }),
    );
  });

  it('returns 404 when club does not exist', async () => {
    mockPrisma.club.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '999' } });
    await getClub(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('not found') }),
    );
  });

  it('returns 400 for invalid club ID', async () => {
    const { req, res } = mockReqRes({ params: { id: 'abc' } });
    await getClub(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

// ── joinClub ──────────────────────────────────────────────────────────────────

describe('joinClub', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates membership and returns 201', async () => {
    mockPrisma.club.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.clubMembership.findUnique.mockResolvedValue(null); // not yet a member
    mockPrisma.clubMembership.create.mockResolvedValue({ id: 5, clubId: 1, userId: 'user-uuid-1', role: 'member' });

    const { req, res } = mockReqRes({ params: { id: '1' } });
    await joinClub(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 409 when user is already a member', async () => {
    mockPrisma.club.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.clubMembership.findUnique.mockResolvedValue({ id: 5, role: 'member' });

    const { req, res } = mockReqRes({ params: { id: '1' } });
    await joinClub(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('Already') }),
    );
  });

  it('returns 404 when club does not exist', async () => {
    mockPrisma.club.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '999' } });
    await joinClub(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ── leaveClub ─────────────────────────────────────────────────────────────────

describe('leaveClub', () => {
  beforeEach(() => jest.clearAllMocks());

  it('removes membership and returns success', async () => {
    mockPrisma.clubMembership.findUnique.mockResolvedValue({ clubId: 1, userId: 'user-uuid-1', role: 'member' });
    mockPrisma.clubMembership.delete.mockResolvedValue({});

    const { req, res } = mockReqRes({ params: { id: '1' } });
    await leaveClub(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(mockPrisma.clubMembership.delete).toHaveBeenCalled();
  });

  it('returns 400 when president tries to leave without transferring first', async () => {
    mockPrisma.clubMembership.findUnique.mockResolvedValue({ clubId: 1, userId: 'user-uuid-1', role: 'president' });

    const { req, res } = mockReqRes({ params: { id: '1' } });
    await leaveClub(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('President') }),
    );
    expect(mockPrisma.clubMembership.delete).not.toHaveBeenCalled();
  });

  it('returns 404 when user is not a member', async () => {
    mockPrisma.clubMembership.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '1' } });
    await leaveClub(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ── getMyClubs ────────────────────────────────────────────────────────────────

describe('getMyClubs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns memberships with nested club data for authenticated user', async () => {
    const memberships = [
      {
        id: 1,
        userId: 'user-uuid-1',
        role: 'president',
        club: { id: 2, name: 'Speed Demons', leader: { id: 'user-uuid-1', username: 'heirr' }, _count: { members: 3 } },
      },
    ];
    mockPrisma.clubMembership.findMany.mockResolvedValue(memberships);

    const { req, res } = mockReqRes();
    await getMyClubs(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ memberships }),
      }),
    );
    expect(mockPrisma.clubMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-uuid-1' } }),
    );
  });

  it('returns empty memberships when user has joined no clubs', async () => {
    mockPrisma.clubMembership.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes();
    await getMyClubs(req, res);

    const { data } = res.json.mock.calls[0][0];
    expect(data.memberships).toHaveLength(0);
  });

  it('returns 500 on database error', async () => {
    mockPrisma.clubMembership.findMany.mockRejectedValue(new Error('db down'));
    const { req, res } = mockReqRes();
    await getMyClubs(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

// ── getElections ──────────────────────────────────────────────────────────────

describe('getElections', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns elections for a club', async () => {
    const elections = [{ id: 1, clubId: 1, position: 'vice-president', status: 'open', _count: { candidates: 2 } }];
    mockPrisma.clubElection.findMany.mockResolvedValue(elections);

    const { req, res } = mockReqRes({ params: { id: '1' } });
    await getElections(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ elections }) }),
    );
    expect(mockPrisma.clubElection.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { clubId: 1 } }));
  });

  it('returns 400 for invalid club ID', async () => {
    const { req, res } = mockReqRes({ params: { id: '0' } });
    await getElections(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on database error', async () => {
    mockPrisma.clubElection.findMany.mockRejectedValue(new Error('db error'));
    const { req, res } = mockReqRes({ params: { id: '1' } });
    await getElections(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── createElection ────────────────────────────────────────────────────────────

describe('createElection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates election when requester is officer/president, returns 201', async () => {
    mockPrisma.clubMembership.findUnique.mockResolvedValue({ role: 'president' });
    const election = { id: 10, clubId: 1, position: 'vice-president', status: 'upcoming' };
    mockPrisma.clubElection.create.mockResolvedValue(election);

    const { req, res } = mockReqRes({
      params: { id: '1' },
      body: {
        position: 'vice-president',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 172800000).toISOString(),
      },
    });
    await createElection(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ election }) }),
    );
  });

  it('returns 403 when requester is just a member', async () => {
    mockPrisma.clubMembership.findUnique.mockResolvedValue({ role: 'member' });

    const { req, res } = mockReqRes({
      params: { id: '1' },
      body: { position: 'officer', startsAt: new Date().toISOString(), endsAt: new Date().toISOString() },
    });
    await createElection(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockPrisma.clubElection.create).not.toHaveBeenCalled();
  });

  it('returns 403 when requester has no membership', async () => {
    mockPrisma.clubMembership.findUnique.mockResolvedValue(null);

    const { req, res } = mockReqRes({
      params: { id: '1' },
      body: { position: 'officer', startsAt: new Date().toISOString(), endsAt: new Date().toISOString() },
    });
    await createElection(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('sets status to open when startsAt is in the past', async () => {
    mockPrisma.clubMembership.findUnique.mockResolvedValue({ role: 'president' });
    mockPrisma.clubElection.create.mockResolvedValue({ id: 1, status: 'open' });

    const { req, res } = mockReqRes({
      params: { id: '1' },
      body: {
        position: 'vice-president',
        startsAt: new Date(Date.now() - 1000).toISOString(), // past
        endsAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    await createElection(req, res);

    expect(mockPrisma.clubElection.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'open' }) }),
    );
  });
});

// ── nominate ──────────────────────────────────────────────────────────────────

describe('nominate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates candidacy and returns 201', async () => {
    mockPrisma.clubElection.findUnique.mockResolvedValue({ id: 1, clubId: 1, status: 'open' });
    mockPrisma.clubMembership.findUnique.mockResolvedValue({ role: 'member' });
    mockPrisma.clubCandidate.findUnique.mockResolvedValue(null);
    const candidate = { id: 5, electionId: 1, userId: 'user-uuid-1', statement: 'My pledge' };
    mockPrisma.clubCandidate.create.mockResolvedValue(candidate);

    const { req, res } = mockReqRes({ params: { id: '1' }, body: { statement: 'My pledge' } });
    await nominate(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ candidate }) }),
    );
  });

  it('returns 404 when election does not exist', async () => {
    mockPrisma.clubElection.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '99' }, body: {} });
    await nominate(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when election is closed', async () => {
    mockPrisma.clubElection.findUnique.mockResolvedValue({ id: 1, clubId: 1, status: 'closed' });
    const { req, res } = mockReqRes({ params: { id: '1' }, body: {} });
    await nominate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Election is closed' }));
  });

  it('returns 403 when user is not a club member', async () => {
    mockPrisma.clubElection.findUnique.mockResolvedValue({ id: 1, clubId: 1, status: 'open' });
    mockPrisma.clubMembership.findUnique.mockResolvedValue(null);

    const { req, res } = mockReqRes({ params: { id: '1' }, body: {} });
    await nominate(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 409 when user is already a candidate', async () => {
    mockPrisma.clubElection.findUnique.mockResolvedValue({ id: 1, clubId: 1, status: 'open' });
    mockPrisma.clubMembership.findUnique.mockResolvedValue({ role: 'member' });
    mockPrisma.clubCandidate.findUnique.mockResolvedValue({ id: 3 }); // already nominated

    const { req, res } = mockReqRes({ params: { id: '1' }, body: {} });
    await nominate(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockPrisma.clubCandidate.create).not.toHaveBeenCalled();
  });
});

// ── vote ──────────────────────────────────────────────────────────────────────

describe('vote', () => {
  beforeEach(() => jest.clearAllMocks());

  it('casts ballot and returns 201', async () => {
    mockPrisma.clubElection.findUnique.mockResolvedValue({ id: 1, clubId: 1, status: 'open' });
    mockPrisma.clubMembership.findUnique.mockResolvedValue({ role: 'member' });
    mockPrisma.clubCandidate.findUnique.mockResolvedValue({ id: 10, electionId: 1 });
    const ballot = { id: 99, electionId: 1, candidateId: 10, voterId: 'user-uuid-1' };
    mockPrisma.clubBallot.create.mockResolvedValue(ballot);

    const { req, res } = mockReqRes({ params: { id: '1' }, body: { candidateId: 10 } });
    await vote(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ ballot }) }),
    );
  });

  it('returns 400 when election is not open', async () => {
    mockPrisma.clubElection.findUnique.mockResolvedValue({ id: 1, clubId: 1, status: 'upcoming' });

    const { req, res } = mockReqRes({ params: { id: '1' }, body: { candidateId: 10 } });
    await vote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Election is not open' }));
    expect(mockPrisma.clubBallot.create).not.toHaveBeenCalled();
  });

  it('returns 403 when voter is not a club member', async () => {
    mockPrisma.clubElection.findUnique.mockResolvedValue({ id: 1, clubId: 1, status: 'open' });
    mockPrisma.clubMembership.findUnique.mockResolvedValue(null);

    const { req, res } = mockReqRes({ params: { id: '1' }, body: { candidateId: 10 } });
    await vote(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when candidate does not belong to this election', async () => {
    mockPrisma.clubElection.findUnique.mockResolvedValue({ id: 1, clubId: 1, status: 'open' });
    mockPrisma.clubMembership.findUnique.mockResolvedValue({ role: 'member' });
    mockPrisma.clubCandidate.findUnique.mockResolvedValue({ id: 10, electionId: 99 }); // wrong election

    const { req, res } = mockReqRes({ params: { id: '1' }, body: { candidateId: 10 } });
    await vote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('Invalid candidate') }),
    );
  });

  it('returns 409 when user has already voted (Prisma P2002 unique constraint)', async () => {
    mockPrisma.clubElection.findUnique.mockResolvedValue({ id: 1, clubId: 1, status: 'open' });
    mockPrisma.clubMembership.findUnique.mockResolvedValue({ role: 'member' });
    mockPrisma.clubCandidate.findUnique.mockResolvedValue({ id: 10, electionId: 1 });
    const uniqueError = new Error('Unique constraint');
    uniqueError.code = 'P2002';
    mockPrisma.clubBallot.create.mockRejectedValue(uniqueError);

    const { req, res } = mockReqRes({ params: { id: '1' }, body: { candidateId: 10 } });
    await vote(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Already voted in this election' }),
    );
  });
});

// ── getElectionResults ────────────────────────────────────────────────────────

describe('getElectionResults', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns election and ranked candidates with vote counts', async () => {
    mockPrisma.clubElection.findUnique.mockResolvedValue({ id: 1, clubId: 1, status: 'closed' });
    const candidates = [
      {
        id: 1,
        statement: 'I will lead well',
        user: { id: 'u1', username: 'heirr' },
        _count: { ballots: 5 },
      },
      {
        id: 2,
        statement: 'Vote for me',
        user: { id: 'u2', username: 'other' },
        _count: { ballots: 2 },
      },
    ];
    mockPrisma.clubCandidate.findMany.mockResolvedValue(candidates);

    const { req, res } = mockReqRes({ params: { id: '1' } });
    await getElectionResults(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          candidates: expect.arrayContaining([
            expect.objectContaining({ voteCount: 5 }),
            expect.objectContaining({ voteCount: 2 }),
          ]),
        }),
      }),
    );
    // _count should be stripped
    const returnedCandidates = res.json.mock.calls[0][0].data.candidates;
    returnedCandidates.forEach(c => expect(c._count).toBeUndefined());
  });

  it('returns 404 when election does not exist', async () => {
    mockPrisma.clubElection.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '999' } });
    await getElectionResults(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 for invalid election ID', async () => {
    const { req, res } = mockReqRes({ params: { id: '0' } });
    await getElectionResults(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ── transferLeadership ────────────────────────────────────────────────────────

describe('transferLeadership', () => {
  beforeEach(() => jest.clearAllMocks());

  it('transfers president role atomically, returns success', async () => {
    mockPrisma.clubMembership.findUnique
      .mockResolvedValueOnce({ role: 'president' }) // current user
      .mockResolvedValueOnce({ role: 'member' }); // target user
    mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);
    mockPrisma.clubMembership.update.mockResolvedValue({});
    mockPrisma.club.update.mockResolvedValue({});

    const { req, res } = mockReqRes({
      params: { id: '1' },
      body: { newPresidentId: 'user-uuid-2' },
    });
    await transferLeadership(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('returns 403 when caller is not the current president', async () => {
    mockPrisma.clubMembership.findUnique
      .mockResolvedValueOnce({ role: 'officer' }) // not president
      .mockResolvedValueOnce({ role: 'member' });

    const { req, res } = mockReqRes({
      params: { id: '1' },
      body: { newPresidentId: 'user-uuid-2' },
    });
    await transferLeadership(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 403 when caller has no membership', async () => {
    mockPrisma.clubMembership.findUnique
      .mockResolvedValueOnce(null) // caller not a member
      .mockResolvedValueOnce({ role: 'member' });

    const { req, res } = mockReqRes({
      params: { id: '1' },
      body: { newPresidentId: 'user-uuid-2' },
    });
    await transferLeadership(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when target user is not a club member', async () => {
    mockPrisma.clubMembership.findUnique.mockResolvedValueOnce({ role: 'president' }).mockResolvedValueOnce(null); // target not a member

    const { req, res } = mockReqRes({
      params: { id: '1' },
      body: { newPresidentId: 'user-uuid-outsider' },
    });
    await transferLeadership(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Target user is not a club member' }),
    );
  });

  it('returns 400 when trying to transfer leadership to yourself', async () => {
    const { req, res } = mockReqRes({
      params: { id: '1' },
      body: { newPresidentId: 'user-uuid-1' }, // same as req.user.id
    });
    await transferLeadership(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('yourself') }),
    );
    expect(mockPrisma.clubMembership.findUnique).not.toHaveBeenCalled();
  });

  it('returns 400 when newPresidentId is missing', async () => {
    const { req, res } = mockReqRes({
      params: { id: '1' },
      body: {},
    });
    await transferLeadership(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'newPresidentId is required' }),
    );
  });

  it('returns 500 on unexpected database error', async () => {
    mockPrisma.clubMembership.findUnique.mockRejectedValue(new Error('db crash'));

    const { req, res } = mockReqRes({
      params: { id: '1' },
      body: { newPresidentId: 'user-uuid-2' },
    });
    await transferLeadership(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});
