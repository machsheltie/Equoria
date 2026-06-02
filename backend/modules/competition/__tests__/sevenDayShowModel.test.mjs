/**
 * 7-Day Deferred-Window Competition Show Model (Equoria-nx8t1).
 *
 * Verifies the user-decided spec (2026-05-18) rule-by-rule against the REAL
 * test database — no mocks, real controllers, real Prisma:
 *
 *  R1. Player creates a show choosing discipline + level.
 *  R2. Show auto-runs exactly 7 days after createdAt (cron picks up
 *      createdAt+7d <= now AND status=open).
 *  R3. Unlimited entries during the window (no entry cap).
 *  R4. Entry fee + prize set by creator at creation.
 *  R5. Prize charged to creator at creation; 400 if insufficient funds.
 *  R6. prize >= 10 * entryFee or 400 with a clear message.
 *  R7. Entry fees credited to the creator as each horse is entered.
 *  R8. At day 7 execution: score all entrants, distribute prize, mark
 *      completed; idempotent re-run does NOT double-pay.
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

let creator;
let creatorToken;
let entrant;
let entrantToken;
let entrantHorse;
const showIds = [];
let entrantHorseId;
let creatorHorseId;
const cleanup = createCleanupTracker();

const uid = () => `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;

beforeAll(async () => {
  creator = await prisma.user.create({
    data: {
      email: `nx8-creator-${uid()}@test.com`,
      username: `nx8c${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Show',
      lastName: 'Creator',
      money: 100000,
    },
  });
  creatorToken = generateTestToken({ id: creator.id, email: creator.email, role: 'user' });

  entrant = await prisma.user.create({
    data: {
      email: `nx8-entrant-${uid()}@test.com`,
      username: `nx8e${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Show',
      lastName: 'Entrant',
      money: 100000,
    },
  });
  entrantToken = generateTestToken({ id: entrant.id, email: entrant.email, role: 'user' });

  entrantHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-nx8-EntrantHorse-${Date.now()}`,
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
      name: `TestFixture-nx8-CreatorHorse-${Date.now()}`,
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

async function createShowReq(body, token = creatorToken) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post('/api/v1/shows/create')
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

describe('R1+R4: player creates show with discipline, level, entryFee, prize', () => {
  it('creates a show storing the chosen level and creator-set entryFee/prize', async () => {
    const res = await createShowReq({
      name: `TestFixture-nx8-R1-${Date.now()}`,
      discipline: 'Dressage',
      level: 5,
      entryFee: 10,
      prize: 200,
    });
    expect(res.status).toBe(201);
    const { show } = res.body.data;
    showIds.push(show.id);
    expect(show.discipline).toBe('Dressage');
    expect(show.entryFee).toBe(10);
    expect(show.prize).toBe(200);
    // level chosen by creator must be persisted (levelMin/levelMax bracket it)
    expect(show.levelMin).toBeLessThanOrEqual(5);
    expect(show.levelMax).toBeGreaterThanOrEqual(5);
  });
});

describe('R2: executesAt = createdAt + 7 days', () => {
  it('sets closeDate exactly 7 days after createdAt', async () => {
    const res = await createShowReq({
      name: `TestFixture-nx8-R2-${Date.now()}`,
      discipline: 'Reining',
      level: 3,
      entryFee: 0,
      prize: 0,
    });
    expect(res.status).toBe(201);
    const { show } = res.body.data;
    showIds.push(show.id);
    // closeDate (== executesAt) must be exactly openDate + 7 days, and
    // openDate is stamped at creation (≈ createdAt). Re-read from the DB so
    // we assert against the persisted createdAt, not just the response.
    const persisted = await prisma.show.findUnique({
      where: { id: show.id },
      select: { createdAt: true, openDate: true, closeDate: true },
    });
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const open = new Date(persisted.openDate).getTime();
    const close = new Date(persisted.closeDate).getTime();
    const created = new Date(persisted.createdAt).getTime();
    expect(close - open).toBe(sevenDays);
    // openDate is set within a few seconds of the DB-stamped createdAt
    expect(Math.abs(open - created)).toBeLessThan(5000);
    // therefore closeDate ≈ createdAt + 7d
    expect(Math.abs(close - (created + sevenDays))).toBeLessThan(5000);
  });
});

describe('R6: prize must be >= 10 * entryFee', () => {
  it('rejects creation with 400 when prize < 10 * entryFee', async () => {
    const res = await createShowReq({
      name: `TestFixture-nx8-R6bad-${Date.now()}`,
      discipline: 'Cutting',
      level: 2,
      entryFee: 50,
      prize: 400, // needs >= 500
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/prize.*(at least|>=|10).*entry fee|10x|10 ?×/i);
  });

  it('accepts creation when prize == 10 * entryFee', async () => {
    const res = await createShowReq({
      name: `TestFixture-nx8-R6ok-${Date.now()}`,
      discipline: 'Roping',
      level: 1,
      entryFee: 50,
      prize: 500,
    });
    expect(res.status).toBe(201);
    showIds.push(res.body.data.show.id);
  });
});

describe('R5: prize charged to creator at creation; insufficient funds rejected', () => {
  it('debits the full prize from the creator at creation', async () => {
    const before = await prisma.user.findUnique({
      where: { id: creator.id },
      select: { money: true },
    });
    const res = await createShowReq({
      name: `TestFixture-nx8-R5-${Date.now()}`,
      discipline: 'Hunter',
      level: 4,
      entryFee: 10,
      prize: 300,
    });
    expect(res.status).toBe(201);
    showIds.push(res.body.data.show.id);
    const after = await prisma.user.findUnique({
      where: { id: creator.id },
      select: { money: true },
    });
    expect(after.money).toBe(before.money - 300);
  });

  it('rejects creation with 400 when creator cannot afford the prize', async () => {
    const poor = await prisma.user.create({
      data: {
        email: `nx8-poor-${uid()}@test.com`,
        username: `nx8p${uid()}`,
        password: 'irrelevant-hash',
        firstName: 'Poor',
        lastName: 'Creator',
        money: 100,
      },
    });
    const poorToken = generateTestToken({ id: poor.id, email: poor.email, role: 'user' });
    const res = await createShowReq(
      {
        name: `TestFixture-nx8-R5poor-${Date.now()}`,
        discipline: 'Eventing',
        level: 1,
        entryFee: 10,
        prize: 500,
      },
      poorToken,
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient funds/i);
    const stillPoor = await prisma.user.findUnique({
      where: { id: poor.id },
      select: { money: true },
    });
    expect(stillPoor.money).toBe(100); // not debited
    // Fail-loud cleanup (Equoria-1ohys): the `poor` user created no horses
    // (creation 400'd on insufficient funds), so a plain delete is safe and a
    // failure should surface rather than be swallowed.
    await prisma.user.delete({ where: { id: poor.id } });
  });
});

describe('R3+R7: unlimited entries; entry fee credited to creator', () => {
  let showId;
  // Bulk horses created in the "unlimited entries" test below are owned by
  // `entrant`. They were previously never cleaned up — only their
  // competitionResults were deleted with a swallowed catch — so the rows leaked
  // and would make the module-level `entrant` delete FAIL (Horse.userId is
  // onDelete:Restrict). Equoria-1ohys: collect their ids and remove them (and
  // their results + entries) fail-loud in this inner afterAll, which runs before
  // the module-level user delete.
  const bulkHorseIds = [];
  const bulkCleanup = createCleanupTracker();
  bulkCleanup.add(
    () =>
      bulkHorseIds.length
        ? prisma.competitionResult.deleteMany({ where: { horseId: { in: bulkHorseIds } } })
        : undefined,
    'bulkHorseResults',
  );
  bulkCleanup.add(
    () => (bulkHorseIds.length ? prisma.showEntry.deleteMany({ where: { horseId: { in: bulkHorseIds } } }) : undefined),
    'bulkHorseEntries',
  );
  bulkCleanup.add(
    () => (bulkHorseIds.length ? prisma.horse.deleteMany({ where: { id: { in: bulkHorseIds } } }) : undefined),
    'bulkHorses',
  );
  afterAll(() => bulkCleanup.run(), 30000);

  it('creates a fee show (no maxEntries cap)', async () => {
    const res = await createShowReq({
      name: `TestFixture-nx8-R7-${Date.now()}`,
      discipline: 'Show Jumping',
      level: 2,
      entryFee: 25,
      prize: 250,
    });
    expect(res.status).toBe(201);
    showId = res.body.data.show.id;
    showIds.push(showId);
    expect(res.body.data.show.maxEntries).toBeNull();
  });

  it('debits entrant and credits creator the entry fee on entry', async () => {
    const creatorBefore = await prisma.user.findUnique({
      where: { id: creator.id },
      select: { money: true },
    });
    const entrantBefore = await prisma.user.findUnique({
      where: { id: entrant.id },
      select: { money: true },
    });

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${entrantToken}`] });
    const res = await request(app)
      .post(`/api/v1/shows/${showId}/enter`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${entrantToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: entrantHorseId });

    expect(res.status).toBe(201);

    const creatorAfter = await prisma.user.findUnique({
      where: { id: creator.id },
      select: { money: true },
    });
    const entrantAfter = await prisma.user.findUnique({
      where: { id: entrant.id },
      select: { money: true },
    });
    expect(entrantAfter.money).toBe(entrantBefore.money - 25);
    expect(creatorAfter.money).toBe(creatorBefore.money + 25);
  });

  it('accepts many entries with no cap (unlimited)', async () => {
    // Create 5 more horses for the entrant and enter them all.
    for (let i = 0; i < 5; i++) {
      const h = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `TestFixture-nx8-bulk-${i}-${Date.now()}`,
          sex: 'Mare',
          dateOfBirth: new Date('2018-01-01'),
          age: 7,
          userId: entrant.id,
          healthStatus: 'healthy',
        },
      });
      // Track for fail-loud cleanup in this describe's afterAll (Equoria-1ohys).
      bulkHorseIds.push(h.id);
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${entrantToken}`] });
      const res = await request(app)
        .post(`/api/v1/shows/${showId}/enter`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${entrantToken}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ horseId: h.id });
      expect(res.status).toBe(201);
    }
    const count = await prisma.showEntry.count({ where: { showId } });
    expect(count).toBeGreaterThanOrEqual(6);
  }, 30000);
});

describe('R8: cron executes only past-window open shows; idempotent', () => {
  let pastShowId;

  beforeAll(async () => {
    const pastClose = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    const show = await prisma.show.create({
      data: {
        name: `TestFixture-nx8-R8-${Date.now()}`,
        discipline: 'Dressage',
        entryFee: 0,
        levelMin: 1,
        levelMax: 999,
        prize: 1000,
        runDate: pastClose,
        status: 'open',
        openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        closeDate: pastClose,
        createdByUserId: creator.id,
      },
    });
    pastShowId = show.id;
    showIds.push(pastShowId);
    await prisma.showEntry.create({
      data: { showId: pastShowId, horseId: entrantHorseId, userId: entrant.id, feePaid: 0 },
    });
  });

  it('executes the past-window show, distributes prize, marks completed', async () => {
    const entrantBefore = await prisma.user.findUnique({
      where: { id: entrant.id },
      select: { money: true },
    });
    // Equoria-rsss0: scope to this suite's show so a parallel competition
    // suite's past-due open shows are not swept up by this global executor.
    await executeClosedShows({ body: { showIds: [pastShowId] } }, undefined);
    const show = await prisma.show.findUnique({ where: { id: pastShowId } });
    expect(show.status).toBe('completed');
    expect(show.executedAt).not.toBeNull();
    const entrantAfter = await prisma.user.findUnique({
      where: { id: entrant.id },
      select: { money: true },
    });
    // single entrant takes 1st place → 50% of 1000 = 500
    expect(entrantAfter.money).toBe(entrantBefore.money + 500);
  }, 30000);

  it('idempotent: re-running does not double-pay or re-process', async () => {
    const entrantBefore = await prisma.user.findUnique({
      where: { id: entrant.id },
      select: { money: true },
    });
    const resultsBefore = await prisma.competitionResult.count({
      where: { showId: pastShowId },
    });
    // Equoria-rsss0: scoped to this suite's show (see above).
    await executeClosedShows({ body: { showIds: [pastShowId] } }, undefined);
    const entrantAfter = await prisma.user.findUnique({
      where: { id: entrant.id },
      select: { money: true },
    });
    const resultsAfter = await prisma.competitionResult.count({
      where: { showId: pastShowId },
    });
    expect(entrantAfter.money).toBe(entrantBefore.money); // no double-pay
    expect(resultsAfter).toBe(resultsBefore); // no duplicate results
  }, 30000);
});
