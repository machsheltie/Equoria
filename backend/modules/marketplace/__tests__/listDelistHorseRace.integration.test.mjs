/**
 * listHorse / delistHorse — conditional updateMany sentinels (Equoria-kj4g7).
 *
 * Sibling of Equoria-alei5 (atomic-claim on buyHorse) and Equoria-zz1ii
 * (conditional debit on buyer money). Before this fix, listHorse and
 * delistHorse were a read-then-write pair on the forSale column: the
 * middleware read req.horse, the controller checked forSale, then
 * unconditional prisma.horse.update overwrote whatever the column actually
 * was at write time. A concurrent buyHorse could complete between the
 * middleware read and the update, leaving the listing in a corrupt state
 * (re-listed by a non-owner, or delisted-after-sold).
 *
 * Fix: both calls now use prisma.horse.updateMany with a where-clause that
 * enforces the precondition (forSale=false for list, forSale=true for delist,
 * AND userId === req.user.id in both). count===0 → 409.
 *
 * Real DB, no mocks, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import config from '../../../config/config.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const FIXTURE_PREFIX = 'TestFixture-kj4g7';
const SALE_PRICE = 250;

let seller;
let sellerToken;
let horseListable;
let horseDelistable;
const createdUserIds = [];
const createdHorseIds = [];
const cleanup = createCleanupTracker();

async function makeUser(suffix) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${suffix}-${tag}`,
      email: `${FIXTURE_PREFIX}-${suffix}-${tag}@example.com`,
      password: pw,
      firstName: 'Race',
      lastName: suffix,
      money: 0,
    },
  });
  createdUserIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: '1h',
  });
  return { user, token };
}

async function makeHorse(forSale) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${randomBytes(4).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: seller.id,
      healthStatus: 'healthy',
      forSale,
      salePrice: forSale ? SALE_PRICE : 0,
    },
  });
  createdHorseIds.push(horse.id);
  return horse;
}

beforeAll(async () => {
  ({ user: seller, token: sellerToken } = await makeUser('seller'));
  horseListable = await makeHorse(false);
  horseDelistable = await makeHorse(true);

  // Scoped, fail-loud cleanup (Equoria-9jv9c): a delete failure fails the suite
  // so leaked fixtures surface instead of being swallowed by a console.warn.
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 30000);

describe('POST /api/v1/marketplace/list — conditional updateMany sentinel (Equoria-kj4g7)', () => {
  it('SENTINEL: two concurrent list calls on the same not-yet-listed horse → exactly ONE 200, one 4xx, salePrice == winner price', async () => {
    const csrf = await Promise.all([fetchCsrf(app), fetchCsrf(app)]);
    const results = await Promise.all([
      request(app)
        .post('/api/v1/marketplace/list')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${sellerToken}`)
        .set('Cookie', csrf[0].cookieHeader)
        .set('X-CSRF-Token', csrf[0].csrfToken)
        .send({ horseId: horseListable.id, price: SALE_PRICE }),
      request(app)
        .post('/api/v1/marketplace/list')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${sellerToken}`)
        .set('Cookie', csrf[1].cookieHeader)
        .set('X-CSRF-Token', csrf[1].csrfToken)
        .send({ horseId: horseListable.id, price: SALE_PRICE + 1 }),
    ]);
    const successes = results.filter(r => r.status === 200);
    expect(successes).toHaveLength(1);
    const failures = results.filter(r => r.status !== 200);
    for (const f of failures) {
      expect(f.status).toBeGreaterThanOrEqual(400);
      expect(f.status).toBeLessThan(500);
    }
    // Horse is listed exactly once; salePrice is whichever request won the
    // updateMany race (never both — that's the corruption this guards).
    const after = await prisma.horse.findUnique({
      where: { id: horseListable.id },
      select: { forSale: true, salePrice: true },
    });
    expect(after.forSale).toBe(true);
    expect([SALE_PRICE, SALE_PRICE + 1]).toContain(after.salePrice);
  });
});

describe('DELETE /api/v1/marketplace/list/:horseId — conditional updateMany sentinel (Equoria-kj4g7)', () => {
  it('SENTINEL: two concurrent delist calls on the same listed horse → exactly ONE 200, one 4xx, horse ends not-for-sale once', async () => {
    const csrf = await Promise.all([fetchCsrf(app), fetchCsrf(app)]);
    const results = await Promise.all([
      request(app)
        .delete(`/api/v1/marketplace/list/${horseDelistable.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${sellerToken}`)
        .set('Cookie', csrf[0].cookieHeader)
        .set('X-CSRF-Token', csrf[0].csrfToken),
      request(app)
        .delete(`/api/v1/marketplace/list/${horseDelistable.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${sellerToken}`)
        .set('Cookie', csrf[1].cookieHeader)
        .set('X-CSRF-Token', csrf[1].csrfToken),
    ]);
    const successes = results.filter(r => r.status === 200);
    expect(successes).toHaveLength(1);
    const failures = results.filter(r => r.status !== 200);
    for (const f of failures) {
      expect(f.status).toBeGreaterThanOrEqual(400);
      expect(f.status).toBeLessThan(500);
    }
    const after = await prisma.horse.findUnique({
      where: { id: horseDelistable.id },
      select: { forSale: true, salePrice: true },
    });
    expect(after.forSale).toBe(false);
    expect(after.salePrice).toBe(0);
  });
});
