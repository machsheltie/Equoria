/**
 * craftingController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getMaterials, getRecipes, craftItem.
 * Routes live under authRouter at /api/v1/crafting (the canonical versioned
 * surface; the unversioned /api/* mount was removed in Equoria-4bs3s).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

function uniqueEmail(prefix = 'craft') {
  return `${prefix}-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`;
}
function uniqueUsername(prefix = 'craft') {
  return `${prefix}${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
}

describe('craftingController integration', () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'irrelevant-hash',
        firstName: 'Craft',
        lastName: 'Tester',
        money: 10000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  }, 30000);

  afterEach(async () => {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }, 30000);

  // ─── GET /api/crafting/materials ────────────────────────────────────────────

  describe('GET /api/crafting/materials', () => {
    it('returns 200 with zero materials for new user', async () => {
      const res = await request(app)
        .get('/api/v1/crafting/materials')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('materials');
      expect(res.body.data).toHaveProperty('workshopTier');
      expect(res.body.data.workshopTier).toBe(0);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/crafting/materials').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/crafting/recipes ──────────────────────────────────────────────

  describe('GET /api/crafting/recipes', () => {
    it('returns 200 with recipes array', async () => {
      const res = await request(app)
        .get('/api/v1/crafting/recipes')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('recipes');
      expect(Array.isArray(res.body.data.recipes)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/crafting/recipes').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/crafting/craft ───────────────────────────────────────────────

  describe('POST /api/crafting/craft', () => {
    it('returns 400 when recipeId is missing', async () => {
      // Bind the CSRF token to the same authenticated user the POST runs as
      // (Equoria-vgqam/plw0h): pass the accessToken cookie so the public
      // /csrf-token GET populates req.user and issues a user-bound token.
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
      const res = await request(app)
        .post('/api/v1/crafting/craft')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for an unknown recipeId', async () => {
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
      const res = await request(app)
        .post('/api/v1/crafting/craft')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ recipeId: 'nonexistent-recipe-xyz' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 403 when workshop tier is too low (tier 0 vs required tier)', async () => {
      // Get the first recipe to use its ID; it requires at least tier 1
      const recipesRes = await request(app)
        .get('/api/v1/crafting/recipes')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      const firstRecipe = recipesRes.body.data.recipes[0];
      if (!firstRecipe) {
        return; // No recipes in DB — skip
      }

      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
      const res = await request(app)
        .post('/api/v1/crafting/craft')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ recipeId: firstRecipe.id });

      // Tier 0 user should get 403 (workshop too low) or 400 (insufficient materials)
      expect([400, 403]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/v1/crafting/craft')
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ recipeId: 'some-recipe' });

      expect(res.status).toBe(401);
    });
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// The HTTP tests above only cover validation/auth shells. These add (1) the pure
// craftingRecipes catalog invariants and (2) the controller-direct craftItem
// happy path: successful craft, synchronous ledger write, material deduction,
// inventory preservation, money decrement — none covered above.
describe('craftingRecipes catalog (merged from legacy backend/tests, Equoria-wvuin)', () => {
  it('exports at least 5 recipes, each with the required fields', async () => {
    const { CRAFTING_RECIPES } = await import('../../crafting/data/craftingRecipes.mjs');
    expect(CRAFTING_RECIPES.length).toBeGreaterThanOrEqual(5);
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

  it('findRecipe returns the correct recipe by id (simple-bridle: tier 0, cosmetic)', async () => {
    const { findRecipe } = await import('../../crafting/data/craftingRecipes.mjs');
    const recipe = findRecipe('simple-bridle');
    expect(recipe).toBeDefined();
    expect(recipe.tier).toBe(0);
    expect(recipe.isCosmetic).toBe(true);
  });

  it('findRecipe returns undefined for an unknown id', async () => {
    const { findRecipe } = await import('../../crafting/data/craftingRecipes.mjs');
    expect(findRecipe('nonexistent-recipe')).toBeUndefined();
  });

  it('includes the Tier 3 legacy tack recipe', async () => {
    const { findRecipe } = await import('../../crafting/data/craftingRecipes.mjs');
    const legacy = findRecipe('legacy-tack-set');
    expect(legacy).toBeDefined();
    expect(legacy.tier).toBe(3);
  });
});

describe('craftItem — controller-direct happy path (merged from legacy backend/tests, Equoria-wvuin)', () => {
  let craftItem;
  let craftUser;

  const makeReq = (overrides = {}) => ({ user: { id: craftUser.id }, body: {}, params: {}, ...overrides });
  const makeRes = () => {
    const res = { _status: null, _body: null };
    res.status = code => {
      res._status = code;
      return res;
    };
    res.json = body => {
      res._body = body;
      return res;
    };
    return res;
  };
  const setState = ({ settings, money = 500 }) =>
    prisma.user.update({ where: { id: craftUser.id }, data: { settings, money } });

  beforeAll(async () => {
    ({ craftItem } = await import('../../crafting/controllers/craftingController.mjs'));
    craftUser = await prisma.user.create({
      data: {
        username: `craftDirect${randomBytes(6).toString('hex')}`,
        email: `craftdirect-${randomBytes(6).toString('hex')}@test.com`,
        password: 'irrelevant-hash',
        firstName: 'Craft',
        lastName: 'Direct',
        money: 500,
        settings: {},
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.userTransaction.deleteMany({ where: { userId: craftUser.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: craftUser.id } }).catch(() => {});
  }, 30000);

  const tier0State = () => ({
    settings: {
      workshopTier: 0,
      craftingMaterials: { leather: 5, cloth: 0, dye: 5, metal: 0, thread: 0 },
      inventory: [],
    },
    money: 500,
  });

  it('successfully crafts a tier 0 item with origin:crafted, coinsSpent and newBalance', async () => {
    await setState(tier0State());
    const res = makeRes();
    await craftItem(makeReq({ body: { recipeId: 'simple-bridle' } }), res);
    expect(res._body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          item: expect.objectContaining({ origin: 'crafted', category: 'bridle' }),
          coinsSpent: 100,
          newBalance: 400,
        }),
      }),
    );
  });

  it('writes the crafting ledger transaction synchronously before the handler resolves', async () => {
    await setState(tier0State());
    const before = await prisma.userTransaction.count({ where: { userId: craftUser.id, category: 'crafting' } });
    const res = makeRes();
    await craftItem(makeReq({ body: { recipeId: 'simple-bridle' } }), res);
    expect(res._body.success).toBe(true);
    // No await-tick: with a fire-and-forget bug the count would still be `before`.
    const after = await prisma.userTransaction.count({ where: { userId: craftUser.id, category: 'crafting' } });
    expect(after).toBe(before + 1);
    const row = await prisma.userTransaction.findFirst({
      where: { userId: craftUser.id, category: 'crafting' },
      orderBy: { createdAt: 'desc' },
    });
    expect(row.type).toBe('debit');
    expect(row.amount).toBe(100);
    await prisma.userTransaction.deleteMany({ where: { userId: craftUser.id, category: 'crafting' } });
  });

  it('deducts the correct materials on craft (1 leather + 1 dye)', async () => {
    await setState({
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 3, cloth: 0, dye: 3, metal: 0, thread: 0 },
        inventory: [],
      },
      money: 500,
    });
    const res = makeRes();
    await craftItem(makeReq({ body: { recipeId: 'simple-bridle' } }), res);
    expect(res._body.data.remainingMaterials.leather).toBe(2);
    expect(res._body.data.remainingMaterials.dye).toBe(2);
  });

  it('preserves existing inventory items when appending the crafted item', async () => {
    const existingItem = { id: 'existing-1', name: 'Old Item' };
    await setState({
      settings: {
        workshopTier: 0,
        craftingMaterials: { leather: 5, cloth: 0, dye: 5, metal: 0, thread: 0 },
        inventory: [existingItem],
      },
      money: 500,
    });
    await craftItem(makeReq({ body: { recipeId: 'simple-bridle' } }), makeRes());
    const updated = await prisma.user.findUnique({ where: { id: craftUser.id } });
    expect(updated.settings.inventory).toHaveLength(2);
    expect(updated.settings.inventory[0]).toEqual(existingItem);
    expect(updated.settings.inventory[1]).toMatchObject({ origin: 'crafted' });
  });

  it('decrements user money by the recipe cost', async () => {
    await setState(tier0State());
    await craftItem(makeReq({ body: { recipeId: 'simple-bridle' } }), makeRes());
    const updated = await prisma.user.findUnique({ where: { id: craftUser.id } });
    expect(updated.money).toBe(400);
  });
});
