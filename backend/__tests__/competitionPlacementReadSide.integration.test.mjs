/**
 * Every placement reader agrees on the same horse (Equoria-f46tb).
 *
 * CompetitionResult.placement used to be a string written as the rank ('1')
 * by the nightly executors and as the ordinal ('1st') by older paths, and each
 * reader matched one spelling: the wins and placements leaderboards only the
 * numbers, the stable's championship border only the ordinals, and the legacy
 * score compared the string to numbers and counted no placings at all. The owner ruled (2026-10-22, options A and C)
 * that placement is an Int, with the ordinal rows backfilled by the migration
 * 20261023110000_competition_result_placement_int.
 *
 * The fixture horse has seven results: 1, 1, 1, 1, 2, 3, 5. Every reader must
 * see 4 wins and 6 top-three placings.
 *
 * Equoria-a7f1p (owner ruling 2026-10-28, q151): the wins and placements
 * leaderboard case read the groupBy helpers of GET /leaderboards/competition, a
 * duplicate list removed with them.
 *
 * Equoria-58xq6: the legacy-score case read calculateAchievementsScore, deleted
 * with the legacy-score calculators after GET /horses/:id/legacy-score was
 * removed (owner ruling q242).
 *
 * Real DB, real routes (supertest, real JWT), scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { testHorseData } from './helpers/createTestHorse.mjs';

const PREFIX = 'TestFixture-f46tb';
const ORIGIN = 'http://localhost:3000';
// Oldest first; the newest result is the numeric 2nd place.
const PLACEMENTS = [1, 5, 1, 3, 1, 1, 2];
const tag = randomBytes(4).toString('hex');
const cleanup = createCleanupTracker();

const userIds = [];
const horseIds = [];
const showIds = [];
let owner;
let horse;
let token;

cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }), 'results');
cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');

beforeAll(async () => {
  owner = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `${PREFIX}-${tag}@test.local`,
      username: `${PREFIX}-${tag}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Placement',
      lastName: 'Forms',
      money: 0,
    },
  });
  userIds.push(owner.id);
  token = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });

  horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `${PREFIX}-horse-${tag}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: owner.id,
      healthStatus: 'healthy',
    }),
  });
  horseIds.push(horse.id);

  const base = Date.now() - PLACEMENTS.length * 60_000;
  for (const [i, placement] of PLACEMENTS.entries()) {
    const show = await prisma.show.create({
      data: {
        name: `${PREFIX}-show-${i}-${tag}`,
        discipline: 'Dressage',
        entryFee: 0,
        levelMin: 1,
        levelMax: 999,
        prize: 0,
        runDate: new Date(),
        status: 'completed',
      },
    });
    showIds.push(show.id);
    await prisma.competitionResult.create({
      data: {
        horseId: horse.id,
        showId: show.id,
        score: 50,
        placement,
        discipline: 'Dressage',
        runDate: new Date(base + i * 60_000),
        showName: show.name,
        prizeWon: 0,
      },
    });
  }
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('placement readers agree (Equoria-f46tb)', () => {
  it("the stable list's championship signal counts every win", async () => {
    const res = await request(app).get('/api/v1/horses').set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const row = res.body.data.find(h => h.id === horse.id);
    expect(row.firstPlaceWins).toBe(4);
    expect(row.hasChampionship).toBe(true);
  });
});
