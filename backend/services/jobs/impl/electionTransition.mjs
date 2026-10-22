/**
 * Election status-transition impl (Equoria-urqic.3 cronJobs split).
 *
 * Extracted out of the CronJobService class so the orchestrator stays a thin
 * scheduler + heartbeat + persistence + health surface. Unlike the foal-trait
 * cluster, this job is self-contained — it touches no other CronJobService
 * method — so it is a plain free function with no `service` handle.
 *
 * The class keeps a thin `transitionElectionStatuses()` delegator (the
 * cronJobs.test.mjs real-DB suite calls it directly on the singleton), which
 * forwards here.
 *
 * Equoria-bvddn.22 (owner ruling 2026-10-22): closing an election decides it.
 *   - One candidate with the most votes: outcome `won`, that candidate takes
 *     the seat (winnerCandidateId).
 *   - The top vote count is tied: outcome `runoff`, and a run-off round opens
 *     at once between ONLY the tied candidates (same club and position, their
 *     statements carried over) for one Eastern game day. When the run-off has
 *     a winner, the run-off records `won` and the tied election's seat goes to
 *     that candidate's candidacy on the tied election.
 *   - A run-off that is itself tied has no rule yet (returned to the owner):
 *     it records `tied`, assigns no seat and opens no further round. The job
 *     summary lists it (tiedElectionIds) and the job logs a warning, so it is
 *     visible to an admin.
 *   - No candidates: closed with no outcome.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { sameGameClockDaysLater } from '../../../utils/gameTime.mjs';

/**
 * Close one due election and decide it, in one transaction. The close is a
 * guarded claim (status still not closed), so a second run — or a concurrent
 * one — finds nothing to do and cannot open a second run-off.
 *
 * @param {number} electionId
 * @param {Date} now
 * @returns {Promise<null|'won'|'runoff'|'tied'|'none'>} null when already closed
 */
async function closeAndDecide(electionId, now) {
  return prisma.$transaction(async tx => {
    const claim = await tx.clubElection.updateMany({
      where: { id: electionId, status: { not: 'closed' } },
      data: { status: 'closed' },
    });
    if (claim.count === 0) {
      return null;
    }

    const election = await tx.clubElection.findUnique({
      where: { id: electionId },
      select: { id: true, clubId: true, position: true, runoffOfId: true },
    });
    const candidates = await tx.clubCandidate.findMany({
      where: { electionId },
      select: { id: true, userId: true, statement: true, _count: { select: { ballots: true } } },
      orderBy: { id: 'asc' },
    });
    if (candidates.length === 0) {
      return 'none';
    }

    const topVotes = Math.max(...candidates.map(c => c._count.ballots));
    const leaders = candidates.filter(c => c._count.ballots === topVotes);

    if (leaders.length === 1) {
      const [winner] = leaders;
      await tx.clubElection.update({
        where: { id: electionId },
        data: { outcome: 'won', winnerCandidateId: winner.id },
      });
      if (election.runoffOfId !== null) {
        // The run-off winner takes the tied election's seat.
        const seat = await tx.clubCandidate.findUnique({
          where: {
            electionId_userId: { electionId: election.runoffOfId, userId: winner.userId },
          },
          select: { id: true },
        });
        if (seat) {
          await tx.clubElection.update({
            where: { id: election.runoffOfId },
            data: { winnerCandidateId: seat.id },
          });
        }
      }
      return 'won';
    }

    if (election.runoffOfId !== null) {
      await tx.clubElection.update({ where: { id: electionId }, data: { outcome: 'tied' } });
      return 'tied';
    }

    await tx.clubElection.update({ where: { id: electionId }, data: { outcome: 'runoff' } });
    await tx.clubElection.create({
      data: {
        clubId: election.clubId,
        position: election.position,
        status: 'open',
        startsAt: now,
        endsAt: sameGameClockDaysLater(now, 1),
        runoffOfId: election.id,
        candidates: {
          create: leaders.map(c => ({ userId: c.userId, statement: c.statement })),
        },
      },
    });
    return 'runoff';
  });
}

/**
 * Transitions ClubElection status fields to match the current time:
 *   upcoming → open  when startsAt <= now
 *   open     → closed when endsAt  <= now, deciding the election (see above)
 * Returns counts of each transition type.
 *
 * @param {Date} [now=new Date()]
 * @returns {Promise<{ opened: number, closed: number, runoffs: number, tied: number, tiedElectionIds: number[] }>}
 */
export async function transitionElectionStatuses(now = new Date()) {
  const startTime = Date.now();
  logger.info('[CronJobService.transitionElectionStatuses] Starting election status transition');

  // No log-and-rethrow wrapper: the cron orchestrator's runWithHeartbeat already
  // logs job failures with the job key + full context (Equoria-urqic.3 / the
  // rethrow-after-log doctrine, Equoria-ej9k1). A local catch that only logged
  // then `throw error`'d would double-log and add nothing.
  const openedResult = await prisma.clubElection.updateMany({
    where: { status: 'upcoming', startsAt: { lte: now } },
    data: { status: 'open' },
  });

  const due = await prisma.clubElection.findMany({
    where: { status: { not: 'closed' }, endsAt: { lte: now } },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  let closed = 0;
  let runoffs = 0;
  const tiedElectionIds = [];
  for (const { id } of due) {
    const outcome = await closeAndDecide(id, now);
    if (outcome === null) {
      continue;
    }
    closed += 1;
    if (outcome === 'runoff') {
      runoffs += 1;
    } else if (outcome === 'tied') {
      tiedElectionIds.push(id);
      logger.warn(
        `[CronJobService.transitionElectionStatuses] Run-off election ${id} ended tied; no seat assigned — waiting for an admin (Equoria-bvddn.22)`,
      );
    }
  }

  const duration = Date.now() - startTime;
  logger.info(
    `[CronJobService.transitionElectionStatuses] Completed in ${duration}ms: opened=${openedResult.count}, closed=${closed}, runoffs=${runoffs}, tied=${tiedElectionIds.length}`,
  );

  return {
    opened: openedResult.count,
    closed,
    runoffs,
    tied: tiedElectionIds.length,
    tiedElectionIds,
  };
}
