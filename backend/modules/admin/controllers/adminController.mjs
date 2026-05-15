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
 *   POST /api/admin/horses/age           — manually trigger horse aging for all horses
 *   POST /api/admin/horses/:id/set-age   — set a specific horse's game age
 *   POST /api/admin/foaling/trigger      — force-run foaling job with advanced clock
 */

import cronJobService from '../../../services/cronJobs.mjs';
import { runFoalingJob } from '../../horses/services/foalingService.mjs';
import { updateHorseAge } from '../../../utils/horseAgingSystem.mjs';
import prisma from '../../../db/index.mjs';
import logger from '../../../utils/logger.mjs';

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
 * POST /api/admin/traits/evaluate
 * Manually trigger daily trait evaluation
 */
export async function evaluateTraits(req, res) {
  try {
    logger.info(
      '[adminController] POST /api/admin/traits/evaluate - Manual trait evaluation triggered',
    );
    const result = await cronJobService.manualTraitEvaluation();
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
    const foals = await prisma.horse.findMany({
      where: { age: { in: [0, 1] } },
      select: {
        id: true,
        name: true,
        age: true,
        bondScore: true,
        stressLevel: true,
        epigeneticModifiers: true,
        breed: { select: { name: true } },
        foalDevelopment: {
          select: {
            currentDay: true,
            bondingLevel: true,
            stressLevel: true,
          },
        },
      },
    });
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
    const { getAllTraitDefinitions } = await import('../../../utils/traitEvaluation.mjs');
    const definitions = getAllTraitDefinitions();
    res.json({ success: true, data: definitions });
  } catch (error) {
    logger.error(`[adminController] GET /api/admin/traits/definitions error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve trait definitions' });
  }
}

/**
 * POST /api/v1/admin/horses/age
 * Manually trigger the aging process for ALL horses.
 * Syncs every horse's stored age (in days) from its dateOfBirth.
 * Use this after correcting dateOfBirth values to immediately reflect the change.
 */
export async function manualHorseAging(req, res) {
  try {
    logger.info('[adminController] POST /api/v1/admin/horses/age — Manual horse aging triggered');
    const result = await cronJobService.manualHorseAging();
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
    const DAYS_PER_GAME_YEAR = 7;
    const dateOfBirth = new Date();
    dateOfBirth.setDate(dateOfBirth.getDate() - Math.round(gameAge * DAYS_PER_GAME_YEAR));

    // Update dateOfBirth so the aging cron stays consistent going forward
    await prisma.horse.update({ where: { id: horseId }, data: { dateOfBirth } });

    // Re-run aging for this horse to immediately sync horse.age
    const result = await updateHorseAge(horseId);

    res.json({
      success: true,
      message: `Horse ${horseId} set to game age ${gameAge} (dateOfBirth: ${dateOfBirth.toISOString().split('T')[0]})`,
      data: result,
    });
  } catch (error) {
    logger.error(`[adminController] POST /api/v1/admin/horses/:id/set-age error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to set horse age',
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/admin/foaling/trigger
 * Force-run the foaling job with a time-advanced clock so recently-started
 * pregnancies (gestation = 7 days) are treated as due.
 *
 * Body: { advanceDays?: number }  — days to add to "now" (default 8)
 */
export async function triggerFoaling(req, res) {
  try {
    const advanceDays = Number(req.body?.advanceDays ?? 8);
    if (!Number.isFinite(advanceDays) || advanceDays < 0 || advanceDays > 365) {
      return res.status(400).json({ success: false, message: 'advanceDays must be 0–365' });
    }
    logger.info(
      `[adminController] POST /api/v1/admin/foaling/trigger — advanceDays=${advanceDays}`,
    );
    const now = new Date(Date.now() + advanceDays * 24 * 60 * 60 * 1000);
    const result = await runFoalingJob({ now });
    res.json({
      success: true,
      message: `Foaling job ran with clock advanced by ${advanceDays} day(s). Foals born: ${result.foalsBorn}.`,
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
