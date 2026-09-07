/**
 * POST /api/v1/marketplace/buy/:horseId — stale-listing regression
 * (audit 2026-07 finding 4 / Equoria-6p398.4).
 *
 * Defect: `buyHorse` snapshotted the seller and price, then claimed ownership
 * with a predicate that only required `forSale: true` and `userId != buyer`.
 * A purchase that started against listing "A sells at 100" could therefore
 * complete against a DIFFERENT listing ("C sells at 700"): the buyer received
 * the relisted horse for the old price and the money went to the OLD seller.
 *
 * Reproduction driven here (the audit's own scenario):
 *   A lists at 100 → B starts buying and pauses after reading the listing →
 *   C buys at 100 and relists at 700 → B resumes.
 *
 * Coordination is a real interleaving, not a sleep: `buyHorse` awaits a
 * delay-only seam (backend/modules/marketplace/services/marketplaceRaceBarrier.mjs)
 * between the authoritative listing read and the first write. The seam never
 * supplies a query result or skips a code path — every read and write below is
 * the real one, in the real transaction, against the real database. The
 * barrier is released in `finally` so a failed assertion cannot wedge a later
 * suite.
 *
 * Both correct serializations are accepted: with a conditional claim, C
 * completes and B must conflict with NO side effects; with an early lock, B
 * may complete first and C must then fail. What is asserted either way is that
 * the persisted owner, every balance, the sale record and both ledger entries
 * describe the sale that actually happened — and that B is never handed the
 * relisted horse at the old price while the old seller pockets the proceeds.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { setMarketplaceRaceBarrier } from '../services/marketplaceRaceBarrier.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-6p398-4-stale';
const LIST_PRICE = 100;
const RELIST_PRICE = 700;
const BARRIER_TIMEOUT_MS = 20000;

function tag() {
  return randomBytes(6).toString('hex');
}

async function makeUser(role, money) {
  const suffix = tag();
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${role}-${suffix}`,
      email: `${FIXTURE_PREFIX}-${role}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Stale',
      lastName: role,
      money,
    },
  });
  return {
    user,
    token: generateTestToken({ id: user.id, email: user.email, role: 'user' }),
  };
}

async function makeListedHorse(sellerId, salePrice) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${tag()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: sellerId,
      healthStatus: 'Excellent',
      forSale: true,
      salePrice,
    },
  });
}

function buy(token, horseId) {
  return fetchCsrf(app).then(csrf =>
    request(app)
      .post(`/api/v1/marketplace/buy/${horseId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({}),
  );
}

/** Settled-safe: a rejected supertest promise must not surface as an unhandled rejection. */
function buySettled(token, horseId) {
  return buy(token, horseId).then(
    res => ({ status: res.status, body: res.body }),
    err => ({ status: 0, body: { message: String(err?.message ?? err) } }),
  );
}

function listForSale(token, horseId, price) {
  return fetchCsrf(app).then(csrf =>
    request(app)
      .post('/api/v1/marketplace/list')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId, price }),
  );
}

function delist(token, horseId) {
  return fetchCsrf(app).then(csrf =>
    request(app)
      .delete(`/api/v1/marketplace/list/${horseId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken),
  );
}

/**
 * Arm the delay-only seam for exactly ONE buyer. Returns the "buyer has read
 * the listing" promise plus release/disarm handles for the caller's `finally`.
 */
function armBarrierFor(buyerId) {
  let markReached;
  let openGate;
  const reached = new Promise(resolve => {
    markReached = resolve;
  });
  const gate = new Promise(resolve => {
    openGate = resolve;
  });
  setMarketplaceRaceBarrier(async (stage, context) => {
    if (stage !== 'buyHorse:afterListingRead' || context?.buyerId !== buyerId) {
      return;
    }
    markReached();
    await gate;
  });
  return {
    reached,
    release: () => openGate(),
    disarm: () => setMarketplaceRaceBarrier(null),
  };
}

async function waitFor(promise, label) {
  let timer;
  try {
    await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), BARRIER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function money(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

async function ledgerFor(userId, category) {
  return prisma.userTransaction.findMany({ where: { userId, category }, select: { amount: true } });
}

describe('buyHorse — a purchase is bound to the listing it actually buys (finding 4)', () => {
  let sellerA;
  let buyerB;
  let buyerC;
  let horse;
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    sellerA = await makeUser('sellerA', 0);
    buyerB = await makeUser('buyerB', 1000);
    buyerC = await makeUser('buyerC', 1000);
    horse = await makeListedHorse(sellerA.user.id, LIST_PRICE);

    const userIds = [sellerA.user.id, buyerB.user.id, buyerC.user.id];
    const horseId = horse.id;
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notifications');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'userTransactions');
    cleanup.add(() => prisma.horseSale.deleteMany({ where: { horseId } }), 'horseSale');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: horseId } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
  }, 60000);

  afterEach(async () => {
    setMarketplaceRaceBarrier(null);
    await cleanup.run();
  }, 60000);

  it('rejects a purchase whose listing was bought and relisted by someone else mid-request', async () => {
    const barrier = armBarrierFor(buyerB.user.id);
    let cBuyStatus;
    let cRelistStatus;
    const bResult = buySettled(buyerB.token, horse.id);

    try {
      await waitFor(barrier.reached, 'buyer B to reach the listing-read barrier');

      // C completes a REAL purchase of the same listing at 100 ...
      const cBuy = await buy(buyerC.token, horse.id);
      cBuyStatus = cBuy.status;
      // ... and relists the horse it now owns at 700.
      const cRelist = await listForSale(buyerC.token, horse.id, RELIST_PRICE);
      cRelistStatus = cRelist.status;
    } finally {
      barrier.release();
      barrier.disarm();
    }

    const bRes = await bResult;

    expect(cBuyStatus).toBe(200);
    expect(cRelistStatus).toBe(200);

    // B's request read "A sells at 100". That listing no longer exists.
    expect(bRes.status).toBe(409);
    expect(bRes.body.success).toBe(false);

    // Persisted state describes C's sale, and only C's sale.
    const horseAfter = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { userId: true, forSale: true, salePrice: true },
    });
    expect(horseAfter.userId).toBe(buyerC.user.id);
    expect(horseAfter.forSale).toBe(true);
    expect(horseAfter.salePrice).toBe(RELIST_PRICE);

    expect(await money(sellerA.user.id)).toBe(LIST_PRICE); // credited ONCE, by C's purchase
    expect(await money(buyerB.user.id)).toBe(1000); // never charged
    expect(await money(buyerC.user.id)).toBe(1000 - LIST_PRICE);

    const sales = await prisma.horseSale.findMany({ where: { horseId: horse.id } });
    expect(sales).toHaveLength(1);
    expect(sales[0].sellerId).toBe(sellerA.user.id);
    expect(sales[0].buyerId).toBe(buyerC.user.id);
    expect(sales[0].salePrice).toBe(LIST_PRICE);

    expect(await ledgerFor(buyerB.user.id, 'marketplace_purchase')).toHaveLength(0);
    expect(await ledgerFor(buyerC.user.id, 'marketplace_purchase')).toEqual([{ amount: LIST_PRICE }]);
    expect(await ledgerFor(sellerA.user.id, 'marketplace_sale')).toEqual([{ amount: LIST_PRICE }]);
  }, 120000);

  it('rejects a purchase whose seller delisted and relisted at a higher price mid-request', async () => {
    const barrier = armBarrierFor(buyerB.user.id);
    let delistStatus;
    let relistStatus;
    const bResult = buySettled(buyerB.token, horse.id);

    try {
      await waitFor(barrier.reached, 'buyer B to reach the listing-read barrier');

      const delisted = await delist(sellerA.token, horse.id);
      delistStatus = delisted.status;
      const relisted = await listForSale(sellerA.token, horse.id, RELIST_PRICE);
      relistStatus = relisted.status;
    } finally {
      barrier.release();
      barrier.disarm();
    }

    const bRes = await bResult;

    expect(delistStatus).toBe(200);
    expect(relistStatus).toBe(200);

    // Neither outcome is acceptable: taking the horse for the stale 100, nor
    // silently charging the newly raised 700 for a request made against 100.
    expect(bRes.status).toBe(409);

    const horseAfter = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { userId: true, forSale: true, salePrice: true },
    });
    expect(horseAfter.userId).toBe(sellerA.user.id);
    expect(horseAfter.forSale).toBe(true);
    expect(horseAfter.salePrice).toBe(RELIST_PRICE);

    expect(await money(sellerA.user.id)).toBe(0);
    expect(await money(buyerB.user.id)).toBe(1000);

    expect(await prisma.horseSale.findMany({ where: { horseId: horse.id } })).toHaveLength(0);
    expect(await ledgerFor(buyerB.user.id, 'marketplace_purchase')).toHaveLength(0);
    expect(await ledgerFor(sellerA.user.id, 'marketplace_sale')).toHaveLength(0);
  }, 120000);

  it('completes normally when the listing is unchanged across the same pause', async () => {
    const barrier = armBarrierFor(buyerB.user.id);
    const bResult = buySettled(buyerB.token, horse.id);

    try {
      await waitFor(barrier.reached, 'buyer B to reach the listing-read barrier');
    } finally {
      barrier.release();
      barrier.disarm();
    }

    const bRes = await bResult;
    expect(bRes.status).toBe(200);

    const horseAfter = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { userId: true, forSale: true, salePrice: true },
    });
    expect(horseAfter.userId).toBe(buyerB.user.id);
    expect(horseAfter.forSale).toBe(false);
    expect(horseAfter.salePrice).toBe(0);

    expect(await money(sellerA.user.id)).toBe(LIST_PRICE);
    expect(await money(buyerB.user.id)).toBe(1000 - LIST_PRICE);

    const sales = await prisma.horseSale.findMany({ where: { horseId: horse.id } });
    expect(sales).toHaveLength(1);
    expect(sales[0].sellerId).toBe(sellerA.user.id);
    expect(sales[0].buyerId).toBe(buyerB.user.id);
    expect(sales[0].salePrice).toBe(LIST_PRICE);

    expect(await ledgerFor(buyerB.user.id, 'marketplace_purchase')).toEqual([{ amount: LIST_PRICE }]);
    expect(await ledgerFor(sellerA.user.id, 'marketplace_sale')).toEqual([{ amount: LIST_PRICE }]);
  }, 120000);
});
