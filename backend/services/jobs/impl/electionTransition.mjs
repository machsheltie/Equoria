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
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Transitions ClubElection status fields to match the current time:
 *   upcoming → open  when startsAt <= now
 *   open     → closed when endsAt  <= now
 * Returns counts of each transition type.
 *
 * @returns {Promise<{ opened: number, closed: number }>}
 */
export async function transitionElectionStatuses() {
  const startTime = Date.now();
  logger.info('[CronJobService.transitionElectionStatuses] Starting election status transition');

  // No log-and-rethrow wrapper: the cron orchestrator's runWithHeartbeat already
  // logs job failures with the job key + full context (Equoria-urqic.3 / the
  // rethrow-after-log doctrine, Equoria-ej9k1). A local catch that only logged
  // then `throw error`'d would double-log and add nothing.
  const now = new Date();

  const [openedResult, closedResult] = await Promise.all([
    prisma.clubElection.updateMany({
      where: { status: 'upcoming', startsAt: { lte: now } },
      data: { status: 'open' },
    }),
    prisma.clubElection.updateMany({
      where: { status: { not: 'closed' }, endsAt: { lte: now } },
      data: { status: 'closed' },
    }),
  ]);

  const duration = Date.now() - startTime;
  logger.info(
    `[CronJobService.transitionElectionStatuses] Completed in ${duration}ms: opened=${openedResult.count}, closed=${closedResult.count}`,
  );

  return { opened: openedResult.count, closed: closedResult.count };
}
