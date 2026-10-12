/**
 * Foal development is server-authoritative — Equoria-mwjst (Codex scan
 * 2026-10-02, Finding 3).
 *
 * The defect: `PUT /api/v1/foals/:id/develop` wrote whatever `currentDay`
 * (0–6), `bondingLevel` and `stressLevel` (0–100) the owner sent straight into
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
 *     bond/stress values; the nightly job still advances exactly one day per run.
 *   - The retained legacy activity (`POST /:id/activity`) writes the
 *     FoalDevelopment update and its FoalActivity record in ONE transaction:
 *     a forced FoalActivity failure leaves the development row untouched, and a
 *     concurrent duplicate of the same activity applies once.
 *
 * Why these assertions detect the old defect: under the old router the PUT
 * returned 200 and stored day 6 / bond 100 / stress 0, and advance-day returned
 * 200 with day+1. The old completeActivity committed its development update
 * BEFORE creating the FoalActivity row as a separate write, so the injected
 * insert failure left the bond/stress change behind, and two concurrent
 * completions both passed the stale "already done?" read and logged twice.
 *
 * Real app, real JWT, real CSRF, real database. The forced failure is a real
 * Postgres trigger scoped to this suite's foal (foalLifecycleAtomicity
 * precedent), not a mock.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
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
    dateOfBirth: new Date(Date.now() - bornDaysAgo * 24 * 60 * 60 * 1000),
  });
  await prisma.foalDevelopment.create({
    data: { foalId: foal.id, currentDay: 0, bondingLevel: 50, stressLevel: 20, completedActivities: {} },
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
    select: { currentDay: true, bondingLevel: true, stressLevel: true, completedActivities: true, updatedAt: true },
  });
}

/** Make every FoalActivity insert for one foal fail inside Postgres. Returns the remover. */
async function failFoalActivityInsertsFor(foalId) {
  const suffix = `${tag}_${foalId}`;
  const fn = `mwjst_fail_activity_${suffix}`;
  const trg = `mwjst_fail_activity_trg_${suffix}`;
  await prisma.$executeRawUnsafe(`
    CREATE FUNCTION ${fn}() RETURNS trigger AS $$
    BEGIN
      IF NEW."foalId" = ${Number(foalId)} THEN
        RAISE EXCEPTION 'injected test failure (${FIXTURE_PREFIX})';
      END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER ${trg} BEFORE INSERT ON foal_activities FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
  );
  return async () => {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trg} ON foal_activities`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`);
  };
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
  it('PUT /:id/develop cannot jump the day or choose bond/stress: 404 and the record is unchanged', async () => {
    const foal = await makeFoal();
    const before = await readDevelopment(foal.id);

    const res = await send('put', `/api/v1/foals/${foal.id}/develop`, {
      currentDay: 6,
      bondingLevel: 100,
      stressLevel: 0,
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

  it('GET /:id/development reports the server-owned day, bond and stress after the attempts', async () => {
    const foal = await makeFoal();
    await send('put', `/api/v1/foals/${foal.id}/develop`, { currentDay: 6, bondingLevel: 100, stressLevel: 0 });
    await send('post', `/api/v1/foals/${foal.id}/advance-day`);

    const res = await request(app)
      .get(`/api/v1/foals/${foal.id}/development`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.data.development).toMatchObject({ currentDay: 0, bondingLevel: 50, stressLevel: 20 });
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

  it('a legacy activity commits its development update and its FoalActivity row together', async () => {
    const foal = await makeFoal();
    const before = await readDevelopment(foal.id);

    const removeTrigger = await failFoalActivityInsertsFor(foal.id);
    let failed;
    try {
      failed = await send('post', `/api/v1/foals/${foal.id}/activity`, { activityType: DAY0_ACTIVITY });
    } finally {
      await removeTrigger();
    }

    // The FoalActivity insert failed, so the development update rolled back.
    expect(failed.status).toBe(500);
    expect(await readDevelopment(foal.id)).toEqual(before);
    expect(await prisma.foalActivity.count({ where: { foalId: foal.id } })).toBe(0);

    // Without the injected failure the same activity completes normally.
    const ok = await send('post', `/api/v1/foals/${foal.id}/activity`, { activityType: DAY0_ACTIVITY });
    expect(ok.status).toBe(200);
    const after = await readDevelopment(foal.id);
    expect(after.completedActivities).toEqual({ 0: [DAY0_ACTIVITY] });
    expect(after.currentDay).toBe(0);
    const activities = await prisma.foalActivity.findMany({ where: { foalId: foal.id } });
    expect(activities).toHaveLength(1);
    expect(after.bondingLevel).toBe(Math.max(0, Math.min(100, before.bondingLevel + activities[0].bondingChange)));
    expect(after.stressLevel).toBe(Math.max(0, Math.min(100, before.stressLevel + activities[0].stressChange)));
  });

  it('two concurrent completions of the same activity apply it once', async () => {
    const foal = await makeFoal();
    const before = await readDevelopment(foal.id);

    const responses = await Promise.all([
      send('post', `/api/v1/foals/${foal.id}/activity`, { activityType: DAY0_ACTIVITY }),
      send('post', `/api/v1/foals/${foal.id}/activity`, { activityType: DAY0_ACTIVITY }),
    ]);

    expect(responses.map(r => r.status).filter(s => s === 200)).toHaveLength(1);
    const activities = await prisma.foalActivity.findMany({ where: { foalId: foal.id } });
    expect(activities).toHaveLength(1);
    const after = await readDevelopment(foal.id);
    expect(after.completedActivities).toEqual({ 0: [DAY0_ACTIVITY] });
    expect(after.bondingLevel).toBe(Math.max(0, Math.min(100, before.bondingLevel + activities[0].bondingChange)));
  });
});
