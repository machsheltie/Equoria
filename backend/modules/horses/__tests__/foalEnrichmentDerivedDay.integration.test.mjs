/**
 * Integration Test: Foal Enrichment — Derived-Day Contract (Equoria-g89vy)
 *
 * The enrichment "day" is NOT supplied by the client. The server derives it
 * from the foal's dateOfBirth using canonical date-only UTC age math
 * (getHorseAgeDays). Consequences proven here:
 *
 *   - The activity must be appropriate for the foal's DERIVED day (its real
 *     age in days), not whatever day a client claims.
 *   - The enrichment window closes at day 7+ (a foal 7+ days old / age 1
 *     game-year is past the 0-6 window): 400 "window closed".
 *   - Anti-farming: the same (day, activity) cannot be completed twice. A
 *     second attempt at the same activity on the same derived day → 400.
 *   - A client-supplied `day` is IGNORED — sending a wrong day does not
 *     change which activities are accepted.
 *
 * Real DB, no mocks. Each test owns an age-matched foal so the derived day
 * is deterministic. Scoped cleanup only (CLAUDE.md §2).
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
// Build a dateOfBirth N whole days ago, anchored at a non-midnight UTC time so
// the test also proves date-only arithmetic isn't fooled by time-of-day.
function dobDaysAgo(days) {
  const d = new Date(Date.now() - days * MS_PER_DAY);
  d.setUTCHours(4, 0, 0, 0);
  return d;
}

describe('INTEGRATION: Foal Enrichment — derived-day contract (Equoria-g89vy)', () => {
  let __csrf__;
  const cleanup = createCleanupTracker();
  let testUser;
  let authToken;
  const createdFoalIds = [];
  const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;

  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
    const hashedPassword = await bcrypt.hash('TestPassword123!', 1);
    testUser = await prisma.user.create({
      data: {
        username: `enrich_derived_${ts}`,
        email: `enrich_derived_${ts}@example.com`,
        password: hashedPassword,
        firstName: 'EnrichDerived',
        lastName: 'Tester',
      },
    });
    authToken = generateTestToken({ id: testUser.id, role: 'user' });

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
    cleanup.add(
      () => prisma.foalActivity.deleteMany({ where: { foalId: { in: createdFoalIds } } }),
      'foalActivity',
    );
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
        name: `TestFixture-EnrichDerived-${ageDays}d-${randomBytes(4).toString('hex')}`,
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
      .post(`/api/foals/${foalId}/enrich`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send(body);
  }

  it('accepts a day-0 activity for a freshly-born foal (derived day 0)', async () => {
    const foal = await makeFoal(0);
    const res = await post(foal.id, { activity: 'gentle_touch' }).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activity.day).toBe(0);
    expect(res.body.data.activity.name).toBe('Gentle Touch');
  });

  it('derives the day from age: a 3-day-old foal can do a day-3 activity', async () => {
    const foal = await makeFoal(3);
    const res = await post(foal.id, { activity: 'Trailer Exposure' }).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activity.day).toBe(3);
  });

  it('rejects a day-3 activity for a day-0 foal even when client claims day 3', async () => {
    const foal = await makeFoal(0);
    // Client lies: sends day:3. Server derives day 0 → Trailer Exposure invalid.
    const res = await post(foal.id, { day: 3, activity: 'Trailer Exposure' }).expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('not appropriate for day 0');
  });

  it('ignores a client-supplied day: day:0 claim does not block a day-3 foal', async () => {
    const foal = await makeFoal(3);
    // Client sends the wrong day (0); server derives 3 and accepts the day-3 activity.
    const res = await post(foal.id, { day: 0, activity: 'Leading Practice' }).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activity.day).toBe(3);
  });

  it('closes the enrichment window at day 7+ (foal aged past the window)', async () => {
    const foal = await makeFoal(8); // age 1 game-year, derived day 8 > 6
    const res = await post(foal.id, { activity: 'gentle_touch' }).expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message.toLowerCase()).toContain('window');
  });

  it('anti-farming: the same activity on the same derived day cannot be repeated', async () => {
    const foal = await makeFoal(1);
    await post(foal.id, { activity: 'play_interaction' }).expect(200);
    // Same foal, same derived day, same activity → rejected.
    const res = await post(foal.id, { activity: 'play_interaction' }).expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message.toLowerCase()).toContain('already');
  });

  it('anti-farming: a different activity on the same day is still allowed', async () => {
    const foal = await makeFoal(1);
    await post(foal.id, { activity: 'feeding_assistance' }).expect(200);
    // Distinct day-1 activity → allowed.
    const res = await post(foal.id, { activity: 'grooming_intro' }).expect(200);
    expect(res.body.success).toBe(true);
  });

  it('does not require a day field in the body', async () => {
    const foal = await makeFoal(2);
    const res = await post(foal.id, { activity: 'walking_practice' }).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activity.day).toBe(2);
  });
});
