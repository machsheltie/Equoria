/**
 * Legacy instant-execution competition path deprecation (Equoria-kacla).
 *
 * The OLD instant-execution routes in competitionRoutes.mjs contradicted the
 * canonical 7-day deferred-window show model (Equoria-nx8t1, commit
 * 68a86c66b). This suite locks in the chosen resolution against the REAL test
 * database (no mocks, real controllers, real Prisma):
 *
 *  - POST /api/v1/competition/enter-show  → 410 Gone (instant enter-and-run is
 *    removed; nothing beta-facing called it).
 *  - POST /api/v1/competition/execute     → 410 Gone (instant host-triggered run
 *    is removed; the nightly cron `executeClosedShows` is the only executor).
 *  - POST /api/v1/competition/enter       → DEFERRED entry only. The frontend
 *    (`competitionsApi.enter`) still calls this, so it stays working but on
 *    correct semantics: it creates a canonical ShowEntry (the row the cron
 *    reads), debits the entrant the entryFee, credits the show creator, and
 *    NEVER returns instant competition results.
 *  - The canonical /api/v1/shows/* 7-day path is unchanged (no nx8t1 regression).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { executeClosedShows } from '../shows/showController.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

const uid = () => `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;

let creator;
let creatorToken;
let entrant;
let entrantToken;
let entrantHorseId;
let creatorHorseId;
const showIds = [];
const cleanup = createCleanupTracker();

beforeAll(async () => {
  creator = await prisma.user.create({
    data: {
      email: `kacla-creator-${uid()}@test.com`,
      username: `kaclac${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Kacla',
      lastName: 'Creator',
      money: 100000,
    },
  });
  creatorToken = generateTestToken({ id: creator.id, email: creator.email, role: 'user' });

  entrant = await prisma.user.create({
    data: {
      email: `kacla-entrant-${uid()}@test.com`,
      username: `kaclae${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Kacla',
      lastName: 'Entrant',
      money: 100000,
    },
  });
  entrantToken = generateTestToken({ id: entrant.id, email: entrant.email, role: 'user' });

  const entrantHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-kacla-EntrantHorse-${Date.now()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: entrant.id,
      healthStatus: 'healthy',
    },
  });
  entrantHorseId = entrantHorse.id;

  const creatorHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-kacla-CreatorHorse-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: creator.id,
      healthStatus: 'healthy',
    },
  });
  creatorHorseId = creatorHorse.id;

  // Scoped, fail-loud cleanup (Equoria-1ohys). showIds is populated by the
  // tests, so the closures read it at run() time (afterAll). FK order: per-show
  // results + entries -> show; then per-horse results -> horse -> user
  // (Horse.userId is onDelete:Restrict, so the owned horses are deleted before
  // their owners). A cleanup failure now fails the suite instead of being
  // swallowed.
  cleanup.add(async () => {
    for (const id of showIds) {
      await prisma.competitionResult.deleteMany({ where: { showId: id } });
      await prisma.showEntry.deleteMany({ where: { showId: id } });
      await prisma.show.delete({ where: { id } });
    }
  }, 'shows');
  cleanup.add(async () => {
    if (entrantHorseId) {
      await prisma.competitionResult.deleteMany({ where: { horseId: entrantHorseId } });
      await prisma.horse.delete({ where: { id: entrantHorseId } });
    }
  }, 'entrantHorse');
  cleanup.add(async () => {
    if (creatorHorseId) {
      await prisma.competitionResult.deleteMany({ where: { horseId: creatorHorseId } });
      await prisma.horse.delete({ where: { id: creatorHorseId } });
    }
  }, 'creatorHorse');
  cleanup.add(() => (entrant ? prisma.user.delete({ where: { id: entrant.id } }) : undefined), 'entrant');
  cleanup.add(() => (creator ? prisma.user.delete({ where: { id: creator.id } }) : undefined), 'creator');
}, 30000);

afterAll(() => cleanup.run(), 30000);

async function createShow(body) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${creatorToken}`] });
  return request(app)
    .post('/api/v1/shows/create')
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${creatorToken}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

describe('Equoria-kacla: legacy instant-execution paths are removed', () => {
  it('POST /api/v1/competition/enter-show returns 410 Gone (no instant enter-and-run)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${entrantToken}`] });
    const res = await request(app)
      .post('/api/v1/competition/enter-show')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${entrantToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ showId: 1, horseIds: [entrantHorseId] });

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
    // Must NOT return instant competition results.
    expect(res.body.results).toBeUndefined();
    expect(res.body.summary).toBeUndefined();
    expect(String(res.body.message)).toMatch(/7-day|deferred|\/api\/shows/i);
  });

  it('POST /api/v1/competition/execute returns 410 Gone (only the nightly cron executes shows)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${creatorToken}`] });
    const res = await request(app)
      .post('/api/v1/competition/execute')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${creatorToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ showId: 1 });

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
    expect(res.body.data?.results).toBeUndefined();
    expect(String(res.body.message)).toMatch(/7-day|deferred|cron|\/api\/shows/i);
  });
});

describe('Equoria-kacla: POST /api/v1/competition/enter is a deferred entry (no instant results)', () => {
  it('creates a canonical ShowEntry, debits entrant, credits creator, returns NO results', async () => {
    const showRes = await createShow({
      name: `TestFixture-kacla-enter-${Date.now()}`,
      discipline: 'Dressage',
      level: 1,
      entryFee: 50,
      prize: 1000,
    });
    expect(showRes.status).toBe(201);
    const show = showRes.body.data.show;
    showIds.push(show.id);

    const entrantBefore = await prisma.user.findUnique({
      where: { id: entrant.id },
      select: { money: true },
    });
    const creatorBefore = await prisma.user.findUnique({
      where: { id: creator.id },
      select: { money: true },
    });

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${entrantToken}`] });
    const res = await request(app)
      .post('/api/v1/competition/enter')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${entrantToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: entrantHorseId, showId: show.id });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    // No instant competition results in the response.
    expect(res.body.results).toBeUndefined();
    expect(res.body.data?.results).toBeUndefined();
    expect(res.body.data?.placement).toBeUndefined();
    expect(res.body.data?.score).toBeUndefined();

    // The entry must land in the CANONICAL ShowEntry table the cron reads,
    // NOT only in the legacy competitionResult table.
    const showEntry = await prisma.showEntry.findFirst({
      where: { showId: show.id, horseId: entrantHorseId },
    });
    expect(showEntry).not.toBeNull();
    expect(showEntry.feePaid).toBe(50);

    // No pre-scored competitionResult was created (instant-execute would have).
    const cr = await prisma.competitionResult.findFirst({
      where: { showId: show.id, horseId: entrantHorseId },
    });
    expect(cr).toBeNull();

    // nx8t1 R7: entrant debited entryFee, creator credited the same.
    const entrantAfter = await prisma.user.findUnique({
      where: { id: entrant.id },
      select: { money: true },
    });
    const creatorAfter = await prisma.user.findUnique({
      where: { id: creator.id },
      select: { money: true },
    });
    expect(entrantAfter.money).toBe(entrantBefore.money - 50);
    expect(creatorAfter.money).toBe(creatorBefore.money + 50);
  }, 30000);

  it('rejects entry once the show is no longer open (closed window)', async () => {
    const showRes = await createShow({
      name: `TestFixture-kacla-closed-${Date.now()}`,
      discipline: 'Reining',
      level: 1,
      entryFee: 0,
      prize: 0,
    });
    expect(showRes.status).toBe(201);
    const show = showRes.body.data.show;
    showIds.push(show.id);
    await prisma.show.update({ where: { id: show.id }, data: { status: 'completed' } });

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${entrantToken}`] });
    const res = await request(app)
      .post('/api/v1/competition/enter')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${entrantToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: entrantHorseId, showId: show.id });

    expect([400, 409]).toContain(res.status);
    expect(res.body.success).toBe(false);
  }, 30000);
});

describe('Equoria-kacla: canonical /api/v1/shows 7-day path still works (no nx8t1 regression)', () => {
  it('create → enter via /api/v1/shows/:id/enter → cron executes at day 7', async () => {
    const showRes = await createShow({
      name: `TestFixture-kacla-canon-${Date.now()}`,
      discipline: 'Dressage',
      level: 1,
      entryFee: 25,
      prize: 500,
    });
    expect(showRes.status).toBe(201);
    const show = showRes.body.data.show;
    showIds.push(show.id);

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${entrantToken}`] });
    const enterRes = await request(app)
      .post(`/api/v1/shows/${show.id}/enter`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${entrantToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: entrantHorseId });
    expect(enterRes.status).toBe(201);
    expect(enterRes.body.data.entry).toBeDefined();
    // Entering does NOT instant-execute.
    expect(enterRes.body.data.results).toBeUndefined();

    // Force the close window into the past and run the cron executor.
    await prisma.show.update({
      where: { id: show.id },
      data: { closeDate: new Date(Date.now() - 60000), status: 'open' },
    });
    // Equoria-rsss0: scope to this test's show so the global executor does
    // not claim a parallel competition suite's past-due open shows.
    await executeClosedShows({ body: { showIds: [show.id] } }, null);

    const after = await prisma.show.findUnique({
      where: { id: show.id },
      select: { status: true },
    });
    expect(after.status).toBe('completed');
    const result = await prisma.competitionResult.findFirst({
      where: { showId: show.id, horseId: entrantHorseId },
    });
    expect(result).not.toBeNull();
    expect(result.placement).toBe('1');
  }, 30000);
});
