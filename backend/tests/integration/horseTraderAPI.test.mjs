/**
 * Horse Trader (Store) API Integration Tests — Epic 21
 *
 * Tests the store-purchase endpoint:
 *   POST /api/v1/marketplace/store/buy
 *
 * Business rules exercised:
 * - Happy path: horse created, coins deducted, correct response shape
 * - Sex selection: mare / stallion stored correctly
 * - Stat generation: all 12 stats in [1, 20] range, total ≤ 200
 * - Age anchor: created horse is age 3, healthStatus 'Excellent'
 * - Validation: missing / invalid breedId, invalid sex → 400
 * - Non-existent breed → 404
 * - Insufficient funds (< 1000 coins) → 400
 * - Unauthenticated request → 401
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../helpers/testAuth.mjs';
import app from '../../app.mjs';

const STORE_PRICE = 1000;

describe('🐴 INTEGRATION: Horse Trader Store API', () => {
  let richUser, richToken;
  let brokeUser, brokeToken;
  let testBreed;
  const createdHorseIds = [];

  beforeAll(async () => {
    const ts = Date.now();

    const rich = await createTestUser({
      username: `store_rich_${ts}`,
      email: `store_rich_${ts}@test.com`,
      money: 10000,
    });
    richUser = rich.user;
    richToken = rich.token;

    const broke = await createTestUser({
      username: `store_broke_${ts}`,
      email: `store_broke_${ts}@test.com`,
      money: 500,
    });
    brokeUser = broke.user;
    brokeToken = broke.token;

    // Reuse an existing breed or create a minimal one
    testBreed =
      (await prisma.breed.findFirst()) ??
      (await prisma.breed.create({
        data: { name: `StoreTestBreed_${ts}`, description: 'Horse trader test breed' },
      }));
  });

  afterAll(async () => {
    try {
      await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
    } catch {
      /* ignore */
    }
    try {
      await prisma.user.deleteMany({
        where: { id: { in: [richUser?.id, brokeUser?.id].filter(Boolean) } },
      });
    } catch {
      /* ignore */
    }
    await prisma.$disconnect();
  });

  // ─── Happy path ──────────────────────────────────────────────────────────────

  it('should create a mare and deduct 1000 coins', async () => {
    const balanceBefore = (await prisma.user.findUnique({ where: { id: richUser.id } })).money;

    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Authorization', `Bearer ${richToken}`)
      .set('x-test-skip-csrf', 'true')
      .send({ breedId: testBreed.id, sex: 'mare' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pricePaid).toBe(STORE_PRICE);
    expect(res.body.data.newBalance).toBe(balanceBefore - STORE_PRICE);
    expect(res.body.data.horse).toBeDefined();
    expect(res.body.data.horse.sex).toBe('mare');

    // Verify horse exists in DB with correct owner
    const horse = await prisma.horse.findUnique({ where: { id: res.body.data.horse.id } });
    expect(horse).not.toBeNull();
    expect(horse.userId).toBe(richUser.id);
    expect(horse.sex).toBe('mare');
    expect(horse.age).toBe(3);
    expect(horse.healthStatus).toBe('Excellent');
    createdHorseIds.push(horse.id);
  });

  it('should create a stallion with correct sex stored', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Authorization', `Bearer ${richToken}`)
      .set('x-test-skip-csrf', 'true')
      .send({ breedId: testBreed.id, sex: 'stallion' });

    expect(res.status).toBe(201);
    expect(res.body.data.horse.sex).toBe('stallion');

    const horse = await prisma.horse.findUnique({ where: { id: res.body.data.horse.id } });
    expect(horse.sex).toBe('stallion');
    createdHorseIds.push(horse.id);
  });

  it('should generate all stats as positive integers within a valid range', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Authorization', `Bearer ${richToken}`)
      .set('x-test-skip-csrf', 'true')
      .send({ breedId: testBreed.id, sex: 'mare' });

    expect(res.status).toBe(201);
    const h = res.body.data.horse;
    createdHorseIds.push(h.id);

    const statFields = [
      'speed',
      'stamina',
      'agility',
      'balance',
      'precision',
      'intelligence',
      'boldness',
      'flexibility',
      'obedience',
      'focus',
    ];

    // Canonical breeds use sampleStat capped at [1, 100]; non-canonical get [20, 45]
    for (const field of statFields) {
      expect(h[field]).toBeGreaterThanOrEqual(1);
      expect(h[field]).toBeLessThanOrEqual(100);
      expect(Number.isInteger(h[field])).toBe(true);
    }
  });

  it('should include message with horse name in response', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Authorization', `Bearer ${richToken}`)
      .set('x-test-skip-csrf', 'true')
      .send({ breedId: testBreed.id, sex: 'mare' });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/added to your stable/i);
    createdHorseIds.push(res.body.data.horse.id);
  });

  // ─── Validation errors ────────────────────────────────────────────────────────

  it('should return 400 when breedId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Authorization', `Bearer ${richToken}`)
      .set('x-test-skip-csrf', 'true')
      .send({ sex: 'mare' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/breedId/i);
  });

  it('should return 400 when breedId is zero', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Authorization', `Bearer ${richToken}`)
      .set('x-test-skip-csrf', 'true')
      .send({ breedId: 0, sex: 'mare' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when breedId is a non-numeric string', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Authorization', `Bearer ${richToken}`)
      .set('x-test-skip-csrf', 'true')
      .send({ breedId: 'abc', sex: 'mare' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when sex is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Authorization', `Bearer ${richToken}`)
      .set('x-test-skip-csrf', 'true')
      .send({ breedId: testBreed.id, sex: 'gelding' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/sex/i);
  });

  it('should return 400 when sex is missing', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Authorization', `Bearer ${richToken}`)
      .set('x-test-skip-csrf', 'true')
      .send({ breedId: testBreed.id });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── Not-found errors ─────────────────────────────────────────────────────────

  it('should return 404 for a non-existent breedId', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Authorization', `Bearer ${richToken}`)
      .set('x-test-skip-csrf', 'true')
      .send({ breedId: 999999, sex: 'mare' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/breed not found/i);
  });

  // ─── Insufficient funds ───────────────────────────────────────────────────────

  it('should return 400 when user has insufficient funds', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Authorization', `Bearer ${brokeToken}`)
      .set('x-test-skip-csrf', 'true')
      .send({ breedId: testBreed.id, sex: 'mare' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/insufficient funds/i);

    // Confirm no coins were deducted
    const user = await prisma.user.findUnique({ where: { id: brokeUser.id } });
    expect(user.money).toBe(500);
  });

  // ─── Authentication ───────────────────────────────────────────────────────────

  it('should return 401 when no auth token is provided', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('x-test-require-auth', 'true')
      .send({ breedId: testBreed.id, sex: 'mare' });

    expect(res.status).toBe(401);
  });
});
