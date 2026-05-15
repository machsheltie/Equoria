/**
 * Color & Genetics Routes Integration Tests (Epic 31E-4, Equoria-5j0z)
 *
 * Real DB. Real middleware. Real Prisma response shape. NO mocks.
 *
 * Covers GET /api/v1/horses/:id/genetics and GET /api/v1/horses/:id/color
 * end to end:
 *   - 200 with full payload (owner, real Prisma colorGenotype/phenotype)
 *   - 200 with data:null for legacy horses (genotype/phenotype IS NULL)
 *   - 401 (no auth token)
 *   - 403 / 404 (cross-user — must NOT leak existence)
 *   - 404 (horse doesn't exist)
 *   - JSONB type guard against the real Prisma response object shape
 *   - Route-ordering sanity: /:id/genetics is not swallowed by /:id catch-all
 */

import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';
import { fetchCsrf } from '../helpers/csrfHelper.mjs';

describe('Color & Genetics Routes — HTTP integration (31E-4 / Equoria-5j0z)', () => {
  let __csrf__;
  let testUser;
  let otherUser;
  let testToken;
  let otherToken;
  let horseWithColor;
  let legacyHorse;
  const createdHorseIds = [];
  const createdUserIds = [];

  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  beforeEach(async () => {
    const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;

    // Two users so we can exercise the cross-user (not-owned) path.
    testUser = await prisma.user.create({
      data: {
        username: `cg_user_${ts}`,
        email: `cg_user_${ts}@test.com`,
        password: 'pwhash',
        firstName: 'CG',
        lastName: 'Owner',
      },
    });
    createdUserIds.push(testUser.id);

    otherUser = await prisma.user.create({
      data: {
        username: `cg_other_${ts}`,
        email: `cg_other_${ts}@test.com`,
        password: 'pwhash',
        firstName: 'CG',
        lastName: 'Stranger',
      },
    });
    createdUserIds.push(otherUser.id);

    testToken = generateTestToken(testUser);
    otherToken = generateTestToken(otherUser);

    // Horse with full color data — exercises the populated branch.
    horseWithColor = await prisma.horse.create({
      data: {
        name: `CGColorHorse_${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 4 * 365.25 * 24 * 60 * 60 * 1000),
        age: 4,
        userId: testUser.id,
        colorGenotype: {
          E_Extension: 'e/e',
          A_Agouti: 'A/a',
          Cr_Cream: 'n/n',
          D_Dun: 'nd2/nd2',
          G_Gray: 'g/g',
        },
        phenotype: {
          colorName: 'Chestnut',
          shade: 'Standard',
          faceMarking: 'Star',
          legMarkings: { frontLeft: 'Sock', frontRight: 'None' },
          modifiers: { isSooty: true },
        },
      },
    });
    createdHorseIds.push(horseWithColor.id);

    // Legacy horse (no color data) — exercises the null-data response branch.
    legacyHorse = await prisma.horse.create({
      data: {
        name: `CGLegacyHorse_${ts}`,
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000),
        age: 5,
        userId: testUser.id,
        // intentionally no colorGenotype / phenotype
      },
    });
    createdHorseIds.push(legacyHorse.id);
  });

  afterEach(async () => {
    if (createdHorseIds.length) {
      await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds.splice(0) } } });
    }
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds.splice(0) } } });
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // GET /:id/genetics
  // ────────────────────────────────────────────────────────────────────────

  describe('GET /api/v1/horses/:id/genetics', () => {
    it('AC: 200 with full genotype + phenotype for owner with real Prisma data', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${horseWithColor.id}/genetics`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeTruthy();
      expect(res.body.data.horseId).toBe(horseWithColor.id);
      // JSONB type guard: colorGenotype must be a real object, not stringified.
      expect(typeof res.body.data.colorGenotype).toBe('object');
      expect(Array.isArray(res.body.data.colorGenotype)).toBe(false);
      expect(res.body.data.colorGenotype.E_Extension).toBe('e/e');
      expect(res.body.data.phenotype.colorName).toBe('Chestnut');
    });

    it('AC: 200 with data:null for legacy horse (no genotype)', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${legacyHorse.id}/genetics`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
      expect(res.body.message).toMatch(/no genetics data/i);
    });

    it('AC: 401 with no auth token', async () => {
      const res = await request(app).get(`/api/v1/horses/${horseWithColor.id}/genetics`);
      expect(res.status).toBe(401);
    });

    it('AC: cross-user request returns 403/404 (not 200)', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${horseWithColor.id}/genetics`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect([403, 404]).toContain(res.status);
      // Must NOT leak the horse's genetics payload.
      expect(res.body.data).toBeFalsy();
    });

    it('AC: 404 when horse does not exist', async () => {
      const res = await request(app)
        .get('/api/v1/horses/999999999/genetics')
        .set('Authorization', `Bearer ${testToken}`);

      expect([403, 404]).toContain(res.status);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // GET /:id/color
  // ────────────────────────────────────────────────────────────────────────

  describe('GET /api/v1/horses/:id/color', () => {
    it('AC: 200 with full color payload for owner', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${horseWithColor.id}/color`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeTruthy();
      expect(res.body.data.colorName).toBe('Chestnut');
      expect(res.body.data.shade).toBe('Standard');
      expect(res.body.data.faceMarking).toBe('Star');
      expect(res.body.data.modifiers.isSooty).toBe(true);
      // Color endpoint must NOT leak genotype (player-safe shape).
      expect(res.body.data.colorGenotype).toBeUndefined();
    });

    it('AC: 200 with data:null for legacy horse (no phenotype)', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${legacyHorse.id}/color`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
    });

    it('AC: 401 with no auth token', async () => {
      const res = await request(app).get(`/api/v1/horses/${horseWithColor.id}/color`);
      expect(res.status).toBe(401);
    });

    it('AC: cross-user request returns 403/404 without leaking color data', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${horseWithColor.id}/color`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect([403, 404]).toContain(res.status);
      expect(res.body.data).toBeFalsy();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Route-ordering sanity (the 31E-4 dev-notes fix)
  // ────────────────────────────────────────────────────────────────────────

  describe('route ordering — /:id/genetics is NOT swallowed by /:id catch-all', () => {
    it('GET /:id/genetics returns the genetics shape, not the full horse object', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${horseWithColor.id}/genetics`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      // The genetics handler's data shape has horseId + colorGenotype keys.
      // The /:id catch-all would return a full horse with conformationScores,
      // gaitScores, etc. — none of which appear on the genetics payload.
      expect(res.body.data).toHaveProperty('colorGenotype');
      expect(res.body.data).not.toHaveProperty('conformationScores');
      expect(res.body.data).not.toHaveProperty('gaitScores');
    });

    it('GET /:id/color returns the color shape, not the full horse object', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${horseWithColor.id}/color`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('colorName');
      expect(res.body.data).not.toHaveProperty('conformationScores');
      expect(res.body.data).not.toHaveProperty('breedId');
    });
  });
});
