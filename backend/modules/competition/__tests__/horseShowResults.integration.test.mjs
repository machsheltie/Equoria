/**
 * horseShowResults.integration.test.mjs (Equoria-q4uem.10, slice A3)
 *
 * Owner ruling R7 (Stacey, 2026-10-15): a horse's show results list every show
 * it was entered in, run and unrun, by date, with show name, competition type,
 * placement, points gained, winnings, and (owner only) any stat gained. This is
 * the read that list will use: GET /api/v1/competition/results/horse/:horseId.
 *
 * Unrecorded values are null, never 0; the list is owner-only and paged.
 * Real app + real DB; result rows are fixtures so the values are fixed.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const uid = () => randomBytes(5).toString('hex');
const ROW_KEYS = [
  'competitionType',
  'conformationAward',
  'date',
  'horsePointsAwarded',
  'placement',
  'showId',
  'showName',
  'statGain',
  'status',
  'winnings',
].sort();

const cleanup = createCleanupTracker();
let owner;
let stranger;
let ownerToken;
let strangerToken;
let horse;
const shows = {};

const day = iso => new Date(iso);

async function makeUser(tag) {
  return prisma.user.create({
    data: {
      email: `q10a3-${tag}-${uid()}@test.local`,
      username: `q10a3${tag}${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Show',
      lastName: 'Results',
      money: 0,
    },
  });
}

async function makeShow(tag, data) {
  return prisma.show.create({
    data: {
      name: `TestFixture-q10a3-${tag}-${uid()}`,
      discipline: 'Dressage',
      prize: 1000,
      entryFee: 0,
      levelMin: 1,
      levelMax: 10,
      ...data,
    },
  });
}

beforeAll(async () => {
  owner = await makeUser('o');
  stranger = await makeUser('s');
  ownerToken = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
  strangerToken = generateTestToken({ id: stranger.id, email: stranger.email, role: 'user' });
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-q10a3-horse-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-01-01'),
      age: 7,
      userId: owner.id,
    },
  });

  shows.upcoming = await makeShow('upcoming', { status: 'open', runDate: day('2026-10-20T07:00:00.000Z') });
  shows.won = await makeShow('won', {
    status: 'completed',
    runDate: day('2026-10-08T07:00:00.000Z'),
    executedAt: day('2026-10-08T07:01:00.000Z'),
  });
  shows.ribbon = await makeShow('ribbon', {
    discipline: 'conformation',
    showType: 'conformation',
    prize: 0,
    status: 'completed',
    runDate: day('2026-10-05T07:00:00.000Z'),
    executedAt: day('2026-10-05T07:01:00.000Z'),
  });
  // Settled before Horse Points were recorded, and with no entry row left.
  shows.legacy = await makeShow('legacy', {
    status: 'completed',
    runDate: day('2026-09-01T07:00:00.000Z'),
    executedAt: day('2026-09-01T07:01:00.000Z'),
  });
  const showIds = Object.values(shows).map(s => s.id);

  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }), 'competitionResult');
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'showEntry');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'show');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [owner.id, stranger.id] } } }), 'user');

  await prisma.showEntry.createMany({
    data: [shows.upcoming, shows.won, shows.ribbon].map(s => ({
      showId: s.id,
      horseId: horse.id,
      userId: owner.id,
      feePaid: 0,
    })),
  });
  await prisma.competitionResult.createMany({
    data: [
      {
        showId: shows.won.id,
        horseId: horse.id,
        score: 88,
        placement: 1,
        discipline: 'Dressage',
        runDate: day('2026-10-08T07:01:00.000Z'),
        showName: shows.won.name,
        prizeWon: 500,
        horsePointsAwarded: 30,
        statGains: { stat: 'intelligence', gain: 1 },
      },
      {
        showId: shows.ribbon.id,
        horseId: horse.id,
        score: 70,
        placement: 2,
        discipline: 'conformation',
        runDate: day('2026-10-05T07:01:00.000Z'),
        showName: shows.ribbon.name,
        prizeWon: null,
        statGains: { ribbon: 'Red', titlePoints: 7 },
      },
      {
        showId: shows.legacy.id,
        horseId: horse.id,
        score: 40,
        placement: 4,
        discipline: 'Dressage',
        runDate: day('2026-09-01T07:01:00.000Z'),
        showName: shows.legacy.name,
        prizeWon: 0,
      },
    ],
  });
});

afterAll(() => cleanup.run(), 60000);

function getShowResults(token, query = '') {
  return request(app)
    .get(`/api/v1/competition/results/horse/${horse.id}${query}`)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`);
}

describe('GET /api/v1/competition/results/horse/:horseId — every entered show (R7)', () => {
  it('lists run and unrun shows newest first, one scoped row each', async () => {
    const res = await getShowResults(ownerToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.map(r => r.showId)).toEqual([
      shows.upcoming.id,
      shows.won.id,
      shows.ribbon.id,
      shows.legacy.id,
    ]);
    for (const row of res.body.data) {
      expect(Object.keys(row).sort()).toEqual(ROW_KEYS);
    }
    expect(res.body.pagination).toMatchObject({ currentPage: 1, totalRecords: 4 });
  });

  it('shows an upcoming show with its scheduled date and no outcome yet', async () => {
    const res = await getShowResults(ownerToken);

    expect(res.body.data[0]).toEqual({
      showId: shows.upcoming.id,
      showName: shows.upcoming.name,
      competitionType: { showType: 'ridden', discipline: 'Dressage' },
      status: 'upcoming',
      date: '2026-10-20T07:00:00.000Z',
      placement: null,
      horsePointsAwarded: null,
      winnings: null,
      statGain: null,
      conformationAward: null,
    });
  });

  it('shows a run show’s placement, points, winnings and the stat gained', async () => {
    const res = await getShowResults(ownerToken);

    expect(res.body.data[1]).toMatchObject({
      status: 'completed',
      date: '2026-10-08T07:01:00.000Z',
      placement: 1,
      horsePointsAwarded: 30,
      winnings: 500,
      statGain: { stat: 'intelligence', gain: 1 },
    });
  });

  it('shows a conformation result as a ribbon with no prize money', async () => {
    const res = await getShowResults(ownerToken);

    expect(res.body.data[2]).toMatchObject({
      competitionType: { showType: 'conformation', discipline: 'conformation' },
      placement: 2,
      winnings: null,
      statGain: null,
      conformationAward: { ribbon: 'Red', titlePoints: 7 },
    });
  });

  it('keeps a legacy result’s unrecorded Horse Points null, not 0', async () => {
    const res = await getShowResults(ownerToken);

    expect(res.body.data[3]).toMatchObject({
      showId: shows.legacy.id,
      status: 'completed',
      placement: 4,
      horsePointsAwarded: null,
      winnings: 0,
    });
  });

  it('pages the list', async () => {
    const res = await getShowResults(ownerToken, '?page=2&limit=3');

    expect(res.body.data.map(r => r.showId)).toEqual([shows.legacy.id]);
    expect(res.body.pagination).toMatchObject({ currentPage: 2, pageSize: 3, totalRecords: 4 });
  });

  it('answers 404 to anyone but the owner, exactly as for a horse that does not exist', async () => {
    const strangerRes = await getShowResults(strangerToken);
    const missingRes = await request(app)
      .get('/api/v1/competition/results/horse/2147483000')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${strangerToken}`);

    expect(strangerRes.status).toBe(404);
    expect(missingRes.status).toBe(404);
    expect(strangerRes.body).toEqual(missingRes.body);
    expect(JSON.stringify(strangerRes.body)).not.toContain(shows.won.name);
  });
});
