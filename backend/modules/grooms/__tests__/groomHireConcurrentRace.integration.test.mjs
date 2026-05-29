/**
 * groom hireFromMarketplace concurrent-race sentinel (Equoria-6g8wm).
 * Site 5 of 6.
 *
 * Sibling of trainerHireConcurrentRace + riderHireConcurrentRace —
 * groom marketplace had the same check-then-debit shape.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { hireFromMarketplace } from '../controllers/groomMarketplaceController.mjs';

const FIXTURE_PREFIX = 'TestFixture-6g8wm-groom';
const N = 4;

let buyer;
let marketplaceIds;
let hiringCost;
const createdUserIds = [];
const createdMarketplaceStateIds = [];

function fakeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(c) {
      res.statusCode = c;
      return res;
    },
    json(b) {
      res.body = b;
      return res;
    },
  };
  return res;
}

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);

  // sessionRate * 7 = hiringCost (controller line 212). Seed buyer with
  // EXACTLY one hire's worth.
  const sessionRate = 100;
  hiringCost = sessionRate * 7;

  buyer = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: pw,
      firstName: 'Groom',
      lastName: 'Race',
      money: hiringCost,
    },
  });
  createdUserIds.push(buyer.id);

  marketplaceIds = Array.from(
    { length: N },
    () => `mid-${randomBytes(4).toString('hex')}`,
  );
  const offers = marketplaceIds.map((mid, i) => ({
    marketplaceId: mid,
    firstName: 'Race',
    lastName: `Groom${i}`,
    specialty: 'general',
    skillLevel: 'experienced',
    personality: 'gentle',
    experience: 5,
    sessionRate,
    bio: 'race fixture',
  }));

  const state = await prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId: buyer.id, staffType: 'groom' } },
    create: { userId: buyer.id, staffType: 'groom', offers, refreshCount: 0 },
    update: { offers },
  });
  createdMarketplaceStateIds.push(state.id);
}, 60000);

afterAll(async () => {
  if (buyer) {
    await prisma.groom.deleteMany({ where: { userId: buyer.id } }).catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  for (const id of createdMarketplaceStateIds) {
    await prisma.staffMarketplaceState.delete({ where: { id } }).catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(err => console.warn(`[cleanup] ${err.message}`));
  }
}, 30000);

describe('groom hireFromMarketplace concurrent-race sentinel (Equoria-6g8wm)', () => {
  it('SENTINEL: N parallel hires from same buyer with money for ONE — at most 1 succeeds, money never negative', async () => {
    const reqs = marketplaceIds.map(mid => ({
      user: { id: buyer.id },
      body: { marketplaceId: mid },
    }));
    const responses = await Promise.all(
      reqs.map(req => {
        const res = fakeRes();
        return hireFromMarketplace(req, res).then(() => res);
      }),
    );
    const successes = responses.filter(r => r.statusCode === 201);
    const failures = responses.filter(r => r.statusCode !== 201);
    expect(successes.length).toBeLessThanOrEqual(1);
    for (const f of failures) {
      expect(f.statusCode).toBeGreaterThanOrEqual(400);
      expect(f.statusCode).toBeLessThan(500);
    }
    const after = await prisma.user.findUnique({
      where: { id: buyer.id },
      select: { money: true },
    });
    expect(Number(after.money)).toBeGreaterThanOrEqual(0);
    expect([0, hiringCost]).toContain(Number(after.money));

    // Tx atomic: groom rows == successes.
    const groomCount = await prisma.groom.count({ where: { userId: buyer.id } });
    expect(groomCount).toBe(successes.length);
  });
});
