/**
 * Stud listing vs ownership transfer (Equoria-q4uem.9, slice 1).
 *
 * Owner rulings (Stacey, 2026-10-02 / 2026-10-15): the PLAYER decides whether
 * her stallion stands at stud and for what fee; selling or transferring a
 * stallion clears its listing (Not at Stud, fee 0).
 *
 * Two defects this suite pins:
 *   1. `buyHorse` transferred an at-stud stallion with its listing intact, so
 *      the buyer inherited the previous owner's public listing and price.
 *   2. The listing writes (`listHorseAtStud` / `unlistHorseAtStud`) were plain
 *      `update({ where: { id } })` calls after a read-only ownership check. An
 *      old owner's call that passed `requireOwnership` before a sale could
 *      still re-list, re-price or unlist the buyer's horse after the sale.
 *      The stale call is reproduced exactly as it happens in production: the
 *      controller receives the `req.horse` snapshot the ownership middleware
 *      loaded BEFORE the sale, and runs after the sale has committed.
 *
 * Real DB, real HTTP for the purchase (real CSRF), scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { listHorseAtStud, unlistHorseAtStud } from '../controllers/horseController.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-q4uem9-studxfer';
const SALE_PRICE = 900;
const STUD_FEE = 1234;

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
      firstName: 'StudXfer',
      lastName: role,
      money,
    },
  });
  return {
    user,
    token: generateTestToken({ id: user.id, email: user.email, role: 'user' }),
  };
}

async function makeStudStallionForSale(ownerId) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-stallion-${tag()}`,
      sex: 'Stallion',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: ownerId,
      healthStatus: 'Excellent',
      forSale: true,
      salePrice: SALE_PRICE,
      studStatus: 'At Public Stud',
      studFee: STUD_FEE,
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

function makeRes() {
  let statusCode = 200;
  let body = null;
  return {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
    get statusValue() {
      return statusCode;
    },
    get jsonValue() {
      return body;
    },
  };
}

describe('stud listing follows the owner, not the horse (Equoria-q4uem.9 slice 1)', () => {
  const cleanup = createCleanupTracker();
  let seller;
  let buyer;
  let stallion;

  beforeEach(async () => {
    seller = await makeUser('seller', 0);
    buyer = await makeUser('buyer', 5000);
    stallion = await makeStudStallionForSale(seller.user.id);
    const userIds = [seller.user.id, buyer.user.id];
    const horseId = stallion.id;
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notifications');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'userTransactions');
    cleanup.add(() => prisma.horseSale.deleteMany({ where: { horseId } }), 'horseSale');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: horseId } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
  });

  afterEach(async () => {
    await cleanup.run();
  });

  it('a purchase clears the stallion stud listing (Not at Stud, fee 0)', async () => {
    const res = await buy(buyer.token, stallion.id);
    expect(res.status).toBe(200);

    const after = await prisma.horse.findUnique({ where: { id: stallion.id } });
    expect(after.userId).toBe(buyer.user.id);
    expect(after.studStatus).toBe('Not at Stud');
    expect(after.studFee).toBe(0);
  });

  it("an old owner's in-flight list call after the sale is refused and cannot re-list the buyer's stallion", async () => {
    // requireOwnership loaded this snapshot while the seller still owned the horse.
    const staleSnapshot = await prisma.horse.findUnique({ where: { id: stallion.id } });

    const sale = await buy(buyer.token, stallion.id);
    expect(sale.status).toBe(200);

    const res = makeRes();
    await listHorseAtStud({ horse: staleSnapshot, body: { studFee: 99 }, user: { id: seller.user.id } }, res);

    expect(res.statusValue).toBe(404);
    const after = await prisma.horse.findUnique({ where: { id: stallion.id } });
    expect(after.userId).toBe(buyer.user.id);
    expect(after.studStatus).toBe('Not at Stud');
    expect(after.studFee).toBe(0);
  });

  it("an old owner's in-flight unlist call after the sale cannot touch the buyer's own listing", async () => {
    const staleSnapshot = await prisma.horse.findUnique({ where: { id: stallion.id } });

    const sale = await buy(buyer.token, stallion.id);
    expect(sale.status).toBe(200);

    // The buyer lists the stallion at her own fee.
    const buyerSnapshot = await prisma.horse.findUnique({ where: { id: stallion.id } });
    const listRes = makeRes();
    await listHorseAtStud({ horse: buyerSnapshot, body: { studFee: 4321 }, user: { id: buyer.user.id } }, listRes);
    expect(listRes.statusValue).toBe(200);

    const res = makeRes();
    await unlistHorseAtStud({ horse: staleSnapshot, body: {}, user: { id: seller.user.id } }, res);

    expect(res.statusValue).toBe(404);
    const after = await prisma.horse.findUnique({ where: { id: stallion.id } });
    expect(after.studStatus).toBe('At Public Stud');
    expect(after.studFee).toBe(4321);
  });
});
