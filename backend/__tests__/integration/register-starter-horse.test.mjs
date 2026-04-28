/**
 * Integration Tests: POST /api/auth/register — Starter Horse Persistence
 *
 * Story 21R-2 Task 13 (seventh-pass correction — no mocks policy)
 *
 * Proves that POST /api/auth/register creates a user AND a starter horse
 * in the real test database. Uses real Prisma, real DB — no mocked calls.
 *
 * Fail-fast contract: if the starter-horse catch-swallow in authController.mjs
 * silently drops a creation failure, the DB query here catches it immediately.
 *
 * Policy: This file uses no vi.mock, no jest.mock, no mocked Prisma clients.
 * It is an integration test — it touches the real database.
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';

import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';
// Test-bypass headers were purged from production middleware in commits
// 5a158681 / 3590916e. Empty object preserves `.set(rateLimitBypass)`
// call-site signatures with no behavior. Rate pressure in test env is
// governed by TEST_RATE_LIMIT_* env knobs (see middleware/rateLimiting.mjs).
const rateLimitBypass = {};

describe('POST /api/auth/register — starter horse integration', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  let server;
  let registeredUserId = null;
  const ts = Date.now();
  const testUser = {
    username: `starthorse_${ts}`,
    email: `starthorse_${ts}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Starter',
    lastName: 'Horse',
  };

  beforeAll(async () => {
    server = app.listen(0);
  });

  afterAll(async () => {
    if (registeredUserId) {
      await prisma.refreshToken.deleteMany({ where: { userId: registeredUserId } });
      await prisma.horse.deleteMany({ where: { userId: registeredUserId } });
      await prisma.user.deleteMany({ where: { id: registeredUserId } });
    }
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    // prisma.$disconnect() removed — global teardown handles disconnection
  });

  it('creates a user and at least one starter horse in the real database', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:3000')
      .set(rateLimitBypass)
      .send(testUser)
      .expect(201);

    expect(res.body.status).toBe('success');

    // Extract user ID from response
    const userId = res.body.data?.user?.id ?? res.body.data?.id;
    expect(typeof userId).toBe('string');
    registeredUserId = userId;

    // Real DB query — proves the horse was actually persisted
    const horses = await prisma.horse.findMany({ where: { userId } });
    expect(horses.length).toBeGreaterThanOrEqual(1);
    expect(horses[0].userId).toBe(userId);
  });

  it('starter horse has valid stats (not all zero)', async () => {
    if (!registeredUserId) {
      throw new Error('Previous test must pass first — no registeredUserId');
    }

    const horses = await prisma.horse.findMany({ where: { userId: registeredUserId } });
    const horse = horses[0];

    expect(horse).toBeDefined();
    // Registration creates a starter horse with base stats (≥ 1 for core stats)
    const coreStats = [horse.speed, horse.stamina, horse.agility, horse.balance, horse.precision, horse.intelligence];
    const nonZeroStats = coreStats.filter(s => s > 0);
    expect(nonZeroStats.length).toBeGreaterThan(0);
  });

  it('starter horse has a name and healthStatus', async () => {
    if (!registeredUserId) {
      throw new Error('Previous test must pass first — no registeredUserId');
    }

    const horses = await prisma.horse.findMany({ where: { userId: registeredUserId } });
    const horse = horses[0];

    expect(horse.name).toBeTruthy();
    expect(horse.healthStatus).toBeTruthy();
  });
});
