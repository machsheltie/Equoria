/**
 * groomController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getGroomDefinitions, getUserGrooms, hireGroom, getFoalAssignments.
 * Real DB, real auth, real CSRF — no bypass headers.
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

// Valid enum values (from constants/schema.mjs)
const VALID_SPECIALITY = 'foal_care';
const VALID_SKILL = 'novice'; // costModifier=0.7 → hiringCost=Math.round(500*0.7)=350
const VALID_PERSONALITY = 'gentle';

function uniqueEmail(prefix = 'gc') {
  return `${prefix}-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`;
}
function uniqueUsername(prefix = 'gc') {
  return `${prefix}${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
}

describe('groomController integration', () => {
  let user;
  let token;
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        email: uniqueEmail('groomctrl'),
        username: uniqueUsername('groomctrl'),
        password: 'irrelevant-hash',
        firstName: 'Groom',
        lastName: 'Tester',
        money: 5000,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  }, 30000);

  afterEach(async () => {
    // Scoped, fail-loud cleanup (Equoria-1ohys). Grooms (userId-scoped) before
    // the user row. run() drains the queue this cycle and a failed delete fails
    // the suite instead of being swallowed and leaking a fixture into the
    // canonical DB. Runs after the nested horse afterEach (afterEach is
    // inner-first), so the per-test horse is already gone before the user delete.
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'grooms');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
    await cleanup.run();
  }, 30000);

  // ─── GET /api/grooms/definitions ─────────────────────────────────────────

  describe('GET /api/grooms/definitions', () => {
    it('returns 200 with specialties, skillLevels, personalities, defaultGrooms', async () => {
      const res = await request(app)
        .get('/api/v1/grooms/definitions')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('specialties');
      expect(res.body.data).toHaveProperty('skillLevels');
      expect(res.body.data).toHaveProperty('personalities');
      expect(res.body.data).toHaveProperty('defaultGrooms');
    });

    it('returns 401 without an auth token', async () => {
      const res = await request(app).get('/api/v1/grooms/definitions').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/grooms/user/:userId ─────────────────────────────────────────

  describe('GET /api/grooms/user/:userId', () => {
    it('returns 200 with empty grooms for a brand-new user', async () => {
      const res = await request(app)
        .get(`/api/v1/grooms/user/${user.id}`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.grooms)).toBe(true);
      expect(res.body.totalGrooms).toBe(0);
    });

    it("returns 404 when requesting another user's grooms (IDOR protection)", async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: uniqueEmail('groomidor'),
          username: uniqueUsername('groomidor'),
          password: 'hash',
          firstName: 'Other',
          lastName: 'User',
          money: 0,
        },
      });

      const res = await request(app)
        .get(`/api/v1/grooms/user/${otherUser.id}`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);

      // Scoped, fail-loud cleanup (Equoria-1ohys). otherUser owns no horse, so a
      // direct delete is correct here. Placed after the assertion (not in a
      // finally) so a cleanup failure cannot mask a test-body failure. No
      // swallowing .catch.
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/api/v1/grooms/user/${user.id}`).set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/grooms/hire ────────────────────────────────────────────────

  describe('POST /api/grooms/hire', () => {
    it('returns 400 when name is missing', async () => {
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
      const res = await request(app)
        .post('/api/v1/grooms/hire')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ speciality: VALID_SPECIALITY, skill_level: VALID_SKILL, personality: VALID_PERSONALITY });

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid speciality', async () => {
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
      const res = await request(app)
        .post('/api/v1/grooms/hire')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({
          name: 'Alice',
          speciality: 'bad_speciality',
          skill_level: VALID_SKILL,
          personality: VALID_PERSONALITY,
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid skill_level', async () => {
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
      const res = await request(app)
        .post('/api/v1/grooms/hire')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ name: 'Alice', speciality: VALID_SPECIALITY, skill_level: 'god_tier', personality: VALID_PERSONALITY });

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid personality', async () => {
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
      const res = await request(app)
        .post('/api/v1/grooms/hire')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ name: 'Alice', speciality: VALID_SPECIALITY, skill_level: VALID_SKILL, personality: 'grumpy' });

      expect(res.status).toBe(400);
    });

    it('returns 201 and creates a groom when all fields are valid', async () => {
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
      const res = await request(app)
        .post('/api/v1/grooms/hire')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({
          name: 'TestFixture-Alice',
          speciality: VALID_SPECIALITY,
          skill_level: VALID_SKILL,
          personality: VALID_PERSONALITY,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('TestFixture-Alice');
      expect(typeof res.body.data.hiringCost).toBe('number');
    });

    it('returns 400 when user has insufficient funds', async () => {
      await prisma.user.update({ where: { id: user.id }, data: { money: 0 } });

      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
      const res = await request(app)
        .post('/api/v1/grooms/hire')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ name: 'Bob', speciality: VALID_SPECIALITY, skill_level: VALID_SKILL, personality: VALID_PERSONALITY });

      expect(res.status).toBe(400);
      expect(res.body.data).toHaveProperty('requiredFunds');
      expect(res.body.data).toHaveProperty('availableFunds');
    });

    it('returns 401 without auth token', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/v1/grooms/hire')
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({
          name: 'Alice',
          speciality: VALID_SPECIALITY,
          skill_level: VALID_SKILL,
          personality: VALID_PERSONALITY,
        });

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/grooms/assignments/:foalId ──────────────────────────────────

  describe('GET /api/grooms/assignments/:foalId', () => {
    let horseId;
    const horseCleanup = createCleanupTracker();

    beforeEach(async () => {
      const horse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `TestFixture-GroomHorse${Date.now()}`,
          sex: 'Filly',
          dateOfBirth: new Date('2023-01-01'),
          age: 1,
          userId: user.id,
        },
      });
      horseId = horse.id;
    }, 30000);

    afterEach(async () => {
      // Scoped, fail-loud cleanup (Equoria-1ohys). Runs before the outer
      // afterEach (afterEach is inner-first), so the per-test horse is deleted
      // before its owning user — honouring Horse.userId onDelete:Restrict. A
      // failed delete fails the suite instead of being swallowed.
      horseCleanup.add(() => prisma.horse.delete({ where: { id: horseId } }), 'horse');
      await horseCleanup.run();
    }, 30000);

    it('returns 200 with empty assignments for a horse with no groom assigned', async () => {
      const res = await request(app)
        .get(`/api/v1/grooms/assignments/${horseId}`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.foalId).toBe(horseId);
      expect(Array.isArray(res.body.data.assignments)).toBe(true);
      expect(res.body.data.totalAssignments).toBe(0);
    });

    it('returns 400 for non-numeric foalId (express-validator rejects it)', async () => {
      const res = await request(app)
        .get('/api/v1/grooms/assignments/notanumber')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });
});
