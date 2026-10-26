/**
 * Foal development is server-authoritative — Equoria-mwjst (Codex scan
 * 2026-10-02, Finding 3).
 *
 * The defect: `PUT /api/v1/foals/:id/develop` wrote whatever `currentDay`
 * (0–6) and `bondingLevel` (0–100) the owner sent straight into
 * FoalDevelopment, and the owner-callable `POST /api/v1/foals/:id/advance-day`
 * (documented as an admin/cron endpoint, mounted for any owner) bumped the day
 * on demand. `FoalDevelopment.currentDay` is the development day the nightly
 * trait job advances one step per night and feeds into epigenetic trait
 * revelation (traitEvaluation minAge 1–6), so a player could jump a newborn to
 * day 6 and compress the seven-night window into one.
 *
 * Owner ruling 2026-10-05: "THEY DO NOT GET AN ADVANCE DAY! THEY MUST WAIT OUT
 * THE FULL 7 DAY AGING PROCESS. THERE IS NO AGING UP FOALS PREMATURELY." Both
 * routes and the frontend "Advance Day" button are retired; only the nightly
 * job moves the day.
 *
 * The invariants this file locks:
 *   - No HTTP request can set or advance the development day, or write
 *     bond values; the nightly job still advances exactly one day per run.
 *   - The legacy player activity (`POST /:id/activity`) is gone too
 *     (Equoria-fr2kg; owner ruling 2026-10-14/15: foal enrichment is the
 *     groom's job). OLD CONTRACT: it wrote the FoalDevelopment update and its
 *     FoalActivity record in one transaction (a forced FoalActivity failure
 *     rolled back, a concurrent duplicate applied once). NEW CONTRACT: 404, no
 *     record change, no FoalActivity row.
 *
 * Why these assertions detect the old defect: under the old router the PUT
 * returned 200 and stored day 6 / bond 100, and advance-day returned
 * 200 with day+1.
 *
 * Real app, real JWT, real CSRF, real database.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import cronJobService from '../../../services/cronJobs.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const FIXTURE_PREFIX = 'TestFixture-mwjst-foaldev';
const ORIGIN = 'http://localhost:3000';
const DAY0_ACTIVITY = 'gentle_touch';
const tag = randomBytes(4).toString('hex');

let owner;
let token;
let csrf;
let seq = 0;

/** A foal owned by the test player, born `bornDaysAgo` days ago, with a day-0 development record. */
async function makeFoal({ bornDaysAgo = 0 } = {}) {
  seq += 1;
  const foal = await createTestHorse({
    name: `${FIXTURE_PREFIX}-${seq}-${tag}`,
    userId: owner.id,
    age: 0,
    sex: 'Filly',
    dateOfBirth: gameCalendarDate(new Date(), -bornDaysAgo),
  });
  await prisma.foalDevelopment.create({
    data: { foalId: foal.id, currentDay: 0, bondingLevel: 50, completedActivities: {} },
  });
  return foal;
}

function send(method, path, body = {}) {
  const agent = request(app);
  return agent[method](path)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

async function readDevelopment(foalId) {
  return prisma.foalDevelopment.findUnique({
    where: { foalId },
    select: { currentDay: true, bondingLevel: true, completedActivities: true, updatedAt: true },
  });
}

beforeAll(async () => {
  ({ user: owner, token } = await createTestUser({
    username: `${FIXTURE_PREFIX}-${tag}`,
    email: `${FIXTURE_PREFIX}-${tag}@example.com`,
  }));
  csrf = await fetchCsrf(app);
}, 120000);

afterAll(async () => {
  // FoalDevelopment and FoalActivity rows cascade with the foal.
  await cleanupTestData();
});

describe('foal development is server-authoritative (Equoria-mwjst Finding 3)', () => {
  it('PUT /:id/develop cannot jump the day or choose the bond: 404 and the record is unchanged', async () => {
    const foal = await makeFoal();
    const before = await readDevelopment(foal.id);

    const res = await send('put', `/api/v1/foals/${foal.id}/develop`, {
      currentDay: 6,
      bondingLevel: 100,
    });

    expect(res.status).toBe(404);
    expect(await readDevelopment(foal.id)).toEqual(before);
  });

  it('POST /:id/advance-day is not a route: 404, and repeating it never moves the day', async () => {
    const foal = await makeFoal();
    const before = await readDevelopment(foal.id);

    for (let i = 0; i < 3; i++) {
      const res = await send('post', `/api/v1/foals/${foal.id}/advance-day`);
      expect(res.status).toBe(404);
    }

    expect(await readDevelopment(foal.id)).toEqual(before);
  });

  it('GET /:id/development reports the server-owned day and bond after the attempts', async () => {
    const foal = await makeFoal();
    await send('put', `/api/v1/foals/${foal.id}/develop`, { currentDay: 6, bondingLevel: 100 });
    await send('post', `/api/v1/foals/${foal.id}/advance-day`);

    const res = await request(app)
      .get(`/api/v1/foals/${foal.id}/development`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    // Equoria-fr2kg Q16 (owner ruling 2026-10-22): the bond is the horse's own
    // Horse.bondScore (OLD CONTRACT: the frozen legacy FoalDevelopment 50).
    // Neither the attempted PUT (bond 100) nor anything else in this request
    // path wrote it.
    const horse = await prisma.horse.findUnique({
      where: { id: foal.id },
      select: { bondScore: true },
    });
    expect(horse.bondScore).not.toBe(100);
    expect(res.body.data.development).toMatchObject({
      currentDay: 0,
      bondingLevel: horse.bondScore,
    });
    expect(await readDevelopment(foal.id)).toMatchObject({ bondingLevel: 50 });
  });

  it('the nightly trait job still advances the development day by exactly one per run', async () => {
    // Born yesterday: day 0 has fully elapsed, so the nightly pass may move it
    // (Equoria-3i34b — a foal born today would correctly stay on day 0).
    const foal = await makeFoal({ bornDaysAgo: 1 });
    const loaded = await prisma.horse.findUnique({
      where: { id: foal.id },
      include: { foalDevelopment: true },
    });

    // Day 0 reveals nothing (every trait needs minAge >= 1); the run ends by
    // advancing the day — the only legitimate way it moves.
    await cronJobService.evaluateFoalTraits(loaded);

    expect((await readDevelopment(foal.id)).currentDay).toBe(1);
  });

  it('POST /:id/activity is not a route: 404, the record is unchanged and no FoalActivity row is written', async () => {
    const foal = await makeFoal();
    const before = await readDevelopment(foal.id);

    const responses = await Promise.all([
      send('post', `/api/v1/foals/${foal.id}/activity`, { activityType: DAY0_ACTIVITY }),
      send('post', `/api/v1/foals/${foal.id}/activity`, { activityType: DAY0_ACTIVITY }),
    ]);

    expect(responses.map(r => r.status)).toEqual([404, 404]);
    expect(await readDevelopment(foal.id)).toEqual(before);
    expect(await prisma.foalActivity.count({ where: { foalId: foal.id } })).toBe(0);
  });
});
