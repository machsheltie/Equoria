/**
 * Unit Test: Foal Routes — Auth Enforcement & Rate Limiting
 *
 * Tests HTTP layer concerns: authentication enforcement and rate limiting.
 * Does NOT test foalModel business logic — that lives in dedicated foal tests.
 *
 * Classification: UNIT — tests middleware behaviour with mocked DB infrastructure.
 * DB and logger are mocked as permitted infrastructure boundaries; no real DB is used.
 *
 * Rate limit tests verify the 429 response on the Nth+1 request regardless of what
 * status previous requests returned, since foalRateLimiter counts ALL requests
 * (skipSuccessfulRequests: false, skipFailedRequests: false).
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
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

jest.unstable_mockModule('../../db/index.mjs', () => ({
  default: mockDb,
}));

jest.unstable_mockModule('../../../packages/database/prismaClient.mjs', () => ({
  default: mockPrisma,
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

const buildToken = userId =>
  jwt.sign({ id: userId, email: `${userId}@example.com` }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

beforeAll(async () => {
  process.env.TEST_RATE_LIMIT_WINDOW_MS = '10000'; // 10s window
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

  mockPrisma.horse.findFirst.mockResolvedValue({
    id: 1,
    userId: 'test-user-id',
  });
});

afterAll(() => {
  delete process.env.TEST_RATE_LIMIT_WINDOW_MS;
  delete process.env.TEST_RATE_LIMIT_MAX_REQUESTS;
});

describe('Foal routes auth enforcement', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  it('rejects unauthenticated access to foal development', async () => {
    const response = await request(app)
      .get('/api/foals/1/development')
      .set('Origin', 'http://localhost:3000')
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access token is required');
  });

  it('rejects unauthenticated access to foal enrichment', async () => {
    const response = await request(app)
      .post('/api/foals/1/enrichment')
      .set('Origin', 'http://localhost:3000')
      .send({ day: 1, activity: 'Feeding Assistance' })
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access token is required');
  });

  it('rejects unauthenticated access to foal activity', async () => {
    const response = await request(app)
      .post('/api/foals/1/activity')
      .set('Origin', 'http://localhost:3000')
      .send({ activityType: 'feeding' })
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access token is required');
  });

  it('rejects unauthenticated access to advance-day', async () => {
    const response = await request(app)
      .post('/api/foals/1/advance-day')
      .set('Origin', 'http://localhost:3000')
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access token is required');
  });

  it('rate limits foal activity endpoints — 429 on Nth+1 request', async () => {
    // foalRateLimiter counts ALL requests (skipSuccessfulRequests: false).
    // The 429 fires on request 3 regardless of what status 1 and 2 returned.
    const userId = 'rate-limit-activity-user';
    mockPrisma.horse.findFirst.mockResolvedValue({ id: 1, userId });
    const token = buildToken(userId);

    // First two requests — counted by rate limiter (any status is fine)
    await request(app)
      .post('/api/foals/1/activity')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityType: 'feeding' });

    await request(app)
      .post('/api/foals/1/activity')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityType: 'feeding' });

    // Third request must be rate-limited
    const response = await request(app)
      .post('/api/foals/1/activity')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityType: 'feeding' })
      .expect(429);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Foal action limit exceeded');
  });

  it('rate limits foal enrichment endpoints — 429 on Nth+1 request', async () => {
    const userId = 'rate-limit-enrichment-user';
    mockPrisma.horse.findFirst.mockResolvedValue({ id: 1, userId });
    const token = buildToken(userId);

    // First two requests — counted by rate limiter
    await request(app)
      .post('/api/foals/1/enrichment')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .send({ day: 1, activity: 'Feeding Assistance' });

    await request(app)
      .post('/api/foals/1/enrichment')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .send({ day: 1, activity: 'Feeding Assistance' });

    // Third request must be rate-limited
    const response = await request(app)
      .post('/api/foals/1/enrichment')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .send({ day: 1, activity: 'Feeding Assistance' })
      .expect(429);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Foal action limit exceeded');
  });

  it('rejects access to foal development when not owned', async () => {
    mockPrisma.horse.findFirst.mockResolvedValueOnce(null);

    const response = await request(app)
      .get('/api/foals/1/development')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Foal not found');
  });
});
