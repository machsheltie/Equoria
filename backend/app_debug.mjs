/**
 * 🏇 EQUORIA BACKEND - Express Application Setup
 * DEBUG VERSION - MEMORY MIDDLEWARE DISABLED
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

import { authenticateToken, requireRole } from './middleware/auth.mjs';
import { applyCsrfProtection, csrfErrorHandler } from './middleware/csrf.mjs';
import { isRedisConnected, getRedisClient, _closeRedis } from './middleware/rateLimiting.mjs';

const publicRouter = express.Router();
const authRouter = express.Router();
authRouter.use(authenticateToken);
authRouter.use(applyCsrfProtection);

const adminRouter = express.Router();
adminRouter.use(authenticateToken, requireRole('admin'));
adminRouter.use(applyCsrfProtection);

publicRouter.use('/auth', authRoutes);
publicRouter.use('/api/auth', authRoutes);
publicRouter.use('/docs', documentationRoutes);
publicRouter.use('/api/docs', documentationRoutes);
publicRouter.use('/user-docs', userDocumentationRoutes);
publicRouter.use('/api/user-docs', userDocumentationRoutes);

authRouter.use('/horses', horseRoutes);
authRouter.use('/users', userRoutes);
authRouter.use('/training', trainingRoutes);
authRouter.use('/competition', competitionRoutes);
authRouter.use('/breeds', breedRoutes);
authRouter.use('/foals', foalRoutes);
authRouter.use('/trait-discovery', traitDiscoveryRoutes);
authRouter.use('/traits', traitRoutes);

authRouter.use('/grooms', groomRoutes);
authRouter.use('/grooms/enhanced', enhancedGroomRoutes);
authRouter.use('/groom-assignments', groomAssignmentRoutes);
authRouter.use('/groom-handlers', groomHandlerRoutes);
authRouter.use('/groom-salaries', groomSalaryRoutes);
authRouter.use('/groom-performance', groomPerformanceRoutes);
authRouter.use('/groom-marketplace', groomMarketplaceRoutes);

authRouter.use('/epigenetic-traits', epigeneticTraitRoutes);
authRouter.use('/flags', epigeneticFlagRoutes);
authRouter.use('/milestones', enhancedMilestoneRoutes);
authRouter.use('/ultra-rare-traits', ultraRareTraitRoutes);
authRouter.use('/leaderboards', leaderboardRoutes);

authRouter.use('/', advancedEpigeneticRoutes);
authRouter.use('/', enhancedReportingRoutes);
authRouter.use('/', advancedBreedingGeneticsRoutes);

authRouter.use('/optimization', apiOptimizationRoutes);
authRouter.use('/memory', memoryManagementRoutes);
authRouter.use('/environment', environmentalRoutes);
authRouter.use('/compatibility', dynamicCompatibilityRoutes);
authRouter.use('/personality-evolution', personalityEvolutionRoutes);

adminRouter.use('/', adminRoutes);

import errorHandler from './middleware/errorHandler.mjs';
import { requestLogger, errorRequestLogger } from './middleware/requestLogger.mjs';
import { setupSwaggerDocs, addDocumentationHeaders } from './middleware/swaggerSetup.mjs';
import {
  responseOptimization,
  paginationMiddleware,
  performanceMonitoring,
} from './middleware/responseOptimization.mjs';
import { createCompressionMiddleware } from './services/apiResponseOptimizationService.mjs';
import { _createResourceManagementMiddleware, _memoryMonitoringMiddleware, _databaseConnectionMiddleware, _requestTimeoutMiddleware } from './middleware/resourceManagement.mjs';

import prisma from '../packages/database/prismaClient.mjs';

const app = express();

app.set('trust proxy', 1);

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

const corsOptions = {
  origin(origin, callback) {
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
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
};

app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.env === 'test' ? 10000 : 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cookieParser());

app.use(requestLogger);

app.use(addDocumentationHeaders());

app.use(createCompressionMiddleware());
app.use(responseOptimization());
app.use(paginationMiddleware());
app.use(performanceMonitoring());

// Memory and resource management middleware - COMMENTED OUT FOR DEBUGGING
// app.use(createResourceManagementMiddleware({
//   trackMemoryUsage: true,
//   trackPerformance: true,
//   enableCleanup: true,
//   memoryThreshold: 100 * 1024 * 1024,
//   performanceThreshold: 5000,
// }));
// app.use(memoryMonitoringMiddleware({
//   threshold: 500 * 1024 * 1024,
//   enableGC: process.env.NODE_ENV === 'production',
// }));
// app.use(databaseConnectionMiddleware(prisma));
// app.use(requestTimeoutMiddleware(30000));

// Public routes
publicRouter.get('/health', async (req, res) => {
  const redisConnected = isRedisConnected();
  const redisClient = getRedisClient();

  const redisInfo = {
    connected: redisConnected,
    status: redisConnected ? 'healthy' : 'degraded',
  };

  if (redisConnected && redisClient) {
    try {
      const info = await redisClient.info('server');
      const version = info.match(/redis_version:([^\n]+)/)?.[1];
      redisInfo.version = version || 'unknown';
      redisInfo.status = 'healthy';
    } catch (error) {
      redisInfo.status = 'error';
      redisInfo.error = error.message;
    }
  }

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
      database: 'healthy',
      redis: redisInfo,
    },
  });
});

publicRouter.use('/ping', pingRoute);

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

setupSwaggerDocs(app);

app.use('/', publicRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/admin', adminRouter);
app.use('/api/v1', authRouter);
app.use('/api', authRouter);

app.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl} from ${req.ip}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

app.use(errorRequestLogger);
app.use(csrfErrorHandler);
app.use(errorHandler);

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;
