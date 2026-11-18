/**
 * AdminController
 *
 * Extracted from inline route handlers in adminRoutes.mjs.
 * All handlers require admin role (enforced at router level in app.mjs).
 *
 * Routes:
 *   GET  /api/admin/cron/status          — get cron job status
 *   POST /api/admin/cron/start           — start cron job service
 *   POST /api/admin/cron/stop            — stop cron job service
 *   POST /api/admin/traits/evaluate      — manually trigger trait evaluation
 *   GET  /api/admin/foals/development    — get foals in development (ages 0–1)
 *   GET  /api/admin/traits/definitions   — get all trait definitions
 *   POST /api/admin/horses/age           — manually trigger horse aging for all horses (Owner only, q341)
 *   POST /api/admin/horses/:id/set-age   — set a specific horse's game age (Owner only, q341)
 *   POST /api/admin/foaling/trigger      — deliver overdue foals now (real time; no fast-forward)
 *   (the API-doc handlers live in adminDocsController.mjs)
 */

import cronJobService from '../../../services/cronJobs.mjs';
import { getActiveConnectionMetrics } from '../../../services/eventBus.mjs';
import { getMultiInstanceStatus } from '../../../utils/sseMultiInstanceGuard.mjs';
import { runFoalingJob } from '../../horses/index.mjs';
import { finishHorseAge, planHorseAge, writeHorseAgeTx } from '../../../utils/horseAgingSystem.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { pruneNotificationsForAllUsers } from '../../../utils/notificationService.mjs';
import { getTraitRevelationAnalytics } from '../../traits/index.mjs';
import { can } from '../../staff/index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { listFoalsInDevelopment } from '../services/foalDevelopmentService.mjs';
import { traitRosterIds, getTraitMetadata } from '../../../utils/epigeneticTraits.mjs';

/**
 * GET /api/admin/cron/status
 * Get status of all cron jobs
 */
export async function getCronStatus(req, res) {
  try {
    logger.info('[adminController] GET /api/admin/cron/status');
    const status = cronJobService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error(`[adminController] GET /api/admin/cron/status error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * GET /api/admin/cron/health (Equoria-0elk)
 * Cron heartbeat / staleness snapshot — answers "is the cron firing?".
 *
 * Returns per-job lastStartedAt / lastFinishedAt / status / summary + a
 * stale flag computed against per-job staleness thresholds. Top-level
 * `anyStale` boolean exists so monitoring can alert without walking the
 * per-job map. See `services/cronJobs.mjs:JOB_STALENESS_MS` for thresholds.
 */
export async function getCronHealth(req, res) {
  try {
    logger.info('[adminController] GET /api/admin/cron/health');
    // Equoria-9wby: include persistent recentRuns[5] per job from CronRunLog
    // so cross-restart history is visible. If DB read fails, recentRuns[] is
    // an empty array per job (in-memory heartbeat data is still returned).
    const health = await cronJobService.getHealthWithHistory({ recentRunsLimit: 5 });
    res.json({ success: true, data: health });
  } catch (error) {
    logger.error(`[adminController] GET /api/admin/cron/health error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * GET /api/admin/sse/metrics (Equoria-fsuys)
 * Observability snapshot of currently-open SSE connections.
 *
 * Returns the overall active-connection gauge plus the distinct-user count
 * and the heaviest single-user connection count. Lets an operator detect a
 * connection leak (count climbs and never drops) or a runaway per-user
 * fan-out before it becomes an incident. Pure in-memory read — no DB, no
 * external metrics dependency.
 */
export async function getSseMetrics(req, res) {
  try {
    logger.info('[adminController] GET /api/admin/sse/metrics');
    const metrics = getActiveConnectionMetrics();
    // Equoria-o3ync (ADR-011): surface the multi-instance trigger status so an
    // operator can see at a glance whether the process-local SSE bus assumption
    // still holds (multiInstance:false) or whether cross-process fan-out
    // (Equoria-03llw) is now required (multiInstance:true + reasons).
    const multiInstance = getMultiInstanceStatus();
    res.json({ success: true, data: { ...metrics, multiInstance } });
  } catch (error) {
    logger.error(`[adminController] GET /api/admin/sse/metrics error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/admin/cron/start
 * Start cron job service
 */
export async function startCron(req, res) {
  try {
    logger.info('[adminController] POST /api/admin/cron/start');
    cronJobService.start();
    res.json({ success: true, message: 'Cron job service started successfully' });
  } catch (error) {
    logger.error(`[adminController] POST /api/admin/cron/start error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to start cron job service' });
  }
}

/**
 * POST /api/admin/cron/stop
 * Stop cron job service
 */
export async function stopCron(req, res) {
  try {
    logger.info('[adminController] POST /api/admin/cron/stop');
    cronJobService.stop();
    res.json({ success: true, message: 'Cron job service stopped successfully' });
  } catch (error) {
    logger.error(`[adminController] POST /api/admin/cron/stop error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to stop cron job service' });
  }
}

/**
 * Run a scheduled job's pass by hand the way its schedule does (Equoria-puj1e.5,
 * docs/features/admin-time-back.md "Nightly-job hold"): through the monitor, so
 * the run is in the cron run log a time-back reads, under the job's own advisory
 * lock, and refused while the owner holds the nightly jobs. Answers the 409 and
 * returns null when the run did not happen; otherwise returns the pass's result.
 */
async function runAsScheduled(res, jobName, handler, lockKey = jobName) {
  const result = await cronJobService.runWithHeartbeat(jobName, handler, {
    applyLock: true,
    lockKey,
  });
  if (result === null) {
    res.status(409).json({
      success: false,
      code: 'jobsHeld',
      message: 'The nightly jobs are held, or another run is in progress. Try again once they run.',
    });
  }
  return result;
}

/**
 * POST /api/admin/traits/evaluate
 * Manually trigger daily trait evaluation, as the nightly job runs it.
 */
export async function evaluateTraits(req, res) {
  try {
    logger.info(
      '[adminController] POST /api/admin/traits/evaluate - Manual trait evaluation triggered',
    );
    const result = await runAsScheduled(res, 'dailyTraitEvaluation', () =>
      cronJobService.manualTraitEvaluation(),
    );
    if (result === null) {
      return;
    }
    res.json({
      success: true,
      message: 'Manual trait evaluation completed successfully',
      data: result,
    });
  } catch (error) {
    logger.error(`[adminController] POST /api/admin/traits/evaluate error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to complete trait evaluation',
      error: error.message,
    });
  }
}

/**
 * GET /api/admin/foals/development
 * Get all foals in development period for monitoring
 */
export async function getFoalDevelopment(req, res) {
  try {
    logger.info('[adminController] GET /api/admin/foals/development');
    const foals = await listFoalsInDevelopment();
    res.json({ success: true, data: { foals, count: foals.length } });
  } catch (error) {
    logger.error(`[adminController] GET /api/admin/foals/development error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve foal development data' });
  }
}

/**
 * GET /api/admin/traits/definitions
 * Get all trait definitions for reference
 */
export async function getTraitDefinitions(req, res) {
  try {
    logger.info('[adminController] GET /api/admin/traits/definitions');
    // The 20-trait roster (owner ruling 2026-10-27, q117). Admin tooling may see
    // the owner's ruled rarity (q134); player routes never do (q112).
    const definitions = traitRosterIds.map(getTraitMetadata);
    res.json({ success: true, data: definitions });
  } catch (error) {
    logger.error(`[adminController] GET /api/admin/traits/definitions error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve trait definitions' });
  }
}

/**
 * GET /api/admin/traits/analytics  (also /api/v1/admin/traits/analytics)
 *
 * Global aggregate trait-revelation analytics from TraitHistoryLog (Equoria-yznve):
 * counts by traitName, definitional category and game day, plus a total. Filters:
 *   ?startDate=ISO   inclusive lower bound on timestamp
 *   ?endDate=ISO     inclusive upper bound on timestamp
 *   ?sourceType=str  scope to one sourceType (e.g. 'dailyEvaluation')
 *
 * Admin and owner only (adminRouter's requireRole('admin')). Rows for a trait
 * still hidden on its horse count for the owner alone (Equoria-4tleh).
 */
export async function getTraitRevelationAnalyticsHandler(req, res) {
  try {
    logger.info('[adminController] GET /api/admin/traits/analytics');

    const { startDate, endDate, sourceType } = req.query;

    // Validate date params if provided — reject unparseable values with 400
    // rather than silently treating them as "no filter" (fail-closed input).
    if (startDate !== undefined && Number.isNaN(new Date(startDate).getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid startDate' });
    }
    if (endDate !== undefined && Number.isNaN(new Date(endDate).getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid endDate' });
    }

    const analytics = await getTraitRevelationAnalytics({
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      // qs may parse repeated keys into arrays; coerce to a single string or null.
      sourceType: typeof sourceType === 'string' ? sourceType : null,
      includeHidden: can(req.user, 'traits.hidden.view'),
    });

    res.json({ success: true, data: analytics });
  } catch (error) {
    logger.error(`[adminController] GET /api/admin/traits/analytics error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve trait analytics' });
  }
}

/**
 * POST /api/v1/admin/horses/age
 * Manually trigger the aging process for ALL horses.
 * Syncs every horse's stored age (in days) from its dateOfBirth.
 * Use this after correcting dateOfBirth values to immediately reflect the change.
 * Runs as the nightly aging job does (run log, lock, hold).
 */
export async function manualHorseAging(req, res) {
  try {
    logger.info('[adminController] POST /api/v1/admin/horses/age — Manual horse aging triggered');
    const result = await runAsScheduled(res, 'dailyHorseAging', () =>
      cronJobService.manualHorseAging(),
    );
    if (result === null) {
      return;
    }
    res.json({ success: true, message: 'Manual horse aging completed', data: result });
  } catch (error) {
    logger.error(`[adminController] POST /api/v1/admin/horses/age error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to run horse aging',
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/admin/horses/:id/set-age
 * Set a horse's game age by deriving a correct dateOfBirth and re-running aging.
 *
 * Body: { gameAge: number }  — desired age in game years (1 game year = 7 real days)
 *
 * Equoria-0ro0p: the birth date and the age it implies are written in one
 * transaction, and a number that names no horse answers 404 with the
 * Steward's Office copy.
 */
export async function setHorseAge(req, res) {
  try {
    const horseId = parseInt(req.params.id, 10);
    const { gameAge } = req.body;

    if (!Number.isInteger(horseId) || horseId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid horse ID' });
    }
    if (typeof gameAge !== 'number' || gameAge < 0 || gameAge > 30) {
      return res
        .status(400)
        .json({ success: false, message: 'gameAge must be a number between 0 and 30' });
    }

    logger.info(
      `[adminController] POST /api/v1/admin/horses/${horseId}/set-age — gameAge=${gameAge}`,
    );

    // 1 game year = 7 real days — derive the correct dateOfBirth
    const dateOfBirth = birthDateForAge(gameAge);

    // The new dateOfBirth keeps the aging cron consistent going forward; the
    // age it implies is written in the same transaction. The update locks the
    // row, so the stored age the plan starts from cannot move underneath it.
    let written;
    try {
      written = await withRetryableTxMapping(
        prisma.$transaction(async tx => {
          const horse = await tx.horse.update({
            where: { id: horseId },
            data: { dateOfBirth },
            select: { id: true, name: true, dateOfBirth: true, age: true },
          });
          const plan = planHorseAge(horse);
          await writeHorseAgeTx(tx, horseId, plan);
          return { horse, plan };
        }),
      );
    } catch (error) {
      if (error?.code === 'P2025') {
        return res.status(404).json({ success: false, message: 'No horse has that number.' });
      }
      throw error;
    }
    const result = await finishHorseAge(written.horse, written.plan);

    res.json({
      success: true,
      message: `Horse ${horseId} set to game age ${gameAge} (dateOfBirth: ${dateOfBirth.toISOString().split('T')[0]})`,
      data: result,
    });
  } catch (error) {
    logger.error(`[adminController] POST /api/v1/admin/horses/:id/set-age error: ${error.message}`);
    if (error.status === 503) {
      return res.status(503).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to set horse age',
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/admin/foaling/trigger — "Deliver overdue foals now"
 * (Equoria-puj1e.5, docs/features/admin-time-back.md; owner ruling 2026-10-05:
 * foals wait the full 7 days). Runs the foaling job at the real time, so only
 * mares already past their due day foal. The old clock fast-forward is gone:
 * a body naming `advanceDays` is refused.
 *
 * It runs like the scheduled job: under the same advisory lock, written to the
 * cron run log, and refused while the owner holds the nightly jobs.
 */
export async function triggerFoaling(req, res) {
  try {
    if (req.body?.advanceDays !== undefined) {
      return res.status(400).json({
        success: false,
        code: 'foalingFastForwardRemoved',
        message: 'Foals arrive only when they are due; the clock cannot be moved forward.',
      });
    }
    logger.info('[adminController] POST /api/v1/admin/foaling/trigger — overdue foals only');
    const result = await runAsScheduled(
      res,
      'foaling',
      () => runFoalingJob(),
      'cronJobService:foaling',
    );
    if (result === null) {
      return;
    }
    res.json({
      success: true,
      message: `Overdue foals delivered: ${result.foalsBorn}.`,
      data: result,
    });
  } catch (error) {
    logger.error(`[adminController] POST /api/v1/admin/foaling/trigger error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to run foaling job',
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/admin/notifications/backfill-prune
 *
 * One-time backfill for ADR-007 (notification-retention-policy). The
 * prune-on-write policy (Equoria-1fqs) only trims a user's notifications when
 * that user's NEXT notification is created. Accounts that have not inserted a
 * new notification since the cap shipped keep their pre-cap backlog forever.
 *
 * This admin-only endpoint walks the users in id order and runs the existing,
 * already-scoped per-user prune for each (pruneNotificationsForAllUsers). It
 * introduces NO new delete logic and no unscoped deleteMany; each user's prune
 * is its own short transaction.
 *
 * Equoria-ctyia: one request stops taking new users once its time budget
 * (backfillTimeBudgetMs, inside the 30s request timeout) has passed and
 * returns `nextCursor`; send it back as `cursor` to carry on. `done` is true
 * and `nextCursor` null once every user has been processed.
 *
 * Body: { batchSize?: number, cursor?: string } — users per page (default
 * 500, 1–5000); the `nextCursor` of a previous call.
 *
 * Returns: { usersProcessed, usersPruned, rowsPruned, nextCursor, done }.
 */
export async function backfillPruneNotifications(req, res) {
  try {
    const batchSize = Number(req.body?.batchSize ?? 500);
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
      return res
        .status(400)
        .json({ success: false, message: 'batchSize must be an integer between 1 and 5000' });
    }
    const cursor = req.body?.cursor ?? null;
    if (cursor !== null && (typeof cursor !== 'string' || cursor === '' || cursor.length > 64)) {
      return res
        .status(400)
        .json({ success: false, message: 'cursor must be the nextCursor of a previous call' });
    }

    logger.info(
      `[adminController] POST /api/v1/admin/notifications/backfill-prune — batchSize=${batchSize}`,
    );

    const result = await pruneNotificationsForAllUsers({ batchSize, cursor });
    const done = result.nextCursor === null;
    const summary = `Processed ${result.usersProcessed} user(s), pruned ${result.rowsPruned} row(s) across ${result.usersPruned} user(s).`;

    res.json({
      success: true,
      message: done
        ? `Notification backfill prune complete. ${summary}`
        : `Notification backfill prune paused. ${summary} Send nextCursor as cursor to continue.`,
      data: { ...result, done },
    });
  } catch (error) {
    logger.error(
      `[adminController] POST /api/v1/admin/notifications/backfill-prune error: ${error.message}`,
    );
    res.status(500).json({
      success: false,
      message: 'Failed to run notification backfill prune',
      error: error.message,
    });
  }
}
