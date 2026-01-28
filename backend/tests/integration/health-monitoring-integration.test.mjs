/**
 * 🧪 SYSTEM INTEGRATION TEST: Health Monitoring System Validation
 *
 * This test validates health monitoring system integration including health check
 * endpoints, database connectivity monitoring, system health assessment, error
 * reporting validation, and cross-system health monitoring coordination.
 *
 * 📋 INTEGRATION SCOPE:
 * - Health endpoint functionality validation across all systems
 * - Database connectivity monitoring and error detection
 * - System resource monitoring and health assessment
 * - Error reporting and logging validation
 * - Cross-system health status coordination
 * - Health monitoring API integration and consistency
 * - Performance monitoring and alerting validation
 * - Service availability and readiness checks
 *
 * 🎯 SYSTEMS TESTED:
 * 1. Main Health Endpoints - /health, /ping, /ready health checks
 * 2. Memory Management Health - Memory system health assessment
 * 3. Documentation System Health - API and user documentation health
 * 4. Database Health Monitoring - Connection and query performance
 * 5. Epigenetic Flag System Health - Flag system operational status
 * 6. Cross-System Health Coordination - Integrated health reporting
 * 7. Error Reporting Validation - Health check error handling
 * 8. Performance Health Monitoring - Response time and resource usage
 *
 * 🔄 NO MOCKING APPROACH:
 * ✅ REAL: Complete health monitoring system, actual database connectivity
 * ✅ REAL: Cross-system health validation, performance monitoring
 * ✅ REAL: Error reporting validation, service availability checks
 * 🔧 MOCK: None - full system integration testing
 *
 * 💡 TEST STRATEGY: Comprehensive health monitoring validation
 *    to ensure reliable system health reporting and monitoring across all services
 */

import request from 'supertest';
import express from 'express';
import { body } from 'express-validator';
import { register, login } from '../../controllers/authController.mjs';
import { authenticateToken } from '../../middleware/auth.mjs';
import { handleValidationErrors } from '../../middleware/validationErrorHandler.mjs';
import { handlePing, handleHealthCheck } from '../../controllers/pingController.mjs';
import memoryManagementRoutes from '../../routes/memoryManagementRoutes.mjs';
import documentationRoutes from '../../routes/documentationRoutes.mjs';
import userDocumentationRoutes from '../../routes/userDocumentationRoutes.mjs';
import epigeneticFlagRoutes from '../../routes/epigeneticFlagRoutes.mjs';
import { initializeMemoryManagement, shutdownMemoryManagement } from '../../services/memoryResourceManagementService.mjs';
import prisma from '../../db/index.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';

// Create test app with health monitoring
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Auth routes for testing
  app.post('/api/auth/register', [
    body('email').isEmail().normalizeEmail(),
    body('username').isLength({ min: 3, max: 30 }),
    body('password').isLength({ min: 8 }),
    body('firstName').notEmpty(),
    body('lastName').notEmpty(),
    handleValidationErrors,
  ], register);

  app.post('/api/auth/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    handleValidationErrors,
  ], login);

  // Main health endpoints
  app.get('/ping', handlePing);
  app.get('/health', handleHealthCheck);
  app.get('/ready', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        success: true,
        status: 'ready',
        message: 'Server is ready to accept requests',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        status: 'not_ready',
        message: 'Server is not ready - database unavailable',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // System health routes
  app.use('/api/memory', memoryManagementRoutes);
  app.use('/api/docs', documentationRoutes);
  app.use('/api/user-docs', userDocumentationRoutes);
  app.use('/api/flags', epigeneticFlagRoutes);

  // Test endpoint for health monitoring validation
  app.get('/api/test/health-status', authenticateToken, (req, res) => {
    res.json({
      success: true,
      message: 'Health monitoring test endpoint',
      data: {
        userId: req.user.id,
        timestamp: new Date().toISOString(),
        systemStatus: 'operational',
      },
    });
  });

  return app;
};

describe('🏥 Health Monitoring Integration Tests', () => {
  let app;
  let _testUser;
  let authToken;
  let _memoryManager;
  let server;

  beforeAll(async () => {
    app = createTestApp();
    // Start server once for all tests
    server = app.listen(0);

    // Initialize memory management for health testing
    _memoryManager = initializeMemoryManagement({
      memoryThreshold: 100 * 1024 * 1024, // 100MB for testing
      monitoringInterval: 1000, // 1 second for testing
      gcInterval: 2000, // 2 seconds for testing
    });
  });

  afterAll(async () => {
    // Clean up all test data
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { contains: 'healthintegration' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'healthintegration' } },
    });

    // Shutdown memory management
    shutdownMemoryManagement();

    // Close server and disconnect
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { contains: 'healthintegration' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'healthintegration' } },
    });

    // Create test user
    const userData = {
      email: 'healthintegration@test.com',
      username: 'healthintegrationuser',
      password: 'TestPassword123!',
      firstName: 'Health',
      lastName: 'Integration',
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);

    expect(registerResponse.status).toBe(201);
    _testUser = registerResponse.body.data.user;

    // Generate JWT token for authentication using test helper
    authToken = generateTestToken({ id: _testUser.id, email: _testUser.email });
  });

  afterEach(async () => {
    // Clean up test data for current test
    if (_testUser?.id) {
      await prisma.refreshToken.deleteMany({
        where: { userId: _testUser.id },
      });
    }
  });

  describe('🔍 Main Health Endpoints', () => {
    test('should provide basic ping health check', async () => {
      const response = await request(app)
        .get('/ping');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('pong');
      expect(response.body.timestamp).toBeDefined();
    });

    test('should provide ping with custom name', async () => {
      const response = await request(app)
        .get('/ping?name=HealthTest');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('pong, HealthTest!');
      expect(response.body.timestamp).toBeDefined();
    });

    test('should provide comprehensive health check', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.uptime).toBeDefined();
      expect(response.body.data.environment).toBeDefined();
      expect(response.body.data.services).toBeDefined();
      expect(response.body.data.services.database).toBeDefined();
      expect(response.body.data.services.database.status).toBe('healthy');
    });

    test('should provide readiness check', async () => {
      const response = await request(app)
        .get('/ready');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('ready');
      expect(response.body.message).toBe('Server is ready to accept requests');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('🧠 Memory Management Health', () => {
    test('should provide memory system health assessment', async () => {
      const response = await request(app)
        .get('/api/memory/health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.score).toBeDefined();
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.memory).toBeDefined();
      expect(response.body.data.memory.utilization).toBeDefined();
      expect(response.body.data.memory.status).toBeDefined();
      expect(response.body.data.resources).toBeDefined();
      expect(response.body.data.uptime).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();
    });

    test('should validate memory health score ranges', async () => {
      const response = await request(app)
        .get('/api/memory/health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const healthData = response.body.data;

      expect(healthData.score).toBeGreaterThanOrEqual(0);
      expect(healthData.score).toBeLessThanOrEqual(100);
      expect(['excellent', 'good', 'fair', 'poor']).toContain(healthData.status);
      expect(['healthy', 'warning', 'critical']).toContain(healthData.memory.status);
    });
  });

  describe('📚 Documentation System Health', () => {
    test('should provide API documentation health status', async () => {
      const response = await request(app)
        .get('/api/docs/health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.validation).toBeDefined();
    });

    test('should provide user documentation health status', async () => {
      const response = await request(app)
        .get('/api/user-docs/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.documentsLoaded).toBeDefined();
      expect(response.body.data.searchIndexSize).toBeDefined();
      expect(response.body.data.systemTime).toBeDefined();
    });
  });

  describe('🧬 Epigenetic Flag System Health', () => {
    test('should provide flag system operational status', async () => {
      const response = await request(app)
        .get('/api/flags/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Epigenetic flag system is operational');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.version).toBeDefined();
    });
  });

  describe('🔗 Cross-System Health Integration', () => {
    test('should validate health across all systems', async () => {
      const healthEndpoints = [
        { path: '/ping', requiresAuth: false },
        { path: '/health', requiresAuth: false },
        { path: '/ready', requiresAuth: false },
        { path: '/api/memory/health', requiresAuth: true },
        { path: '/api/docs/health', requiresAuth: true },
        { path: '/api/user-docs/health', requiresAuth: false },
        { path: '/api/flags/health', requiresAuth: false },
      ];

      for (const endpoint of healthEndpoints) {
        const request_builder = request(app).get(endpoint.path);

        if (endpoint.requiresAuth) {
          request_builder.set('Authorization', `Bearer ${authToken}`);
        }

        const response = await request_builder;

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // Validate common health response structure
        expect(response.body).toHaveProperty('success');
        if (response.body.data) {
          expect(response.body.data).toHaveProperty('status');
        }
      }
    });

    test('should provide consistent health response formats', async () => {
      const responses = await Promise.all([
        request(app).get('/health'),
        request(app).get('/api/memory/health').set('Authorization', `Bearer ${authToken}`),
        request(app).get('/api/user-docs/health'),
        request(app).get('/api/flags/health'),
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('success');

        // Each should have either message or data
        expect(
          Object.prototype.hasOwnProperty.call(response.body, 'message') ||
          Object.prototype.hasOwnProperty.call(response.body, 'data'),
        ).toBe(true);
      });
    });
  });

  describe('⚡ Performance Health Monitoring', () => {
    test('should monitor health endpoint response times', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/health');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      expect(response.body.data.services.database.responseTime).toBeDefined();
    });

    test('should validate database performance in health checks', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.data.services.database.status).toBe('healthy');
      expect(response.body.data.services.database.responseTime).toBeDefined();

      // Parse response time and validate it's reasonable
      const responseTime = parseInt(response.body.data.services.database.responseTime);
      expect(responseTime).toBeGreaterThan(0);
      expect(responseTime).toBeLessThan(5000); // Should be less than 5 seconds
    });
  });

  describe('🛡️ Health Monitoring Security', () => {
    test('should require authentication for protected health endpoints', async () => {
      const protectedEndpoints = [
        '/api/memory/health',
        '/api/docs/health',
        '/api/test/health-status',
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app).get(endpoint).set('x-test-require-auth', 'true');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access token is required');
      }
    });

    test('should allow public access to basic health endpoints', async () => {
      const publicEndpoints = [
        '/ping',
        '/health',
        '/ready',
        '/api/user-docs/health',
        '/api/flags/health',
      ];

      for (const endpoint of publicEndpoints) {
        const response = await request(app).get(endpoint);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('🚨 Error Handling and Reporting', () => {
    test('should handle health check errors gracefully', async () => {
      // Test authenticated health endpoint with valid token
      const response = await request(app)
        .get('/api/test/health-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.systemStatus).toBe('operational');
    });

    test('should provide meaningful error messages for health failures', async () => {
      // Test with invalid token
      const response = await request(app)
        .get('/api/memory/health')
        .set('x-test-require-auth', 'true')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired token');
    });
  });
});