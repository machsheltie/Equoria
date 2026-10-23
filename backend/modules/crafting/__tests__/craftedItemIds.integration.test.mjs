/**
 * Crafted inventory items get ids that cannot collide (Equoria-d5ncx).
 *
 * craftItem built `crafted-${Date.now()}-${result}`, so two crafts of the same
 * recipe within one millisecond (a double click, now that two affordable crafts
 * both succeed) produced two inventory records with the same id. equip and
 * unequip address records by id, so the second copy could never be touched.
 *
 * The clock is pinned (a deterministic time seam, not a mock of Equoria code) so
 * the collision does not depend on how fast the machine is.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { craftItem } from '../controllers/craftingController.mjs';
import { findRecipe } from '../data/craftingRecipes.mjs';

const fixturePrefix = 'TestFixture-d5ncx-craft';
const cleanup = createCleanupTracker();

let user;

function fakeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const recipe = findRecipe('basic-halter');
  user = await prisma.user.create({
    data: {
      username: `${fixturePrefix}-${tag}`,
      email: `${fixturePrefix}-${tag}@example.com`,
      password: await bcrypt.hash('TestPassword123!', 1),
      firstName: 'Craft',
      lastName: 'Ids',
      money: recipe.cost * 3,
      settings: {
        craftingMaterials: { leather: 1000, cloth: 1000, dye: 1000, metal: 1000, thread: 1000 },
        workshopTier: 1,
      },
    },
  });
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: user.id } }), 'userTransaction');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 30000);

describe('crafted item ids (Equoria-d5ncx)', () => {
  it('two crafts of the same recipe in the same millisecond get different inventory ids', async () => {
    const recipe = findRecipe('basic-halter');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    try {
      for (let i = 0; i < 2; i += 1) {
        const res = fakeRes();
        await craftItem({ user: { id: user.id }, body: { recipeId: recipe.id } }, res);
        expect(res.body?.success).toBe(true);
      }
    } finally {
      nowSpy.mockRestore();
    }

    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { settings: true } });
    const crafted = row.settings.inventory.filter(item => item.itemId === recipe.result);
    expect(crafted).toHaveLength(2);
    expect(new Set(crafted.map(item => item.id)).size).toBe(2);
  });
});
