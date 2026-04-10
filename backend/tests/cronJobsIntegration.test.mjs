/**
 * Integration Test: Admin Cron API Routes — HTTP Layer
 *
 * Tests admin API endpoints for cron job management (status, start/stop,
 * manual trigger, foal listing, trait definitions).
 *
 * Scope: HTTP routing, auth enforcement, response structure.
 * NOT testing cron service correctness — that lives in cronJobService.test.mjs.
 * NOT testing trait evaluation logic — that lives in the dedicated trait tests.
 *
 * The cron service is mocked here because it controls time-scheduled jobs;
 * the mock prevents real jobs from firing during test runs while still
 * allowing the HTTP routing layer to be exercised end-to-end.
 *
 * REMOVED (were completely fake — called mock functions and asserted mock was called):
 * - "Daily Trait Evaluation" describe block
 * - "Error Handling" describe block
 * Real trait evaluation is tested in: atBirthTraits.test.mjs, traitMilestoneEvaluation.test.mjs
 */

import { jest, describe, beforeEach, expect, it, beforeAll } from '@jest/globals';
import request from 'supertest';
import { generateAdminToken } from './helpers/authHelper.mjs';

// Prisma mock — DB client boundary, permitted
const mockPrisma = {
  user: { create: jest.fn(), findUnique: jest.fn(), deleteMany: jest.fn() },
  horse: { findMany: jest.fn() },
  $disconnect: jest.fn(),
};

// Cron service mock — prevents real scheduled jobs from starting during tests.
// These tests verify HTTP routing/auth/response structure, NOT service correctness.
const mockCronJobService = {
  stop: jest.fn(),
  start: jest.fn(),
  evaluateDailyFoalTraits: jest.fn(),
  manualTraitEvaluation: jest.fn(),
  getStatus: jest.fn(),
};

jest.unstable_mockModule('../db/index.mjs', () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule('../services/cronJobs.mjs', () => ({
  default: mockCronJobService,
}));

const app = (await import('../app.mjs')).default;

describe('Admin Cron API Routes', () => {
  let adminToken;

  beforeAll(() => {
    mockCronJobService.stop.mockResolvedValue();
    mockCronJobService.start.mockResolvedValue();
    mockCronJobService.evaluateDailyFoalTraits.mockResolvedValue();
    mockCronJobService.manualTraitEvaluation.mockResolvedValue();
    mockCronJobService.getStatus.mockResolvedValue({
      serviceRunning: true,
      jobs: [{ name: 'dailyTraitEvaluation', running: true, nextRun: new Date() }],
      totalJobs: 1,
    });
    adminToken = generateAdminToken();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCronJobService.evaluateDailyFoalTraits.mockResolvedValue();
    mockCronJobService.manualTraitEvaluation.mockResolvedValue();
    mockCronJobService.getStatus.mockResolvedValue({
      serviceRunning: true,
      jobs: [{ name: 'dailyTraitEvaluation', running: true, nextRun: new Date() }],
      totalJobs: 1,
    });
    mockCronJobService.start.mockResolvedValue();
    mockCronJobService.stop.mockResolvedValue();
  });

  describe('Admin API Endpoints', () => {
    it('should get cron job status', async () => {
      const response = await request(app)
        .get('/api/admin/cron/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
    });

    it('should manually trigger trait evaluation', async () => {
      const response = await request(app)
        .post('/api/admin/traits/evaluate')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-skip-csrf', 'true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('completed successfully');
    });

    it('should get foals in development', async () => {
      mockPrisma.horse.findMany.mockResolvedValueOnce([
        {
          id: 8,
          name: 'Development List Foal',
          age: 0,
          bondScore: 65,
          stressLevel: 35,
          epigeneticModifiers: { positive: [], negative: [], hidden: [] },
        },
      ]);

      const response = await request(app)
        .get('/api/admin/foals/development')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('foals');
      expect(response.body.data).toHaveProperty('count');
      expect(Array.isArray(response.body.data.foals)).toBe(true);
    });

    it('should get trait definitions', async () => {
      const response = await request(app)
        .get('/api/admin/traits/definitions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('positive');
      expect(response.body.data).toHaveProperty('negative');
      expect(response.body.data).toHaveProperty('rare');

      Object.values(response.body.data).forEach(category => {
        Object.values(category).forEach(trait => {
          expect(trait).toHaveProperty('name');
          expect(trait).toHaveProperty('description');
          expect(trait).toHaveProperty('revealConditions');
          expect(trait).toHaveProperty('rarity');
          expect(trait).toHaveProperty('baseChance');
        });
      });
    });

    it('should start and stop cron job service', async () => {
      const startResponse = await request(app)
        .post('/api/admin/cron/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-skip-csrf', 'true')
        .expect(200);

      expect(startResponse.body.success).toBe(true);
      expect(startResponse.body.message).toContain('started successfully');

      const stopResponse = await request(app)
        .post('/api/admin/cron/stop')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-skip-csrf', 'true')
        .expect(200);

      expect(stopResponse.body.success).toBe(true);
      expect(stopResponse.body.message).toContain('stopped successfully');
    });

    it('requires admin authentication — rejects missing token', async () => {
      await request(app).get('/api/admin/cron/status').expect(401);
    });
  });
});
