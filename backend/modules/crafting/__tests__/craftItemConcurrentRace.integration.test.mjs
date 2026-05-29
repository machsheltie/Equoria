/**
 * POST /api/crafting/craft — concurrent-race sentinel (Equoria-6g8wm).
 * Site 4 of 6.
 *
 * The crafting controller previously did the money debit OUTSIDE any
 * transaction and the ledger row was fire-and-forget. The fix wraps the
 * money debit + settings update + ledger row in ONE $transaction via
 * debitMoneyOrThrow.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { craftItem } from '../controllers/craftingController.mjs';
import { CRAFTING_RECIPES } from '../data/craftingRecipes.mjs';

const FIXTURE_PREFIX = 'TestFixture-6g8wm-craft';
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
  // Pick a tier-0 recipe so workshop tier check passes by default.
  const recipe = CRAFTING_RECIPES.find(r => r.tier === 0);

  // Seed user with EXACTLY one craft's worth of coins. Materials seeded
  // VERY high so the test isolates the MONEY race specifically (the
  // material check is a separate pre-tx guard outside the helper's scope).
  user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: pw,
      firstName: 'Craft',
      lastName: 'Race',
      money: recipe.cost,
      settings: {
        craftingMaterials: {
          leather: 1000,
          cloth: 1000,
          dye: 1000,
          metal: 1000,
          thread: 1000,
        },
        workshopTier: 1,
      },
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

describe('crafting craftItem concurrent-race sentinel (Equoria-6g8wm)', () => {
  it('SENTINEL: N parallel crafts with money for ONE — exactly 1 succeeds, money never negative', async () => {
    const recipe = CRAFTING_RECIPES.find(r => r.tier === 0);
    const reqs = Array.from({ length: N }, () => ({
      user: { id: user.id },
      body: { recipeId: recipe.id },
    }));
    const responses = await Promise.all(
      reqs.map(req => {
        const res = fakeRes();
        return craftItem(req, res).then(() => res);
      }),
    );
    const successes = responses.filter(r => r.body?.success === true);
    const failures = responses.filter(r => r.body?.success !== true);
    expect(successes).toHaveLength(1);
    for (const f of failures) {
      // Either 400 insufficient coins (raced and lost the money debit)
      // OR 400 insufficient materials (raced and lost the material check
      // against a stale read — a known separate race not in 6g8wm scope).
      expect(f.statusCode).toBe(400);
    }
    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(Number(after.money)).toBe(0);
    expect(Number(after.money)).toBeGreaterThanOrEqual(0);
  });
});
