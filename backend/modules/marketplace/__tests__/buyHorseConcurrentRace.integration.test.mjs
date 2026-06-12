/**
 * POST /api/v1/marketplace/buy/:horseId — concurrent-race sentinel (Equoria-zz1ii).
 *
 * The audit-2026-05-28 finding #1 identified two TOCTOU races + missing rate
 * limit on buyHorse. The atomic-claim on the horse row (Equoria-alei5) was
 * already in place; this commit added the conditional buyer-debit
 * (updateMany WHERE money >= salePrice) so the buyer's money column can never
 * go negative via this path even under concurrent same-buyer activity, plus
 * mounted mutationRateLimiter on /buy/:horseId and /store/buy.
 *
 * This sentinel fires N concurrent buy requests for the SAME horse from N
 * DIFFERENT buyers (each with exactly the salePrice in their wallet), and
 * asserts:
 *   - Exactly ONE buyer wins (horse.userId reflects the winner; horse.forSale=false).
 *   - The winner's money is exactly 0 (their full balance was debited once).
 *   - Every OTHER buyer's money is unchanged (no loser was charged).
 *   - The seller is credited exactly ONCE (sellerMoneyBefore + salePrice).
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

const FIXTURE_PREFIX = 'TestFixture-zz1ii-race';

const N_BUYERS = 5; // Use a modest number to avoid hammering the DB unnecessarily
const SALE_PRICE = 500;

let seller;
let horse;
const buyers = []; // { user, token }
const createdUserIds = [];
const createdHorseIds = [];
const cleanup = createCleanupTracker();

async function makeUser(suffix, money) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${suffix}-${tag}`,
      email: `${FIXTURE_PREFIX}-${suffix}-${tag}@example.com`,
      password: pw,
      firstName: 'Race',
      lastName: suffix,
      money,
    },
  });
  createdUserIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: '1h',
  });
  return { user, token };
}

beforeAll(async () => {
  ({ user: seller } = await makeUser('seller', 0));

  // The horse for sale (owned by seller, forSale=true, salePrice=SALE_PRICE).
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${randomBytes(4).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: seller.id,
      healthStatus: 'healthy',
      forSale: true,
      salePrice: SALE_PRICE,
    },
  });
  createdHorseIds.push(horse.id);

  // N buyers, each with EXACTLY the salePrice — so a double-debit would
  // produce a negative balance, providing a sharp sentinel.
  for (let i = 0; i < N_BUYERS; i++) {
    const b = await makeUser(`buyer${i}`, SALE_PRICE);
    buyers.push(b);
  }

  // Scoped, fail-loud cleanup (Equoria-9jv9c): if a delete fails the suite goes
  // red so the leaked fixtures are fixed at the source, not swallowed.
  // FK order: the winning purchase writes a horseSale row whose horseId,
  // buyerId AND sellerId FKs are all RESTRICT — it must be deleted before the
  // horse and the users it references, or both deletes P2003 and the whole
  // fixture graph leaks into the canonical DB. (userTransaction and
  // notification rows from the purchase cascade with the user rows.)
  cleanup.add(() => prisma.horseSale.deleteMany({ where: { horseId: { in: createdHorseIds } } }), 'horseSale');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'user');
}, 120000);

afterAll(() => cleanup.run(), 30000);

describe('POST /api/v1/marketplace/buy/:horseId — concurrent-race sentinel (Equoria-zz1ii)', () => {
  it('SENTINEL: N parallel buyers, exactly ONE wins, none go negative, seller credited once', async () => {
    const sellerBefore = await prisma.user.findUnique({
      where: { id: seller.id },
      select: { money: true },
    });

    // Fire N concurrent buy requests. The atomic-claim guarantees exactly one
    // wins the horse; the conditional debit guarantees no buyer ever goes
    // below the salePrice (and therefore never negative). Each request needs
    // a CSRF token (real production middleware, no bypass).
    const csrfPerBuyer = await Promise.all(buyers.map(() => fetchCsrf(app)));
    const results = await Promise.all(
      buyers.map(({ token }, i) =>
        request(app)
          .post(`/api/v1/marketplace/buy/${horse.id}`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${token}`)
          .set('Cookie', csrfPerBuyer[i].cookieHeader)
          .set('X-CSRF-Token', csrfPerBuyer[i].csrfToken)
          .send({})
          .then(res => ({ status: res.status, body: res.body }))
          .catch(err => ({ status: 0, error: err.message })),
      ),
    );

    // EXACTLY ONE 200 success.
    const successes = results.filter(r => r.status === 200);
    expect(successes).toHaveLength(1);

    // All others must be 4xx (409 conflict, or 429 rate-limit; never 500, never 200).
    const failures = results.filter(r => r.status !== 200);
    for (const f of failures) {
      expect(f.status).toBeGreaterThanOrEqual(400);
      expect(f.status).toBeLessThan(500);
    }

    // Inspect final state: exactly one buyer owns the horse.
    const horseAfter = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { userId: true, forSale: true },
    });
    expect(horseAfter.forSale).toBe(false);
    const winnerIds = buyers.map(b => b.user.id);
    expect(winnerIds).toContain(horseAfter.userId);

    // Winner's money should be exactly 0 (debited the full SALE_PRICE).
    const winner = await prisma.user.findUnique({
      where: { id: horseAfter.userId },
      select: { money: true },
    });
    expect(Number(winner.money)).toBe(0);

    // Every NON-winner buyer's money is UNCHANGED (still SALE_PRICE; nobody
    // was silently charged for losing the race). This is the precise
    // protection the bd issue describes.
    for (const { user } of buyers) {
      if (user.id === horseAfter.userId) {
        continue;
      }
      const loser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { money: true },
      });
      expect(Number(loser.money)).toBe(SALE_PRICE);
    }

    // Seller credited EXACTLY ONCE (no double-credit from a duplicate buy).
    const sellerAfter = await prisma.user.findUnique({
      where: { id: seller.id },
      select: { money: true },
    });
    expect(Number(sellerAfter.money) - Number(sellerBefore.money)).toBe(SALE_PRICE);
  });
});
