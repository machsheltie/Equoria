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
import rateLimit from 'express-rate-limit';
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

// Middleware imports
import errorHandler from './middleware/errorHandler.mjs';
import { requestLogger, errorRequestLogger } from './middleware/requestLogger.mjs';
import { setupSwaggerDocs, addDocumentationHeaders } from './middleware/swaggerSetup.mjs';
import {
  responseOptimization,
  paginationMiddleware,
  performanceMonitoring
} from './middleware/responseOptimization.mjs';
import { createCompressionMiddleware } from './services/apiResponseOptimizationService.mjs';
import {
  createResourceManagementMiddleware,
  memoryMonitoringMiddleware,
  databaseConnectionMiddleware,
  requestTimeoutMiddleware,
} from './middleware/resourceManagement.mjs';

// Service imports
import { initializeCronJobs, stopCronJobs } from './services/cronJobService.mjs';
import { initializeMemoryManagement, shutdownMemoryManagement } from './services/memoryResourceManagementService.mjs';
import prisma from '../packages/database/prismaClient.mjs';

const app = express();

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Rate limiting - more lenient for test environment
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.env === 'test' ? 10000 : 100, // Much higher limit for tests
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use(createResourceManagementMiddleware({
  trackMemoryUsage: true,
  trackPerformance: true,
  enableCleanup: true,
  memoryThreshold: 100 * 1024 * 1024, // 100MB
  performanceThreshold: 5000, // 5 seconds
}));
app.use(memoryMonitoringMiddleware({
  threshold: 500 * 1024 * 1024, // 500MB
  enableGC: process.env.NODE_ENV === 'production',
}));
app.use(databaseConnectionMiddleware(prisma));
app.use(requestTimeoutMiddleware(30000)); // 30 second timeout

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
  });
});

// API Routes
app.use('/ping', pingRoute);
app.use('/api/auth', authRoutes);
app.use('/api/horses', horseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/competition', competitionRoutes);
app.use('/api/breeds', breedRoutes);
app.use('/api/foals', foalRoutes);
app.use('/api/trait-discovery', traitDiscoveryRoutes);
app.use('/api/traits', traitRoutes);
app.use('/api/grooms', groomRoutes);
app.use('/api/grooms/enhanced', enhancedGroomRoutes);
app.use('/api/groom-assignments', groomAssignmentRoutes);
app.use('/api/groom-handlers', groomHandlerRoutes);
app.use('/api/groom-salaries', groomSalaryRoutes);
app.use('/api/groom-performance', groomPerformanceRoutes);
app.use('/api/groom-marketplace', groomMarketplaceRoutes);
app.use('/api/epigenetic-traits', epigeneticTraitRoutes);
app.use('/api/flags', epigeneticFlagRoutes);
app.use('/api/milestones', enhancedMilestoneRoutes);
app.use('/api/ultra-rare-traits', ultraRareTraitRoutes);
app.use('/api', advancedEpigeneticRoutes);
app.use('/api', enhancedReportingRoutes);
app.use('/api/compatibility', dynamicCompatibilityRoutes);
app.use('/api/personality-evolution', personalityEvolutionRoutes);
app.use('/api/optimization', apiOptimizationRoutes);
app.use('/api/memory', memoryManagementRoutes);
app.use('/api/docs', documentationRoutes);
app.use('/api/user-docs', userDocumentationRoutes);
app.use('/api/leaderboards', leaderboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', advancedBreedingGeneticsRoutes);
app.use('/api/environment', environmentalRoutes);

// Setup Swagger documentation
setupSwaggerDocs(app);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Equoria API v1.0',
    documentation: '/api-docs',
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

// Global error handler
app.use(errorHandler);

// Graceful shutdown handling
// Initialize cron jobs and memory management
initializeCronJobs();
initializeMemoryManagement({
  memoryThreshold: 500 * 1024 * 1024, // 500MB
  gcInterval: 60000, // 1 minute
  monitoringInterval: 10000, // 10 seconds
  alertThreshold: 0.8, // 80%
  enableGCOptimization: process.env.NODE_ENV === 'production',
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopCronJobs();
  shutdownMemoryManagement();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  stopCronJobs();
  shutdownMemoryManagement();
  process.exit(0);
});

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
