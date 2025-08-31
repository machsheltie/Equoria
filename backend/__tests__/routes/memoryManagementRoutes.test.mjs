/**
 * 🧪 Memory Management Routes Tests
 * 
 * Comprehensive test suite for memory management API endpoints including:
 * - Memory status and metrics retrieval
 * - Resource analytics and monitoring
 * - Garbage collection management
 * - System health assessment
 * - Performance monitoring and alerting
 * 
 * Testing Approach: TDD with NO MOCKING
 * - Real API endpoint testing with authentication
 * - Authentic memory monitoring validation
 * - Genuine resource tracking behavior
 * - Production-like memory scenarios
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import memoryManagementRoutes from '../../routes/memoryManagementRoutes.mjs';
import { responseHandler } from '../../utils/apiResponse.mjs';
import { authenticateToken } from '../../middleware/auth.mjs';
import { 
  getMemoryManager, 
  shutdownMemoryManagement,
  initializeMemoryManagement 
} from '../../services/memoryResourceManagementService.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

describe('Memory Management Routes', () => {
  let testApp;
  let testUser;
  let authToken;
  let memoryManager;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: 'memoryTestUser',
        email: 'memory@test.com',
        password: 'testPassword123',
        firstName: 'Memory',
        lastName: 'Test',
      },
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test Express app
    testApp = express();
    testApp.use(express.json());
    testApp.use(responseHandler);
    testApp.use('/api/memory', memoryManagementRoutes);

    // Initialize memory management
    memoryManager = initializeMemoryManagement({
      memoryThreshold: 50 * 1024 * 1024, // 50MB for testing
      monitoringInterval: 1000, // 1 second for testing
      gcInterval: 2000, // 2 seconds for testing
    });
  });

  afterAll(async () => {
    // Cleanup memory management
    shutdownMemoryManagement();
    
    // Cleanup test data
    await prisma.user.delete({
      where: { id: testUser.id },
    });
  });

  describe('GET /api/memory/status', () => {
    test('retrieves memory status successfully', async () => {
      const response = await request(testApp)
        .get('/api/memory/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('status');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.memory).toBeDefined();
      expect(response.body.data.resources).toBeDefined();
      expect(response.body.data.monitoring).toBeDefined();
    });

    test('requires authentication', async () => {
      const response = await request(testApp)
        .get('/api/memory/status')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });
  });

  describe('GET /api/memory/metrics', () => {
    test('retrieves memory metrics with default timeframe', async () => {
      const response = await request(testApp)
        .get('/api/memory/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.timeframe).toBe('1h');
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.analytics).toBeDefined();
      expect(response.body.data.analytics.averageHeapUsed).toBeDefined();
      expect(response.body.data.analytics.peakHeapUsed).toBeDefined();
      expect(response.body.data.analytics.averageHeapUtilization).toBeDefined();
      expect(response.body.data.analytics.memoryGrowthRate).toBeDefined();
    });

    test('accepts different timeframe parameters', async () => {
      const timeframes = ['1h', '6h', '24h', '7d'];
      
      for (const timeframe of timeframes) {
        const response = await request(testApp)
          .get(`/api/memory/metrics?timeframe=${timeframe}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.timeframe).toBe(timeframe);
      }
    });

    test('includes GC data when requested', async () => {
      const response = await request(testApp)
        .get('/api/memory/metrics?includeGC=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.gc).toBeDefined();
    });

    test('validates timeframe parameter', async () => {
      const response = await request(testApp)
        .get('/api/memory/metrics?timeframe=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('GET /api/memory/resources', () => {
    test('retrieves resource analytics successfully', async () => {
      const response = await request(testApp)
        .get('/api/memory/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.current).toBeDefined();
      expect(response.body.data.tracked).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();
      expect(response.body.data.efficiency).toBeDefined();
      expect(Array.isArray(response.body.data.recommendations)).toBe(true);
      expect(typeof response.body.data.efficiency).toBe('number');
    });
  });

  describe('POST /api/memory/gc', () => {
    test('triggers garbage collection when available', async () => {
      if (!global.gc) {
        // Skip test if GC is not exposed
        return;
      }

      const response = await request(testApp)
        .post('/api/memory/gc')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ force: false })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.duration).toBeDefined();
      expect(response.body.data.memoryBefore).toBeDefined();
      expect(response.body.data.memoryAfter).toBeDefined();
      expect(response.body.data.memoryFreed).toBeDefined();
      expect(response.body.data.efficiency).toBeDefined();
    });

    test('handles GC unavailability gracefully', async () => {
      const originalGC = global.gc;
      delete global.gc;

      const response = await request(testApp)
        .post('/api/memory/gc')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not exposed');

      global.gc = originalGC;
    });

    test('validates request body', async () => {
      const response = await request(testApp)
        .post('/api/memory/gc')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ force: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('POST /api/memory/cleanup', () => {
    test('performs resource cleanup successfully', async () => {
      const response = await request(testApp)
        .post('/api/memory/cleanup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ resourceTypes: ['all'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.resourcesAfterCleanup).toBeDefined();
      expect(response.body.data.timestamp).toBeDefined();
    });

    test('handles selective cleanup request', async () => {
      const response = await request(testApp)
        .post('/api/memory/cleanup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ resourceTypes: ['timers', 'intervals'] })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('validates resource types parameter', async () => {
      const response = await request(testApp)
        .post('/api/memory/cleanup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ resourceTypes: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('GET /api/memory/alerts', () => {
    test('retrieves memory alerts successfully', async () => {
      const response = await request(testApp)
        .get('/api/memory/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.alerts).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.summary.total).toBeDefined();
      expect(response.body.data.summary.bySeverity).toBeDefined();
      expect(response.body.data.summary.recent).toBeDefined();
      expect(Array.isArray(response.body.data.alerts)).toBe(true);
    });

    test('filters alerts by severity', async () => {
      const severities = ['info', 'warning', 'critical'];
      
      for (const severity of severities) {
        const response = await request(testApp)
          .get(`/api/memory/alerts?severity=${severity}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.alerts).toBeDefined();
      }
    });

    test('limits alert results', async () => {
      const response = await request(testApp)
        .get('/api/memory/alerts?limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.alerts.length).toBeLessThanOrEqual(10);
    });

    test('validates severity parameter', async () => {
      const response = await request(testApp)
        .get('/api/memory/alerts?severity=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });

    test('validates limit parameter', async () => {
      const response = await request(testApp)
        .get('/api/memory/alerts?limit=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('GET /api/memory/health', () => {
    test('retrieves system health assessment successfully', async () => {
      const response = await request(testApp)
        .get('/api/memory/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.score).toBeDefined();
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.memory).toBeDefined();
      expect(response.body.data.resources).toBeDefined();
      expect(response.body.data.uptime).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();
      
      expect(typeof response.body.data.score).toBe('number');
      expect(response.body.data.score).toBeGreaterThanOrEqual(0);
      expect(response.body.data.score).toBeLessThanOrEqual(100);
      expect(['excellent', 'good', 'fair', 'poor']).toContain(response.body.data.status);
      expect(Array.isArray(response.body.data.recommendations)).toBe(true);
    });

    test('provides memory utilization status', async () => {
      const response = await request(testApp)
        .get('/api/memory/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.memory.utilization).toBeDefined();
      expect(response.body.data.memory.status).toBeDefined();
      expect(typeof response.body.data.memory.utilization).toBe('number');
      expect(['healthy', 'warning', 'critical']).toContain(response.body.data.memory.status);
    });

    test('provides resource efficiency metrics', async () => {
      const response = await request(testApp)
        .get('/api/memory/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.resources.efficiency).toBeDefined();
      expect(response.body.data.resources.status).toBeDefined();
      expect(typeof response.body.data.resources.efficiency).toBe('number');
    });
  });

  describe('Error Handling', () => {
    test('handles invalid authentication tokens', async () => {
      const response = await request(testApp)
        .get('/api/memory/status')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('handles missing authorization header', async () => {
      const response = await request(testApp)
        .get('/api/memory/status')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Performance Validation', () => {
    test('memory metrics show realistic values', async () => {
      const response = await request(testApp)
        .get('/api/memory/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const analytics = response.body.data.analytics;
      
      expect(analytics.averageHeapUsed).toBeGreaterThan(0);
      expect(analytics.peakHeapUsed).toBeGreaterThan(0);
      expect(analytics.averageHeapUtilization).toBeGreaterThan(0);
      expect(analytics.averageHeapUtilization).toBeLessThanOrEqual(1);
    });

    test('resource analytics show meaningful data', async () => {
      const response = await request(testApp)
        .get('/api/memory/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const data = response.body.data;
      
      expect(data.efficiency).toBeGreaterThanOrEqual(0);
      expect(data.efficiency).toBeLessThanOrEqual(100);
      expect(data.current).toBeDefined();
      expect(typeof data.current).toBe('object');
    });

    test('health assessment provides actionable insights', async () => {
      const response = await request(testApp)
        .get('/api/memory/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const health = response.body.data;
      
      expect(health.score).toBeGreaterThan(0);
      expect(health.recommendations).toBeDefined();
      expect(health.memory.utilization).toBeGreaterThan(0);
      expect(health.uptime).toBeGreaterThan(0);
    });
  });

  describe('Real-time Monitoring Integration', () => {
    test('status endpoint reflects current monitoring state', async () => {
      const response = await request(testApp)
        .get('/api/memory/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.monitoring.isActive).toBe(true);
      expect(response.body.data.monitoring.uptime).toBeGreaterThan(0);
    });

    test('metrics endpoint provides recent data', async () => {
      // Wait a moment for metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const response = await request(testApp)
        .get('/api/memory/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.analytics.averageHeapUsed).toBeGreaterThan(0);
    });
  });
});
