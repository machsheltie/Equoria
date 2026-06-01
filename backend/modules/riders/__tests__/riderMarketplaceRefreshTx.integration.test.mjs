/**
 * refreshRiderMarketplace — $transaction wrap sentinel (Equoria-t65fh,
 * hjtys follow-up #4).
 *
 * Sibling of trainerMarketplaceRefreshTx.integration.test.mjs. Same
 * pre-fix / post-fix shape — see that file for context.
 *
 * Real DB, no mocks, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateRiderMarketplace, RIDER_MARKETPLACE_CONFIG } from '../services/riderMarketplace.mjs';
import { refreshRiderMarketplace } from '../controllers/riderMarketplaceController.mjs';

const SUITE_PREFIX = 'TestFixture-t65fh-rider';

function makeReqRes(userId, body = {}) {
  let _status = 200;
  let _body = null;
  return {
    req: { user: { id: userId }, body, params: {}, query: {} },
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

async function createUser(money) {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'Refresh',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
      money,
    },
  });
}

async function seedRecentMarketplace(userId) {
  const offers = generateRiderMarketplace();
  return prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId, staffType: 'rider' } },
    create: {
      userId,
      staffType: 'rider',
      offers,
      lastRefresh: new Date(),
      refreshCount: 1,
    },
    update: {
      offers,
      lastRefresh: new Date(),
      refreshCount: 1,
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
  await prisma.staffMarketplaceState
    .deleteMany({ where: { userId: { in: userIds } } })
    .catch(err => console.warn(`[cleanup] staffMarketplaceState.deleteMany: ${err.message}`));
  await prisma.userTransaction
    .deleteMany({ where: { userId: { in: userIds } } })
    .catch(err => console.warn(`[cleanup] userTransaction.deleteMany: ${err.message}`));
  await prisma.user
    .deleteMany({ where: { id: { in: userIds } } })
    .catch(err => console.warn(`[cleanup] user.deleteMany: ${err.message}`));
}

describe('refreshRiderMarketplace — $transaction wrap (Equoria-t65fh)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  it('paid refresh: debit + upsert commit together (offers refreshed, money debited exactly once)', async () => {
    const startingMoney = 10_000;
    const user = await createUser(startingMoney);
    const seeded = await seedRecentMarketplace(user.id);
    const refreshCost = RIDER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST;

    const h = makeReqRes(user.id, { force: true });
    await refreshRiderMarketplace(h.req, h.res);

    expect(h.res.statusValue).toBe(200);
    expect(h.res.jsonValue.success).toBe(true);

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(after.money).toBe(startingMoney - refreshCost);

    const stateAfter = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId: user.id, staffType: 'rider' } },
    });
    expect(stateAfter.refreshCount).toBe(seeded.refreshCount + 1);
    expect(stateAfter.lastRefresh.getTime()).toBeGreaterThanOrEqual(seeded.lastRefresh.getTime());
  });

  it('insufficient funds: NO money debited AND NO offer-list mutation (rollback parity)', async () => {
    const refreshCost = RIDER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST;
    const startingMoney = refreshCost - 1;
    const user = await createUser(startingMoney);
    const seeded = await seedRecentMarketplace(user.id);

    const h = makeReqRes(user.id, { force: true });
    await refreshRiderMarketplace(h.req, h.res);

    expect(h.res.statusValue).toBe(400);
    expect(h.res.jsonValue.success).toBe(false);

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(after.money).toBe(startingMoney);

    const stateAfter = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId: user.id, staffType: 'rider' } },
    });
    expect(stateAfter.refreshCount).toBe(seeded.refreshCount);
    expect(stateAfter.lastRefresh.getTime()).toBe(seeded.lastRefresh.getTime());
  });

  it('paid refresh without force flag: returns 400 cost prompt, NO debit, NO offer mutation', async () => {
    const user = await createUser(10_000);
    const seeded = await seedRecentMarketplace(user.id);

    const h = makeReqRes(user.id, { force: false });
    await refreshRiderMarketplace(h.req, h.res);

    expect(h.res.statusValue).toBe(400);
    expect(h.res.jsonValue.data.cost).toBe(RIDER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(after.money).toBe(10_000);

    const stateAfter = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId: user.id, staffType: 'rider' } },
    });
    expect(stateAfter.refreshCount).toBe(seeded.refreshCount);
    expect(stateAfter.lastRefresh.getTime()).toBe(seeded.lastRefresh.getTime());
  });
});
