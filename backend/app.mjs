/**
 * 🏇 EQUORIA BACKEND - Express Application Setup
 *
 * Main Express application configuration for the Equoria horse breeding and competition game.
 * Provides comprehensive API endpoints for user management, horse operations, training,
 * competitions, breeding, and game progression.
 *
 * 🎯 FEATURES:
 * - RESTful API design with comprehensive endpoints
 * - JWT-based authentication and authorization
 * - Rate limiting and security middleware
 * - Request/response logging and monitoring
 * - Error handling and validation
 * - API documentation with Swagger
 * - CORS configuration for frontend integration
 *
 * 🔧 MIDDLEWARE STACK:
 * - Security: Helmet, CORS, Rate limiting
 * - Authentication: JWT token verification
 * - Logging: Request/response logging with Winston
 * - Validation: Express-validator for input validation
 * - Error handling: Centralized error management
 *
 * 🚀 API ROUTES:
 * - /api/auth - Authentication and user management
 * - /api/horses - Horse CRUD operations and management
 * - /api/training - Training sessions and progression
 * - /api/competition - Competition entry and results
 * - /api/breeding - Breeding operations and foal management
 * - /api/users - User profile and dashboard
 * - /api/leaderboards - Rankings and statistics
 * - /api/milestones - Milestone evaluation system
 * - /api/admin - Administrative operations
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ESM equivalents of __filename / __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendPublicDir = join(__dirname, 'public');
const frontendDistDir = join(__dirname, '..', 'frontend', 'dist');
const frontendPublicDir = join(__dirname, '..', 'frontend', 'public');
const requiredFrontendAssets = [
  'index.html',
  'images/bg-stable.webp',
  'images/bg-horse-detail.webp',
  'assets/art/farrier.webp',
  'images/farriershop.webp',
];
const hasRequiredFrontendAssets = publicDir =>
  requiredFrontendAssets.every(assetPath => existsSync(join(publicDir, assetPath)));
const staticAssetDirs = [backendPublicDir, frontendDistDir, frontendPublicDir].filter(publicDir =>
  existsSync(publicDir),
);
const spaPublicDir = hasRequiredFrontendAssets(backendPublicDir)
  ? backendPublicDir
  : existsSync(join(frontendDistDir, 'index.html'))
    ? frontendDistDir
    : null;
import config from './config/config.mjs';
import logger from './utils/logger.mjs';

// Route imports
import pingRoute from './routes/ping.mjs';
import authRoutes from './routes/authRoutes.mjs';
import authenticatedAuthRoutes from './modules/auth/routes/authenticatedAuthRoutes.mjs';
import horseRoutes from './routes/horseRoutes.mjs';
import userRoutes from './routes/userRoutes.mjs';
import trainingRoutes from './routes/trainingRoutes.mjs';
import competitionRoutes from './routes/competitionRoutes.mjs';
import breedRoutes from './routes/breedRoutes.mjs';
import foalRoutes from './routes/foalRoutes.mjs';
import traitRoutes from './routes/traitRoutes.mjs';
import traitDiscoveryRoutes from './routes/traitDiscoveryRoutes.mjs';
import groomRoutes from './routes/groomRoutes.mjs';
import groomMarketplaceRoutes from './routes/groomMarketplaceRoutes.mjs';
import enhancedGroomRoutes from './routes/enhancedGroomRoutes.mjs';
import groomAssignmentRoutes from './routes/groomAssignmentRoutes.mjs';
import groomHandlerRoutes from './routes/groomHandlerRoutes.mjs';
import groomSalaryRoutes from './routes/groomSalaryRoutes.mjs';
import groomPerformanceRoutes from './routes/groomPerformanceRoutes.mjs';
import epigeneticTraitRoutes from './routes/epigeneticTraitRoutes.mjs';
import epigeneticFlagRoutes from './routes/epigeneticFlagRoutes.mjs';
import enhancedMilestoneRoutes from './routes/enhancedMilestoneRoutes.mjs';
import leaderboardRoutes from './routes/leaderboardRoutes.mjs';
import ultraRareTraitRoutes from './routes/ultraRareTraitRoutes.mjs';
import advancedEpigeneticRoutes from './routes/advancedEpigeneticRoutes.mjs';
import enhancedReportingRoutes from './routes/enhancedReportingRoutes.mjs';
import dynamicCompatibilityRoutes from './routes/dynamicCompatibilityRoutes.mjs';
import personalityEvolutionRoutes from './routes/personalityEvolutionRoutes.mjs';
import apiOptimizationRoutes from './routes/apiOptimizationRoutes.mjs';
import memoryManagementRoutes from './routes/memoryManagementRoutes.mjs';
import documentationRoutes from './routes/documentationRoutes.mjs';
import userDocumentationRoutes from './routes/userDocumentationRoutes.mjs';
import advancedBreedingGeneticsRoutes from './routes/advancedBreedingGeneticsRoutes.mjs';
import environmentalRoutes from './routes/environmentalRoutes.mjs';
import adminRoutes from './routes/adminRoutes.mjs';
import riderRoutes from './routes/riderRoutes.mjs';
import trainerRoutes from './routes/trainerRoutes.mjs';
import vetRoutes from './routes/vetRoutes.mjs';
import tackShopRoutes from './routes/tackShopRoutes.mjs';
import farrierRoutes from './routes/farrierRoutes.mjs';
import feedShopRoutes from './routes/feedShopRoutes.mjs';
import inventoryRoutes from './routes/inventoryRoutes.mjs';
import forumRoutes from './routes/forumRoutes.mjs';
import messageRoutes from './routes/messageRoutes.mjs';
import clubRoutes from './routes/clubRoutes.mjs';
import marketplaceRoutes from './modules/marketplace/routes/marketplaceRoutes.mjs';
import nextActionsRoutes from './routes/nextActionsRoutes.mjs';
import wyagRoutes from './routes/wyagRoutes.mjs';
import showRoutes from './routes/showRoutes.mjs';
import bankRoutes from './routes/bankRoutes.mjs';
import craftingRoutes from './routes/craftingRoutes.mjs';

/**
 * 🔒 SECURITY ROUTER ARCHITECTURE
 *
 * Three-tier router system for granular authentication control:
 * - publicRouter: No authentication required (health, docs, auth endpoints)
 * - authRouter: Authenticated users only (all game features)
 * - adminRouter: Admin role required (system administration)
 */

// Import authentication middleware
import { authenticateToken, requireRole } from './middleware/auth.mjs';

// Import CSRF protection middleware
import { csrfProtection, csrfErrorHandler } from './middleware/csrf.mjs';

// Import Redis rate limiting (for health check and shutdown)
import { createRateLimiter, isRedisConnected, getRedisClient } from './middleware/rateLimiting.mjs';

// Import shared security configuration
// (centralized so the helmet CSP, COEP, and response-header middleware stay in
//  one place — see backend/middleware/security.mjs)
import { helmetConfig, addSecurityHeaders } from './middleware/security.mjs';

// Public router - No authentication required
const publicRouter = express.Router();

// Authenticated router - Requires valid JWT token
const authRouter = express.Router();
authRouter.use(authenticateToken);
// Apply CSRF protection to all state-changing operations (POST/PUT/DELETE/PATCH)
authRouter.use(csrfProtection);

// Admin router - Requires valid JWT token + admin role
const adminRouter = express.Router();
adminRouter.use(authenticateToken, requireRole('admin'));
// Apply CSRF protection to all state-changing operations (POST/PUT/DELETE/PATCH)
adminRouter.use(csrfProtection);

// PUBLIC ROUTES (No authentication)
// Auth endpoints (login, register, password reset, CSRF token)
publicRouter.use('/auth', authRoutes);
// Backward compatibility for tests hitting /api/auth/*
publicRouter.use('/api/auth', authRoutes);
// Documentation endpoints
publicRouter.use('/docs', documentationRoutes);
publicRouter.use('/api/docs', documentationRoutes);
publicRouter.use('/user-docs', userDocumentationRoutes);
// Backward compatibility for tests hitting /api/user-docs/*
publicRouter.use('/api/user-docs', userDocumentationRoutes);

// AUTHENTICATED ROUTES (Valid JWT required)
// Authenticated auth mutations (profile, logout, change-password, onboarding, preferences)
// — live on authRouter so they inherit authenticateToken + csrfProtection.
authRouter.use('/auth', authenticatedAuthRoutes);

// Core game features
authRouter.use('/horses', horseRoutes);
authRouter.use('/users', userRoutes);
authRouter.use('/training', trainingRoutes);
authRouter.use('/competition', competitionRoutes);
authRouter.use('/breeds', breedRoutes);
authRouter.use('/foals', foalRoutes);
authRouter.use('/trait-discovery', traitDiscoveryRoutes);
authRouter.use('/traits', traitRoutes);

// Rider and trainer systems
authRouter.use('/riders', riderRoutes);
authRouter.use('/trainers', trainerRoutes);
authRouter.use('/vet', vetRoutes);
authRouter.use('/tack-shop', tackShopRoutes);
authRouter.use('/farrier', farrierRoutes);
authRouter.use('/feed-shop', feedShopRoutes);
authRouter.use('/inventory', inventoryRoutes);
authRouter.use('/forum', forumRoutes);
authRouter.use('/messages', messageRoutes);
authRouter.use('/clubs', clubRoutes);
authRouter.use('/marketplace', marketplaceRoutes);
authRouter.use('/next-actions', nextActionsRoutes);
authRouter.use('/while-you-were-gone', wyagRoutes);
authRouter.use('/shows', showRoutes);
authRouter.use('/bank', bankRoutes);
authRouter.use('/crafting', craftingRoutes);

// Groom management system
authRouter.use('/grooms', groomRoutes);
authRouter.use('/grooms/enhanced', enhancedGroomRoutes);
authRouter.use('/groom-assignments', groomAssignmentRoutes);
authRouter.use('/groom-handlers', groomHandlerRoutes);
authRouter.use('/groom-salaries', groomSalaryRoutes);
authRouter.use('/groom-performance', groomPerformanceRoutes);
authRouter.use('/groom-marketplace', groomMarketplaceRoutes);

// Advanced game features
authRouter.use('/epigenetic-traits', epigeneticTraitRoutes);
authRouter.use('/flags', epigeneticFlagRoutes);
authRouter.use('/milestones', enhancedMilestoneRoutes);
authRouter.use('/ultra-rare-traits', ultraRareTraitRoutes);
authRouter.use('/leaderboards', leaderboardRoutes);

// Advanced epigenetic and genetics features
authRouter.use('/', advancedEpigeneticRoutes); // Mounts horse-specific routes at /horses/:id/...
authRouter.use('/', enhancedReportingRoutes); // Enhanced reporting endpoints
authRouter.use('/', advancedBreedingGeneticsRoutes); // Advanced breeding mechanics

// Performance optimization and environmental systems
authRouter.use('/optimization', apiOptimizationRoutes);
authRouter.use('/memory', memoryManagementRoutes);
authRouter.use('/environment', environmentalRoutes);
authRouter.use('/compatibility', dynamicCompatibilityRoutes);
authRouter.use('/personality-evolution', personalityEvolutionRoutes);

// ADMIN ROUTES (Admin role required)
adminRouter.use('/', adminRoutes);

// Middleware imports
import errorHandler from './middleware/errorHandler.mjs';
import { requestLogger, errorRequestLogger } from './middleware/requestLogger.mjs';
import { setupSwaggerDocs, addDocumentationHeaders } from './middleware/swaggerSetup.mjs';
import {
  responseOptimization,
  paginationMiddleware,
  performanceMonitoring,
} from './middleware/responseOptimization.mjs';
import { createCompressionMiddleware } from './services/apiResponseOptimizationService.mjs';
import {
  createResourceManagementMiddleware,
  memoryMonitoringMiddleware,
  databaseConnectionMiddleware,
  requestTimeoutMiddleware,
} from './middleware/resourceManagement.mjs';

// Service imports
import prisma from '../packages/database/prismaClient.mjs';

// Sentry error tracking and monitoring
import { initializeSentry, attachSentryErrorHandler } from './config/sentry.mjs';

const app = express();

// Initialize Sentry (must be before any other middleware)
initializeSentry(app);

// Trust proxy for accurate IP addresses behind reverse proxies
app.set('trust proxy', 1);

// Security middleware
// Order matters: addSecurityHeaders runs first so helmet does not overwrite
// the Permissions-Policy / Referrer-Policy values, then helmet applies the
// CSP + COEP + HSTS directives defined in middleware/security.mjs.
app.use(addSecurityHeaders);
app.use(helmet(helmetConfig));

// CORS + no-origin policy — single authoritative source.
//
// Two layers in order:
//   1. enforceNoOriginPolicy — hard-rejects requests without an Origin
//      header except on operational probes (/health, /ready, /ping). The
//      `cors` package's `origin: false` only suppresses response headers;
//      it does NOT terminate the request, so a dedicated gate is needed.
//   2. cors(corsOptions) — validates the Origin value against the allow
//      list. Browsers always send Origin on mutations, so legitimate SPA
//      traffic passes through.
//
// There is no machine-client API-key fallback. The prior dead
// `validateApiKey` middleware has been removed — do not reintroduce it.
const NO_ORIGIN_EXEMPT_PATHS = ['/health', '/ready', '/ping'];

const isNoOriginExempt = path =>
  NO_ORIGIN_EXEMPT_PATHS.some(p => path === p || path.startsWith(`${p}/`));

const enforceNoOriginPolicy = (req, res, next) => {
  if (req.get('Origin')) {
    return next();
  }
  if (isNoOriginExempt(req.path)) {
    return next();
  }
  logger.warn(`Blocked no-origin request: ${req.method} ${req.path}`);
  return res.status(403).json({
    success: false,
    message: 'Origin header required',
    code: 'NO_ORIGIN_BLOCKED',
  });
};

app.use(enforceNoOriginPolicy);

const corsOptions = {
  origin(origin, callback) {
    // No-origin requests that reach this point are already exempt
    // (health/ping); reflect them through.
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ];

    if (config.allowedOrigins && config.allowedOrigins.length > 0) {
      allowedOrigins.push(...config.allowedOrigins);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    logger.warn(`CORS blocked request from origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
};

app.use(cors(corsOptions));

// Rate limiting - using factory for consistency and test support
// ⚠️ DEV WORKFLOW NOTE: Limits are intentionally high for local development.
// DO NOT reduce the development/test/beta/beta-readiness limits — they exist
// to prevent lockouts during active dev and testing sessions.
// Production: 100 req / 15 min | Beta: 500 req / 15 min | Development: 500 req / 15 min |
// Test / beta-readiness: 1000 req / 15 min
//
// Story 21S-3: NODE_ENV=beta (Playwright) sits between dev and prod — high
// enough that E2E without bypass headers does not 429, low enough that an
// abusive client would still be throttled.
//
// beta-readiness runs the full Playwright readiness suite against production
// middleware; at production's 100-req cap the suite self-rate-limits before
// reaching the end of a single flow. Treating beta-readiness like test for
// this limit keeps production parity where it matters (auth, CSRF, ownership,
// email delivery) without turning the gate into a rate-limiter test.
const RATE_LIMIT_MAX_BY_ENV = {
  // Test suite runs several hundred requests across many files in one
  // --runInBand session. 1000 was the old cap when bypass headers reset
  // the counter between suites; with bypasses removed in WS4 the counter
  // accumulates for the whole run, so we set the cap well above what any
  // realistic suite run consumes.
  test: 20000,
  'beta-readiness': 1000,
  beta: 500,
  development: 500,
};
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: RATE_LIMIT_MAX_BY_ENV[process.env.NODE_ENV] ?? 100,
  keyPrefix: 'rl:global',
  useEnvOverride: false, // Don't let tests override the global limit
});

app.use('/api/', apiLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing middleware for httpOnly cookies
app.use(cookieParser());

// Request logging
app.use(requestLogger);

// Documentation headers
app.use(addDocumentationHeaders());

// Response optimization middleware
app.use(createCompressionMiddleware());
app.use(responseOptimization());
app.use(paginationMiddleware());
app.use(performanceMonitoring());

// Memory and resource management middleware
app.use(
  createResourceManagementMiddleware({
    trackMemoryUsage: true,
    trackPerformance: true,
    enableCleanup: true,
    memoryThreshold: 100 * 1024 * 1024, // 100MB
    performanceThreshold: 5000, // 5 seconds
  }),
);
app.use(
  memoryMonitoringMiddleware({
    threshold: 500 * 1024 * 1024, // 500MB
    enableGC: process.env.NODE_ENV === 'production',
  }),
);
app.use(databaseConnectionMiddleware(prisma));
app.use(requestTimeoutMiddleware(30000)); // 30 second timeout

/**
 * 🔒 MOUNT SECURITY ROUTERS
 *
 * Router mounting order (CRITICAL - DO NOT CHANGE):
 * 1. Public routes first (no auth)
 * 2. Admin routes (highest security)
 * 3. Authenticated routes (standard auth)
 * 4. Labs routes (experimental, authenticated)
 */

const getRedisHealthInfo = async () => {
  // Check Redis connection status
  const redisConnected = isRedisConnected();
  const redisClient = getRedisClient();

  const redisInfo = {
    connected: redisConnected,
    status: redisConnected ? 'healthy' : 'degraded',
  };

  // Try to get Redis server info if connected
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

// PUBLIC ROUTES - No authentication required
// Health check endpoint — keep lightweight for Railway liveness probes.
// Database readiness is exposed separately at /ready so health probes do not
// consume scarce Supabase Session-mode pool clients.
publicRouter.get('/health', async (req, res) => {
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
});

// Readiness endpoint — performs a real DB ping for operators and deploy smoke tests.
publicRouter.get('/ready', async (req, res) => {
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
});

// Ping endpoint
publicRouter.use('/ping', pingRoute);

// API documentation endpoint
publicRouter.get('/api-info', (req, res) => {
  // Endpoint map is mutable across deploys — never cache.
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
});

// Setup Swagger documentation (public)
setupSwaggerDocs(app);

// MOUNT ROUTERS
// Public routes (health, ping, auth, docs)
app.use('/', publicRouter);

// Public breed routes (no auth — needed for onboarding before login)
app.use('/api/v1/breeds', breedRoutes);
app.use('/api/breeds', breedRoutes);

// Admin routes (requires auth + admin role)
app.use('/api/v1/admin', adminRouter);
app.use('/api/admin', adminRouter);

// Authenticated routes (requires auth)
app.use('/api/v1', authRouter);
app.use('/api', authRouter);

// Serve frontend static assets in every environment so direct backend-port
// image requests work for local development, non-Docker production, and Docker.
// Must come before the 404 handler so asset requests are served, not rejected.
//
// Cache-Control policy (ZAP rule 10049 "Storable but Non-Cacheable Content"):
// - /assets/* and /fonts/* — Vite emits content-hashed filenames, so these
//   are safely cached forever. `immutable` tells browsers not to revalidate.
// - everything else — short-lived cache with mandatory revalidation so
//   replacement images (e.g. /images/bg-stable.webp) propagate promptly.
const setStaticCacheHeaders = (res, filePath) => {
  const urlPath = filePath.replace(/\\/g, '/');
  if (/\/assets\/[^/]+$|\/fonts\/[^/]+$/.test(urlPath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
  }
};

for (const staticAssetDir of staticAssetDirs) {
  app.use(express.static(staticAssetDir, { setHeaders: setStaticCacheHeaders }));
}

// Cache index.html in memory at startup to avoid sendFile streaming issues
let spaHtml = null;
if (process.env.NODE_ENV === 'production' && spaPublicDir) {
  try {
    spaHtml = readFileSync(join(spaPublicDir, 'index.html'), 'utf-8');
  } catch {
    logger.warn('[SPA] Could not read index.html — SPA fallback disabled');
  }
}

// 404 handler for undefined routes
// In production: serve index.html for non-API routes (SPA client-side routing)
// In development: return JSON 404 so API callers get useful errors
app.use('*', (req, res) => {
  if (
    spaHtml &&
    process.env.NODE_ENV === 'production' &&
    !req.path.startsWith('/api') &&
    !req.path.startsWith('/health') &&
    !req.path.startsWith('/api-docs')
  ) {
    // SPA HTML pins the current bundle hash — it must never be served from
    // a stale cache, otherwise users boot an old bundle whose chunks no
    // longer exist on the server (ZAP rule 10049).
    res.setHeader('Cache-Control', 'no-store');
    return res.type('html').send(spaHtml);
  }

  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl} from ${req.ip}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Error request logging
app.use(errorRequestLogger);

// Sentry error handler (must be after routes, before other error handlers)
attachSentryErrorHandler(app);

// CSRF error handler (must be before global error handler)
app.use(csrfErrorHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown handling is managed by server.mjs so that background services
// like cron jobs and memory monitoring only run in production environments.

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Uncaught exception handler
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;
