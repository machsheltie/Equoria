/**
 * 🏇 EQUORIA BACKEND - Server Entry Point
 *
 * Main server startup file with environment validation and error handling.
 * Validates all required environment variables before starting the Express app.
 *
 * 🔐 SECURITY:
 * - Environment validation at startup (fail-fast)
 * - Strong JWT secret requirements
 * - Database password validation
 *
 * 🚀 STARTUP SEQUENCE:
 * 1. Load environment variables (.env)
 * 2. Validate environment configuration
 * 3. Initialize Express app
 * 4. Start HTTP server
 * 5. Initialize cron jobs
 * 6. Handle graceful shutdown
 */

import dotenv from 'dotenv';
import { validateEnvironment } from './utils/validateEnvironment.mjs';
import app from './app.mjs';
import logger from './utils/logger.mjs';
import { initializeCronJobs, stopCronJobs } from './services/cronJobService.mjs';
import { startShowScheduler, stopShowScheduler } from './utils/showScheduler.mjs';
import prisma from '../packages/database/prismaClient.mjs';
import { shutdownMemoryManagement } from './services/memoryResourceManagementService.mjs';
import { closeRedis } from './middleware/rateLimiting.mjs';
import { closeRedisConnection } from './utils/cacheHelper.mjs';
import { checkAndAlertMultiInstance } from './utils/sseMultiInstanceGuard.mjs';
import { preloadBreedProfiles } from './modules/horses/data/breedProfileLoader.mjs';

// Load environment variables FIRST
dotenv.config();

// Validate environment variables BEFORE starting server
logger.info('🔍 Validating environment configuration...');
validateEnvironment();

// Get port from environment
const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Equoria-wpfvl (2026-05-28): preload the per-breed profile cache from
// breeds.breedGeneticProfile BEFORE binding the listener. Hot paths in
// conformationService, gaitService, temperamentService, horseRoutes, and
// horseController call getBreedProfile() synchronously; an unwarmed cache
// would force them to fall back to the gait/temperament-only JSON and miss
// post-26qjf color genetics. Fatal-on-error so a misconfigured DB never
// boots into a "partially correct" state. Cron + show scheduler init move
// inside the listen callback (unchanged).
try {
  const breedCount = await preloadBreedProfiles(prisma);
  logger.info(`🧬 Preloaded ${breedCount} breed profiles into in-memory cache`);
} catch (err) {
  logger.error(
    `❌ FATAL: preloadBreedProfiles() failed during startup. ` +
      `Refusing to bind listener so requests never serve from an empty cache. ${err.message}`,
  );
  await prisma.$disconnect();
  process.exit(1);
}

// Start HTTP server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
  logger.info(`📝 API documentation available at http://localhost:${PORT}/api-docs`);
  logger.info(`🏥 Health check available at http://localhost:${PORT}/health`);

  // Initialize cron jobs in production
  if (NODE_ENV === 'production') {
    logger.info('⏰ Initializing cron jobs...');
    initializeCronJobs();
  }

  // Start show execution scheduler (all environments)
  startShowScheduler();

  // SSE multi-instance trigger monitor (Equoria-o3ync, ADR-011). Fires a loud
  // alert if this deploy runs >1 SSE-serving process (cluster workers or
  // horizontal replicas), at which point the process-local SSE bus is partial
  // and cross-process fan-out (Redis pub/sub, Equoria-03llw) must be wired.
  // Runs in all environments so a staging replica bump is caught too.
  checkAndAlertMultiInstance();
});

// Graceful shutdown handler
const shutdown = async signal => {
  logger.info(`\n${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Stop cron jobs (production only)
      if (NODE_ENV === 'production') {
        logger.info('Stopping cron jobs...');
        stopCronJobs();
      }

      // Stop show scheduler
      stopShowScheduler();

      // Shutdown memory management
      logger.info('Shutting down memory management...');
      shutdownMemoryManagement();

      // Close rate limiting Redis connection
      logger.info('Closing rate limiting Redis connection...');
      await closeRedis();

      // Close caching Redis connection (if initialized)
      logger.info('Closing caching Redis connection...');
      await closeRedisConnection();

      // Disconnect Prisma
      logger.info('Disconnecting database...');
      await prisma.$disconnect();

      logger.info('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle termination signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('UNHANDLED_REJECTION');
});

export default server;
