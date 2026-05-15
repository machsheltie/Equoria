/**
 * leaderboardHorseProfileAge.integration.test.mjs
 *
 * Equoria-rkld — GET /api/leaderboards/horse/:horseId must compute the `age`
 * field via the canonical getHorseAgeYears() helper (game-years: 7 real days
 * = 1 game-year, date-only UTC), NOT raw `Math.floor(ms / 365.25 days)`
 * calendar math.
 *
 * Sentinel: a horse whose dateOfBirth is exactly 35 days ago is 5 game-years
 * old (floor(35 / 7)). The pre-fix raw-ms calendar math returns 0 (35 days
 * is < 1 calendar year). This test fails RED before the fix, passes GREEN
 * after, and would fail again if the route ever reverts to calendar math.
 *
 * Also asserts the date-only UTC convention: a dob set to "今日 minus N days
 * at an arbitrary intra-day time" must not produce an off-by-one vs the
 * canonical helper.
 *
 * NO MOCKS — real backend, real Prisma, real auth, real DB. Fixtures scoped
 * and cleaned up by explicit ID (CLAUDE.md REAL DB ONLY rule).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../db/index.mjs';
import { createTestUser, createTestHorse } from '../../../tests/helpers/testAuth.mjs';
import { getHorseAgeYears } from '../../../utils/horseAge.mjs';

describe('INTEGRATION: GET /api/leaderboards/horse/:horseId age field (Equoria-rkld)', () => {
  let token;
  let userId;
  const horseIds = [];

  beforeAll(async () => {
    const ts = Date.now();
    const u = await createTestUser({
      username: `rkld_age_${ts}`,
      email: `rkld_age_${ts}@test.com`,
      level: 1,
      xp: 0,
    });
    token = u.token;
    userId = u.user.id;
  }, 120000);

  afterAll(async () => {
    if (horseIds.length > 0) {
      await prisma.competitionResult.deleteMany({ where: { horseId: { in: horseIds } } });
      await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  }, 120000);

  it('returns game-year age (floor(days/7)) — 35-day-old horse is 5 game-years, not 0 calendar-years', async () => {
    const day = 24 * 60 * 60 * 1000;
    // 35 days ago → 5 game-years. Raw /365.25 calendar math would give 0.
    const dob = new Date(Date.now() - 35 * day);
    const horse = await createTestHorse({
      name: `RkldSentinel_${Date.now()}`,
      userId,
      dateOfBirth: dob,
    });
    horseIds.push(horse.id);

    const res = await request(app).get(`/api/leaderboards/horse/${horse.id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Canonical expectation — matches getHorseAgeYears (game-years).
    expect(res.body.data.age).toBe(getHorseAgeYears(dob));
    expect(res.body.data.age).toBe(5);
    // Guard against silent revert to calendar math (which would yield 0).
    expect(res.body.data.age).not.toBe(0);
  }, 60000);

  it('honours date-only UTC convention — intra-day dob time does not shift the game-year', async () => {
    const day = 24 * 60 * 60 * 1000;
    // 70 days + a 23-hour intra-day offset. Calendar /365.25 math is
    // sensitive to the sub-day remainder; the canonical helper truncates to
    // start-of-UTC-day, so age must equal floor(70/7) = 10 regardless.
    const dob = new Date(Date.now() - 70 * day - 23 * 60 * 60 * 1000);
    const horse = await createTestHorse({
      name: `RkldUtc_${Date.now()}`,
      userId,
      dateOfBirth: dob,
    });
    horseIds.push(horse.id);

    const res = await request(app).get(`/api/leaderboards/horse/${horse.id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.age).toBe(getHorseAgeYears(dob));
  }, 60000);
});
