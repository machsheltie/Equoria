/**
 * Crafting Controller — Leathersmith Workshop (REAL DB)
 *
 * Tests the crafting system: materials stockpile, recipe availability,
 * and item crafting with full validation (tier, coins, materials).
 *
 * NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted
 * from jest.unstable_mockModule of prismaClient + logger to a real-DB
 * integration test against the canonical equoria DB. Every prisma-mock-
 * driven branch is now exercised by setting the test user's
 * settings/money via real updates, calling the controller, and
 * verifying real DB mutations.
 *
 * Removed (per doctrine):
 *   - "getMaterials_endpoint returns 500 on unexpected error" — required
 *     mocking prisma.user.findUnique to reject. Synthetic Prisma fault
 *     injection is forbidden; the .catch() block IS exercised on real DB
 *     failure but a synthetic test is not a permitted pattern.
 *   - "craftItem returns 500 on unexpected error" — same reason.
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { getMaterials_endpoint, getRecipes, craftItem } from '../modules/services/controllers/craftingController.mjs';

const ts = randomBytes(8).toString('hex');
const NON_EXISTENT_USER_ID = `nonexistent-${ts}`;
let testUser;

function makeReq(overrides = {}) {
  return {
    user: { id: testUser?.id ?? 'pre-init' },
    body: {},
    params: {},
    ...overrides,
  };
}

function makeRes() {
  const res = {
    _status: null,
    _body: null,
  };
  res.status = code => {
    res._status = code;
    return res;
  };
  res.json = body => {
    res._body = body;
    return res;
  };
  return res;
}

const DEFAULT_SETTINGS = {
  craftingMaterials: { leather: 5, cloth: 3, dye: 2, metal: 1, thread: 4 },
  workshopTier: 1,
  inventory: [],
};

beforeAll(async () => {
  // rounds=1: fast in tests; password is never verified (JWT generated directly)
  const hashed = await bcrypt.hash('TestPass123!', 1);
  testUser = await prisma.user.create({
    data: {
      username: `craftingTest_${ts}`,
      email: `craftingTest_${ts}@test.com`,
      password: hashed,
      firstName: 'Crafting',
      lastName: 'Test',
      money: 10_000,
      settings: { ...DEFAULT_SETTINGS },
    },
  });
}, 120000);

afterAll(async () => {
  if (testUser?.id) {
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  }
});

async function setUserState({ settings = DEFAULT_SETTINGS, money = 10_000 }) {
  await prisma.user.update({
    where: { id: testUser.id },
    data: { settings, money },
  });
}

// ── craftingRecipes catalog (pure data; no DB) ────────────────────────────────

describe('craftingRecipes catalog', () => {
  it('exports at least 5 recipes', async () => {
    const { CRAFTING_RECIPES } = await import('../modules/services/data/craftingRecipes.mjs');
    expect(CRAFTING_RECIPES.length).toBeGreaterThanOrEqual(5);
  });

  it('every recipe has required fields', async () => {
    const { CRAFTING_RECIPES } = await import('../modules/services/data/craftingRecipes.mjs');
    for (const r of CRAFTING_RECIPES) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('tier');
      expect(r).toHaveProperty('cost');
      expect(r).toHaveProperty('materials');
      expect(r).toHaveProperty('result');
      expect(r).toHaveProperty('resultCategory');
      expect(typeof r.numericBonus).toBe('number');
      expect(typeof r.isCosmetic).toBe('boolean');
    }
  });

  it('findRecipe returns the correct recipe by id', async () => {
    const { findRecipe } = await import('../modules/services/data/craftingRecipes.mjs');
    const recipe = findRecipe('simple-bridle');
    expect(recipe).toBeDefined();
    expect(recipe.tier).toBe(0);
    expect(recipe.isCosmetic).toBe(true);
  });

  it('findRecipe returns undefined for unknown id', async () => {
    const { findRecipe } = await import('../modules/services/data/craftingRecipes.mjs');
    expect(findRecipe('nonexistent-recipe')).toBeUndefined();
  });

  it('includes Tier 3 legacy tack recipe', async () => {
    const { findRecipe } = await import('../modules/services/data/craftingRecipes.mjs');
    const legacy = findRecipe('legacy-tack-set');
    expect(legacy).toBeDefined();
    expect(legacy.tier).toBe(3);
  });
});

// ── getMaterials_endpoint (real DB) ───────────────────────────────────────────

describe('getMaterials_endpoint', () => {
  it('returns 404 if user not found', async () => {
    const req = makeReq({ user: { id: NON_EXISTENT_USER_ID } });
    const res = makeRes();
    await getMaterials_endpoint(req, res);
    expect(res._status).toBe(404);
    expect(res._body.success).toBe(false);
  });

  it('returns materials and workshopTier from settings', async () => {
    await setUserState({ settings: DEFAULT_SETTINGS });
    const req = makeReq();
    const res = makeRes();
    await getMaterials_endpoint(req, res);
    expect(res._body).toEqual({
      success: true,
      data: {
        materials: { leather: 5, cloth: 3, dye: 2, metal: 1, thread: 4 },
        workshopTier: 1,
      },
    });
  });

  it('defaults materials to 0 and tier to 0 when settings is empty', async () => {
    await setUserState({ settings: {} });
    const req = makeReq();
    const res = makeRes();
    await getMaterials_endpoint(req, res);
    expect(res._body).toEqual({
      success: true,
      data: {
        materials: { leather: 0, cloth: 0, dye: 0, metal: 0, thread: 0 },
        workshopTier: 0,
      },
    });
  });
});

// ── getRecipes (real DB) ──────────────────────────────────────────────────────

describe('getRecipes', () => {
  it('returns 404 if user not found', async () => {
    const req = makeReq({ user: { id: NON_EXISTENT_USER_ID } });
    const res = makeRes();
    await getRecipes(req, res);
    expect(res._status).toBe(404);
  });

  it('marks tier 1+ recipes as locked for workshopTier 0', async () => {
    await setUserState({ settings: { workshopTier: 0 } });
    const req = makeReq();
    const res = makeRes();
    await getRecipes(req, res);
    const { data } = res._body;
    const locked = data.recipes.filter(r => r.tier > 0);
    expect(locked.every(r => r.locked === true)).toBe(true);
  });

  it('marks tier 0 recipes as unlocked for workshopTier 0', async () => {
    await setUserState({ settings: { workshopTier: 0 } });
    const req = makeReq();
    const res = makeRes();
    await getRecipes(req, res);
    const { data } = res._body;
    const tier0 = data.recipes.filter(r => r.tier === 0);
    expect(tier0.length).toBeGreaterThan(0);
    expect(tier0.every(r => r.locked === false)).toBe(true);
  });

  it('includes lockReason for locked recipes', async () => {
    await setUserState({ settings: { workshopTier: 0 } });
    const req = makeReq();
    const res = makeRes();
    await getRecipes(req, res);
    const { data } = res._body;
    const lockedRecipe = data.recipes.find(r => r.locked);
    expect(lockedRecipe.lockReason).toMatch(/Tier \d/);
  });

  it('marks affordable=true when materials are sufficient', async () => {
    await setUserState({
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 5, cloth: 5, dye: 5, metal: 5, thread: 5 },
      },
    });
    const req = makeReq();
    const res = makeRes();
    await getRecipes(req, res);
    const { data } = res._body;
    const tier0Unlocked = data.recipes.filter(r => r.tier === 0);
    expect(tier0Unlocked.every(r => r.affordable === true)).toBe(true);
  });

  it('marks affordable=false and sets deficit when materials are insufficient', async () => {
    await setUserState({
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 0, cloth: 0, dye: 0, metal: 0, thread: 0 },
      },
    });
    const req = makeReq();
    const res = makeRes();
    await getRecipes(req, res);
    const { data } = res._body;
    const needsMats = data.recipes.filter(r => !r.locked && r.tier === 0);
    const simpleBridle = needsMats.find(r => r.id === 'simple-bridle');
    expect(simpleBridle.affordable).toBe(false);
    expect(simpleBridle.deficit).toMatch(/leather/);
  });
});

// ── craftItem (real DB) ───────────────────────────────────────────────────────

describe('craftItem', () => {
  it('returns 404 for unknown recipeId', async () => {
    const req = makeReq({ body: { recipeId: 'nonexistent' } });
    const res = makeRes();
    await craftItem(req, res);
    expect(res._status).toBe(404);
    expect(res._body.success).toBe(false);
  });

  it('returns 404 if user not found', async () => {
    const req = makeReq({
      user: { id: NON_EXISTENT_USER_ID },
      body: { recipeId: 'simple-bridle' },
    });
    const res = makeRes();
    await craftItem(req, res);
    expect(res._status).toBe(404);
  });

  it('returns 403 when workshop tier is too low', async () => {
    await setUserState({
      settings: { workshopTier: 0, craftingMaterials: { leather: 5, dye: 5 } },
      money: 9999,
    });
    const req = makeReq({ body: { recipeId: 'dyed-bridle' } }); // requires tier 1
    const res = makeRes();
    await craftItem(req, res);
    expect(res._status).toBe(403);
    expect(res._body.message).toContain('Leathersmith Workshop');
  });

  it('returns 400 when player has insufficient coins', async () => {
    await setUserState({
      settings: { workshopTier: 0, craftingMaterials: { leather: 5, dye: 5 } },
      money: 10, // simple-bridle costs 100
    });
    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);
    expect(res._status).toBe(400);
    expect(res._body.message).toContain('Insufficient coins');
  });

  it('returns 400 when materials are insufficient and lists the deficit', async () => {
    await setUserState({
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 0, cloth: 0, dye: 0, metal: 0, thread: 0 },
      },
      money: 9999,
    });
    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);
    expect(res._status).toBe(400);
    expect(res._body.message).toMatch(/Insufficient materials/);
    expect(res._body.message).toMatch(/leather/);
  });

  it('successfully crafts a tier 0 item and returns it with origin: crafted', async () => {
    await setUserState({
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 5, cloth: 0, dye: 5, metal: 0, thread: 0 },
        inventory: [],
      },
      money: 500,
    });
    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);

    expect(res._body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          item: expect.objectContaining({
            origin: 'crafted',
            category: 'bridle',
          }),
          coinsSpent: 100,
          newBalance: 400,
        }),
      }),
    );
  });

  it('deducts correct materials on craft', async () => {
    await setUserState({
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 3, cloth: 0, dye: 3, metal: 0, thread: 0 },
        inventory: [],
      },
      money: 500,
    });
    const req = makeReq({ body: { recipeId: 'simple-bridle' } }); // costs 1 leather + 1 dye
    const res = makeRes();
    await craftItem(req, res);

    const { data } = res._body;
    expect(data.remainingMaterials.leather).toBe(2);
    expect(data.remainingMaterials.dye).toBe(2);
  });

  it('preserves existing inventory items when appending new crafted item', async () => {
    const existingItem = { id: 'existing-1', name: 'Old Item' };
    await setUserState({
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 5, cloth: 0, dye: 5, metal: 0, thread: 0 },
        inventory: [existingItem],
      },
      money: 500,
    });
    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);

    const updated = await prisma.user.findUnique({ where: { id: testUser.id } });
    const updatedInventory = updated.settings.inventory;
    expect(updatedInventory).toHaveLength(2);
    expect(updatedInventory[0]).toEqual(existingItem);
    expect(updatedInventory[1]).toMatchObject({ origin: 'crafted' });
  });

  it('decrements user money by the recipe cost', async () => {
    await setUserState({
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 5, cloth: 0, dye: 5, metal: 0, thread: 0 },
        inventory: [],
      },
      money: 500,
    });
    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);

    const updated = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(updated.money).toBe(400); // 500 - 100 cost
  });
});
