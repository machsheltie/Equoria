/**
 * backfillCraftingMaterials.integration.test.mjs
 *
 * Equoria-msuh — Backfill craftingMaterials for pre-fix existing beta accounts.
 *
 * Bug: accounts created BEFORE the starter-material grant landed have no
 * settings.craftingMaterials. getMaterials() defaults to all-zero so NO
 * Tier 0 recipe is affordable for those existing beta testers, even though
 * crafting is beta-live and must work for real testers.
 *
 * Fix: an idempotent, scoped backfill that grants STARTER_CRAFTING_MATERIALS
 * to any account whose settings.craftingMaterials is absent — without
 * touching accounts that already have it (no double-grant) and without
 * disturbing any other settings keys.
 *
 * AC verification: simulate a pre-fix account (settings WITHOUT
 * craftingMaterials), run the backfill, confirm GET /api/v1/crafting/recipes
 * returns >=1 affordable recipe AND the backfill is idempotent (second run
 * is a no-op for that account).
 *
 * NO MOCKS — real app, real Prisma, real auth + CSRF flow, real DB.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../db/index.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import {
  backfillCraftingMaterials,
  STARTER_CRAFTING_MATERIALS,
} from '../../../scripts/backfill-crafting-materials.mjs';

const ORIGIN = 'http://localhost:3000';

function uniq(prefix) {
  return `${prefix}${randomBytes(6).toString('hex')}`;
}

describe('INTEGRATION: backfill craftingMaterials for pre-fix accounts (Equoria-msuh)', () => {
  const createdUserIds = [];

  afterAll(async () => {
    if (createdUserIds.length) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
  }, 60000);

  async function registerAndLogin() {
    const { csrfToken, cookieHeader } = await fetchCsrf(app, { origin: ORIGIN });
    const username = uniq('msuh');
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
        firstName: 'Msuh',
        lastName: 'Tester',
        dateOfBirth: '1990-01-01', // Equoria-iqzn: COPPA age gate (adult DOB)
      });
    expect(res.status).toBe(201);
    const userId = res.body?.data?.user?.id;
    createdUserIds.push(userId);
    return { userId, setCookies: res.headers['set-cookie'] || [] };
  }

  async function affordableRecipeCount(setCookies) {
    const res = await request(app).get('/api/v1/crafting/recipes').set('Origin', ORIGIN).set('Cookie', setCookies);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    return res.body.data.recipes.filter(r => r.affordable === true).length;
  }

  it('pre-fix account (no craftingMaterials) has 0 affordable recipes BEFORE backfill, >=1 AFTER', async () => {
    const { userId, setCookies } = await registerAndLogin();

    // Simulate a pre-fix account: strip craftingMaterials but keep other
    // settings keys (inventory, completedOnboarding) intact.
    const fresh = await prisma.user.findUnique({ where: { id: userId } });
    const stripped = { ...fresh.settings };
    delete stripped.craftingMaterials;
    await prisma.user.update({ where: { id: userId }, data: { settings: stripped } });

    const before = await affordableRecipeCount(setCookies);
    expect(before).toBe(0); // no materials → nothing affordable

    // Run the real backfill (scoped to this user via the filter).
    const result = await backfillCraftingMaterials({ userIds: [userId] });
    expect(result.granted).toBe(1);

    const after = await affordableRecipeCount(setCookies);
    expect(after).toBeGreaterThanOrEqual(1);

    // Granted materials are exactly the server starter, not zeros.
    const updated = await prisma.user.findUnique({ where: { id: userId } });
    expect(updated.settings.craftingMaterials).toEqual(STARTER_CRAFTING_MATERIALS);
    // Other settings keys preserved.
    expect(Array.isArray(updated.settings.inventory)).toBe(true);
    expect(updated.settings.completedOnboarding).toBe(false);
  }, 90000);

  it('idempotent: a second backfill run does NOT re-grant (no double-grant)', async () => {
    const { userId } = await registerAndLogin();

    const fresh = await prisma.user.findUnique({ where: { id: userId } });
    const stripped = { ...fresh.settings };
    delete stripped.craftingMaterials;
    await prisma.user.update({ where: { id: userId }, data: { settings: stripped } });

    const first = await backfillCraftingMaterials({ userIds: [userId] });
    expect(first.granted).toBe(1);

    // Tamper-spend the materials to detect any re-grant on the second run.
    const afterFirst = await prisma.user.findUnique({ where: { id: userId } });
    const spent = { ...afterFirst.settings, craftingMaterials: { leather: 0, cloth: 0, dye: 0, metal: 0, thread: 0 } };
    await prisma.user.update({ where: { id: userId }, data: { settings: spent } });

    const second = await backfillCraftingMaterials({ userIds: [userId] });
    expect(second.granted).toBe(0); // already has the key → skipped

    const finalUser = await prisma.user.findUnique({ where: { id: userId } });
    // Spent materials NOT topped back up — confirms no double-grant.
    expect(finalUser.settings.craftingMaterials).toEqual({
      leather: 0,
      cloth: 0,
      dye: 0,
      metal: 0,
      thread: 0,
    });
  }, 90000);

  it('post-fix account (already has craftingMaterials) is left untouched', async () => {
    const { userId } = await registerAndLogin();
    const before = await prisma.user.findUnique({ where: { id: userId } });
    expect(before.settings.craftingMaterials).toEqual(STARTER_CRAFTING_MATERIALS);

    const result = await backfillCraftingMaterials({ userIds: [userId] });
    expect(result.granted).toBe(0);

    const after = await prisma.user.findUnique({ where: { id: userId } });
    expect(after.settings.craftingMaterials).toEqual(STARTER_CRAFTING_MATERIALS);
  }, 90000);
});
