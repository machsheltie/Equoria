/**
 * POST /api/v1/marketplace/buy/:horseId pays the seller through
 * transferUserMoneyOrThrow (Equoria-t8v8t).
 *
 * buyHorse used to carry its own inline copy of "guarded debit, credit, two
 * ledger rows" — the copy transferUserMoneyOrThrow (Equoria-e7tgc.3) exists to
 * retire, because copies drift and a drifted copy mints or burns coin. This
 * file proves, for BOTH User id orders (the helper locks the two User rows in
 * ascending id, and each order takes a different branch), on the real
 * database through the real route:
 *   - conservation: the buyer loses exactly the price, the seller gains
 *     exactly the price, the pair's total is unchanged;
 *   - exactly one ledger row per side, with the long-standing categories and
 *     descriptions, each side's true balance after the sale, and the other
 *     player recorded as `counterpartyId` (the helper's mark — the inline copy
 *     never wrote it);
 *   - the response's newBalance is the buyer's committed balance.
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
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const origin = 'http://localhost:3000';
const fixturePrefix = 'TestFixture-t8v8t-transfer';
const price = 750;
const buyerStart = 1000;
const sellerStart = 200;

const cleanup = createCleanupTracker();
let userIds = [];
let horseIds = [];

function tag() {
  return randomBytes(6).toString('hex');
}

async function makeUser(label) {
  const suffix = tag();
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${fixturePrefix}-${label}-${suffix}`,
      email: `${fixturePrefix}-${label}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Transfer',
      lastName: label,
      money: 0,
    },
  });
  userIds.push(user.id);
  return user;
}

/** Two players, returned as [lowerId, higherId]. */
async function makeOrderedPair() {
  const a = await makeUser('a');
  const b = await makeUser('b');
  return a.id < b.id ? [a, b] : [b, a];
}

async function setMoney(userId, amount) {
  await prisma.user.update({ where: { id: userId }, data: { money: amount } });
}

async function makeListedHorse(sellerId) {
  const horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `${fixturePrefix}-horse-${tag()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: sellerId,
      healthStatus: 'Excellent',
      forSale: true,
      salePrice: price,
    }),
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

async function buy(buyer, horseId) {
  const csrf = await fetchCsrf(app);
  const token = generateTestToken({ id: buyer.id, email: buyer.email, role: 'user' });
  return request(app)
    .post(`/api/v1/marketplace/buy/${horseId}`)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', origin)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({});
}

async function money(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

async function assertTransferredSale({ buyer, seller }) {
  await setMoney(buyer.id, buyerStart);
  await setMoney(seller.id, sellerStart);
  const horse = await makeListedHorse(seller.id);

  const res = await buy(buyer, horse.id);
  expect(res.status).toBe(200);
  expect(res.body.data.newBalance).toBe(buyerStart - price);

  expect(await money(buyer.id)).toBe(buyerStart - price);
  expect(await money(seller.id)).toBe(sellerStart + price);
  expect((await money(buyer.id)) + (await money(seller.id))).toBe(buyerStart + sellerStart);

  const rows = await prisma.userTransaction.findMany({
    where: { userId: { in: [buyer.id, seller.id] } },
    orderBy: { id: 'asc' },
  });
  expect(rows).toHaveLength(2);
  const [paid, received] = rows;

  expect(paid).toMatchObject({
    userId: buyer.id,
    type: 'debit',
    amount: price,
    category: 'marketplacePurchase',
    description: `Purchased ${horse.name}`,
    balanceAfter: buyerStart - price,
  });
  expect(paid.metadata).toMatchObject({ horseId: horse.id, sellerId: seller.id, counterpartyId: seller.id });

  expect(received).toMatchObject({
    userId: seller.id,
    type: 'credit',
    amount: price,
    category: 'marketplaceSale',
    description: `Sold ${horse.name}`,
    balanceAfter: sellerStart + price,
  });
  expect(received.metadata).toMatchObject({ horseId: horse.id, buyerId: buyer.id, counterpartyId: buyer.id });

  const horseAfter = await prisma.horse.findUnique({
    where: { id: horse.id },
    select: { userId: true, forSale: true, salePrice: true },
  });
  expect(horseAfter).toEqual({ userId: buyer.id, forSale: false, salePrice: 0 });
  expect(await prisma.horseSale.count({ where: { horseId: horse.id, buyerId: buyer.id, sellerId: seller.id } })).toBe(
    1,
  );
}

describe('buyHorse pays the seller through transferUserMoneyOrThrow (Equoria-t8v8t)', () => {
  afterEach(async () => {
    registerCleanup();
    await cleanup.run();
    userIds = [];
    horseIds = [];
  }, 60000);

  it('buyer id sorts first: conserves money and writes one ledger row per side', async () => {
    const [low, high] = await makeOrderedPair();
    await assertTransferredSale({ buyer: low, seller: high });
  }, 120000);

  it('seller id sorts first: conserves money and writes one ledger row per side', async () => {
    const [low, high] = await makeOrderedPair();
    await assertTransferredSale({ buyer: high, seller: low });
  }, 120000);
});
