/**
 * 🧪 UNIT TEST: Crafting Controller — Leathersmith Workshop
 *
 * Tests the crafting system: materials stockpile, recipe availability,
 * and item crafting with full validation (tier, coins, materials).
 *
 * 📋 BUSINESS RULES TESTED:
 * - GET /crafting/materials: returns material counts + workshop tier from User.settings
 * - GET /crafting/recipes: enriches catalog with locked/unlocked/affordable status
 * - POST /crafting/craft: validates tier, coins, materials before deducting and creating item
 * - Workshop tier gate: recipes above player's tier return 403
 * - Material deficit: clear error message listing what's missing
 * - Coin check: insufficient funds returns 400
 * - Crafted item gets origin: 'crafted' and is added to inventory
 * - Existing inventory items are preserved on craft
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: All controller business logic, validation rules, material calculations
 * ✅ REAL: Recipe catalog lookup, deficit calculation, inventory mutation logic
 * 🔧 MOCK: Prisma (external DB dependency)
 * 🔧 MOCK: Logger (external I/O dependency)
 */

import { jest, describe, beforeEach, expect, it } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.unstable_mockModule(join(__dirname, '../../packages/database/prismaClient.mjs'), () => ({ default: mockPrisma }));

jest.unstable_mockModule(join(__dirname, '../utils/logger.mjs'), () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ── Load modules after mocks ──────────────────────────────────────────────────

const { getMaterials_endpoint, getRecipes, craftItem } = await import(
  '../modules/services/controllers/craftingController.mjs'
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(overrides = {}) {
  return {
    user: { id: 'user-1' },
    body: {},
    params: {},
    ...overrides,
  };
}

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const DEFAULT_SETTINGS = {
  craftingMaterials: { leather: 5, cloth: 3, dye: 2, metal: 1, thread: 4 },
  workshopTier: 1,
  inventory: [],
};

// ── Tests: craftingRecipes catalog ───────────────────────────────────────────

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

// ── Tests: getMaterials_endpoint ─────────────────────────────────────────────

describe('getMaterials_endpoint', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    const req = makeReq();
    const res = makeRes();
    await getMaterials_endpoint(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('returns materials and workshopTier from settings', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ settings: DEFAULT_SETTINGS });
    const req = makeReq();
    const res = makeRes();
    await getMaterials_endpoint(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        materials: { leather: 5, cloth: 3, dye: 2, metal: 1, thread: 4 },
        workshopTier: 1,
      },
    });
  });

  it('defaults materials to 0 and tier to 0 when settings is empty', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ settings: {} });
    const req = makeReq();
    const res = makeRes();
    await getMaterials_endpoint(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        materials: { leather: 0, cloth: 0, dye: 0, metal: 0, thread: 0 },
        workshopTier: 0,
      },
    });
  });

  it('returns 500 on unexpected error', async () => {
    mockPrisma.user.findUnique.mockRejectedValueOnce(new Error('DB failure'));
    const req = makeReq();
    const res = makeRes();
    await getMaterials_endpoint(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── Tests: getRecipes ─────────────────────────────────────────────────────────

describe('getRecipes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    const req = makeReq();
    const res = makeRes();
    await getRecipes(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('marks tier 1+ recipes as locked for workshopTier 0', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ settings: { workshopTier: 0 } });
    const req = makeReq();
    const res = makeRes();
    await getRecipes(req, res);
    const { data } = res.json.mock.calls[0][0];
    const locked = data.recipes.filter(r => r.tier > 0);
    expect(locked.every(r => r.locked === true)).toBe(true);
  });

  it('marks tier 0 recipes as unlocked for workshopTier 0', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ settings: { workshopTier: 0 } });
    const req = makeReq();
    const res = makeRes();
    await getRecipes(req, res);
    const { data } = res.json.mock.calls[0][0];
    const tier0 = data.recipes.filter(r => r.tier === 0);
    expect(tier0.length).toBeGreaterThan(0);
    expect(tier0.every(r => r.locked === false)).toBe(true);
  });

  it('includes lockReason for locked recipes', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ settings: { workshopTier: 0 } });
    const req = makeReq();
    const res = makeRes();
    await getRecipes(req, res);
    const { data } = res.json.mock.calls[0][0];
    const lockedRecipe = data.recipes.find(r => r.locked);
    expect(lockedRecipe.lockReason).toMatch(/Tier \d/);
  });

  it('marks affordable=true when materials are sufficient', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 5, cloth: 5, dye: 5, metal: 5, thread: 5 },
      },
    });
    const req = makeReq();
    const res = makeRes();
    await getRecipes(req, res);
    const { data } = res.json.mock.calls[0][0];
    const tier0Unlocked = data.recipes.filter(r => r.tier === 0);
    expect(tier0Unlocked.every(r => r.affordable === true)).toBe(true);
  });

  it('marks affordable=false and sets deficit when materials are insufficient', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 0, cloth: 0, dye: 0, metal: 0, thread: 0 },
      },
    });
    const req = makeReq();
    const res = makeRes();
    await getRecipes(req, res);
    const { data } = res.json.mock.calls[0][0];
    const needsMats = data.recipes.filter(r => !r.locked && r.tier === 0);
    // simple-bridle needs 1 leather + 1 dye
    const simpleBridle = needsMats.find(r => r.id === 'simple-bridle');
    expect(simpleBridle.affordable).toBe(false);
    expect(simpleBridle.deficit).toMatch(/leather/);
  });
});

// ── Tests: craftItem ──────────────────────────────────────────────────────────

describe('craftItem', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 for unknown recipeId', async () => {
    const req = makeReq({ body: { recipeId: 'nonexistent' } });
    const res = makeRes();
    await craftItem(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('returns 404 if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when workshop tier is too low', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      money: 9999,
      settings: { workshopTier: 0, craftingMaterials: { leather: 5, dye: 5 } },
    });
    // dyed-bridle requires tier 1
    const req = makeReq({ body: { recipeId: 'dyed-bridle' } });
    const res = makeRes();
    await craftItem(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Leathersmith Workshop') }),
    );
  });

  it('returns 400 when player has insufficient coins', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      money: 10, // simple-bridle costs 100
      settings: { workshopTier: 0, craftingMaterials: { leather: 5, dye: 5 } },
    });
    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Insufficient coins') }),
    );
  });

  it('returns 400 when materials are insufficient and lists the deficit', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      money: 9999,
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 0, cloth: 0, dye: 0, metal: 0, thread: 0 },
      },
    });
    // simple-bridle needs 1 leather + 1 dye
    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const { message } = res.json.mock.calls[0][0];
    expect(message).toMatch(/Insufficient materials/);
    expect(message).toMatch(/leather/);
  });

  it('successfully crafts a tier 0 item and returns it with origin: crafted', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      money: 500,
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 5, cloth: 0, dye: 5, metal: 0, thread: 0 },
        inventory: [],
      },
    });
    mockPrisma.user.update.mockResolvedValueOnce({});

    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);

    expect(res.json).toHaveBeenCalledWith(
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
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      money: 500,
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 3, cloth: 0, dye: 3, metal: 0, thread: 0 },
        inventory: [],
      },
    });
    mockPrisma.user.update.mockResolvedValueOnce({});

    const req = makeReq({ body: { recipeId: 'simple-bridle' } }); // costs 1 leather + 1 dye
    const res = makeRes();
    await craftItem(req, res);

    const { data } = res.json.mock.calls[0][0];
    expect(data.remainingMaterials.leather).toBe(2);
    expect(data.remainingMaterials.dye).toBe(2);
  });

  it('preserves existing inventory items when appending new crafted item', async () => {
    const existingItem = { id: 'existing-1', name: 'Old Item' };
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      money: 500,
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 5, cloth: 0, dye: 5, metal: 0, thread: 0 },
        inventory: [existingItem],
      },
    });
    mockPrisma.user.update.mockResolvedValueOnce({});

    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);

    // Verify prisma.user.update was called with inventory containing both items
    const updateCall = mockPrisma.user.update.mock.calls[0][0];
    const updatedInventory = updateCall.data.settings.inventory;
    expect(updatedInventory).toHaveLength(2);
    expect(updatedInventory[0]).toEqual(existingItem);
    expect(updatedInventory[1]).toMatchObject({ origin: 'crafted' });
  });

  it('calls prisma.user.update with decremented money', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      money: 500,
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 5, cloth: 0, dye: 5, metal: 0, thread: 0 },
        inventory: [],
      },
    });
    mockPrisma.user.update.mockResolvedValueOnce({});

    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);

    const updateCall = mockPrisma.user.update.mock.calls[0][0];
    expect(updateCall.data.money).toEqual({ decrement: 100 });
  });

  it('returns 500 on unexpected error', async () => {
    mockPrisma.user.findUnique.mockRejectedValueOnce(new Error('DB connection lost'));
    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
