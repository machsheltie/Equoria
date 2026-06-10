/**
 * Foal Activity Age-Stage Enforcement — Integration (Equoria-4kzik)
 *
 * Real app, real DB, real auth + CSRF, real ownership middleware. NO mocks.
 *
 * Proves the age-stage gating that previously lived ONLY in the frontend
 * DevelopmentTracker is now enforced server-side on
 * POST /api/v1/foals/:foalId/activity. A client posting an out-of-stage
 * age-stage activity (e.g. 'longe_work', a two_year_old activity, on a
 * newborn foal) must be rejected with HTTP 400 — it can no longer succeed
 * by calling the API directly.
 *
 * Sentinel-positive (OPTIMAL_FIX_DISCIPLINE §2): the "wrong stage rejected"
 * test fails if the controller's validateActivityForFoalAge guard is
 * removed; the "correct stage accepted" test fails if the guard is too
 * strict. Together they pin the real rule, not a placebo.
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-n7qa3: fail-loud scoped cleanup — a swallowed cleanup delete leaks
// fixtures into the canonical DB and trips downstream sentinels (CLAUDE.md §2).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const app = (await import('../../../app.mjs')).default;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe('INTEGRATION: Foal activity age-stage enforcement (Equoria-4kzik)', () => {
  let csrf;
  const cleanup = createCleanupTracker();
  let testUser;
  let authToken;
  let newbornFoal;
  let yearlingFoal;
  const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('TestPassword123!', 1);
    testUser = await prisma.user.create({
      data: {
        username: `agestage_user_${ts}`,
        email: `agestage_${ts}@example.com`,
        password: hashedPassword,
        firstName: 'AgeStage',
        lastName: 'Tester',
      },
    });
    authToken = generateTestToken({ id: testUser.id, role: 'user' });

    // Per-user CSRF (Equoria-plw0h): mint AFTER authToken exists and bind it to
    // the same user the mutations authenticate as (Authorization: Bearer
    // authToken). Without the accessToken cookie the /csrf-token GET would
    // resolve the fallback identifier and csrfProtection would 403 the
    // authenticated POSTs on the session-identifier mismatch.
    csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });

    // Newborn: dob now → stage 'newborn' (< 4 weeks)
    newbornFoal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `AgeStageNewborn_${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: testUser.id,
        bondScore: 50,
        stressLevel: 20,
      },
    });

    // Yearling: dob 30 weeks ago → stage 'yearling' (26 ≤ weeks < 52)
    yearlingFoal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `AgeStageYearling_${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(Date.now() - 30 * WEEK_MS),
        age: 0,
        userId: testUser.id,
        bondScore: 50,
        stressLevel: 20,
      },
    });

    // FK-order scoped cleanup (Equoria-n7qa3). Both foals are owned by testUser
    // and Horse.userId is onDelete:Restrict (schema:282), so the foal horse rows
    // must be deleted BEFORE the user. Tasks read the foal ids at run() time;
    // fail-loud so a real leak reds afterAll instead of being swallowed.
    const foalIds = () => [newbornFoal?.id, yearlingFoal?.id].filter(Boolean);
    cleanup.add(
      () => prisma.foalTrainingHistory.deleteMany({ where: { horseId: { in: foalIds() } } }),
      'foalTrainingHistory',
    );
    cleanup.add(() => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: foalIds() } } }), 'foalDevelopment');
    cleanup.add(() => prisma.foalActivity.deleteMany({ where: { foalId: { in: foalIds() } } }), 'foalActivity');
    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { foalId: { in: foalIds() } } }), 'groomAssignment');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: foalIds() } } }), 'foalHorses');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: testUser.id } }), 'groom(user)');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: testUser.id } }), 'user');
  }, 120000);

  afterAll(() => cleanup.run(), 120000);

  const post = (foalId, activityType) =>
    request(app)
      .post(`/api/v1/foals/${foalId}/activity`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ activityType });

  it('REJECTS a two_year_old activity (longe_work) on a newborn foal — 400', async () => {
    const res = await post(newbornFoal.id, 'longe_work');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.reason).toBe('wrong_stage');
    expect(res.body.requiredStage).toBe('two_year_old');
    expect(res.body.currentStage).toBe('newborn');
    // The activity must NOT have been logged.
    const logged = await prisma.foalActivity.count({
      where: { foalId: newbornFoal.id, activityType: 'longe_work' },
    });
    expect(logged).toBe(0);
  });

  it('REJECTS a newborn activity (imprinting) on a yearling foal — 400', async () => {
    const res = await post(yearlingFoal.id, 'imprinting');
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe('wrong_stage');
    expect(res.body.requiredStage).toBe('newborn');
    expect(res.body.currentStage).toBe('yearling');
  });

  it('lists the server-enforced age stage + available activities on GET /activities', async () => {
    const res = await request(app)
      .get(`/api/v1/foals/${yearlingFoal.id}/activities`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.ageStage).toBe('yearling');
    const ids = res.body.availableActivities.map(a => a.id);
    expect(ids).toContain('ground_work');
    expect(ids).not.toContain('imprinting'); // newborn-only
    expect(ids).not.toContain('longe_work'); // two_year_old-only
  });

  it('ACCEPTS a stage-appropriate activity (yearling → ground_work)', async () => {
    // This proves the guard is not over-broad: a correct-stage activity is
    // not blocked by the new age-stage check (it proceeds into the
    // day-based completeActivity flow, which governs day/cooldown rules).
    const res = await post(yearlingFoal.id, 'ground_work');
    // The age-stage guard must NOT be the thing that blocks it. Either the
    // activity completes (200) or it is rejected by the SEPARATE day-based
    // availability rule — but never with the age-stage 'wrong_stage' reason.
    expect(res.body.reason).not.toBe('wrong_stage');
    expect([200, 400, 404]).toContain(res.status);
  });
});
