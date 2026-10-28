/**
 * Hall of Fame: nominations, weekly votes, run-offs and inductions (Equoria-vb1n0).
 *
 * Owner rulings 2026-10-28 (vb1n0, q257-q259):
 *   - The Hall of Fame is for the best of the best, not every retired horse. It
 *     started empty: "No one has earned the right to be in the hall of fame yet."
 *   - A horse retires at 21 (the only way it retires); from then its OWNER may
 *     nominate it, once, ever. If it is not inducted, that was its one chance.
 *   - Nominations made in Eastern game week N are the nominees of week N+1.
 *     Every player has one vote per round and may vote for any nominee,
 *     including her own horse.
 *   - At the end of week N+1 the nominee with the most votes is inducted (52 a
 *     year at most). A tied top vote opens a one-game-day run-off between ONLY
 *     the tied horses, like club elections (electionTransition.mjs), repeating
 *     until one wins.
 *
 * A Hall of Fame game week starts at 00:00 Eastern on Sunday (owner ruling
 * 2026-10-28, q265).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { retirementAgeYears } from '../../../constants/horseAgePolicy.mjs';
import { getHorseAgeYears } from '../../../utils/horseAge.mjs';
import { sameGameClockDaysLater, startOfGameWeek } from '../../../utils/gameTime.mjs';

/** Sunday (owner ruling q265): a Hall of Fame game week runs Sunday 00:00 to Sunday 00:00 Eastern. */
const weekStartDay = 0;

/** A refusal the routes answer with `status` and the authored `message`. */
export class HallOfFameRefusal extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** 00:00 Eastern on the Sunday that starts the game week holding `now`. */
export function hallOfFameWeekStart(now = new Date()) {
  return startOfGameWeek(now, weekStartDay);
}

/**
 * Whether this owner may nominate this horse now, and why not.
 *
 * @param {{ id: number, userId: string|null, dateOfBirth: Date|null }} horse
 * @param {string} userId
 * @param {{ id: number }|null} nomination - the horse's nomination, if any
 * @param {Date} now
 * @returns {null|{ status: number, code: string, message: string }}
 */
function nominationRefusal(horse, userId, nomination, now) {
  if (!horse || horse.userId !== userId) {
    return { status: 404, code: 'horseNotFound', message: 'Horse not found' };
  }
  if (getHorseAgeYears(horse.dateOfBirth, now) < retirementAgeYears) {
    return {
      status: 400,
      code: 'notRetired',
      message: 'Only a retired horse can be nominated to the Hall of Fame.',
    };
  }
  if (nomination) {
    return {
      status: 409,
      code: 'alreadyNominated',
      message: 'This horse has already been nominated to the Hall of Fame.',
    };
  }
  return null;
}

/**
 * The owner's Hall of Fame standing for one horse (the horse-page button).
 *
 * @returns {Promise<{ canNominate: boolean, nominated: boolean, inducted: boolean }>}
 */
export async function getHorseHallOfFameStatus(horseId, userId, now = new Date()) {
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: {
      id: true,
      userId: true,
      dateOfBirth: true,
      hallOfFameNomination: { select: { id: true } },
      hallOfFameInduction: { select: { id: true } },
    },
  });
  if (!horse || horse.userId !== userId) {
    throw new HallOfFameRefusal(404, 'horseNotFound', 'Horse not found');
  }
  return {
    canNominate: nominationRefusal(horse, userId, horse.hallOfFameNomination, now) === null,
    nominated: horse.hallOfFameNomination !== null,
    inducted: horse.hallOfFameInduction !== null,
  };
}

/**
 * Nominate a retired horse, once ever. The unique horseId on the nomination is
 * the race-proof guard: a concurrent second nomination fails P2002 and answers
 * the same 409.
 */
export async function nominateHorse(horseId, userId, now = new Date()) {
  return prisma.$transaction(async tx => {
    const horse = await tx.horse.findUnique({
      where: { id: horseId },
      select: { id: true, userId: true, dateOfBirth: true, name: true },
    });
    const existing = await tx.hallOfFameNomination.findUnique({
      where: { horseId },
      select: { id: true },
    });
    const refusal = nominationRefusal(horse, userId, existing, now);
    if (refusal) {
      throw new HallOfFameRefusal(refusal.status, refusal.code, refusal.message);
    }
    try {
      return await tx.hallOfFameNomination.create({
        data: { horseId, nominatedById: userId, weekStart: hallOfFameWeekStart(now) },
        select: { id: true, horseId: true, weekStart: true },
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        throw new HallOfFameRefusal(
          409,
          'alreadyNominated',
          'This horse has already been nominated to the Hall of Fame.',
        );
      }
      throw error;
    }
  });
}

/**
 * Cast the player's one vote in an open round. The unique (roundId, voterId)
 * is the race-proof one-vote guard.
 */
export async function castHallOfFameVote(candidateId, voterId, now = new Date()) {
  return prisma.$transaction(async tx => {
    const candidate = await tx.hallOfFameCandidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        round: { select: { id: true, startsAt: true, endsAt: true, closedAt: true } },
      },
    });
    if (!candidate) {
      throw new HallOfFameRefusal(404, 'nomineeNotFound', 'Nominee not found');
    }
    const { round } = candidate;
    if (round.closedAt !== null || round.startsAt > now || round.endsAt <= now) {
      throw new HallOfFameRefusal(400, 'votingClosed', 'Voting for this nominee has closed.');
    }
    try {
      return await tx.hallOfFameVote.create({
        data: { roundId: round.id, candidateId, voterId },
        select: { id: true, roundId: true, candidateId: true },
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        throw new HallOfFameRefusal(
          409,
          'alreadyVoted',
          'You have already voted for a Hall of Fame nominee this week.',
        );
      }
      throw error;
    }
  });
}

/**
 * The Hall of Fame page: the open rounds' nominees (with the player's own vote
 * in each round) and every inducted horse with the date it joined. Vote counts
 * are not shown.
 */
export async function getHallOfFame(userId, now = new Date()) {
  const rounds = await prisma.hallOfFameRound.findMany({
    where: { closedAt: null, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      endsAt: true,
      runoffOfId: true,
      votes: { where: { voterId: userId }, select: { candidateId: true } },
      candidates: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          nomination: {
            select: {
              horse: {
                select: {
                  id: true,
                  name: true,
                  breed: { select: { name: true } },
                  user: { select: { username: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  const inductions = await prisma.hallOfFameInduction.findMany({
    orderBy: [{ inductedAt: 'desc' }, { id: 'desc' }],
    select: {
      inductedAt: true,
      horse: {
        select: {
          id: true,
          name: true,
          breed: { select: { name: true } },
          user: { select: { username: true } },
        },
      },
    },
  });

  const horseView = horse => ({
    horseId: horse.id,
    horseName: horse.name,
    breedName: horse.breed?.name ?? null,
    ownerName: horse.user?.username ?? null,
  });

  return {
    rounds: rounds.map(round => ({
      roundId: round.id,
      isRunoff: round.runoffOfId !== null,
      endsAt: round.endsAt.toISOString(),
      myVoteCandidateId: round.votes[0]?.candidateId ?? null,
      nominees: round.candidates.map(c => ({
        candidateId: c.id,
        ...horseView(c.nomination.horse),
      })),
    })),
    inductees: inductions.map(i => ({
      ...horseView(i.horse),
      inductedAt: i.inductedAt.toISOString(),
    })),
  };
}

/**
 * Close one due round and decide it, in one transaction. The close is a
 * guarded claim, so a second or concurrent run finds nothing to do and can
 * neither induct twice nor open a second run-off.
 *
 * @returns {Promise<null|'inducted'|'runoff'|'none'>} null when already closed
 */
async function closeAndDecideRound(roundId, now) {
  return prisma.$transaction(async tx => {
    const claim = await tx.hallOfFameRound.updateMany({
      where: { id: roundId, closedAt: null },
      data: { closedAt: now },
    });
    if (claim.count === 0) {
      return null;
    }
    const candidates = await tx.hallOfFameCandidate.findMany({
      where: { roundId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        nominationId: true,
        nomination: { select: { horseId: true } },
        _count: { select: { votes: true } },
      },
    });
    const topVotes = candidates.length ? Math.max(...candidates.map(c => c._count.votes)) : 0;
    if (topVotes === 0) {
      await tx.hallOfFameRound.update({ where: { id: roundId }, data: { outcome: 'none' } });
      return 'none';
    }
    const leaders = candidates.filter(c => c._count.votes === topVotes);
    if (leaders.length === 1) {
      const [winner] = leaders;
      await tx.hallOfFameRound.update({ where: { id: roundId }, data: { outcome: 'inducted' } });
      await tx.hallOfFameInduction.create({
        data: { horseId: winner.nomination.horseId, roundId, inductedAt: now },
      });
      return 'inducted';
    }
    await tx.hallOfFameRound.update({ where: { id: roundId }, data: { outcome: 'runoff' } });
    await tx.hallOfFameRound.create({
      data: {
        startsAt: now,
        endsAt: sameGameClockDaysLater(now, 1),
        runoffOfId: roundId,
        candidates: { create: leaders.map(c => ({ nominationId: c.nominationId })) },
      },
    });
    return 'runoff';
  });
}

/**
 * Open this week's round with every nomination made in an earlier week that
 * has not yet stood in a round. Idempotent: the round's unique weekStart means
 * a second run (or a concurrent one) opens nothing.
 *
 * @returns {Promise<number>} nominees placed in a newly opened round (0 if none opened)
 */
async function openWeeklyRound(now) {
  const weekStart = hallOfFameWeekStart(now);
  return prisma.$transaction(async tx => {
    const existing = await tx.hallOfFameRound.findUnique({
      where: { weekStart },
      select: { id: true },
    });
    if (existing) {
      return 0;
    }
    const waiting = await tx.hallOfFameNomination.findMany({
      where: { weekStart: { lt: weekStart }, candidacies: { none: {} } },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (waiting.length === 0) {
      return 0;
    }
    try {
      await tx.hallOfFameRound.create({
        data: {
          weekStart,
          startsAt: weekStart,
          endsAt: sameGameClockDaysLater(weekStart, 7),
          candidates: { create: waiting.map(n => ({ nominationId: n.id })) },
        },
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        return 0;
      }
      throw error;
    }
    return waiting.length;
  });
}

/**
 * The scheduled step: decide every round whose time is up (weekly rounds and
 * run-offs), then open this week's round of last week's nominations.
 *
 * @param {Date} [now=new Date()]
 * @returns {Promise<{ closed: number, inducted: number, runoffs: number, nomineesOpened: number }>}
 */
export async function runHallOfFameRounds(now = new Date()) {
  const due = await prisma.hallOfFameRound.findMany({
    where: { closedAt: null, endsAt: { lte: now } },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  let closed = 0;
  let inducted = 0;
  let runoffs = 0;
  for (const { id } of due) {
    const outcome = await closeAndDecideRound(id, now);
    if (outcome === null) {
      continue;
    }
    closed += 1;
    if (outcome === 'inducted') {
      inducted += 1;
    }
    if (outcome === 'runoff') {
      runoffs += 1;
    }
  }
  const nomineesOpened = await openWeeklyRound(now);
  return { closed, inducted, runoffs, nomineesOpened };
}
