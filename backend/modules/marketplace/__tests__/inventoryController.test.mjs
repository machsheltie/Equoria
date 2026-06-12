/**
 * inventoryController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getInventory, equipItem, unequipItem.
 * All inventory routes live under authRouter → real auth + real CSRF for POSTs.
 *
 * Path contract: the unversioned /api/* mounts were removed (Equoria-4bs3s);
 * /api/v1/* is the only surface, so every request below targets /api/v1/.
 *
 * CSRF binding: per-user CSRF binding (Equoria-plw0h,
 * backend/middleware/csrf.mjs) derives the sessionIdentifier as req.user.id
 * when the request is authenticated. The authRouter mounts authenticateToken
 * BEFORE csrfProtection (backend/app/routers.mjs), so by the time
 * csrfProtection runs on a Bearer-authenticated mutation, req.user.id is
 * populated and the CSRF token MUST have been issued under that same user id.
 * An anonymous token (bound to the CSRF_SESSION_SALT fallback) correctly
 * 403s — that is the middleware doing its job — so every authenticated
 * mutation below fetches its CSRF token bound to the acting identity by
 * forwarding that identity's accessToken cookie to GET /auth/csrf-token
 * (fetchCsrf's extraCookies option → tryPopulateUserFromAccessCookie binds
 * issuance to the decoded user id).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

/**
 * Fetch a CSRF token bound to a specific authenticated identity.
 * Forwards the identity's JWT as an accessToken cookie on the token GET so
 * csrf.mjs#tryPopulateUserFromAccessCookie resolves the issuance
 * sessionIdentifier to that user's id — matching what authenticateToken →
 * csrfProtection will resolve on the subsequent mutation (Equoria-plw0h).
 */
const fetchCsrfFor = jwt => fetchCsrf(app, { extraCookies: [`accessToken=${jwt}`] });

function uniqueEmail(prefix = 'inv') {
  return `${prefix}-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`;
}
function uniqueUsername(prefix = 'inv') {
  return `${prefix}${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
}

// A valid inventory item that can be seeded directly into User.settings
const SEED_ITEM = {
  id: 'test-inv-saddle-1',
  itemId: 'all-purpose-saddle',
  category: 'saddle',
  name: 'All-Purpose Saddle',
  bonus: 5,
  quantity: 1,
  equippedToHorseId: null,
};

describe('inventoryController integration', () => {
  let user;
  let token;
  // Per-test horse ids so afterEach deletes EXACTLY this suite's fixtures
  // (Equoria-9jv9c) — replaces the prior broad `name startsWith` deleteMany,
  // which would also delete a parallel worker's TestFixture-InvHorse rows.
  let createdHorseIds = [];
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    createdHorseIds = [];
    user = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'irrelevant-hash',
        firstName: 'Inv',
        lastName: 'Tester',
        money: 5000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    // Scoped, fail-loud cleanup (Equoria-9jv9c): horses (FK) before owner.
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  // ─── GET /api/inventory ───────────────────────────────────────────────────

  describe('GET /api/inventory', () => {
    it('returns 200 with empty items for a new user', async () => {
      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.total).toBe(0);
    });

    it('returns 200 with seeded inventory items', async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: { settings: { inventory: [SEED_ITEM] } },
      });

      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.items[0].id).toBe(SEED_ITEM.id);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/v1/inventory').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/inventory/equip ────────────────────────────────────────────

  describe('POST /api/inventory/equip', () => {
    it('returns 400 when inventoryItemId is missing', async () => {
      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/inventory/equip')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ horseId: 1 });

      expect(res.status).toBe(400);
    });

    it('returns 400 when horseId is missing', async () => {
      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/inventory/equip')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ inventoryItemId: 'test-inv-saddle-1' });

      expect(res.status).toBe(400);
    });

    it('returns 404 when inventoryItemId does not exist in user inventory', async () => {
      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/inventory/equip')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ inventoryItemId: 'nonexistent-item', horseId: 1 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 and equips item to horse when both exist', async () => {
      // Seed inventory item
      await prisma.user.update({
        where: { id: user.id },
        data: { settings: { inventory: [SEED_ITEM] } },
      });

      // Create horse owned by user; tracked for scoped afterEach cleanup.
      const horse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `TestFixture-InvHorse-${Date.now()}`,
          sex: 'Filly',
          dateOfBirth: new Date('2022-01-01'),
          age: 3,
          userId: user.id,
        },
      });
      createdHorseIds.push(horse.id);

      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/inventory/equip')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ inventoryItemId: SEED_ITEM.id, horseId: horse.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      // The equipped item should now point to this horse
      const equipped = res.body.data.equippedItem;
      expect(equipped.equippedToHorseId).toBe(horse.id);
    });

    it('returns 401 without auth token', async () => {
      // No CSRF pair needed: the authRouter mounts authenticateToken BEFORE
      // csrfProtection (backend/app/routers.mjs), so a credential-less request
      // is 401'd by authenticateToken before CSRF validation ever runs.
      const res = await request(app)
        .post('/api/v1/inventory/equip')
        .set('Origin', ORIGIN)
        .send({ inventoryItemId: 'test-inv-saddle-1', horseId: 1 });

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/inventory/unequip ──────────────────────────────────────────

  describe('POST /api/inventory/unequip', () => {
    it('returns 400 when inventoryItemId is missing', async () => {
      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/inventory/unequip')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 404 when inventoryItemId does not exist in user inventory', async () => {
      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/inventory/unequip')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ inventoryItemId: 'nonexistent-item' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when item exists but is not equipped', async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: { settings: { inventory: [SEED_ITEM] } },
      });

      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/inventory/unequip')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ inventoryItemId: SEED_ITEM.id });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not currently equipped/i);
    });

    it('returns 200 and unequips item when it was equipped', async () => {
      const horse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `TestFixture-InvHorse-${Date.now()}`,
          sex: 'Filly',
          dateOfBirth: new Date('2022-01-01'),
          age: 3,
          userId: user.id,
          tack: { saddle: 'all-purpose-saddle' },
        },
      });
      createdHorseIds.push(horse.id);

      // Seed inventory with item already equipped to this horse
      const equippedItem = { ...SEED_ITEM, equippedToHorseId: horse.id };
      await prisma.user.update({
        where: { id: user.id },
        data: { settings: { inventory: [equippedItem] } },
      });

      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/inventory/unequip')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ inventoryItemId: SEED_ITEM.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.unequippedItem.equippedToHorseId).toBeNull();
    });

    it('returns 401 without auth token', async () => {
      // No CSRF pair needed: authenticateToken runs before csrfProtection on
      // the authRouter, so a credential-less request is 401'd first.
      const res = await request(app)
        .post('/api/v1/inventory/unequip')
        .set('Origin', ORIGIN)
        .send({ inventoryItemId: 'test-inv-saddle-1' });

      expect(res.status).toBe(401);
    });
  });
});
