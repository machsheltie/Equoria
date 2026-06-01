/**
 * ❤️  HEALTH / READINESS HANDLERS (Equoria-515lv)
 *
 * Liveness (`/health`) and readiness (`/ready`) request handlers plus the
 * shared Redis-info helper, extracted verbatim from app.mjs.
 *
 * Design constraints preserved exactly:
 * - /health stays lightweight (no DB ping) for Railway liveness probes so it
 *   does not consume scarce Supabase Session-mode pool clients.
 * - /ready performs a real `SELECT 1` DB ping for operators / deploy smoke
 *   tests and returns 503 when the DB is unreachable.
 * - Both responses set `Cache-Control: no-store` (ZAP rule 10049) because
 *   they reflect real-time state.
 */

import config from './config.mjs';
import logger from '../utils/logger.mjs';
import { isRedisConnected, getRedisClient } from '../middleware/rateLimiting.mjs';
import prisma from '../../packages/database/prismaClient.mjs';

/**
 * Collects Redis connection status (and server version when reachable) for the
 * health/readiness payloads. Never throws — a Redis hiccup degrades the field,
 * it does not fail the probe.
 */
export const getRedisHealthInfo = async () => {
  const redisConnected = isRedisConnected();
  const redisClient = getRedisClient();

  const redisInfo = {
    connected: redisConnected,
    status: redisConnected ? 'healthy' : 'degraded',
  };

  if (redisConnected && redisClient) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis info timeout')), 2000),
      );
      const info = await Promise.race([redisClient.info('server'), timeoutPromise]);
      const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
      redisInfo.version = version || 'unknown';
      redisInfo.status = 'healthy';
    } catch (error) {
      redisInfo.status = 'error';
      redisInfo.error = error.message;
      logger.warn(`[HealthCheck] Redis info check failed: ${error.message}`);
    }
  }

  return redisInfo;
};

/**
 * GET /health — liveness probe. Lightweight by design: never pings the DB.
 */
export const healthHandler = async (req, res) => {
  const redisInfo = await getRedisHealthInfo();

  // Liveness output reflects real-time state — never cache (ZAP rule 10049).
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    success: true,
    status: 'healthy',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
    services: {
      api: 'healthy',
      redis: redisInfo,
    },
  });
};

/**
 * GET /ready — readiness probe. Performs a real DB ping; 503 when unreachable.
 */
export const readyHandler = async (req, res) => {
  const redisInfo = await getRedisHealthInfo();
  let dbInfo = { status: 'healthy' };
  let statusCode = 200;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbInfo.responseTime = `${Date.now() - dbStart}ms`;
  } catch (error) {
    dbInfo = { status: 'unhealthy', error: error.message };
    statusCode = 503;
    logger.error(`[ReadinessCheck] Database unreachable: ${error.message}`);
  }

  // Readiness flips on DB state — must reflect real-time health, never cache.
  res.setHeader('Cache-Control', 'no-store');
  res.status(statusCode).json({
    success: statusCode === 200,
    status: statusCode === 200 ? 'ready' : 'not_ready',
    message: statusCode === 200 ? 'Server is ready' : 'Database unreachable',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
    services: {
      api: 'healthy',
      database: dbInfo,
      redis: redisInfo,
    },
  });
};

/**
 * GET /api-info — static endpoint map. Mutable across deploys → never cache.
 */
export const apiInfoHandler = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    message: 'Equoria API v1.0',
    documentation: '/api-docs',
    versioned: '/api/v1',
    labs: '/api/v1/labs',
    endpoints: {
      auth: '/api/auth',
      horses: '/api/horses',
      users: '/api/users',
      training: '/api/training',
      competition: '/api/competition',
      breeds: '/api/breeds',
      foals: '/api/foals',
      traits: '/api/traits',
      traitDiscovery: '/api/trait-discovery',
      milestones: '/api/milestones',
      grooms: '/api/grooms',
      leaderboards: '/api/leaderboards',
      admin: '/api/admin',
    },
    health: '/health',
  });
};
