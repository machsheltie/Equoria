/**
 * showResultsView.integration.test.mjs (Equoria-q4uem.10, slice A2)
 *
 * Owner ruling R4 (Stacey, 2026-10-15): the results modal reads the existing
 * GET /api/v1/competition/show/:showId/results, which must answer with a scoped,
 * server-built DTO. Before A2 it returned raw Prisma rows with every entrant's
 * full horse row (stats, genetics, owner userId) and the full show row.
 *
 * R7: a post-show stat gain is visible to the horse's owner only.
 *
 * Kept contracts (pinned elsewhere, unchanged): envelope keys success / showId /
 * results / count, 400 on a non-numeric id, and 200 with [] for a show that does
 * not exist (competition-rate-limiting.test.mjs, competitionController.test.mjs).
 *
 * Real app + real DB; result rows are written as fixtures so placements are fixed.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const ORIGIN = 'http://localhost:3000';
const uid = () => randomBytes(5).toString('hex');
const RESULT_KEYS = [
  'conformationAward',
  'horseId',
  'horseName',
  'horsePointsAwarded',
  'isViewerHorse',
  'ownerName',
  'placement',
  'prizeWon',
  'resultId',
  'runDate',
  'score',
  'statGain',
].sort();

const cleanup = createCleanupTracker();
let viewer;
let rival;
let viewerToken;
let viewerHorse;
let rivalHorse;
let legacyHorse;
let riddenShow;
let conformationShow;
const runDate = new Date('2026-10-10T07:00:00.000Z');

async function makeUser(tag) {
  return prisma.user.create({
    data: {
      emailVerified: true,
      email: `q10a2-${tag}-${uid()}@test.local`,
      username: `q10a2${tag}${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Results',
      lastName: 'Viewer',
      money: 0,
    },
  });
}

async function makeHorse(userId, tag) {
  return prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `TestFixture-q10a2-${tag}-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-01-01'),
      age: 7,
      userId,
      speed: 77,
    }),
  });
}

async function makeShow(tag, extra = {}) {
  return prisma.show.create({
    data: {
      name: `TestFixture-q10a2-${tag}-${uid()}`,
      discipline: 'Dressage',
      runDate,
      prize: 1000,
      entryFee: 0,
      levelMin: 1,
      levelMax: 10,
      status: 'completed',
      executedAt: runDate,
      ...extra,
    },
  });
}

function result(show, horse, fields) {
  return {
    score: 50,
    discipline: show.discipline,
    runDate,
    showName: show.name,
    horseId: horse.id,
    showId: show.id,
    ...fields,
  };
}

beforeAll(async () => {
  cleanup.add(
    () =>
      prisma.competitionResult.deleteMany({
        where: { showId: { in: [riddenShow?.id, conformationShow?.id].filter(Boolean) } },
      }),
    'competitionResult',
  );
  cleanup.add(
    () => prisma.show.deleteMany({ where: { id: { in: [riddenShow?.id, conformationShow?.id].filter(Boolean) } } }),
    'show',
  );
  cleanup.add(
    () =>
      prisma.horse.deleteMany({
        where: { id: { in: [viewerHorse?.id, rivalHorse?.id, legacyHorse?.id].filter(Boolean) } },
      }),
    'horse',
  );
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [viewer?.id, rival?.id].filter(Boolean) } } }), 'user');

  viewer = await makeUser('v');
  rival = await makeUser('r');
  viewerToken = generateTestToken({ id: viewer.id, email: viewer.email, role: 'user' });
  viewerHorse = await makeHorse(viewer.id, 'viewer');
  rivalHorse = await makeHorse(rival.id, 'rival');
  legacyHorse = await makeHorse(rival.id, 'legacy');
  riddenShow = await makeShow('ridden');
  conformationShow = await makeShow('conf', { discipline: 'conformation', showType: 'conformation', prize: 0 });

  await prisma.competitionResult.createMany({
    data: [
      result(riddenShow, rivalHorse, {
        score: 81.5,
        placement: 1,
        prizeWon: 500,
        horsePointsAwarded: 30,
        statGains: { stat: 'focus', gain: 1 },
      }),
      result(riddenShow, viewerHorse, {
        score: 64.25,
        placement: 2,
        prizeWon: 300,
        horsePointsAwarded: 27,
        statGains: { stat: 'precision', gain: 1 },
      }),
      // Settled before A1: nothing recorded, and a malformed statGains value.
      result(riddenShow, legacyHorse, { score: 40, placement: 3, prizeWon: 200, statGains: { stat: 7 } }),
      result(conformationShow, viewerHorse, {
        score: 72,
        placement: 1,
        prizeWon: null,
        statGains: { ribbon: 'Blue', titlePoints: 10 },
      }),
    ],
  });
});

afterAll(() => cleanup.run(), 60000);

function getResults(showId) {
  return request(app)
    .get(`/api/v1/competition/show/${showId}/results`)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${viewerToken}`);
}

describe('GET /api/v1/competition/show/:showId/results — scoped DTO (R4)', () => {
  it('answers with the show header and one scoped row per result, in placement order', async () => {
    const res = await getResults(riddenShow.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, showId: riddenShow.id, count: 3 });
    expect(res.body.show).toEqual({
      id: riddenShow.id,
      name: riddenShow.name,
      discipline: 'Dressage',
      showType: 'ridden',
      status: 'completed',
      scheduledRunDate: runDate.toISOString(),
      executedAt: runDate.toISOString(),
      prize: 1000,
    });
    for (const row of res.body.results) {
      expect(Object.keys(row).sort()).toEqual(RESULT_KEYS);
    }
    expect(res.body.results.map(r => r.horseId)).toEqual([rivalHorse.id, viewerHorse.id, legacyHorse.id]);
  });

  it('marks the viewer’s horse and shows its stat gain to the viewer only', async () => {
    const res = await getResults(riddenShow.id);
    const [rivalRow, viewerRow] = res.body.results;

    expect(viewerRow).toMatchObject({
      horseName: viewerHorse.name,
      ownerName: viewer.username,
      isViewerHorse: true,
      placement: 2,
      score: 64.25,
      prizeWon: 300,
      runDate: runDate.toISOString(),
      horsePointsAwarded: 27,
      statGain: { stat: 'precision', gain: 1 },
      conformationAward: null,
    });
    // The rival's gain is recorded but belongs to the rival.
    expect(rivalRow).toMatchObject({ isViewerHorse: false, ownerName: rival.username, statGain: null });
  });

  it('never exposes the full horse row or another player’s account id', async () => {
    const res = await getResults(riddenShow.id);
    const body = JSON.stringify(res.body);

    expect(body).not.toContain(rival.id);
    expect(body).not.toContain(viewer.id);
    expect(body).not.toContain('"horse"');
    expect(body).not.toContain('"speed"');
  });

  it('shows a legacy row’s unrecorded values as null, never 0', async () => {
    const res = await getResults(riddenShow.id);
    const legacyRow = res.body.results[2];

    expect(legacyRow).toMatchObject({ placement: 3, horsePointsAwarded: null, statGain: null });
  });

  it('reads a conformation result as a ribbon award with no prize money', async () => {
    const res = await getResults(conformationShow.id);

    expect(res.body.show).toMatchObject({ showType: 'conformation', prize: 0 });
    expect(res.body.results[0]).toMatchObject({
      isViewerHorse: true,
      prizeWon: null,
      statGain: null,
      conformationAward: { ribbon: 'Blue', titlePoints: 10 },
    });
  });

  it('keeps 200 with an empty list for a show that does not exist, now with a null header', async () => {
    const res = await getResults(2147483000);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, showId: 2147483000, results: [], count: 0, show: null });
  });
});
