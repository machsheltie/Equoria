/**
 * registerCraftingStarterWithSettings.integration.test.mjs
 *
 * Equoria-aazk — Crafting starter materials skipped when registration body
 * includes a settings object.
 *
 * Bug: authController.register seeded craftingMaterials ONLY in the
 * `settings || { ... }` default branch. If a registration request supplied
 * ANY settings object, the entire starter grant (including
 * craftingMaterials) was silently skipped, leaving the new account unable
 * to afford any Tier 0 crafting recipe.
 *
 * AC: Starter craftingMaterials are merged into new-user settings regardless
 * of whether the registration request includes a settings body. Sentinel:
 * register WITH an explicit settings object and assert >=1 Tier 0 recipe is
 * affordable via GET /api/v1/crafting/recipes. Default-registration
 * behavior unchanged.
 *
 * NO MOCKS — real app, real Prisma, real auth + CSRF flow.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../db/index.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

function uniq(prefix) {
  return `${prefix}${randomBytes(6).toString('hex')}`;
}

describe('INTEGRATION: register with explicit settings still seeds crafting starter (Equoria-aazk)', () => {
  const createdUserIds = [];

  afterAll(async () => {
    if (createdUserIds.length) {
      // Scoped cleanup — only the users this suite created.
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
  }, 60000);

  async function registerWith(settingsBody) {
    const { csrfToken, cookieHeader } = await fetchCsrf(app, { origin: ORIGIN });
    const username = uniq('aazk');
    const email = `${username}@test.com`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieHeader)
      .set('X-CSRF-Token', csrfToken)
      .send({
        username,
        email,
        password: 'StrongP@ssw0rd!23',
        firstName: 'Aazk',
        lastName: 'Tester',
        ...(settingsBody !== undefined ? { settings: settingsBody } : {}),
      });
    expect(res.status).toBe(201);
    if (res.body?.data?.user?.id) {
      createdUserIds.push(res.body.data.user.id);
    }
    // accessToken is set as an httpOnly cookie — forward it to the next call.
    const setCookies = res.headers['set-cookie'] || [];
    return { setCookies, userId: res.body?.data?.user?.id };
  }

  async function affordableRecipeCount(setCookies) {
    const res = await request(app).get('/api/v1/crafting/recipes').set('Origin', ORIGIN).set('Cookie', setCookies);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const recipes = res.body.data.recipes;
    expect(Array.isArray(recipes)).toBe(true);
    return recipes.filter(r => r.affordable === true).length;
  }

  it('register WITH an explicit settings object → still has >=1 affordable recipe', async () => {
    // This is the failing case before the fix: providing any settings object
    // skipped the starter craftingMaterials grant entirely.
    const { setCookies } = await registerWith({ theme: 'dark', soundEnabled: true });
    const count = await affordableRecipeCount(setCookies);
    expect(count).toBeGreaterThanOrEqual(1);
  }, 60000);

  it('register WITH an empty settings object → still has >=1 affordable recipe', async () => {
    const { setCookies } = await registerWith({});
    const count = await affordableRecipeCount(setCookies);
    expect(count).toBeGreaterThanOrEqual(1);
  }, 60000);

  it('default registration (no settings) behavior unchanged → >=1 affordable recipe', async () => {
    const { setCookies } = await registerWith(undefined);
    const count = await affordableRecipeCount(setCookies);
    expect(count).toBeGreaterThanOrEqual(1);
  }, 60000);

  it('starter settings are server-authoritative: a client settings body cannot skip or tamper the grant', async () => {
    // A client attempting to self-seed economy fields or skip onboarding must
    // not be honored at registration. The starter grant is unconditional and
    // server-owned (Equoria-aazk).
    const { userId } = await registerWith({
      theme: 'dark',
      completedOnboarding: true, // attempt to skip onboarding — must be ignored
      craftingMaterials: { leather: 9999 }, // economy-tamper attempt — must be ignored
      workshopTier: 3, // economy-tamper attempt — must be ignored
    });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const s = user.settings;
    // Onboarding flag is server-controlled (false for new account)
    expect(s.completedOnboarding).toBe(false);
    // craftingMaterials are exactly the server starter, not the client's 9999
    expect(s.craftingMaterials).toEqual({ leather: 2, cloth: 2, dye: 2, metal: 0, thread: 1 });
    // workshopTier not seeded from client (stays unset → controller defaults to 0)
    expect(s.workshopTier).toBeUndefined();
    // Starter inventory still seeded
    expect(Array.isArray(s.inventory)).toBe(true);
    expect(s.inventory.length).toBe(2);
    // Arbitrary client key not persisted
    expect(s.theme).toBeUndefined();
  }, 60000);
});
