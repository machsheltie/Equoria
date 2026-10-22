/**
 * Every placement reader counts both stored spellings (Equoria-f46tb).
 *
 * CompetitionResult.placement is written as the rank ('1', '2', ...) by the
 * nightly executors and as the ordinal ('1st', '2nd', ...) by older paths.
 * Readers matched one spelling each: the wins and placements leaderboards only
 * the numbers, the stable's championship border and the dashboard's last
 * placing only the ordinals, and the legacy score compared the string column to
 * numbers and so counted no placings at all. The same horse therefore had
 * different win totals on different screens.
 *
 * The fixture horse has seven results: 1, 1, 1st, 1st, 2, 3rd, 5. Every
 * reader must see 4 wins and 6 top-three placings. (A migration to one
 * encoding is owner-gated and not part of this fix.)
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
import { placementRank, storedPlacements } from '../utils/competitionPlacement.mjs';
import {
  groupWinsByHorse,
  groupTopThreePlacementsByHorse,
} from '../modules/leaderboards/services/leaderboardCompetitionQueries.mjs';
import { calculateAchievementsScore } from '../modules/horses/services/legacyScoreCalculator.mjs';

const PREFIX = 'TestFixture-f46tb';
const ORIGIN = 'http://localhost:3000';
// Oldest first; the newest result is the numeric 2nd place.
const PLACEMENTS = ['1st', '5', '1', '3rd', '1st', '1', '2'];
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
    data: {
      ...fixtureColor(),
      name: `${PREFIX}-horse-${tag}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: owner.id,
      healthStatus: 'healthy',
    },
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

describe('placement readers count both spellings (Equoria-f46tb)', () => {
  it('helpers: rank of either spelling; every spelling of a rank', () => {
    expect(placementRank('1')).toBe(1);
    expect(placementRank('1st')).toBe(1);
    expect(placementRank(' 3rd ')).toBe(3);
    expect(placementRank(2)).toBe(2);
    expect(placementRank('')).toBeNull();
    expect(placementRank(null)).toBeNull();
    expect(storedPlacements(1, 2, 3)).toEqual(['1', '1st', '2', '2nd', '3', '3rd']);
    expect(storedPlacements(11, 12, 13, 21, 22)).toEqual([
      '11',
      '11th',
      '12',
      '12th',
      '13',
      '13th',
      '21',
      '21st',
      '22',
      '22nd',
    ]);
  });

  it('wins and placements leaderboards count both spellings', async () => {
    const wins = await groupWinsByHorse({ horseId: horse.id }, { take: 5, skip: 0 });
    expect(wins).toEqual([{ horseId: horse.id, _count: { id: 4 } }]);
    const placings = await groupTopThreePlacementsByHorse({ horseId: horse.id }, { take: 5, skip: 0 });
    expect(placings).toEqual([{ horseId: horse.id, _count: { id: 6 } }]);
  });

  it("the stable list's championship signal counts both spellings", async () => {
    const res = await request(app).get('/api/v1/horses').set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const row = res.body.data.find(h => h.id === horse.id);
    expect(row.firstPlaceWins).toBe(4);
    expect(row.hasChampionship).toBe(true);
  });

  it("the dashboard's last placing finds the newest top-three result in either spelling", async () => {
    const res = await request(app)
      .get(`/api/v1/users/dashboard/${owner.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const activity = res.body.data?.activity ?? res.body.activity;
    expect(activity.lastShowPlaced).toMatchObject({ horseName: horse.name, placement: '2' });
  });

  it('the legacy score counts the stored placings', async () => {
    const competitionResults = await prisma.competitionResult.findMany({ where: { horseId: horse.id } });
    const { breakdown } = await calculateAchievementsScore({ competitionResults });
    expect(breakdown).toMatchObject({ firstPlaces: 4, secondPlaces: 1, thirdPlaces: 1, totalCompetitions: 7 });
  });
});
