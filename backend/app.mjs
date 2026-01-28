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
import config from './config/config.mjs';
import logger from './utils/logger.mjs';

// Route imports
import pingRoute from './routes/ping.mjs';
import authRoutes from './routes/authRoutes.mjs';
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
import { applyCsrfProtection, csrfErrorHandler } from './middleware/csrf.mjs';

// Import Redis rate limiting (for health check and shutdown)
import { createRateLimiter, isRedisConnected, getRedisClient } from './middleware/rateLimiting.mjs';

// Public router - No authentication required
const publicRouter = express.Router();

// Authenticated router - Requires valid JWT token
const authRouter = express.Router();
authRouter.use(authenticateToken);
// Apply CSRF protection to all state-changing operations (POST/PUT/DELETE/PATCH)
authRouter.use(applyCsrfProtection);

// Admin router - Requires valid JWT token + admin role
const adminRouter = express.Router();
adminRouter.use(authenticateToken, requireRole('admin'));
// Apply CSRF protection to all state-changing operations (POST/PUT/DELETE/PATCH)
adminRouter.use(applyCsrfProtection);

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
// Core game features
authRouter.use('/horses', horseRoutes);
authRouter.use('/users', userRoutes);
authRouter.use('/training', trainingRoutes);
authRouter.use('/competition', competitionRoutes);
authRouter.use('/breeds', breedRoutes);
authRouter.use('/foals', foalRoutes);
authRouter.use('/trait-discovery', traitDiscoveryRoutes);
authRouter.use('/traits', traitRoutes);

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
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// CORS configuration
const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ];

    // Add production origins from environment
    if (config.allowedOrigins && config.allowedOrigins.length > 0) {
      allowedOrigins.push(...config.allowedOrigins);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
    'x-test-skip-csrf',
  ],
};

app.use(cors(corsOptions));

// Rate limiting - using factory for consistency and test support
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 100, // Lenient in tests to avoid interference
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

// PUBLIC ROUTES - No authentication required
// Health check endpoint
publicRouter.get('/health', async (req, res) => {
  // Check Redis connection status
  const redisConnected = isRedisConnected();
  const redisClient = getRedisClient();

  let redisInfo = {
    connected: redisConnected,
    status: redisConnected ? 'healthy' : 'degraded',
  };

  // Try to get Redis server info if connected
  if (redisConnected && redisClient) {
    try {
      // Add a timeout to avoid hanging if Redis is unstable (e.g. during E2E tests)
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

  // Overall health status
  // Server is "healthy" even if Redis is down (graceful degradation)
  // But we report the Redis status for monitoring
  const overallStatus = 'healthy';
  const statusCode = 200;

  res.status(statusCode).json({
    success: true,
    status: overallStatus,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
    services: {
      api: 'healthy',
      database: 'healthy', // Assumes DB is healthy if app is running
      redis: redisInfo,
    },
  });
});

// Ping endpoint
publicRouter.use('/ping', pingRoute);

// API documentation endpoint
publicRouter.get('/api-info', (req, res) => {
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

// Admin routes (requires auth + admin role)
app.use('/api/v1/admin', adminRouter);
app.use('/api/admin', adminRouter);

// Authenticated routes (requires auth)
app.use('/api/v1', authRouter);
app.use('/api', authRouter);

// 404 handler for undefined routes
app.use('*', (req, res) => {
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
