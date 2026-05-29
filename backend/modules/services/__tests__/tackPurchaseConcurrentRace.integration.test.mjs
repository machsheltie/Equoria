/**
 * tackShop purchaseTackItem concurrent-race sentinel (Equoria-6g8wm).
 * Site 6 of 6 — closes the helper-adoption follow-up.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { purchaseTackItem, TACK_INVENTORY } from '../controllers/tackShopController.mjs';

const FIXTURE_PREFIX = 'TestFixture-6g8wm-tack';
const N = 5;

let user;
let horse;
const createdUserIds = [];
const createdHorseIds = [];

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
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: pw,
      firstName: 'Tack',
      lastName: 'Race',
      money: item.cost,
    },
  });
  createdUserIds.push(user.id);

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${tag}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: user.id,
      healthStatus: 'healthy',
    },
  });
  createdHorseIds.push(horse.id);
}, 60000);

afterAll(async () => {
  if (createdHorseIds.length) {
    await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }).catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(err => console.warn(`[cleanup] ${err.message}`));
  }
}, 30000);

describe('tackShop purchaseTackItem concurrent-race sentinel (Equoria-6g8wm)', () => {
  it('SENTINEL: N parallel purchases with money for ONE — exactly 1 succeeds, money never negative', async () => {
    const item = TACK_INVENTORY.filter(i => !i.isLegacyAlias && i.cost > 0)[0];
    const reqs = Array.from({ length: N }, () => ({
      user: { id: user.id },
      body: { horseId: horse.id, itemId: item.id },
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
  });
});
