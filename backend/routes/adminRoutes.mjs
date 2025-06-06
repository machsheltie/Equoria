import express from 'express';
// TODO: Add validation when admin endpoints require input validation
// import { body, validationResult } from 'express-validator';
import cronJobService from '../services/cronJobs.mjs';
import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

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

    const { getAllTraitDefinitions } = await import('../utils/traitEvaluation.js');
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

export default router;
