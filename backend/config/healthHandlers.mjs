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

import logger from '../utils/logger.mjs';
import { isRedisConnected, getRedisClient } from '../middleware/rateLimiting.mjs';
import prisma from '../../packages/database/prismaClient.mjs';

/**
 * Collects Redis connection status for the health/readiness payloads. Never
 * throws — a Redis hiccup degrades the field, it does not fail the probe.
 *
 * Both probes are anonymous, so the payload is only `{ connected, status }`;
 * the server version and error text never leave the server (Equoria-ht7qz).
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
      // Responsiveness check only; the reply (which names the version) is discarded.
      await Promise.race([redisClient.info('server'), timeoutPromise]);
      redisInfo.status = 'healthy';
    } catch (error) {
      redisInfo.status = 'error';
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
    services: {
      api: 'healthy',
      redis: redisInfo,
    },
  });
};

/**
 * GET /ready — readiness probe. Performs a real DB ping on `db`; 503 when
 * unreachable. The client is a parameter so the unreachable branch can be
 * exercised with a real client pointed at a dead port.
 */
export const createReadyHandler =
  ({ db }) =>
  async (req, res) => {
    const redisInfo = await getRedisHealthInfo();
    let dbInfo = { status: 'healthy' };
    let statusCode = 200;

    try {
      const dbStart = Date.now();
      await db.$queryRaw`SELECT 1`;
      dbInfo.responseTime = `${Date.now() - dbStart}ms`;
    } catch (error) {
      // The driver message can name host:port — log it, never send it (Equoria-ht7qz).
      dbInfo = { status: 'unhealthy' };
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
      services: {
        api: 'healthy',
        database: dbInfo,
        redis: redisInfo,
      },
    });
  };

export const readyHandler = createReadyHandler({ db: prisma });

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
