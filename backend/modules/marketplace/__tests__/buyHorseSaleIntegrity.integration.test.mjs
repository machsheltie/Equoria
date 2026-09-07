/**
 * POST /api/v1/marketplace/buy/:horseId — sale-integrity invariants
 * (audit 2026-07 finding 4 / Equoria-6p398.4).
 *
 * Companion to buyHorseStaleListing.integration.test.mjs. That file proves the
 * stale-listing defect is closed; this file pins the invariants the fix must
 * NOT break while closing it, each asserted on persisted state rather than on
 * an HTTP status alone:
 *
 *   1. Multiple buyers racing one listing: exactly one owner, one debit, one
 *      seller credit, one sale record; every loser untouched.
 *   2. Insufficient funds: rejected, and the listing/ledger are exactly as they
 *      were — the conditional `money >= salePrice` debit is the only guard.
 *   3. Concurrent spending by ONE buyer across two listings priced at their
 *      whole balance: at most one succeeds and the balance never goes negative.
 *   4. Rollback when a required write fails: a seller credit that overflows the
 *      int4 `money` column is a genuine, unmocked write failure inside the
 *      transaction. Nothing may survive it — no transfer, no debit, no sale
 *      record, no ledger row.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-6p398-4-integrity';
const INT4_MAX = 2147483647;

const cleanup = createCleanupTracker();
let userIds = [];
let horseIds = [];

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
      firstName: 'Integrity',
      lastName: role,
      money,
    },
  });
  userIds.push(user.id);
  return {
    user,
    token: generateTestToken({ id: user.id, email: user.email, role: 'user' }),
  };
}

async function makeListedHorse(sellerId, salePrice) {
  const horse = await prisma.horse.create({
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
  horseIds.push(horse.id);
  return horse;
}

function registerCleanup() {
  const users = [...userIds];
  const horses = [...horseIds];
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: users } } }), 'notifications');
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: users } } }), 'userTransactions');
  cleanup.add(() => prisma.horseSale.deleteMany({ where: { horseId: { in: horses } } }), 'horseSale');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horses } } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: users } } }), 'users');
}

function buy(token, horseId) {
  return fetchCsrf(app).then(csrf =>
    request(app)
      .post(`/api/v1/marketplace/buy/${horseId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({})
      .then(
        res => ({ status: res.status, body: res.body }),
        err => ({ status: 0, body: { message: String(err?.message ?? err) } }),
      ),
  );
}

async function money(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

async function ledgerCount(userId, category) {
  return prisma.userTransaction.count({ where: { userId, category } });
}

describe('buyHorse — sale integrity invariants (finding 4)', () => {
  afterEach(async () => {
    registerCleanup();
    await cleanup.run();
    userIds = [];
    horseIds = [];
  }, 60000);

  it('three concurrent buyers of one listing: one owner, one debit, one seller credit', async () => {
    const price = 300;
    const seller = await makeUser('seller', 0);
    const horse = await makeListedHorse(seller.user.id, price);
    const buyers = [await makeUser('b0', price), await makeUser('b1', price), await makeUser('b2', price)];

    const results = await Promise.all(buyers.map(b => buy(b.token, horse.id)));

    expect(results.filter(r => r.status === 200)).toHaveLength(1);
    for (const failed of results.filter(r => r.status !== 200)) {
      expect(failed.status).toBeGreaterThanOrEqual(400);
      expect(failed.status).toBeLessThan(500);
    }

    const horseAfter = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { userId: true, forSale: true, salePrice: true },
    });
    expect(horseAfter.forSale).toBe(false);
    expect(horseAfter.salePrice).toBe(0);
    const winnerId = horseAfter.userId;
    expect(buyers.map(b => b.user.id)).toContain(winnerId);

    expect(await money(winnerId)).toBe(0);
    for (const b of buyers.filter(b => b.user.id !== winnerId)) {
      expect(await money(b.user.id)).toBe(price);
      expect(await ledgerCount(b.user.id, 'marketplace_purchase')).toBe(0);
    }

    expect(await money(seller.user.id)).toBe(price);
    expect(await ledgerCount(seller.user.id, 'marketplace_sale')).toBe(1);
    expect(await ledgerCount(winnerId, 'marketplace_purchase')).toBe(1);

    const sales = await prisma.horseSale.findMany({ where: { horseId: horse.id } });
    expect(sales).toHaveLength(1);
    expect(sales[0].sellerId).toBe(seller.user.id);
    expect(sales[0].buyerId).toBe(winnerId);
    expect(sales[0].salePrice).toBe(price);
  }, 120000);

  it('insufficient funds: rejected with the listing and ledger untouched', async () => {
    const price = 500;
    const seller = await makeUser('seller', 0);
    const horse = await makeListedHorse(seller.user.id, price);
    const buyer = await makeUser('poor', price - 1);

    const res = await buy(buyer.token, horse.id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient funds/i);

    const horseAfter = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { userId: true, forSale: true, salePrice: true },
    });
    expect(horseAfter.userId).toBe(seller.user.id);
    expect(horseAfter.forSale).toBe(true);
    expect(horseAfter.salePrice).toBe(price);

    expect(await money(buyer.user.id)).toBe(price - 1);
    expect(await money(seller.user.id)).toBe(0);
    expect(await prisma.horseSale.findMany({ where: { horseId: horse.id } })).toHaveLength(0);
    expect(await ledgerCount(buyer.user.id, 'marketplace_purchase')).toBe(0);
    expect(await ledgerCount(seller.user.id, 'marketplace_sale')).toBe(0);
  }, 120000);

  it('one buyer spending concurrently on two listings priced at their whole balance', async () => {
    const price = 400;
    const sellerOne = await makeUser('s1', 0);
    const sellerTwo = await makeUser('s2', 0);
    const horseOne = await makeListedHorse(sellerOne.user.id, price);
    const horseTwo = await makeListedHorse(sellerTwo.user.id, price);
    const buyer = await makeUser('spender', price);

    const results = await Promise.all([buy(buyer.token, horseOne.id), buy(buyer.token, horseTwo.id)]);

    // EXACTLY one must win — the buyer holds exactly one horse's worth. A
    // "<= 1" assertion would pass vacuously if BOTH requests failed for an
    // unrelated reason (this is the only test firing two mutations from one
    // user, so the user-keyed mutationRateLimiter is the obvious candidate),
    // and every assertion below would then degenerate to "nothing happened".
    const successes = results.filter(r => r.status === 200);
    expect(successes).toHaveLength(1);
    // ...and the loser must be rejected by the conditional debit specifically:
    // 400 Insufficient funds. A 429, 500 or 503 here would mean the race was
    // never actually exercised.
    const failures = results.filter(r => r.status !== 200);
    expect(failures).toHaveLength(1);
    expect(failures[0].status).toBe(400);
    expect(failures[0].body.message).toMatch(/insufficient funds/i);

    // One purchase happened, so: the balance is spent to exactly 0 (never
    // negative), one horse changed hands, one seller was credited.
    expect(await money(buyer.user.id)).toBe(0);

    const owned = await prisma.horse.count({
      where: { id: { in: [horseOne.id, horseTwo.id] }, userId: buyer.user.id },
    });
    expect(owned).toBe(1);

    const sellerCredits =
      (await ledgerCount(sellerOne.user.id, 'marketplace_sale')) +
      (await ledgerCount(sellerTwo.user.id, 'marketplace_sale'));
    expect(sellerCredits).toBe(1);
    expect(await ledgerCount(buyer.user.id, 'marketplace_purchase')).toBe(1);
    expect((await money(sellerOne.user.id)) + (await money(sellerTwo.user.id))).toBe(price);
  }, 120000);

  it('rolls the whole sale back when a required write fails (seller credit overflows money)', async () => {
    // A real, unmocked failure inside the transaction: crediting the seller
    // would push `User.money` past int4. Postgres raises, the transaction dies,
    // and NOTHING may survive — not the transfer, not the buyer debit.
    const price = 2_000_000_000;
    const seller = await makeUser('richSeller', 2_000_000_000);
    const horse = await makeListedHorse(seller.user.id, price);
    const buyer = await makeUser('richBuyer', price);
    expect(2_000_000_000 + price).toBeGreaterThan(INT4_MAX);

    const res = await buy(buyer.token, horse.id);
    // 500, describing reality: an int4 overflow is an UNHANDLED Prisma error
    // path. `withRetryableTxMapping` only maps P2028, and the controller's
    // catch has no `statusCode` to read, so it falls through to the generic
    // 500. The invariant this test guards is the ROLLBACK below, not the
    // status; the status is asserted exactly so that a future decision to map
    // this error has to update this line deliberately rather than silently.
    expect(res.status).toBe(500);

    const horseAfter = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { userId: true, forSale: true, salePrice: true },
    });
    expect(horseAfter.userId).toBe(seller.user.id);
    expect(horseAfter.forSale).toBe(true);
    expect(horseAfter.salePrice).toBe(price);

    expect(await money(buyer.user.id)).toBe(price);
    expect(await money(seller.user.id)).toBe(2_000_000_000);
    expect(await prisma.horseSale.findMany({ where: { horseId: horse.id } })).toHaveLength(0);
    expect(await ledgerCount(buyer.user.id, 'marketplace_purchase')).toBe(0);
    expect(await ledgerCount(seller.user.id, 'marketplace_sale')).toBe(0);
  }, 120000);
});
