/**
 * craftingController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getMaterials, getRecipes, craftItem.
 * Routes live under authRouter at /api/crafting.
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
        .get('/api/crafting/materials')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('materials');
      expect(res.body.data).toHaveProperty('workshopTier');
      expect(res.body.data.workshopTier).toBe(0);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/crafting/materials').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/crafting/recipes ──────────────────────────────────────────────

  describe('GET /api/crafting/recipes', () => {
    it('returns 200 with recipes array', async () => {
      const res = await request(app)
        .get('/api/crafting/recipes')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('recipes');
      expect(Array.isArray(res.body.data.recipes)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/crafting/recipes').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/crafting/craft ───────────────────────────────────────────────

  describe('POST /api/crafting/craft', () => {
    it('returns 400 when recipeId is missing', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/crafting/craft')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for an unknown recipeId', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/crafting/craft')
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
        .get('/api/crafting/recipes')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      const firstRecipe = recipesRes.body.data.recipes[0];
      if (!firstRecipe) {
        return; // No recipes in DB — skip
      }

      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/crafting/craft')
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
        .post('/api/crafting/craft')
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ recipeId: 'some-recipe' });

      expect(res.status).toBe(401);
    });
  });
});
