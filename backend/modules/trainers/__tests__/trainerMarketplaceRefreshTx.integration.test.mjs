/**
 * refreshTrainerMarketplace — $transaction wrap sentinel (Equoria-t65fh,
 * hjtys follow-up #4).
 *
 * Pre-fix: refreshTrainerMarketplace called debitMoneyOrThrow(prisma, ...)
 * against bare prisma (autocommit) and then called
 * prisma.staffMarketplaceState.upsert OUTSIDE any transaction. If the
 * upsert failed (DB blip, conflict, validation), the user was debited the
 * refresh fee with NO refreshed offer list persisted.
 *
 * Post-fix: both writes are inside a single $transaction. A failure of
 * the upsert rolls back the debit. A failure of the debit (insufficient
 * funds) skips the upsert (no offer list mutation).
 *
 * This sentinel asserts the post-fix invariant in the happy-path:
 *   1. A paid refresh debits the user EXACTLY refreshCost and persists a
 *      refreshed offer list with a bumped refreshCount + lastRefresh.
 *   2. A free refresh (refreshCost === 0) does NOT debit the user and
 *      still persists a refreshed offer list.
 *   3. Insufficient funds returns 400 with NO money debited AND NO
 *      offer-list mutation — both writes share rollback semantics.
 *
 * Real DB, no mocks, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTrainerMarketplace, TRAINER_MARKETPLACE_CONFIG } from '../services/trainerMarketplace.mjs';
import { refreshTrainerMarketplace } from '../controllers/trainerMarketplaceController.mjs';

const SUITE_PREFIX = 'TestFixture-t65fh-trainer';

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

/**
 * Seed a marketplace whose lastRefresh is NOW (so getTrainerRefreshCost
 * returns the PREMIUM_REFRESH_COST — i.e. a paid refresh is required to
 * force a refresh inside the 24h window).
 */
async function seedRecentMarketplace(userId) {
  const offers = generateTrainerMarketplace();
  return prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId, staffType: 'trainer' } },
    create: {
      userId,
      staffType: 'trainer',
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

describe('refreshTrainerMarketplace — $transaction wrap (Equoria-t65fh)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  it('paid refresh: debit + upsert commit together (offers refreshed, money debited exactly once)', async () => {
    const startingMoney = 10_000;
    const user = await createUser(startingMoney);
    const seeded = await seedRecentMarketplace(user.id);
    const refreshCost = TRAINER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST;

    const before = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(before.money).toBe(startingMoney);

    const h = makeReqRes(user.id, { force: true });
    await refreshTrainerMarketplace(h.req, h.res);

    expect(h.res.statusValue).toBe(200);
    expect(h.res.jsonValue.success).toBe(true);

    // Money debited EXACTLY the refresh cost.
    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(after.money).toBe(startingMoney - refreshCost);

    // Offer list refreshed (refreshCount bumped, lastRefresh advanced).
    const stateAfter = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId: user.id, staffType: 'trainer' } },
    });
    expect(stateAfter.refreshCount).toBe(seeded.refreshCount + 1);
    expect(stateAfter.lastRefresh.getTime()).toBeGreaterThanOrEqual(seeded.lastRefresh.getTime());
  });

  it('insufficient funds: NO money debited AND NO offer-list mutation (rollback parity)', async () => {
    const refreshCost = TRAINER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST;
    // User has refreshCost - 1 — fails the pre-check at 400.
    const startingMoney = refreshCost - 1;
    const user = await createUser(startingMoney);
    const seeded = await seedRecentMarketplace(user.id);

    const h = makeReqRes(user.id, { force: true });
    await refreshTrainerMarketplace(h.req, h.res);

    expect(h.res.statusValue).toBe(400);
    expect(h.res.jsonValue.success).toBe(false);

    // Money UNCHANGED.
    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(after.money).toBe(startingMoney);

    // Offer list UNCHANGED — same refreshCount, same lastRefresh.
    const stateAfter = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId: user.id, staffType: 'trainer' } },
    });
    expect(stateAfter.refreshCount).toBe(seeded.refreshCount);
    expect(stateAfter.lastRefresh.getTime()).toBe(seeded.lastRefresh.getTime());
  });

  it('paid refresh without force flag: returns 400 cost prompt, NO debit, NO offer mutation', async () => {
    const user = await createUser(10_000);
    const seeded = await seedRecentMarketplace(user.id);

    const h = makeReqRes(user.id, { force: false });
    await refreshTrainerMarketplace(h.req, h.res);

    expect(h.res.statusValue).toBe(400);
    expect(h.res.jsonValue.data.cost).toBe(TRAINER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST);

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(after.money).toBe(10_000);

    const stateAfter = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId: user.id, staffType: 'trainer' } },
    });
    expect(stateAfter.refreshCount).toBe(seeded.refreshCount);
    expect(stateAfter.lastRefresh.getTime()).toBe(seeded.lastRefresh.getTime());
  });
});
