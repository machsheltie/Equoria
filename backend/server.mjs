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
import prisma from '../packages/database/prismaClient.mjs';
import { shutdownMemoryManagement } from './services/memoryResourceManagementService.mjs';
import { closeRedis } from './middleware/rateLimiting.mjs';
import { closeRedisConnection } from './utils/cacheHelper.mjs';

// Load environment variables FIRST
dotenv.config();

// Validate environment variables BEFORE starting server
logger.info('🔍 Validating environment configuration...');
validateEnvironment();

// Get port from environment
const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

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
});

// Graceful shutdown handler
const shutdown = async (signal) => {
  logger.info(`\n${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Stop cron jobs (production only)
      if (NODE_ENV === 'production') {
        logger.info('Stopping cron jobs...');
        stopCronJobs();
      }

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
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('UNHANDLED_REJECTION');
});

export default server;
