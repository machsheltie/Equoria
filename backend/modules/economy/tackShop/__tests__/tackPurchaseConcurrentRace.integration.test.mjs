/**
 * tackShop purchaseTackItem concurrent-race sentinel (Equoria-6g8wm).
 * Site 6 of 6 — closes the helper-adoption follow-up.
 *
 * Owner ruling 2026-10-26 (q78, Equoria-dslww): a purchase no longer involves a
 * horse; it buys into the inventory. The race it proves is unchanged: with money
 * for ONE item, exactly one of N parallel purchases succeeds, the wallet never
 * goes negative, and now exactly one inventory record and one ledger row exist.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { purchaseTackItem, TACK_INVENTORY } from '../controllers/tackShopController.mjs';

const FIXTURE_PREFIX = 'TestFixture-6g8wm-tack';
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
  // Pick the cheapest functional item for the test (avoids the legacy-alias filter).
  const item = TACK_INVENTORY.filter(i => !i.isLegacyAlias && i.cost > 0)[0];

  user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: pw,
      firstName: 'Tack',
      lastName: 'Race',
      money: item.cost,
    },
  });
  createdUserIds.push(user.id);
}, 60000);

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
}, 30000);

describe('tackShop purchaseTackItem concurrent-race sentinel (Equoria-6g8wm)', () => {
  it('SENTINEL: N parallel purchases with money for ONE — exactly 1 succeeds, money never negative', async () => {
    const item = TACK_INVENTORY.filter(i => !i.isLegacyAlias && i.cost > 0)[0];
    const reqs = Array.from({ length: N }, () => ({
      user: { id: user.id },
      body: { itemId: item.id },
    }));
    const responses = await Promise.all(
      reqs.map(req => {
        const res = fakeRes();
        return purchaseTackItem(req, res).then(() => res);
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

    // Exactly one item was bought: one inventory record, one ledger row.
    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { settings: true } });
    expect((row.settings?.inventory ?? []).filter(r => r.itemId === item.id)).toHaveLength(1);
    expect(await prisma.userTransaction.count({ where: { userId: user.id, category: 'tackPurchase' } })).toBe(1);
  });
});
