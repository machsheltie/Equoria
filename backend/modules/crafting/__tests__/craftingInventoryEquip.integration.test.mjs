/**
 * Crafting + Inventory-Equip beta-critical API — real-DB integration (Equoria-htt6)
 *
 * Both the Leathersmith crafting flow and the inventory equip/unequip path
 * are beta-live but had no co-located real-DB supertest coverage. This file
 * exercises the full HTTP chain against the real test DB with real JWT auth
 * and the real CSRF flow — NO mocks of the primary path, no bypass headers.
 *
 * Coverage:
 *  Crafting
 *   - GET /api/v1/crafting/materials   → seeded stockpile + workshop tier
 *   - GET /api/v1/crafting/recipes     → at least one affordable for a granted account
 *   - POST /api/v1/crafting/craft      → materials + coins decremented and PERSISTED,
 *                                          crafted item appended to inventory; reload
 *                                          (a second GET) reflects the new state
 *   - POST craft error: insufficient materials → 400, NO state mutation
 *  Inventory equip
 *   - POST /api/v1/inventory/equip        → persists to Horse.tack + settings inventory
 *   - POST /api/v1/inventory/unequip      → clears tack + inventory record
 *   - equip error: non-owned horse     → 404, no mutation
 *
 * Real DB. Real prisma. Real HTTP chain via supertest. Real CSRF.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { findRecipe } from '../data/craftingRecipes.mjs';

const FIXTURE_PREFIX = 'TestFixture-craftinv-htt6';
const ORIGIN = 'http://localhost:3000';

// Tier-0 recipe with a clean small footprint. Cost 75, materials { leather: 1 }.
const RECIPE_ID = 'basic-halter';
const RECIPE = findRecipe(RECIPE_ID);

let owner;
let token;
let horse;

// Fail-loud, id-scoped, FK-ordered cleanup (Equoria-0y9f5 pattern). Every
// fixture id is pushed the moment it exists; horses delete before users
// (Horse.userId is ON DELETE RESTRICT since v58ta, so the reverse order
// would P2003 and leak the whole graph).
const cleanup = createCleanupTracker();
const ids = { users: [], horses: [] };

/**
 * Sends a CSRF-protected mutating request and resolves to the response.
 * NOTE: a supertest chain is itself a thenable — `await`ing it fires the
 * request. So we fetch CSRF first, then build + .send() in one expression
 * and return that single promise (no intermediate await of the chain).
 */
async function sendAuthCsrf(method, endpoint, body) {
  const c = await fetchCsrf(app, { origin: ORIGIN });
  const agent = request(app);
  const req = agent[method](endpoint);
  return req
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', c.cookieHeader)
    .set('X-CSRF-Token', c.csrfToken)
    .send(body);
}

beforeAll(async () => {
  // Registration order = run order: horses (RESTRICT children) before users.
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: ids.horses } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: ids.users } } }), 'users');

  const tag = randomBytes(4).toString('hex');

  const created = await createTestUser({
    username: `${FIXTURE_PREFIX}-${tag}`,
    email: `${FIXTURE_PREFIX}-${tag}@example.com`,
    money: 1000,
  });
  owner = created.user;
  token = created.token;
  ids.users.push(owner.id);

  // Grant the account a workshop + a material stockpile that affords the
  // tier-0 recipe with margin, and a pre-seeded inventory item to equip.
  await prisma.user.update({
    where: { id: owner.id },
    data: {
      money: 1000,
      settings: {
        workshopTier: 1,
        craftingMaterials: { leather: 5, cloth: 5, dye: 5, metal: 5, thread: 5 },
        inventory: [
          {
            id: 'inv-seed-saddle',
            itemId: 'english-saddle',
            category: 'saddle',
            name: 'English Saddle',
            bonus: '+2 dressage',
            quantity: 1,
            equippedToHorseId: null,
          },
        ],
      },
    },
  });

  horse = await createTestHorse({
    name: `${FIXTURE_PREFIX}-horse-${tag}`,
    userId: owner.id,
    age: 5,
  });
  ids.horses.push(horse.id);
}, 120000);

// Fail-loud: a failed scoped delete throws here instead of console.warn'ing
// the leak away (the previous cleanupTestData() swallowed delete errors).
afterAll(() => cleanup.run(), 120000);

describe('Crafting API — real-DB integration (Equoria-htt6)', () => {
  it('GET /crafting/materials returns the seeded stockpile and workshop tier', async () => {
    const res = await request(app)
      .get('/api/v1/crafting/materials')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.workshopTier).toBe(1);
    expect(res.body.data.materials).toEqual({
      leather: 5,
      cloth: 5,
      dye: 5,
      metal: 5,
      thread: 5,
    });
  });

  it('GET /crafting/recipes returns at least one affordable recipe for the granted account', async () => {
    const res = await request(app)
      .get('/api/v1/crafting/recipes')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const affordable = res.body.data.recipes.filter(r => r.affordable === true);
    expect(affordable.length).toBeGreaterThan(0);
    // The recipe we will craft must be among the affordable set.
    expect(affordable.some(r => r.id === RECIPE_ID)).toBe(true);
  });

  it('POST /crafting/craft deducts materials + coins, persists crafted item, reload reflects state', async () => {
    const before = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { money: true, settings: true },
    });
    const beforeLeather = before.settings.craftingMaterials.leather;
    const beforeInvLen = before.settings.inventory.length;

    const res = await sendAuthCsrf('post', '/api/v1/crafting/craft', {
      recipeId: RECIPE_ID,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.coinsSpent).toBe(RECIPE.cost);
    expect(res.body.data.newBalance).toBe(before.money - RECIPE.cost);
    expect(res.body.data.item.origin).toBe('crafted');

    // PERSISTED state: re-read straight from the DB (not the response body).
    const after = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { money: true, settings: true },
    });
    expect(after.money).toBe(before.money - RECIPE.cost);
    expect(after.settings.craftingMaterials.leather).toBe(beforeLeather - (RECIPE.materials.leather || 0));
    expect(after.settings.inventory.length).toBe(beforeInvLen + 1);
    const crafted = after.settings.inventory.find(i => i.origin === 'crafted');
    expect(crafted).toBeDefined();
    expect(crafted.itemId).toBe(RECIPE.result);

    // Reload via the HTTP API — materials endpoint must reflect the deduction.
    const reload = await request(app)
      .get('/api/v1/crafting/materials')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN);
    expect(reload.status).toBe(200);
    expect(reload.body.data.materials.leather).toBe(beforeLeather - (RECIPE.materials.leather || 0));
  });

  it('POST /crafting/craft rejects when materials are insufficient and does NOT mutate state', async () => {
    // Drain leather below what the recipe needs.
    const cur = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { money: true, settings: true },
    });
    await prisma.user.update({
      where: { id: owner.id },
      data: {
        settings: { ...cur.settings, craftingMaterials: { ...cur.settings.craftingMaterials, leather: 0 } },
      },
    });
    const pre = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { money: true, settings: true },
    });

    const res = await sendAuthCsrf('post', '/api/v1/crafting/craft', {
      recipeId: RECIPE_ID,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/insufficient materials/i);

    // No coins spent, no inventory growth — the rejection must be atomic.
    const post = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { money: true, settings: true },
    });
    expect(post.money).toBe(pre.money);
    expect(post.settings.inventory.length).toBe(pre.settings.inventory.length);
  });
});

describe('Inventory equip/unequip API — real-DB integration (Equoria-htt6)', () => {
  it('GET /api/v1/inventory lists the seeded item', async () => {
    const res = await request(app)
      .get('/api/v1/inventory')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.some(i => i.id === 'inv-seed-saddle')).toBe(true);
  });

  it('POST /api/v1/inventory/equip persists to Horse.tack and the inventory record', async () => {
    const res = await sendAuthCsrf('post', '/api/v1/inventory/equip', {
      inventoryItemId: 'inv-seed-saddle',
      horseId: horse.id,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Persisted to Horse.tack.
    const horseRow = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { tack: true },
    });
    expect(horseRow.tack.saddle).toBe('english-saddle');

    // Persisted to the inventory record (equippedToHorseId).
    const userRow = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { settings: true },
    });
    const item = userRow.settings.inventory.find(i => i.id === 'inv-seed-saddle');
    expect(item.equippedToHorseId).toBe(horse.id);
  });

  it('POST /api/v1/inventory/unequip clears the tack and the inventory record', async () => {
    const res = await sendAuthCsrf('post', '/api/v1/inventory/unequip', {
      inventoryItemId: 'inv-seed-saddle',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const horseRow = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { tack: true },
    });
    expect(horseRow.tack.saddle).toBeUndefined();

    const userRow = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { settings: true },
    });
    const item = userRow.settings.inventory.find(i => i.id === 'inv-seed-saddle');
    expect(item.equippedToHorseId).toBeNull();
  });

  it('POST /api/v1/inventory/equip on a non-owned horse returns 404 and does not mutate', async () => {
    // A horse owned by a *different* user.
    const otherTag = randomBytes(4).toString('hex');
    const other = await createTestUser({
      username: `${FIXTURE_PREFIX}-other-${otherTag}`,
      email: `${FIXTURE_PREFIX}-other-${otherTag}@example.com`,
    });
    ids.users.push(other.user.id);
    const foreignHorse = await createTestHorse({
      name: `${FIXTURE_PREFIX}-foreign-${otherTag}`,
      userId: other.user.id,
      age: 5,
    });
    ids.horses.push(foreignHorse.id);

    const res = await sendAuthCsrf('post', '/api/v1/inventory/equip', {
      inventoryItemId: 'inv-seed-saddle',
      horseId: foreignHorse.id,
    });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);

    // Foreign horse tack untouched.
    const foreignRow = await prisma.horse.findUnique({
      where: { id: foreignHorse.id },
      select: { tack: true },
    });
    const noSaddle =
      foreignRow.tack === null ||
      foreignRow.tack === undefined ||
      foreignRow.tack.saddle === null ||
      foreignRow.tack.saddle === undefined;
    expect(noSaddle).toBe(true);
  });
});
