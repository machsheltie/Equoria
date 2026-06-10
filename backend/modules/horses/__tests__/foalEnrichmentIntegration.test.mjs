/**
 * Integration Test: Foal Enrichment API — Real Database
 *
 * Tests the POST /api/v1/foals/:foalId/enrich(ment) endpoint with real database
 * operations. No mocks — validates request handling, the derived-day contract
 * (Equoria-g89vy: the enrichment day is derived server-side from the foal's
 * dateOfBirth, NOT supplied by the client), database writes, and response
 * formatting against the real enrichment system.
 *
 * Behaviors covered here (complementary to foalEnrichmentDerivedDay.integration
 * .test.mjs, which owns derive/window/dedup/ignore-client-day specifics):
 * - Success response shape (foal, activity, updatedLevels, changes, recordId)
 * - Bond/stress persistence: DB values match the response
 * - foal_training_history record creation with correct fields
 * - Bond/stress bounds (0-100) capping
 * - Activity name-format flexibility (snake_case / Title Case / UPPERCASE)
 * - 404 for missing foal, 401 without auth
 *
 * Each test uses an age-matched foal so the derived day is deterministic, and
 * distinct activities so the per-day anti-farming dedup is not tripped.
 * Scoped cleanup only (CLAUDE.md §2).
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import bcrypt from 'bcryptjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-n7qa3: fail-loud scoped cleanup — a swallowed cleanup delete leaks
// fixtures into the canonical DB and trips downstream sentinels (CLAUDE.md §2).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const app = (await import('../../../app.mjs')).default;

const MS_PER_DAY = 1000 * 60 * 60 * 24;
function dobDaysAgo(days) {
  const d = new Date(Date.now() - days * MS_PER_DAY);
  d.setUTCHours(4, 0, 0, 0);
  return d;
}

describe('INTEGRATION: Foal Enrichment API — Real Database', () => {
  let __csrf__;
  const cleanup = createCleanupTracker();
  let testUser;
  let authToken;
  const createdFoalIds = [];
  const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('TestPassword123!', 1);
    testUser = await prisma.user.create({
      data: {
        username: `enrichment_user_${ts}`,
        email: `enrichment_${ts}@example.com`,
        password: hashedPassword,
        firstName: 'Enrichment',
        lastName: 'Tester',
      },
    });
    authToken = generateTestToken({ id: testUser.id, role: 'user' });

    // Per-user CSRF (Equoria-plw0h): mint AFTER authToken exists and bind it to
    // the same user the mutations authenticate as (Authorization: Bearer
    // authToken). Without the accessToken cookie the /csrf-token GET would
    // resolve the fallback identifier and csrfProtection would 403 the
    // authenticated POSTs on the session-identifier mismatch.
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });

    // FK-order scoped cleanup (Equoria-n7qa3). Foals are owned by testUser and
    // Horse.userId is onDelete:Restrict (schema:282), so foal horse rows must
    // be deleted BEFORE the user. Tasks read the live createdFoalIds at run()
    // time; fail-loud so a real leak reds afterAll instead of being swallowed.
    cleanup.add(
      () => prisma.foalTrainingHistory.deleteMany({ where: { horseId: { in: createdFoalIds } } }),
      'foalTrainingHistory',
    );
    cleanup.add(
      () => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: createdFoalIds } } }),
      'foalDevelopment',
    );
    cleanup.add(() => prisma.foalActivity.deleteMany({ where: { foalId: { in: createdFoalIds } } }), 'foalActivity');
    cleanup.add(
      () => prisma.groomAssignment.deleteMany({ where: { foalId: { in: createdFoalIds } } }),
      'groomAssignment',
    );
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdFoalIds } } }), 'foalHorses');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: testUser.id } }), 'groom(user)');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: testUser.id } }), 'user');
  }, 120000);

  afterAll(() => cleanup.run(), 120000);

  async function makeFoal(ageDays, overrides = {}) {
    const foal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-Enrichment-${ageDays}d-${randomBytes(4).toString('hex')}`,
        sex: 'Filly',
        dateOfBirth: dobDaysAgo(ageDays),
        age: Math.floor(ageDays / 7),
        userId: testUser.id,
        bondScore: 50,
        stressLevel: 20,
        ...overrides,
      },
    });
    createdFoalIds.push(foal.id);
    return foal;
  }

  function post(foalId, body) {
    return request(app)
      .post(`/api/v1/foals/${foalId}/enrich`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send(body);
  }

  describe('POST /api/v1/foals/:foalId/enrich', () => {
    it('completes an enrichment activity successfully (day derived from age)', async () => {
      const foal = await makeFoal(3); // derived day 3
      const response = await post(foal.id, { activity: 'Trailer Exposure' }).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Trailer Exposure');
      expect(response.body.data).toHaveProperty('foal');
      expect(response.body.data).toHaveProperty('activity');
      expect(response.body.data).toHaveProperty('updatedLevels');
      expect(response.body.data).toHaveProperty('changes');
      expect(response.body.data).toHaveProperty('trainingRecordId');

      expect(response.body.data.foal.id).toBe(foal.id);
      expect(response.body.data.foal.name).toBe(foal.name);

      expect(response.body.data.activity.name).toBe('Trailer Exposure');
      expect(response.body.data.activity.day).toBe(3);
      expect(response.body.data.activity.outcome).toMatch(/success|excellent|challenging/);

      expect(response.body.data.updatedLevels.bondScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.updatedLevels.bondScore).toBeLessThanOrEqual(100);
      expect(response.body.data.updatedLevels.stressLevel).toBeGreaterThanOrEqual(0);
      expect(response.body.data.updatedLevels.stressLevel).toBeLessThanOrEqual(100);

      expect(response.body.data.changes).toHaveProperty('bondChange');
      expect(response.body.data.changes).toHaveProperty('stressChange');
    });

    it('persists bondScore and stressLevel in the real database', async () => {
      const foal = await makeFoal(3);
      const response = await post(foal.id, { activity: 'Halter Introduction' }).expect(200);

      const after = await prisma.horse.findUnique({
        where: { id: foal.id },
        select: { bondScore: true, stressLevel: true },
      });

      expect(after.bondScore).toBe(response.body.data.updatedLevels.bondScore);
      expect(after.stressLevel).toBe(response.body.data.updatedLevels.stressLevel);
    });

    it('rejects an empty activity', async () => {
      const foal = await makeFoal(3);
      await post(foal.id, { activity: '' }).expect(400);
    });

    it('returns 404 for a non-existent foal', async () => {
      const response = await post(99999, { activity: 'gentle_touch' }).expect(404);
      expect(response.body.success).toBe(false);
    });

    it('returns 400 for an activity not appropriate for the derived day', async () => {
      const foal = await makeFoal(0); // derived day 0
      const response = await post(foal.id, { activity: 'Trailer Exposure' }).expect(400); // day-3 activity
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not appropriate for day 0');
    });

    it('accepts different activity name formats (distinct day-3 activities)', async () => {
      const foal = await makeFoal(3);

      // snake_case
      await post(foal.id, { activity: 'leading_practice' }).expect(200);
      // Title Case (distinct activity)
      await post(foal.id, { activity: 'Halter Introduction' }).expect(200);
      // UPPERCASE (distinct activity)
      await post(foal.id, { activity: 'HANDLING EXERCISES' }).expect(200);
    });

    it('creates a training history record in the real database', async () => {
      const foal = await makeFoal(1); // derived day 1
      const response = await post(foal.id, { activity: 'Feeding Assistance' }).expect(200);

      const trainingRecord = await prisma.foalTrainingHistory.findUnique({
        where: { id: response.body.data.trainingRecordId },
      });

      expect(trainingRecord).toBeTruthy();
      expect(trainingRecord.horseId).toBe(foal.id);
      expect(trainingRecord.day).toBe(1);
      expect(trainingRecord.activity).toBe('Feeding Assistance');
      expect(trainingRecord.outcome).toMatch(/success|excellent|challenging/);
      expect(typeof trainingRecord.bondChange).toBe('number');
      expect(typeof trainingRecord.stressChange).toBe('number');
    });

    it('caps bond and stress within 0-100 bounds', async () => {
      const foal = await makeFoal(3, { bondScore: 98, stressLevel: 2 });
      const response = await post(foal.id, { activity: 'Trailer Exposure' }).expect(200);

      expect(response.body.data.updatedLevels.bondScore).toBeLessThanOrEqual(100);
      expect(response.body.data.updatedLevels.bondScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.updatedLevels.stressLevel).toBeLessThanOrEqual(100);
      expect(response.body.data.updatedLevels.stressLevel).toBeGreaterThanOrEqual(0);

      const updated = await prisma.horse.findUnique({
        where: { id: foal.id },
        select: { bondScore: true, stressLevel: true },
      });
      expect(updated.bondScore).toBeLessThanOrEqual(100);
      expect(updated.stressLevel).toBeGreaterThanOrEqual(0);
    });

    it('requires authentication', async () => {
      const foal = await makeFoal(0);
      await request(app)
        .post(`/api/v1/foals/${foal.id}/enrich`)
        .set('Origin', 'http://localhost:3000')
        .send({ activity: 'gentle_touch' })
        .expect(401);
    });
  });
});
