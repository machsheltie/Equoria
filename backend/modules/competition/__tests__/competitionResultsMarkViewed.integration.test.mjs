/**
 * POST /api/v1/competition/results/viewed — mark-viewed integration tests
 * (Equoria-oey96.28, owner ruling 2026-09-21).
 *
 * This is the WRITE half of the Story 23.4 `check-results` next-action. The
 * hub emits `check-results` while a player holds a CompetitionResult with
 * `viewedAt IS NULL`; this route is what clears it, when the player actually
 * opens the results surface (Equoria-oey96.5 / CompetitionResultsPage).
 *
 * What is proven here, over real HTTP against the real database:
 *   1. the route marks the caller's unviewed results for the named shows and
 *      reports how many rows it changed;
 *   2. it is OWNERSHIP-SCOPED — a second player's result on the SAME show is
 *      untouched, so the route cannot be used to read or write across owners;
 *   3. it is a one-way latch — an already-viewed result keeps its original
 *      timestamp and is not re-stamped, so a second call marks nothing;
 *   4. the request body is validated (missing / empty / non-integer showIds).
 *
 * NO MOCKS (Constitution §3): real app, real auth, real CSRF, real Prisma.
 * Cleanup is registered before seeding and scoped to collected ids.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';

const ORIGIN = 'http://localhost:3000';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ENDPOINT = '/api/v1/competition/results/viewed';

const rand = () => randomBytes(6).toString('hex');

describe('POST /api/v1/competition/results/viewed (Equoria-oey96.28)', () => {
  const cleanup = createCleanupTracker();
  const resultIds = [];
  const showIds = [];
  const horseIds = [];
  const userIds = [];

  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { id: { in: resultIds } } }), 'competitionResults');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => cleanupTestHorses(prisma, horseIds), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');

  let owner;
  let ownerToken;
  let ownerCsrf;
  let intruder;
  let showA;
  let showB;
  let ownerResultA;
  let ownerResultB;
  let intruderResultA;
  let alreadyViewedAt;

  async function makeUser(label) {
    const user = await prisma.user.create({
      data: {
        email: `markviewed-${label}-${rand()}@test.com`,
        username: `markviewed${label}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'Mark',
        lastName: 'Viewed',
        money: 5000,
      },
    });
    userIds.push(user.id);
    return user;
  }

  async function makeSettledShow(label) {
    const now = new Date();
    const show = await prisma.show.create({
      data: {
        name: `TestFixture-markviewed-${label}-${rand()}`,
        discipline: 'Dressage',
        levelMin: 1,
        levelMax: 999,
        entryFee: 100,
        prize: 1000,
        runDate: new Date(now.getTime() - 2 * MS_PER_DAY),
        status: 'completed',
        openDate: new Date(now.getTime() - 9 * MS_PER_DAY),
        closeDate: new Date(now.getTime() - 2 * MS_PER_DAY),
      },
    });
    showIds.push(show.id);
    return show;
  }

  async function makeHorse(user, label) {
    const now = new Date();
    return createTestHorse(
      prisma,
      {
        name: `TestFixture-markviewed-${label}-${rand()}`,
        sex: 'Rig',
        age: 5,
        dateOfBirth: new Date(now.getTime() - 5 * 365 * MS_PER_DAY),
        healthStatus: 'Excellent',
        userId: user.id,
      },
      horseIds,
    );
  }

  async function makeResult(show, horseId, viewedAt) {
    const result = await prisma.competitionResult.create({
      data: {
        horseId,
        showId: show.id,
        score: 101.25,
        placement: '2nd',
        discipline: show.discipline,
        runDate: show.runDate,
        showName: show.name,
        prizeWon: 250,
        viewedAt,
      },
    });
    resultIds.push(result.id);
    return result;
  }

  beforeAll(async () => {
    owner = await makeUser('owner');
    intruder = await makeUser('intruder');

    showA = await makeSettledShow('showA');
    showB = await makeSettledShow('showB');

    const ownerHorse = await makeHorse(owner, 'ownerHorse');
    const intruderHorse = await makeHorse(intruder, 'intruderHorse');

    ownerResultA = await makeResult(showA, ownerHorse.id, null);
    ownerResultB = await makeResult(showB, ownerHorse.id, null);
    // Same show as ownerResultA, different owner — must stay untouched.
    intruderResultA = await makeResult(showA, intruderHorse.id, null);

    ownerToken = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
    // Equoria-plw0h: the CSRF token must be minted under the same
    // sessionIdentifier the POST resolves from its Bearer token.
    ownerCsrf = await fetchCsrf(app, { extraCookies: [`accessToken=${ownerToken}`] });
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  function postViewed(body) {
    return request(app)
      .post(ENDPOINT)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Origin', ORIGIN)
      .set('Cookie', ownerCsrf.cookieHeader)
      .set('X-CSRF-Token', ownerCsrf.csrfToken)
      .send(body);
  }

  it('marks the caller’s unviewed results for the named shows and reports the count', async () => {
    const before = Date.now();
    const res = await postViewed({ showIds: [showA.id, showB.id] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.markedCount).toBe(2);

    const rows = await prisma.competitionResult.findMany({
      where: { id: { in: [ownerResultA.id, ownerResultB.id] } },
      select: { id: true, viewedAt: true },
      orderBy: { id: 'asc' },
    });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      // `toBeInstanceOf(Date)` is NOT usable here: under the --experimental-vm-modules
      // loader a Prisma DateTime arrives from another realm, so its constructor is a
      // different `Date` and the matcher fails on a perfectly good value. Assert the
      // VALUE instead — non-null, and stamped inside this request, which is a
      // stronger claim than the type check anyway.
      expect(row.viewedAt).not.toBeNull();
      const stamped = new Date(row.viewedAt).getTime();
      expect(Number.isNaN(stamped)).toBe(false);
      // 5s of clock skew between the app process and Postgres' `now`.
      expect(stamped).toBeGreaterThanOrEqual(before - 5000);
      expect(stamped).toBeLessThanOrEqual(Date.now() + 5000);
    }
    alreadyViewedAt = new Date(rows[0].viewedAt);
  });

  it('leaves another player’s result on the SAME show untouched', async () => {
    const intruderRow = await prisma.competitionResult.findUnique({
      where: { id: intruderResultA.id },
      select: { viewedAt: true },
    });
    expect(intruderRow.viewedAt).toBeNull();
  });

  it('is a one-way latch: a second call marks nothing and does not re-stamp', async () => {
    const res = await postViewed({ showIds: [showA.id, showB.id] });

    expect(res.status).toBe(200);
    expect(res.body.markedCount).toBe(0);

    const row = await prisma.competitionResult.findUnique({
      where: { id: ownerResultA.id },
      select: { viewedAt: true },
    });
    expect(new Date(row.viewedAt).getTime()).toBe(alreadyViewedAt.getTime());
  });

  it('rejects a missing showIds array with 400', async () => {
    const res = await postViewed({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects an empty showIds array with 400', async () => {
    const res = await postViewed({ showIds: [] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects a non-integer show id with 400', async () => {
    const res = await postViewed({ showIds: ['not-a-number'] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects an unauthenticated call with 401', async () => {
    const res = await request(app)
      .post(ENDPOINT)
      .set('Origin', ORIGIN)
      .send({ showIds: [showA.id] });
    expect(res.status).toBe(401);
  });
});
