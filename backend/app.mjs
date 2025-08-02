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
 * - /api/user - User profile and dashboard
 * - /api/leaderboard - Rankings and statistics
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
import leaderboardRoutes from './routes/leaderboardRoutes.mjs';
import adminRoutes from './routes/adminRoutes.mjs';

// Middleware imports
import errorHandler from './middleware/errorHandler.mjs';
import { requestLogger, errorRequestLogger } from './middleware/requestLogger.mjs';

// Service imports
import { initializeCronJobs, stopCronJobs } from './services/cronJobService.mjs';

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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
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
app.use('/api/user', userRoutes);
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
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Equoria API v1.0',
    documentation: '/api-docs',
    endpoints: {
      auth: '/api/auth',
      horses: '/api/horses',
      user: '/api/user',
      training: '/api/training',
      competition: '/api/competition',
      breeds: '/api/breeds',
      foals: '/api/foals',
      traits: '/api/traits',
      grooms: '/api/grooms',
      leaderboard: '/api/leaderboard',
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
// Initialize cron jobs
initializeCronJobs();

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopCronJobs();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  stopCronJobs();
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
