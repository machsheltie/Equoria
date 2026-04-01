import express from 'express';
import cronJobService from '../../../services/cronJobs.mjs';
import { updateHorseAge } from '../../../utils/horseAgingSystem.mjs';
import prisma from '../../../db/index.mjs';
import logger from '../../../utils/logger.mjs';

const router = express.Router();

/**
 * GET /api/admin/cron/status
 * Get status of all cron jobs
 */
router.get('/cron/status', async (req, res) => {
  try {
    logger.info('[adminRoutes] GET /api/admin/cron/status');

    const status = cronJobService.getStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error(`[adminRoutes] GET /api/admin/cron/status error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * POST /api/admin/cron/start
 * Start cron job service
 */
router.post('/cron/start', async (req, res) => {
  try {
    logger.info('[adminRoutes] POST /api/admin/cron/start');

    cronJobService.start();

    res.json({
      success: true,
      message: 'Cron job service started successfully',
    });
  } catch (error) {
    logger.error(`[adminRoutes] POST /api/admin/cron/start error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to start cron job service',
    });
  }
});

/**
 * POST /api/admin/cron/stop
 * Stop cron job service
 */
router.post('/cron/stop', async (req, res) => {
  try {
    logger.info('[adminRoutes] POST /api/admin/cron/stop');

    cronJobService.stop();

    res.json({
      success: true,
      message: 'Cron job service stopped successfully',
    });
  } catch (error) {
    logger.error(`[adminRoutes] POST /api/admin/cron/stop error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to stop cron job service',
    });
  }
});

/**
 * POST /api/admin/traits/evaluate
 * Manually trigger daily trait evaluation
 */
router.post('/traits/evaluate', async (req, res) => {
  try {
    logger.info(
      '[adminRoutes] POST /api/admin/traits/evaluate - Manual trait evaluation triggered',
    );

    const result = await cronJobService.manualTraitEvaluation();

    res.json({
      success: true,
      message: 'Manual trait evaluation completed successfully',
      data: result,
    });
  } catch (error) {
    logger.error(`[adminRoutes] POST /api/admin/traits/evaluate error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to complete trait evaluation',
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/foals/development
 * Get all foals in development period for monitoring
 */
router.get('/foals/development', async (req, res) => {
  try {
    logger.info('[adminRoutes] GET /api/admin/foals/development');

    const foals = await prisma.horse.findMany({
      where: {
        age: {
          in: [0, 1],
        },
      },
      select: {
        id: true,
        name: true,
        age: true,
        bond_score: true,
        stress_level: true,
        epigenetic_modifiers: true,
        breed: {
          select: {
            name: true,
          },
        },
        foalDevelopment: {
          select: {
            currentDay: true,
            bondingLevel: true,
            stressLevel: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        foals,
        count: foals.length,
      },
    });
  } catch (error) {
    logger.error(`[adminRoutes] GET /api/admin/foals/development error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve foal development data',
    });
  }
});

/**
 * GET /api/admin/traits/definitions
 * Get all trait definitions for reference
 */
router.get('/traits/definitions', async (req, res) => {
  try {
    logger.info('[adminRoutes] GET /api/admin/traits/definitions');

    const { getAllTraitDefinitions } = await import('../../../utils/traitEvaluation.js');
    const definitions = getAllTraitDefinitions();

    res.json({
      success: true,
      data: definitions,
    });
  } catch (error) {
    logger.error(`[adminRoutes] GET /api/admin/traits/definitions error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve trait definitions',
    });
  }
});

/**
 * POST /api/v1/admin/horses/age
 * Manually trigger the aging process for ALL horses.
 * Syncs every horse's stored age (in days) from its dateOfBirth.
 * Use this after correcting dateOfBirth values to immediately reflect the change.
 */
router.post('/horses/age', async (req, res) => {
  try {
    logger.info('[adminRoutes] POST /api/v1/admin/horses/age — Manual horse aging triggered');

    const result = await cronJobService.manualHorseAging();

    res.json({
      success: true,
      message: 'Manual horse aging completed',
      data: result,
    });
  } catch (error) {
    logger.error(`[adminRoutes] POST /api/v1/admin/horses/age error: ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to run horse aging', error: error.message });
  }
});

/**
 * POST /api/v1/admin/horses/:id/set-age
 * Set a horse's game age by deriving a correct dateOfBirth and re-running aging.
 *
 * This is the right way to adjust ages — it keeps dateOfBirth and horse.age in sync
 * so future cron runs continue to work correctly.
 *
 * Body: { gameAge: number }  — desired age in game years (1 game year = 7 real days)
 *
 * Example: gameAge: 5 → dateOfBirth = today − 35 days → horse.age = 35
 */
router.post('/horses/:id/set-age', async (req, res) => {
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

    logger.info(`[adminRoutes] POST /api/v1/admin/horses/${horseId}/set-age — gameAge=${gameAge}`);

    // 1 game year = 7 real days — derive the correct dateOfBirth
    const DAYS_PER_GAME_YEAR = 7;
    const dateOfBirth = new Date();
    dateOfBirth.setDate(dateOfBirth.getDate() - Math.round(gameAge * DAYS_PER_GAME_YEAR));

    // Update dateOfBirth so the aging cron stays consistent going forward
    await prisma.horse.update({
      where: { id: horseId },
      data: { dateOfBirth },
    });

    // Re-run aging for this horse to immediately sync horse.age
    const result = await updateHorseAge(horseId);

    res.json({
      success: true,
      message: `Horse ${horseId} set to game age ${gameAge} (dateOfBirth: ${dateOfBirth.toISOString().split('T')[0]})`,
      data: result,
    });
  } catch (error) {
    logger.error(`[adminRoutes] POST /api/v1/admin/horses/:id/set-age error: ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to set horse age', error: error.message });
  }
});

export default router;
