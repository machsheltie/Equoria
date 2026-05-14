/**
 * Tests for the Leathersmith Crafting System (Equoria-lnn4) — real DB
 *
 * NO MOCKS. Rewritten 2026-04-30 (Equoria-p6fx, no-mocks doctrine epic)
 * from a jest.unstable_mockModule pattern (mocked logger + prismaClient
 * + financialLedgerService) to a real-DB integration test.
 *
 * Covers:
 *   - craftingRecipes catalog (shape, tiers, data integrity) — pure
 *     module data, no mocking ever needed
 *   - craftingController: getMaterials_endpoint, getRecipes, craftItem
 *     against the real `equoria_test` DB. Each test creates a real
 *     user with controlled settings JSON, calls the real controller,
 *     and asserts on real DB state.
 *
 * Removed (per no-mocks doctrine):
 *   - "returns 500 on DB error" tests that mocked Prisma to reject.
 *     Synthetic Prisma fault injection is forbidden; the catch path is
 *     observable in production via real DB outage / sentry.
 *
 * @module __tests__/craftingSystem
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../db/index.mjs';
import { CRAFTING_RECIPES, findRecipe } from '../../services/data/craftingRecipes.mjs';
import { getMaterials_endpoint, getRecipes, craftItem } from '../../services/controllers/craftingController.mjs';

const SUITE_PREFIX = 'craft';

function makeReq(userId, overrides = {}) {
  return {
    user: { id: userId },
    body: {},
    ...overrides,
  };
}

function makeRes() {
  const res = {
    _status: 200,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
  return res;
}

function makeSettings(overrides = {}) {
  return {
    craftingMaterials: { leather: 5, cloth: 5, dye: 5, metal: 5, thread: 5 },
    workshopTier: 0,
    inventory: [],
    ...overrides,
  };
}

async function createUser(extra = {}) {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'Craft',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
      money: 500,
      ...extra,
    },
  });
}

async function cleanupSuite() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) {
    return;
  }
  const userIds = users.map(u => u.id);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

// ─────────────────────────────────────────────────────────────────────────────
// CRAFTING_RECIPES catalog (pure data — no DB)
// ─────────────────────────────────────────────────────────────────────────────

describe('CRAFTING_RECIPES catalog', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(CRAFTING_RECIPES)).toBe(true);
    expect(CRAFTING_RECIPES.length).toBeGreaterThan(0);
  });

  it('every recipe has required fields', () => {
    for (const r of CRAFTING_RECIPES) {
      expect(typeof r.id).toBe('string');
      expect(typeof r.name).toBe('string');
      expect(typeof r.tier).toBe('number');
      expect(typeof r.cost).toBe('number');
      expect(typeof r.materials).toBe('object');
      expect(typeof r.result).toBe('string');
      expect(typeof r.resultName).toBe('string');
      expect(typeof r.resultCategory).toBe('string');
      expect(typeof r.isCosmetic).toBe('boolean');
    }
  });

  it('tier values are 0-3', () => {
    for (const r of CRAFTING_RECIPES) {
      expect(r.tier).toBeGreaterThanOrEqual(0);
      expect(r.tier).toBeLessThanOrEqual(3);
    }
  });

  it('all recipe IDs are unique', () => {
    const ids = CRAFTING_RECIPES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('at least one recipe per tier 0-2', () => {
    for (const tier of [0, 1, 2]) {
      expect(CRAFTING_RECIPES.some(r => r.tier === tier)).toBe(true);
    }
  });
});

describe('findRecipe()', () => {
  it('returns the recipe for a valid id', () => {
    const first = CRAFTING_RECIPES[0];
    expect(findRecipe(first.id)).toEqual(first);
  });

  it('returns undefined for unknown id', () => {
    expect(findRecipe('not-a-recipe')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Controllers (real DB)
// ─────────────────────────────────────────────────────────────────────────────

describe('craftingController (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  describe('getMaterials_endpoint()', () => {
    it('returns materials and workshopTier for a real user with populated settings', async () => {
      const user = await createUser({ settings: makeSettings({ workshopTier: 2 }) });

      const res = makeRes();
      await getMaterials_endpoint(makeReq(user.id), res);

      expect(res._status).toBe(200);
      expect(res._body.success).toBe(true);
      expect(res._body.data.workshopTier).toBe(2);
      expect(res._body.data.materials.leather).toBe(5);
    });

    it('defaults all materials to 0 when settings JSON is null', async () => {
      const user = await createUser({ settings: undefined });

      const res = makeRes();
      await getMaterials_endpoint(makeReq(user.id), res);

      expect(res._body.data.materials).toEqual({
        leather: 0,
        cloth: 0,
        dye: 0,
        metal: 0,
        thread: 0,
      });
      expect(res._body.data.workshopTier).toBe(0);
    });

    it('returns 404 when the user does not exist', async () => {
      const res = makeRes();
      await getMaterials_endpoint(makeReq(`${SUITE_PREFIX}-nonexistent-${randomBytes(4).toString('hex')}`), res);

      expect(res._status).toBe(404);
      expect(res._body.success).toBe(false);
    });
  });

  describe('getRecipes()', () => {
    it('returns all recipes with tier-0 unlocked + tier-1+ locked at workshopTier=0', async () => {
      const user = await createUser({ settings: makeSettings({ workshopTier: 0 }) });

      const res = makeRes();
      await getRecipes(makeReq(user.id), res);

      expect(res._body.success).toBe(true);
      const recipes = res._body.data.recipes;
      expect(Array.isArray(recipes)).toBe(true);
      expect(recipes.filter(r => r.tier === 0).every(r => !r.locked)).toBe(true);
      expect(recipes.filter(r => r.tier > 0).every(r => r.locked)).toBe(true);
    });

    it('unlocks Tier-1 recipes at workshopTier=1', async () => {
      const user = await createUser({ settings: makeSettings({ workshopTier: 1 }) });

      const res = makeRes();
      await getRecipes(makeReq(user.id), res);

      const recipes = res._body.data.recipes;
      expect(recipes.filter(r => r.tier === 1).every(r => !r.locked)).toBe(true);
    });

    it('marks recipes unaffordable when materials are insufficient', async () => {
      const user = await createUser({
        settings: makeSettings({
          workshopTier: 0,
          craftingMaterials: { leather: 0, cloth: 0, dye: 0, metal: 0, thread: 0 },
        }),
      });

      const res = makeRes();
      await getRecipes(makeReq(user.id), res);

      const recipes = res._body.data.recipes;
      const needsMaterials = recipes.filter(r => Object.values(r.materials).some(v => v > 0));
      expect(needsMaterials.every(r => !r.affordable)).toBe(true);
    });

    it('returns 404 when the user does not exist', async () => {
      const res = makeRes();
      await getRecipes(makeReq(`${SUITE_PREFIX}-nonexistent-${randomBytes(4).toString('hex')}`), res);
      expect(res._status).toBe(404);
    });
  });

  describe('craftItem()', () => {
    it('crafts a Tier-0 recipe when user has sufficient materials and coins (real DB write)', async () => {
      const user = await createUser({
        money: 500,
        settings: makeSettings({ workshopTier: 0 }),
      });

      const res = makeRes();
      await craftItem(makeReq(user.id, { body: { recipeId: 'simple-bridle' } }), res);

      expect(res._body.success).toBe(true);
      expect(res._body.data.item.origin).toBe('crafted');
      expect(res._body.data.item.itemId).toBe('crafted-simple-bridle');
      expect(res._body.data.coinsSpent).toBe(100);

      // Verify the DB was actually mutated.
      const after = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true, settings: true } });
      expect(after.money).toBe(400); // 500 - 100
      expect(after.settings.craftingMaterials.leather).toBe(4); // 5 - 1
    });

    it('deducts the correct materials after crafting', async () => {
      const user = await createUser({
        money: 500,
        settings: makeSettings({ workshopTier: 0 }),
      });

      const res = makeRes();
      await craftItem(makeReq(user.id, { body: { recipeId: 'simple-bridle' } }), res);

      // simple-bridle needs 1 leather + 1 dye
      expect(res._body.data.remainingMaterials.leather).toBe(4);
      expect(res._body.data.remainingMaterials.dye).toBe(4);
      expect(res._body.data.remainingMaterials.cloth).toBe(5);
    });

    it('returns 404 for an unknown recipeId', async () => {
      const user = await createUser({ settings: makeSettings() });

      const res = makeRes();
      await craftItem(makeReq(user.id, { body: { recipeId: 'does-not-exist' } }), res);

      expect(res._status).toBe(404);
      expect(res._body.success).toBe(false);
    });

    it('returns 403 when workshopTier is too low for the recipe', async () => {
      const user = await createUser({
        money: 9999,
        settings: makeSettings({ workshopTier: 0 }), // event-saddle needs tier 2
      });

      const res = makeRes();
      await craftItem(makeReq(user.id, { body: { recipeId: 'event-saddle' } }), res);

      expect(res._status).toBe(403);
      expect(res._body.message).toMatch(/upgrade required/i);
    });

    it('returns 400 when user has insufficient coins', async () => {
      const user = await createUser({
        money: 10,
        settings: makeSettings({ workshopTier: 0 }),
      });

      const res = makeRes();
      await craftItem(makeReq(user.id, { body: { recipeId: 'simple-bridle' } }), res);

      expect(res._status).toBe(400);
      expect(res._body.message).toMatch(/insufficient coins/i);
    });

    it('returns 400 when user has insufficient materials', async () => {
      const user = await createUser({
        money: 9999,
        settings: makeSettings({
          workshopTier: 0,
          craftingMaterials: { leather: 0, cloth: 0, dye: 0, metal: 0, thread: 0 },
        }),
      });

      const res = makeRes();
      await craftItem(makeReq(user.id, { body: { recipeId: 'simple-bridle' } }), res);

      expect(res._status).toBe(400);
      expect(res._body.message).toMatch(/insufficient materials/i);
    });

    it('returns 404 when the user does not exist', async () => {
      const res = makeRes();
      await craftItem(
        makeReq(`${SUITE_PREFIX}-nonexistent-${randomBytes(4).toString('hex')}`, {
          body: { recipeId: 'simple-bridle' },
        }),
        res,
      );

      expect(res._status).toBe(404);
    });

    it('crafted item has origin=crafted and craftedAt timestamp', async () => {
      const user = await createUser({
        money: 500,
        settings: makeSettings({ workshopTier: 0 }),
      });

      const res = makeRes();
      await craftItem(makeReq(user.id, { body: { recipeId: 'basic-halter' } }), res);

      const item = res._body.data.item;
      expect(item.origin).toBe('crafted');
      expect(typeof item.craftedAt).toBe('string');
      expect(item.equippedToHorseId).toBeNull();
    });
  });
});
