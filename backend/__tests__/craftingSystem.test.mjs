/**
 * Tests for the Leathersmith Crafting System (Equoria-lnn4).
 *
 * Covers:
 *   - craftingRecipes catalog (shape, tiers, data integrity)
 *   - craftingController: getMaterials, getRecipes, craftItem
 *     (all DB calls mocked — no real DB needed)
 */

import { jest } from '@jest/globals';

// ── Mocks (must precede dynamic imports) ─────────────────────────────────────

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.unstable_mockModule('../utils/logger.mjs', () => ({ default: mockLogger }));

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockPrisma = {
  user: {
    findUnique: mockUserFindUnique,
    update: mockUserUpdate,
  },
};
jest.unstable_mockModule('../../packages/database/prismaClient.mjs', () => ({
  default: mockPrisma,
}));

// ── Dynamic imports (after mocks) ────────────────────────────────────────────

const { CRAFTING_RECIPES, findRecipe } = await import('../modules/services/data/craftingRecipes.mjs');
const { getMaterials_endpoint, getRecipes, craftItem } = await import(
  '../modules/services/controllers/craftingController.mjs'
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(overrides = {}) {
  return {
    user: { id: 'user-1' },
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

// ─────────────────────────────────────────────────────────────────────────────
// CRAFTING_RECIPES catalog
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
// getMaterials_endpoint
// ─────────────────────────────────────────────────────────────────────────────

describe('getMaterials_endpoint()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns materials and workshopTier for a found user', async () => {
    const settings = makeSettings({ workshopTier: 2 });
    mockUserFindUnique.mockResolvedValueOnce({ settings });

    const req = makeReq();
    const res = makeRes();
    await getMaterials_endpoint(req, res);

    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
    expect(res._body.data.workshopTier).toBe(2);
    expect(res._body.data.materials.leather).toBe(5);
  });

  it('defaults all materials to 0 when settings are null', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ settings: null });

    const req = makeReq();
    const res = makeRes();
    await getMaterials_endpoint(req, res);

    expect(res._body.data.materials).toEqual({
      leather: 0,
      cloth: 0,
      dye: 0,
      metal: 0,
      thread: 0,
    });
    expect(res._body.data.workshopTier).toBe(0);
  });

  it('returns 404 when user not found', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);

    const req = makeReq();
    const res = makeRes();
    await getMaterials_endpoint(req, res);

    expect(res._status).toBe(404);
    expect(res._body.success).toBe(false);
  });

  it('returns 500 on DB error', async () => {
    mockUserFindUnique.mockRejectedValueOnce(new Error('DB down'));

    const req = makeReq();
    const res = makeRes();
    await getMaterials_endpoint(req, res);

    expect(res._status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getRecipes
// ─────────────────────────────────────────────────────────────────────────────

describe('getRecipes()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all recipes with locked status based on workshopTier=0', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ settings: makeSettings({ workshopTier: 0 }) });

    const req = makeReq();
    const res = makeRes();
    await getRecipes(req, res);

    expect(res._body.success).toBe(true);
    const recipes = res._body.data.recipes;
    expect(Array.isArray(recipes)).toBe(true);

    // Tier-0 recipes should be unlocked
    const tier0 = recipes.filter(r => r.tier === 0);
    expect(tier0.every(r => !r.locked)).toBe(true);

    // Tier-1+ recipes should be locked
    const tier1plus = recipes.filter(r => r.tier > 0);
    expect(tier1plus.every(r => r.locked)).toBe(true);
  });

  it('unlocks Tier 1 recipes when workshopTier=1', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ settings: makeSettings({ workshopTier: 1 }) });

    const req = makeReq();
    const res = makeRes();
    await getRecipes(req, res);

    const recipes = res._body.data.recipes;
    const tier1 = recipes.filter(r => r.tier === 1);
    expect(tier1.every(r => !r.locked)).toBe(true);
  });

  it('marks recipes unaffordable when materials are insufficient', async () => {
    const poorSettings = makeSettings({
      workshopTier: 0,
      craftingMaterials: { leather: 0, cloth: 0, dye: 0, metal: 0, thread: 0 },
    });
    mockUserFindUnique.mockResolvedValueOnce({ settings: poorSettings });

    const req = makeReq();
    const res = makeRes();
    await getRecipes(req, res);

    // All recipes needing any material should be not affordable
    const recipes = res._body.data.recipes;
    const needsMaterials = recipes.filter(r => Object.values(r.materials).some(v => v > 0));
    expect(needsMaterials.every(r => !r.affordable)).toBe(true);
  });

  it('returns 404 when user not found', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    const req = makeReq();
    const res = makeRes();
    await getRecipes(req, res);
    expect(res._status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// craftItem
// ─────────────────────────────────────────────────────────────────────────────

describe('craftItem()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('crafts a Tier-0 recipe when user has sufficient materials and coins', async () => {
    const settings = makeSettings({ workshopTier: 0 });
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', money: 500, settings });
    mockUserUpdate.mockResolvedValueOnce({});

    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);

    expect(res._body.success).toBe(true);
    expect(res._body.data.item.origin).toBe('crafted');
    expect(res._body.data.item.itemId).toBe('crafted-simple-bridle');
    expect(res._body.data.coinsSpent).toBe(100);
    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
  });

  it('deducts the correct materials after crafting', async () => {
    const settings = makeSettings({ workshopTier: 0 });
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', money: 500, settings });
    mockUserUpdate.mockResolvedValueOnce({});

    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);

    // simple-bridle needs 1 leather + 1 dye
    expect(res._body.data.remainingMaterials.leather).toBe(4); // 5 - 1
    expect(res._body.data.remainingMaterials.dye).toBe(4); // 5 - 1
    expect(res._body.data.remainingMaterials.cloth).toBe(5); // unchanged
  });

  it('returns 404 for an unknown recipeId', async () => {
    const req = makeReq({ body: { recipeId: 'does-not-exist' } });
    const res = makeRes();
    await craftItem(req, res);

    expect(res._status).toBe(404);
    expect(res._body.success).toBe(false);
  });

  it('returns 403 when workshopTier is too low for the recipe', async () => {
    const settings = makeSettings({ workshopTier: 0 }); // event-saddle needs tier 2
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', money: 9999, settings });

    const req = makeReq({ body: { recipeId: 'event-saddle' } });
    const res = makeRes();
    await craftItem(req, res);

    expect(res._status).toBe(403);
    expect(res._body.message).toMatch(/upgrade required/i);
  });

  it('returns 400 when user has insufficient coins', async () => {
    const settings = makeSettings({ workshopTier: 0 });
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', money: 10, settings }); // needs 100

    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);

    expect(res._status).toBe(400);
    expect(res._body.message).toMatch(/insufficient coins/i);
  });

  it('returns 400 when user has insufficient materials', async () => {
    const poorSettings = makeSettings({
      workshopTier: 0,
      craftingMaterials: { leather: 0, cloth: 0, dye: 0, metal: 0, thread: 0 },
    });
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', money: 9999, settings: poorSettings });

    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);

    expect(res._status).toBe(400);
    expect(res._body.message).toMatch(/insufficient materials/i);
  });

  it('returns 404 when user not found', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);

    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);

    expect(res._status).toBe(404);
  });

  it('returns 500 on DB error during craftItem', async () => {
    mockUserFindUnique.mockRejectedValueOnce(new Error('connection lost'));

    const req = makeReq({ body: { recipeId: 'simple-bridle' } });
    const res = makeRes();
    await craftItem(req, res);

    expect(res._status).toBe(500);
  });

  it('crafted item has origin: crafted and craftedAt timestamp', async () => {
    const settings = makeSettings({ workshopTier: 0 });
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', money: 500, settings });
    mockUserUpdate.mockResolvedValueOnce({});

    const req = makeReq({ body: { recipeId: 'basic-halter' } });
    const res = makeRes();
    await craftItem(req, res);

    const item = res._body.data.item;
    expect(item.origin).toBe('crafted');
    expect(typeof item.craftedAt).toBe('string');
    expect(item.equippedToHorseId).toBeNull();
  });
});
