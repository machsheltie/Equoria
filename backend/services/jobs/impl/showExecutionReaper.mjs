/**
 * Show-execution reaper (Equoria-c7mx0 crash recovery).
 *
 * DEFECT: executeClosedShows claims a show atomically ('open' -> 'executing',
 * stamping claimedAt) and only later writes 'completed'. The nightly scan
 * selects status:'open' ONLY, so a process crash (deploy, OOM, Railway
 * restart) anywhere between the claim and the 'completed' write leaves the
 * show in 'executing' forever — prize + fee escrow frozen, no code path ever
 * picks it up again, and GDPR erasure explicitly skips 'executing' shows.
 *
 * WHY RELEASE-AND-REDRIVE IS SAFE (the load-bearing ordering invariant):
 * executeClosedShows (Equoria-koodu) writes 'completed' BEFORE any per-entry
 * result/payout transaction runs, and the conformation path
 * (conformationShowService.executeConformationShow) claims AND completes
 * inside one $transaction, so a crash there rolls back — it never persists
 * 'executing'. Therefore a PERSISTED status of 'executing' guarantees: zero
 * competitionResult rows, zero payouts, and both escrow columns intact for
 * that show. The reaper releases the stranded claim ('executing' -> 'open')
 * and re-drives the show through the REAL executor (executeClosedShows,
 * scoped to the released ids), reusing the existing scoring / 50-30-20 prize
 * split / escrow debit / fee settlement / progression path byte-for-byte.
 *
 * DETERMINISM (Equoria-c7mx0, 2026-07-06 approved decision): the executor
 * persists the scored ordering in the SAME atomic statement as its claim
 * (Show.stagedOrdering), and the release below deliberately does NOT touch
 * that column — so the re-drive REPLAYS the ordering scored at the original
 * claim verbatim (executeClosedShows consumes persisted staging instead of
 * re-scoring). A crash never re-rolls placements or winners. Strandings that
 * predate the staging migration (stagedOrdering NULL) fall back to fresh
 * scoring — there was never a persisted ordering to honor. Should the reaper
 * ever race a slow-but-alive executor, the @@unique([showId, horseId])
 * constraint on CompetitionResult aborts any duplicate per-entry tx before
 * money moves (the documented koodu backstop), and fee settlement is a no-op
 * once feeEscrow has drained.
 *
 * Even when the immediate re-drive fails, the release alone ends the
 * stranding: an 'open' show with a past closeDate is re-owned by the normal
 * nightly executor (and re-entry stays impossible — enterShow rejects any
 * show whose closeDate has passed, independent of status).
 *
 * Time constants (correlated set): STALE_CLAIM_THRESHOLD_MS below (2h — a
 * generous upper bound on a healthy executor pass, which takes seconds);
 * the job runs every 30 minutes (showExecutionReaperJob.mjs), so a stranded
 * show is recovered at most ~2.5h after its claim; the job's heartbeat
 * staleness budget is 1h (2x its schedule period).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { Sentry } from '../../../config/sentry.mjs';
import { executeClosedShows } from '../../../modules/competition/index.mjs';

/** A claim older than this is considered stranded by a crashed executor. */
export const STALE_CLAIM_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/**
 * Staleness predicate for a stranded 'executing' claim, shared by the scan
 * and the fenced release so the two can never drift apart.
 *
 * The claimedAt:null arm covers rows that entered 'executing' before the
 * claimedAt migration (Equoria-c7mx0) — a bare `claimedAt < cutoff` filter
 * would leave those invisible forever. The claim write itself bumps
 * Prisma's @updatedAt, so a stale updatedAt is the equivalent signal.
 */
function staleClaimPredicate(cutoff) {
  return [{ claimedAt: { lt: cutoff } }, { claimedAt: null, updatedAt: { lt: cutoff } }];
}

/**
 * Operational Sentry alert (issue spec step 4): a reaper release means a
 * crash stranded real escrow — this must be visible, not just logged.
 * Fail-soft and debounce-free by design: firing at most once per 30-min
 * cycle per stuck cohort is acceptable noise for a MONEY defect. No-op when
 * the Sentry DSN is not configured (captureMessage becomes a noop) — same
 * posture as CronJobMonitor.evaluateStaleAlerts.
 */
function emitReaperAlert(staleShows, releasedIds) {
  try {
    Sentry.withScope(scope => {
      scope.setTag('event_type', 'operational');
      scope.setTag('alert', 'show_execution_reaper_fired');
      scope.setLevel('error');
      scope.setContext('stranded_shows', {
        staleShowsFound: staleShows.length,
        releasedCount: releasedIds.length,
        shows: staleShows.map(s => ({
          id: s.id,
          name: s.name,
          claimedAt: s.claimedAt ? s.claimedAt.toISOString() : null,
          updatedAt: s.updatedAt.toISOString(),
        })),
      });
      Sentry.captureMessage(
        `Show-execution reaper fired: ${staleShows.length} show(s) stranded in 'executing' > 2h (ids: ${staleShows.map(s => s.id).join(', ')})`,
        'error',
      );
    });
  } catch (err) {
    logger.warn(`[ShowExecutionReaper] Sentry emit failed: ${err?.message ?? err}`);
  }
}

/**
 * Detect and recover shows stranded in 'executing' by an executor crash.
 *
 * @param {Object}   [options]
 * @param {number[]} [options.showIds] Optional id scoping, mirroring the
 *   Equoria-rsss0 hook on executeClosedShows: a valid array of integer ids
 *   narrows the scan so a test only ever reaps the shows it created;
 *   anything else leaves the scan global (the production cron passes
 *   nothing).
 * @returns {Promise<{staleShowsFound: number, releasedCount: number, recoveredCount: number, failedShowIds: number[]}>}
 * @throws when any released show failed to reach 'completed' on the
 *   re-drive, so runWithHeartbeat records an 'error' heartbeat and
 *   /api/admin/cron/health surfaces the failure instead of reporting a
 *   success-shaped summary on a failing cycle.
 */
export async function reapStaleExecutingShows({ showIds } = {}) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - STALE_CLAIM_THRESHOLD_MS);

  const where = { status: 'executing', OR: staleClaimPredicate(cutoff) };
  const scopedIds = Array.isArray(showIds) ? showIds.filter(id => Number.isInteger(id)) : null;
  if (scopedIds && scopedIds.length > 0) {
    where.id = { in: scopedIds };
  }

  const staleShows = await prisma.show.findMany({
    where,
    select: { id: true, name: true, claimedAt: true, updatedAt: true },
  });

  if (staleShows.length === 0) {
    return { staleShowsFound: 0, releasedCount: 0, recoveredCount: 0, failedShowIds: [] };
  }

  logger.warn(
    `[ShowExecutionReaper] ${staleShows.length} show(s) stranded in 'executing' past ${cutoff.toISOString()}: ${staleShows.map(s => `${s.id} (${s.name})`).join(', ')}`,
  );

  // Fenced release: the conditional updateMany re-asserts BOTH the status and
  // the same staleness predicate, so a show that a live executor re-claimed
  // (fresh claimedAt) between the scan and this write is left alone —
  // count === 0 means "state moved since the scan, not ours to touch".
  // stagedOrdering is deliberately NOT cleared: the re-drive must replay the
  // ordering the crashed claim persisted (see DETERMINISM in the docblock).
  const releasedIds = [];
  for (const show of staleShows) {
    const released = await prisma.show.updateMany({
      where: { id: show.id, status: 'executing', OR: staleClaimPredicate(cutoff) },
      data: { status: 'open', claimedAt: null },
    });
    if (released.count === 1) {
      releasedIds.push(show.id);
    } else {
      logger.info(
        `[ShowExecutionReaper] Skipping show ${show.id} — its state moved between scan and release`,
      );
    }
  }

  emitReaperAlert(staleShows, releasedIds);

  if (releasedIds.length > 0) {
    // Re-drive through the REAL settlement path, scoped to exactly the ids
    // released above. executeClosedShows re-claims each show atomically
    // ('open' -> 'executing' with a fresh claimedAt), scores, pays from
    // escrow, settles fees, and marks 'completed' — the identical code the
    // crashed run was executing. It handles its own errors internally and
    // never throws; the post-state query below is the outcome check.
    await executeClosedShows({ body: { showIds: releasedIds } }, undefined);
  }

  const postStates =
    releasedIds.length > 0
      ? await prisma.show.findMany({
          where: { id: { in: releasedIds } },
          select: { id: true, status: true },
        })
      : [];
  const recoveredCount = postStates.filter(s => s.status === 'completed').length;
  const failedShowIds = postStates.filter(s => s.status !== 'completed').map(s => s.id);

  const summary = {
    staleShowsFound: staleShows.length,
    releasedCount: releasedIds.length,
    recoveredCount,
    failedShowIds,
  };
  logger.info(`[ShowExecutionReaper] Cycle summary: ${JSON.stringify(summary)}`);

  if (failedShowIds.length > 0) {
    // A non-'completed' leftover is NOT re-stranded: a show left 'open' is
    // re-owned by the nightly executor, and a re-claimed-then-recrashed
    // 'executing' show is picked up by the next reaper tick once its fresh
    // claim goes stale. But the cycle itself failed to deliver recovery, so
    // throw — a success-shaped return here would let a 100%-failure cycle
    // report 'success' to the cron-health endpoint.
    throw new Error(
      `[ShowExecutionReaper] ${failedShowIds.length} of ${releasedIds.length} released show(s) did not reach 'completed' on re-drive (ids: ${failedShowIds.join(', ')}); summary: ${JSON.stringify(summary)}`,
    );
  }
  return summary;
}

export default { reapStaleExecutingShows };
