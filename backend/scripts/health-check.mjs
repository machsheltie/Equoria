/**
 * Health Check Script for CI/CD Pipeline
 *
 * This script performs comprehensive health checks including:
 * - Database connectivity validation
 * - Environment variable validation
 * - Service dependency checks
 * - API endpoint availability
 */

import prisma from '../db/index.mjs';
import { logger } from '../utils/logger.mjs';

// Health check configuration
const HEALTH_CONFIG = {
  timeout: 10000, // 10 seconds
  retries: 3,
  endpoints: [
    '/ping',
    '/health',
  ],
};

/**
 * Check database connectivity
 */
async function checkDatabase() {
  try {
    logger.info('🔍 Checking database connectivity...');

    // Test basic connection
    await prisma.$connect();

    // Test query execution
    await prisma.$queryRaw`SELECT 1 as test`;

    // Test table access
    const userCount = await prisma.user.count();

    logger.info(`✅ Database connection successful (${userCount} users)`);
    return {
      status: 'healthy',
      message: 'Database connection successful',
      userCount,
    };
  } catch (error) {
    logger.error('❌ Database connection failed:', error.message);
    return {
      status: 'unhealthy',
      message: `Database connection failed: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Check required environment variables
 */
function checkEnvironmentVariables() {
  logger.info('🔍 Checking environment variables...');

  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'NODE_ENV',
  ];

  const missing = [];
  const present = [];

  for (const varName of requiredVars) {
    if (process.env[varName]) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  }

  if (missing.length === 0) {
    logger.info('✅ All required environment variables present');
    return {
      status: 'healthy',
      message: 'All required environment variables present',
      present,
    };
  } else {
    logger.error(`❌ Missing environment variables: ${missing.join(', ')}`);
    return {
      status: 'unhealthy',
      message: `Missing environment variables: ${missing.join(', ')}`,
      missing,
      present,
    };
  }
}

/**
 * Check API endpoints
 */
async function checkApiEndpoints(baseUrl = 'http://localhost:3000') {
  logger.info('🔍 Checking API endpoints...');

  const results = [];

  for (const endpoint of HEALTH_CONFIG.endpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        timeout: HEALTH_CONFIG.timeout,
      });

      const result = {
        endpoint,
        status: response.status,
        healthy: response.ok,
        responseTime: 0, // Will be calculated if needed
      };

      results.push(result);

      if (response.ok) {
        logger.info(`✅ Endpoint ${endpoint} is healthy`);
      } else {
        logger.warn(`⚠️ Endpoint ${endpoint} returned status ${response.status}`);
      }
    } catch (error) {
      logger.error(`❌ Endpoint ${endpoint} check failed:`, error.message);
      results.push({
        endpoint,
        status: 0,
        healthy: false,
        error: error.message,
      });
    }
  }

  const healthyEndpoints = results.filter(r => r.healthy).length;
  const totalEndpoints = results.length;

  return {
    status: healthyEndpoints === totalEndpoints ? 'healthy' : 'unhealthy',
    message: `${healthyEndpoints}/${totalEndpoints} endpoints healthy`,
    endpoints: results,
  };
}

/**
 * Check system resources
 */
function checkSystemResources() {
  logger.info('🔍 Checking system resources...');

  const memUsage = process.memoryUsage();
  const uptime = process.uptime();

  // Convert bytes to MB
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);

  // Check if memory usage is reasonable (under 500MB for basic health check)
  const memoryHealthy = heapUsedMB < 500;

  logger.info(`📊 Memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (RSS: ${rssMB}MB)`);
  logger.info(`⏱️ Uptime: ${Math.round(uptime)}s`);

  return {
    status: memoryHealthy ? 'healthy' : 'warning',
    message: `Memory usage: ${heapUsedMB}MB, Uptime: ${Math.round(uptime)}s`,
    memory: {
      heapUsed: heapUsedMB,
      heapTotal: heapTotalMB,
      rss: rssMB,
      external: Math.round(memUsage.external / 1024 / 1024),
    },
    uptime: Math.round(uptime),
  };
}

/**
 * Perform comprehensive health check
 */
async function performHealthCheck(options = {}) {
  const startTime = Date.now();

  logger.info('🏥 Starting comprehensive health check...');
  logger.info('=========================================');

  const results = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {},
    duration: 0,
  };

  try {
    // Check environment variables
    results.checks.environment = checkEnvironmentVariables();

    // Check database
    results.checks.database = await checkDatabase();

    // Check system resources
    results.checks.system = checkSystemResources();

    // Check API endpoints (only if server is running)
    if (options.checkEndpoints) {
      results.checks.api = await checkApiEndpoints(options.baseUrl);
    }

    // Determine overall status
    const checkStatuses = Object.values(results.checks).map(check => check.status);
    const hasUnhealthy = checkStatuses.includes('unhealthy');
    const hasWarning = checkStatuses.includes('warning');

    if (hasUnhealthy) {
      results.status = 'unhealthy';
    } else if (hasWarning) {
      results.status = 'warning';
    } else {
      results.status = 'healthy';
    }

    results.duration = Date.now() - startTime;

    // Log summary
    logger.info('\n📋 Health Check Summary');
    logger.info('=======================');
    logger.info(`Overall Status: ${results.status.toUpperCase()}`);
    logger.info(`Duration: ${results.duration}ms`);

    Object.entries(results.checks).forEach(([checkName, check]) => {
      const statusIcon = check.status === 'healthy' ? '✅' :
        check.status === 'warning' ? '⚠️' : '❌';
      logger.info(`${statusIcon} ${checkName}: ${check.status} - ${check.message}`);
    });

    return results;

  } catch (error) {
    logger.error('❌ Health check failed:', error.message);
    results.status = 'unhealthy';
    results.error = error.message;
    results.duration = Date.now() - startTime;
    return results;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Main health check execution
 */
async function runHealthCheck() {
  try {
    const options = {
      checkEndpoints: process.argv.includes('--check-endpoints'),
      baseUrl: process.env.HEALTH_CHECK_URL || 'http://localhost:3000',
    };

    const results = await performHealthCheck(options);

    // Output results for CI/CD
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(results, null, 2));
    }

    // Exit with appropriate code
    if (results.status === 'healthy') {
      logger.info('✅ Health check PASSED');
      process.exit(0);
    } else if (results.status === 'warning') {
      logger.warn('⚠️ Health check completed with WARNINGS');
      process.exit(0); // Don't fail CI for warnings
    } else {
      logger.error('❌ Health check FAILED');
      process.exit(1);
    }

  } catch (error) {
    logger.error('❌ Health check execution failed:', error.message);
    process.exit(1);
  }
}

// Run health check if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runHealthCheck();
}

export { performHealthCheck, checkDatabase, checkEnvironmentVariables, checkSystemResources };
