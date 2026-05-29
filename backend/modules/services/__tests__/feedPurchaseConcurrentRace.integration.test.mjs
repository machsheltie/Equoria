/**
 * POST /api/feed-shop/purchase — concurrent-race sentinel (Equoria-6g8wm).
 * Site 3 of 6 in the helper-adoption follow-up.
 *
 * Asserts that N parallel purchases by the same user with money for ONE
 * result in exactly one success — the conditional updateMany predicate
 * inside debitMoneyOrThrow rejects the others. Wallet never goes negative.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { purchaseFeed, FEED_CATALOG } from '../controllers/feedShopController.mjs';

const FIXTURE_PREFIX = 'TestFixture-6g8wm-feed';
const N = 5;

let user;
const createdUserIds = [];

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
  const tier = FEED_CATALOG[0];
  user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: pw,
      firstName: 'Feed',
      lastName: 'Race',
      money: tier.packPrice,
      settings: {},
    },
  });
  createdUserIds.push(user.id);
}, 60000);

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
  }
}, 30000);

describe('feedShop purchaseFeed concurrent-race sentinel (Equoria-6g8wm)', () => {
  it('SENTINEL: N parallel purchases with money for ONE — exactly 1 succeeds, money never negative', async () => {
    const tier = FEED_CATALOG[0];
    const reqs = Array.from({ length: N }, () => ({
      user: { id: user.id },
      body: { feedTier: tier.id, packs: 1 },
    }));
    const responses = await Promise.all(
      reqs.map(req => {
        const res = fakeRes();
        return purchaseFeed(req, res).then(() => res);
      }),
    );
    const successes = responses.filter(r => r.statusCode === 200);
    const failures = responses.filter(r => r.statusCode !== 200);
    expect(successes).toHaveLength(1);
    for (const f of failures) {
      expect(f.statusCode).toBe(400);
      expect(String(f.body?.message ?? '')).toMatch(/insufficient funds/i);
    }
    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(Number(after.money)).toBe(0);
    expect(Number(after.money)).toBeGreaterThanOrEqual(0);
  });
});
