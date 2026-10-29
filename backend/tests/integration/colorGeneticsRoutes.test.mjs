/**
 * Color & Genetics Routes Integration Tests (Epic 31E-4, Equoria-5j0z)
 *
 * Real DB. Real middleware. Real Prisma response shape. NO mocks.
 *
 * Covers GET /api/v1/horses/:id/genetics end to end (GET /:id/color and its
 * cases went with the duplicate lookups, owner ruling 2026-10-28, q151,
 * Equoria-a7f1p; the horse page reads the phenotype on GET /horses/:id):
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
import { gameCalendarDate } from '../../utils/gameTime.mjs';

describe('Color & Genetics Routes — HTTP integration (31E-4 / Equoria-5j0z)', () => {
  let __csrf__;
  let testUser;
  let otherUser;
  let testToken;
  let otherToken;
  let horseWithColor;
  let legacyHorse;
  let untestedHorse;
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
        emailVerified: true,
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
        emailVerified: true,
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
    // eslint-disable-next-line equoria/no-raw-test-horse-create -- populated-branch fixture sets an explicit colorGenotype + phenotype on purpose (the route reads these back and the assertions match them exactly); a fixtureColor() spread would override them. No NULL-phenotype risk.
    horseWithColor = await prisma.horse.create({
      data: {
        name: `CGColorHorse_${ts}`,
        sex: 'Mare',
        dateOfBirth: gameCalendarDate(new Date(), -Math.round(4 * 365.25)),
        age: 4,
        userId: testUser.id,
        colorGeneticsTested: true,
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

    // Untested horse: has a genotype but the owner has not paid for the vet's
    // colour genetics test (owner ruling 2026-10-26, q72), so it must stay hidden.
    // eslint-disable-next-line equoria/no-raw-test-horse-create -- gate fixture: explicit genotype + phenotype with colorGeneticsTested left false on purpose.
    untestedHorse = await prisma.horse.create({
      data: {
        name: `CGUntestedHorse_${ts}`,
        sex: 'Mare',
        dateOfBirth: gameCalendarDate(new Date(), -Math.round(4 * 365.25)),
        age: 4,
        userId: testUser.id,
        colorGenotype: { E_Extension: 'E/e', A_Agouti: 'A/A' },
        phenotype: { colorName: 'Bay', shade: 'Standard', faceMarking: 'Star' },
      },
    });
    createdHorseIds.push(untestedHorse.id);

    // Legacy horse (no color data) — exercises the null-data response branch.
    // eslint-disable-next-line equoria/no-raw-test-horse-create -- /genetics gates data:null on colorGenotype IS NULL (horseGeneticsController.getGenetics); this fixture MUST be born with BOTH null to exercise that legacy branch (assertions at lines ~145/201 expect data:null). A fixtureColor() spread would defeat the test. Scoped id-in afterEach cleanup contains the row.
    legacyHorse = await prisma.horse.create({
      data: {
        name: `CGLegacyHorse_${ts}`,
        sex: 'Stallion',
        dateOfBirth: gameCalendarDate(new Date(), -Math.round(5 * 365.25)),
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

    it('ruling q72: an untested horse never has its genotype in the response', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${untestedHorse.id}/genetics`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.colorGeneticsTested).toBe(false);
      expect(res.body.data.horseId).toBe(untestedHorse.id);
      expect(res.body.data).not.toHaveProperty('colorGenotype');
      expect(JSON.stringify(res.body)).not.toContain('E_Extension');
      expect(JSON.stringify(res.body)).not.toContain('E/e');
    });

    it('ruling q72: a paid test (colorGeneticsTested) reveals the genotype', async () => {
      await prisma.horse.update({
        where: { id: untestedHorse.id },
        data: { colorGeneticsTested: true },
      });
      const res = await request(app)
        .get(`/api/v1/horses/${untestedHorse.id}/genetics`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.colorGeneticsTested).toBe(true);
      expect(res.body.data.colorGenotype.E_Extension).toBe('E/e');
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
  });
});
