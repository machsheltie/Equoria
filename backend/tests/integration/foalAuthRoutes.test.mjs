import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockDb = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockPrisma = {
  horse: {
    findFirst: jest.fn(),
  },
};

const mockFoalModel = {
  getFoalDevelopment: jest.fn(),
  completeActivity: jest.fn(),
  advanceDay: jest.fn(),
  completeEnrichmentActivity: jest.fn(),
};

jest.unstable_mockModule('../../db/index.mjs', () => ({
  default: mockDb,
}));

jest.unstable_mockModule('../../../packages/database/prismaClient.mjs', () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule('../../models/foalModel.mjs', () => ({
  getFoalDevelopment: mockFoalModel.getFoalDevelopment,
  completeActivity: mockFoalModel.completeActivity,
  advanceDay: mockFoalModel.advanceDay,
  completeEnrichmentActivity: mockFoalModel.completeEnrichmentActivity,
}));

jest.unstable_mockModule('../../utils/logger.mjs', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

let app;
let authToken;
const originalBypassRateLimit = process.env.TEST_BYPASS_RATE_LIMIT;

const buildToken = userId =>
  jwt.sign({ id: userId, email: `${userId}@example.com` }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

beforeAll(async () => {
  process.env.TEST_BYPASS_RATE_LIMIT = 'false';
  process.env.TEST_RATE_LIMIT_WINDOW_MS = '1000';
  process.env.TEST_RATE_LIMIT_MAX_REQUESTS = '2';

  authToken = jwt.sign({ id: 'test-user-id', email: 'test@example.com' }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

  const { authenticateToken } = await import('../../middleware/auth.mjs');
  const { foalRateLimiter } = await import('../../middleware/rateLimiting.mjs');
  const { default: foalRoutes } = await import('../../routes/foalRoutes.mjs');

  app = express();
  app.use(express.json());
  app.use(authenticateToken);
  app.use('/api/foals', foalRateLimiter, foalRoutes);
});

beforeEach(() => {
  jest.clearAllMocks();

  mockDb.user.findUnique.mockResolvedValue({
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'admin',
  });
  mockDb.user.create.mockResolvedValue({
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'admin',
  });
  mockDb.user.update.mockResolvedValue({
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'admin',
  });

  mockPrisma.horse.findFirst.mockResolvedValue({
    id: 1,
    userId: 'test-user-id',
  });

  mockFoalModel.getFoalDevelopment.mockResolvedValue({
    development: { currentDay: 1 },
  });
  mockFoalModel.completeActivity.mockResolvedValue({
    activityType: 'feeding',
  });
  mockFoalModel.advanceDay.mockResolvedValue({
    development: { currentDay: 2 },
  });
  mockFoalModel.completeEnrichmentActivity.mockResolvedValue({
    activity: { name: 'Feeding Assistance' },
    foal: { id: 1, name: 'Test Foal' },
    levels: { bond_score: 50, stress_level: 20, bond_change: 0, stress_change: 0 },
    training_record_id: 'test-record-id',
  });
});

afterAll(() => {
  process.env.TEST_BYPASS_RATE_LIMIT = originalBypassRateLimit;
  delete process.env.TEST_RATE_LIMIT_WINDOW_MS;
  delete process.env.TEST_RATE_LIMIT_MAX_REQUESTS;
});

describe('Foal routes auth enforcement', () => {
  // SECURITY FIX (Phase 1, Task 1.1): Removed x-test-require-auth and x-test-bypass-rate-limit headers
  // Tests now rely on authenticateToken middleware functioning properly with no bypass mechanisms
  it('rejects unauthenticated access to foal development', async () => {
    const response = await request(app).get('/api/foals/1/development').expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access token is required');
  });

  it('rejects unauthenticated access to foal enrichment', async () => {
    const response = await request(app)
      .post('/api/foals/1/enrichment')
      .send({ day: 1, activity: 'Feeding Assistance' })
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access token is required');
  });

  it('rejects unauthenticated access to foal activity', async () => {
    const response = await request(app).post('/api/foals/1/activity').send({ activityType: 'feeding' }).expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access token is required');
  });

  it('rejects unauthenticated access to advance-day', async () => {
    const response = await request(app).post('/api/foals/1/advance-day').expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access token is required');
  });

  it('rate limits foal activity endpoints', async () => {
    const userId = 'rate-limit-activity-user';
    mockPrisma.horse.findFirst.mockResolvedValue({
      id: 1,
      userId,
    });
    const token = buildToken(userId);

    await request(app)
      .post('/api/foals/1/activity')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityType: 'feeding' })
      .expect(200);

    await request(app)
      .post('/api/foals/1/activity')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityType: 'feeding' })
      .expect(200);

    const response = await request(app)
      .post('/api/foals/1/activity')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityType: 'feeding' })
      .expect(429);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Foal action limit exceeded');
  });

  it('rate limits foal enrichment endpoints', async () => {
    const userId = 'rate-limit-enrichment-user';
    mockPrisma.horse.findFirst.mockResolvedValue({
      id: 1,
      userId,
    });
    const token = buildToken(userId);

    await request(app)
      .post('/api/foals/1/enrichment')
      .set('Authorization', `Bearer ${token}`)
      .send({ day: 1, activity: 'Feeding Assistance' })
      .expect(200);

    await request(app)
      .post('/api/foals/1/enrichment')
      .set('Authorization', `Bearer ${token}`)
      .send({ day: 1, activity: 'Feeding Assistance' })
      .expect(200);

    const response = await request(app)
      .post('/api/foals/1/enrichment')
      .set('Authorization', `Bearer ${token}`)
      .send({ day: 1, activity: 'Feeding Assistance' })
      .expect(429);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Foal action limit exceeded');
  });

  it('rejects access to foal development when not owned', async () => {
    mockPrisma.horse.findFirst.mockResolvedValueOnce(null);

    // SECURITY FIX (Phase 1, Task 1.1): Removed x-test-bypass-rate-limit header
    // Rate limiting uses TEST_RATE_LIMIT_MAX_REQUESTS from .env.test (1000 requests)
    const response = await request(app)
      .get('/api/foals/1/development')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Foal not found');
  });
});
