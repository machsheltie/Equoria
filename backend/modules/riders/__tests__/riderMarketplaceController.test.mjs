/**
 * riderMarketplaceController.test.mjs — real DB
 *
 * NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted
 * from jest.unstable_mockModule of prismaClient + logger to a real-DB
 * integration test.
 *
 * Coverage: getRiderMarketplace, refreshRiderMarketplace, hireRiderFromMarketplace.
 * Uses real generateRiderMarketplace() service.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateRiderMarketplace } from '../services/riderMarketplace.mjs';
import {
  getRiderMarketplace,
  refreshRiderMarketplace,
  hireRiderFromMarketplace,
} from '../controllers/riderMarketplaceController.mjs';

const SUITE_PREFIX = 'rmkt';

function makeReqRes(userId, overrides = {}) {
  let _status = 200;
  let _body = null;
  return {
    req: {
      user: userId === undefined ? undefined : { id: userId },
      body: {},
      params: {},
      query: {},
      ...overrides,
    },
    res: {
      status(c) {
        _status = c;
        return this;
      },
      json(b) {
        _body = b;
        return this;
      },
      get statusValue() {
        return _status;
      },
      get jsonValue() {
        return _body;
      },
    },
  };
}

async function createUser(money = 9999) {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'Rmkt',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
      money,
    },
  });
}

async function seedMarketplaceState(userId, overrides = {}) {
  const offers = generateRiderMarketplace();
  return prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId, staffType: 'rider' } },
    create: {
      userId,
      staffType: 'rider',
      offers,
      lastRefresh: overrides.lastRefresh ?? new Date(),
      refreshCount: overrides.refreshCount ?? 1,
    },
    update: {
      offers,
      lastRefresh: overrides.lastRefresh ?? new Date(),
      refreshCount: overrides.refreshCount ?? 1,
    },
  });
}

async function cleanupSuite() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) {
    return;
  }
  const userIds = users.map(u => u.id);
  await prisma.staffMarketplaceState.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.rider.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('riderMarketplaceController (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  describe('getRiderMarketplace', () => {
    it('generates and returns marketplace for a new user (no prior state row)', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id);
      await getRiderMarketplace(h.req, h.res);

      expect(h.res.statusValue).toBe(200);
      const body = h.res.jsonValue;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.riders)).toBe(true);
      expect(body.data.riders.length).toBeGreaterThan(0);
      expect(typeof body.data.refreshCost).toBe('number');
      expect(typeof body.data.canRefreshFree).toBe('boolean');
      expect(body.data.riders[0]).toMatchObject({
        marketplaceId: expect.stringMatching(/^mkt_rider_/),
        firstName: expect.any(String),
        lastName: expect.any(String),
        skillLevel: expect.stringMatching(/^(rookie|developing|experienced)$/),
        personality: expect.any(String),
        weeklyRate: expect.any(Number),
      });

      // Verify the upsert persisted a state row.
      const persisted = await prisma.staffMarketplaceState.findFirst({
        where: { userId: user.id, staffType: 'rider' },
      });
      expect(persisted).not.toBeNull();
    });

    it('returns existing marketplace when refresh is not needed', async () => {
      const user = await createUser();
      await seedMarketplaceState(user.id, { lastRefresh: new Date() });

      const h = makeReqRes(user.id);
      await getRiderMarketplace(h.req, h.res);

      expect(h.res.statusValue).toBe(200);
      expect(Array.isArray(h.res.jsonValue.data.riders)).toBe(true);
    });

    it('returns 500 when req.user is missing (controller throws)', async () => {
      // The controller dereferences req.user.id without auth-guard.
      const h = makeReqRes(undefined);
      await getRiderMarketplace(h.req, h.res);

      expect(h.res.statusValue).toBe(500);
      expect(h.res.jsonValue).toMatchObject({ success: false });
    });
  });

  describe('refreshRiderMarketplace', () => {
    it('refreshes free when no prior marketplace exists (cost is 0)', async () => {
      const user = await createUser();

      const h = makeReqRes(user.id, { body: {} });
      await refreshRiderMarketplace(h.req, h.res);

      expect(h.res.statusValue).toBe(200);
      const data = h.res.jsonValue.data;
      expect(Array.isArray(data.riders)).toBe(true);
      expect(data.riders.length).toBeGreaterThan(0);
      expect(data.refreshCost).toBe(0);
    });

    it('returns 400 when paid refresh attempted without force=true', async () => {
      const user = await createUser();
      await seedMarketplaceState(user.id, { lastRefresh: new Date() });

      const h = makeReqRes(user.id, { body: { force: false } });
      await refreshRiderMarketplace(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue).toMatchObject({
        success: false,
        message: expect.stringContaining('force=true'),
      });
    });

    it('deducts cost and refreshes when force=true and user has enough money', async () => {
      const user = await createUser(500); // PREMIUM_REFRESH_COST is 50
      await seedMarketplaceState(user.id, { lastRefresh: new Date() });

      const h = makeReqRes(user.id, { body: { force: true } });
      await refreshRiderMarketplace(h.req, h.res);

      expect(h.res.statusValue).toBe(200);

      // Verify the DB reflects the deduction (500 - 50 = 450).
      const after = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
      expect(after.money).toBe(450);
    });

    it('returns 400 when user has insufficient funds for paid refresh', async () => {
      const user = await createUser(10); // less than PREMIUM_REFRESH_COST
      await seedMarketplaceState(user.id, { lastRefresh: new Date() });

      const h = makeReqRes(user.id, { body: { force: true } });
      await refreshRiderMarketplace(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue).toMatchObject({
        success: false,
        message: expect.stringContaining('Insufficient'),
      });

      // Money should NOT have been decremented.
      const after = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
      expect(after.money).toBe(10);
    });
  });

  describe('hireRiderFromMarketplace', () => {
    it('returns 400 when marketplaceId is missing from body', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { body: {} });
      await hireRiderFromMarketplace(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue).toMatchObject({
        success: false,
        message: expect.stringContaining('marketplaceId'),
      });
    });

    it('returns 404 when no marketplace has been generated for user', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { body: { marketplaceId: 'mkt_rider_nonexistent' } });
      await hireRiderFromMarketplace(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue).toMatchObject({
        success: false,
        message: expect.stringContaining('marketplace'),
      });
    });

    it('hires rider, deducts weeklyRate, returns 201, persists rider, removes from offers', async () => {
      const user = await createUser(9999);
      const state = await seedMarketplaceState(user.id);
      const targetRider = state.offers[0];

      const h = makeReqRes(user.id, { body: { marketplaceId: targetRider.marketplaceId } });
      await hireRiderFromMarketplace(h.req, h.res);

      expect(h.res.statusValue).toBe(201);
      const body = h.res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.cost).toBe(targetRider.weeklyRate);
      expect(body.data.rider).toMatchObject({
        firstName: targetRider.firstName,
        lastName: targetRider.lastName,
      });

      // Verify the rider was created in the rider table.
      const persistedRider = await prisma.rider.findFirst({
        where: { userId: user.id, firstName: targetRider.firstName, lastName: targetRider.lastName },
      });
      expect(persistedRider).not.toBeNull();

      // Verify money deducted.
      const userAfter = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
      expect(userAfter.money).toBe(9999 - targetRider.weeklyRate);

      // Verify hired rider removed from offers.
      const stateAfter = await prisma.staffMarketplaceState.findFirst({
        where: { userId: user.id, staffType: 'rider' },
      });
      const remainingIds = stateAfter.offers.map(o => o.marketplaceId);
      expect(remainingIds).not.toContain(targetRider.marketplaceId);
    });

    // Equoria-jmn75 (sibling of Equoria-78i38): the ledger write must complete
    // BEFORE hireRiderFromMarketplace resolves. It was previously
    // fire-and-forget `recordTransaction(...).catch(...)` — the dangling
    // promise settled after suite cleanup deleted the user and Jest tore down
    // the module registry, risking an import-after-teardown ReferenceError.
    // Sentinel: the ledger row exists the instant the handler returns.
    it('writes the rider_hire ledger transaction synchronously before the handler resolves', async () => {
      const user = await createUser(9999);
      const state = await seedMarketplaceState(user.id);
      const targetRider = state.offers[0];

      const before = await prisma.userTransaction.count({
        where: { userId: user.id, category: 'rider_hire' },
      });

      const h = makeReqRes(user.id, { body: { marketplaceId: targetRider.marketplaceId } });
      await hireRiderFromMarketplace(h.req, h.res);
      expect(h.res.statusValue).toBe(201);

      // No await-tick on purpose: with the fire-and-forget bug this is still `before`.
      const after = await prisma.userTransaction.count({
        where: { userId: user.id, category: 'rider_hire' },
      });
      expect(after).toBe(before + 1);

      const row = await prisma.userTransaction.findFirst({
        where: { userId: user.id, category: 'rider_hire' },
        orderBy: { createdAt: 'desc' },
      });
      expect(row).not.toBeNull();
      expect(row.type).toBe('debit');
      expect(row.amount).toBe(targetRider.weeklyRate);
    });

    it('returns 400 when user has insufficient funds to hire', async () => {
      const user = await createUser(0);
      const state = await seedMarketplaceState(user.id);
      const targetRider = state.offers[0];

      const h = makeReqRes(user.id, { body: { marketplaceId: targetRider.marketplaceId } });
      await hireRiderFromMarketplace(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue).toMatchObject({
        success: false,
        message: expect.stringContaining('Insufficient'),
      });

      // Verify NO rider was created.
      const persistedRider = await prisma.rider.findFirst({ where: { userId: user.id } });
      expect(persistedRider).toBeNull();
    });
  });
});
