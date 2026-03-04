/**
 * Club Controller (19B-3)
 * Handles clubs, membership, and elections with voting.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

const USER_SELECT = { id: true, username: true };

/** GET /api/clubs?type=&category= */
export async function getClubs(req, res) {
  const { type, category } = req.query;
  const where = {};
  if (type) where.type = type;
  if (category) where.category = category;

  try {
    const clubs = await prisma.club.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        leader: { select: USER_SELECT },
        _count: { select: { members: true } },
      },
    });
    const shaped = clubs.map(c => ({ ...c, memberCount: c._count.members, _count: undefined }));
    return res.json({ success: true, data: { clubs: shaped } });
  } catch (error) {
    logger.error(`[clubController.getClubs] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch clubs' });
  }
}

/** GET /api/clubs/mine */
export async function getMyClubs(req, res) {
  const userId = req.user.id;
  try {
    const memberships = await prisma.clubMembership.findMany({
      where: { userId },
      include: {
        club: {
          include: { leader: { select: USER_SELECT }, _count: { select: { members: true } } },
        },
      },
    });
    return res.json({ success: true, data: { memberships } });
  } catch (error) {
    logger.error(`[clubController.getMyClubs] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch clubs' });
  }
}

/** GET /api/clubs/:id */
export async function getClub(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || id <= 0) return res.status(400).json({ success: false, message: 'Invalid club ID' });
  try {
    const club = await prisma.club.findUnique({
      where: { id },
      include: {
        leader: { select: USER_SELECT },
        members: { include: { user: { select: USER_SELECT } }, orderBy: { joinedAt: 'asc' } },
      },
    });
    if (!club) return res.status(404).json({ success: false, message: 'Club not found' });
    return res.json({ success: true, data: { club } });
  } catch (error) {
    logger.error(`[clubController.getClub] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch club' });
  }
}

/** POST /api/clubs */
export async function createClub(req, res) {
  const { name, type, category, description } = req.body;
  const leaderId = req.user.id;
  try {
    const existing = await prisma.club.findUnique({ where: { name } });
    if (existing)
      return res.status(409).json({ success: false, message: 'Club name already taken' });

    const club = await prisma.$transaction(async tx => {
      const c = await tx.club.create({ data: { name, type, category, description, leaderId } });
      await tx.clubMembership.create({
        data: { clubId: c.id, userId: leaderId, role: 'president' },
      });
      return c;
    });

    logger.info(`[clubController.createClub] User ${leaderId} created club ${club.id}`);
    return res.status(201).json({ success: true, data: { club } });
  } catch (error) {
    logger.error(`[clubController.createClub] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create club' });
  }
}

/** POST /api/clubs/:id/join */
export async function joinClub(req, res) {
  const clubId = parseInt(req.params.id, 10);
  const userId = req.user.id;
  if (!clubId || clubId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid club ID' });
  try {
    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) return res.status(404).json({ success: false, message: 'Club not found' });

    const existing = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (existing) return res.status(409).json({ success: false, message: 'Already a member' });

    const membership = await prisma.clubMembership.create({
      data: { clubId, userId, role: 'member' },
    });
    return res.status(201).json({ success: true, data: { membership } });
  } catch (error) {
    logger.error(`[clubController.joinClub] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to join club' });
  }
}

/** DELETE /api/clubs/:id/leave */
export async function leaveClub(req, res) {
  const clubId = parseInt(req.params.id, 10);
  const userId = req.user.id;
  if (!clubId || clubId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid club ID' });
  try {
    const membership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership) return res.status(404).json({ success: false, message: 'Not a member' });
    if (membership.role === 'president') {
      return res
        .status(400)
        .json({ success: false, message: 'President cannot leave — transfer leadership first' });
    }
    await prisma.clubMembership.delete({ where: { clubId_userId: { clubId, userId } } });
    return res.json({ success: true });
  } catch (error) {
    logger.error(`[clubController.leaveClub] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to leave club' });
  }
}

/** GET /api/clubs/:id/elections */
export async function getElections(req, res) {
  const clubId = parseInt(req.params.id, 10);
  if (!clubId || clubId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid club ID' });
  try {
    const elections = await prisma.clubElection.findMany({
      where: { clubId },
      orderBy: { startsAt: 'desc' },
      include: { _count: { select: { candidates: true } } },
    });
    return res.json({ success: true, data: { elections } });
  } catch (error) {
    logger.error(`[clubController.getElections] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch elections' });
  }
}

/** POST /api/clubs/:id/elections — officer/president only */
export async function createElection(req, res) {
  const clubId = parseInt(req.params.id, 10);
  const userId = req.user.id;
  const { position, startsAt, endsAt } = req.body;
  if (!clubId || clubId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid club ID' });
  try {
    const membership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership || !['officer', 'president'].includes(membership.role)) {
      return res
        .status(403)
        .json({ success: false, message: 'Only officers and presidents can create elections' });
    }
    const now = new Date();
    const status = new Date(startsAt) <= now ? 'open' : 'upcoming';
    const election = await prisma.clubElection.create({
      data: { clubId, position, startsAt: new Date(startsAt), endsAt: new Date(endsAt), status },
    });
    return res.status(201).json({ success: true, data: { election } });
  } catch (error) {
    logger.error(`[clubController.createElection] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create election' });
  }
}

/** POST /api/clubs/elections/:id/nominate */
export async function nominate(req, res) {
  const electionId = parseInt(req.params.id, 10);
  const userId = req.user.id;
  const { statement = '' } = req.body;
  if (!electionId || electionId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid election ID' });
  try {
    const election = await prisma.clubElection.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, message: 'Election not found' });
    if (election.status === 'closed')
      return res.status(400).json({ success: false, message: 'Election is closed' });

    const existing = await prisma.clubCandidate.findUnique({
      where: { electionId_userId: { electionId, userId } },
    });
    if (existing) return res.status(409).json({ success: false, message: 'Already nominated' });

    const candidate = await prisma.clubCandidate.create({
      data: { electionId, userId, statement },
    });
    return res.status(201).json({ success: true, data: { candidate } });
  } catch (error) {
    logger.error(`[clubController.nominate] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to nominate' });
  }
}

/** POST /api/clubs/elections/:id/vote */
export async function vote(req, res) {
  const electionId = parseInt(req.params.id, 10);
  const voterId = req.user.id;
  const { candidateId } = req.body;
  if (!electionId || electionId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid election ID' });
  try {
    const election = await prisma.clubElection.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, message: 'Election not found' });
    if (election.status !== 'open')
      return res.status(400).json({ success: false, message: 'Election is not open' });

    const candidate = await prisma.clubCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate || candidate.electionId !== electionId) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid candidate for this election' });
    }

    try {
      const ballot = await prisma.clubBallot.create({ data: { electionId, candidateId, voterId } });
      return res.status(201).json({ success: true, data: { ballot } });
    } catch (uniqueError) {
      if (uniqueError.code === 'P2002')
        return res.status(409).json({ success: false, message: 'Already voted in this election' });
      throw uniqueError;
    }
  } catch (error) {
    if (error.status)
      return res.status(error.status).json({ success: false, message: error.message });
    logger.error(`[clubController.vote] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to cast vote' });
  }
}

/** GET /api/clubs/elections/:id/results */
export async function getElectionResults(req, res) {
  const electionId = parseInt(req.params.id, 10);
  if (!electionId || electionId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid election ID' });
  try {
    const election = await prisma.clubElection.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, message: 'Election not found' });

    const candidates = await prisma.clubCandidate.findMany({
      where: { electionId },
      include: {
        user: { select: USER_SELECT },
        _count: { select: { ballots: true } },
      },
      orderBy: { ballots: { _count: 'desc' } },
    });

    const shaped = candidates.map(c => ({
      id: c.id,
      user: c.user,
      statement: c.statement,
      voteCount: c._count.ballots,
    }));

    return res.json({ success: true, data: { election, candidates: shaped } });
  } catch (error) {
    logger.error(`[clubController.getElectionResults] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch results' });
  }
}
