/**
 * Feeding must not write back a stale copy of the pooled feed inventory
 * (Equoria-bvddn.13, codebase audit 2026-09-25).
 *
 * THE DEFECT THIS FILE REPRODUCES
 *   feedHorse() reads `User.settings.inventory` with a plain SELECT inside its
 *   transaction, subtracts one unit in JS, and writes the WHOLE array back via
 *   updateUserSettingsPaths with no compare-and-swap. Under READ COMMITTED any
 *   inventory change committed between that read and that write is erased:
 *     A. feed alongside a feed purchase: the purchase commits +100, then the
 *        feed writes (old count - 1) — the paid-for units vanish.
 *     B. two horses fed at once: both read the same count and both write
 *        (count - 1) — two feedings consume one unit.
 *
 * HOW THE INTERLEAVING IS FORCED (no mocks, no sleeps)
 *   Same barrier technique as economy/inventory/__tests__/
 *   inventorySettingsRace.integration.test.mjs: a SECOND Prisma client holds
 *   `SELECT ... FOR UPDATE` on the fixture user's row. Real HTTP requests then
 *   run their real production queries; each one's plain SELECT of settings
 *   succeeds (and sees the pre-barrier document), but its UPDATE of the User
 *   row queues on the lock. pg_blocking_pids tells us when each request is
 *   genuinely queued. Releasing the barrier lets the queued writers commit in
 *   queue order, which is exactly the audited ordering:
 *     feed read < other writer's commit < feed write.
 *
 * THE INVARIANT
 *   Feed units are conserved: final = start + purchased - successful feeds.
 *   A request that loses the race must be rejected (409), not silently applied
 *   on top of stale data, and its horse must not be marked fed.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma, { PrismaClient } from '../../../../packages/database/prismaClient.mjs';
import { buildDatabaseUrl } from '../../../../packages/database/dbPoolConfig.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-FeedStale';
const START_UNITS = 5;
const UNITS_PER_PACK = 100;

// Dedicated client so the barrier never competes with the app singleton's
// pool for the connections the blocked requests hold.
const barrierClient = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl(process.env.DATABASE_URL, process.env) } },
  log: [],
  errorFormat: 'minimal',
});

const uniq = () => randomBytes(6).toString('hex');

const basicFeed = quantity => ({
  id: 'feed-basic',
  itemId: 'basic',
  category: 'feed',
  name: 'Basic Feed',
  quantity,
});

const csrfFor = jwt => fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${jwt}`] });

/** Build (but do not send) an authenticated, CSRF-carrying POST. */
function authedPost(endpoint, jwt, csrf, body) {
  return request(app)
    .post(endpoint)
    .set('Authorization', `Bearer ${jwt}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body ?? {});
}

/**
 * Holds `FOR UPDATE` on the user's row on the barrier client until
 * `release()`. Returns the holding session's backend pid.
 */
async function openUserRowBarrier(userId) {
  let release;
  let ready;
  const released = new Promise(r => {
    release = r;
  });
  const armed = new Promise(r => {
    ready = r;
  });

  let pid;
  // Recorded (never swallowed) and rethrown from release().
  let barrierFailure = null;
  const held = barrierClient
    .$transaction(
      async tx => {
        const rows = await tx.$queryRaw`SELECT pg_backend_pid()::int AS pid`;
        pid = Number(rows[0].pid);
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
        ready();
        await released;
      },
      { maxWait: 20000, timeout: 120000 },
    )
    .then(
      () => undefined,
      err => {
        barrierFailure = err;
      },
    );

  await Promise.race([
    armed,
    held.then(() => {
      throw barrierFailure ?? new Error('barrier transaction ended before it was armed');
    }),
  ]);

  return {
    pid,
    async release() {
      release();
      await held;
      if (barrierFailure) {
        throw barrierFailure;
      }
    },
  };
}

/** Resolves once `count` sessions are transitively blocked by the barrier. */
async function waitForBlockedSessions(barrierPid, count, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const rows = await barrierClient.$queryRaw`
      WITH RECURSIVE chain AS (
        SELECT pid FROM pg_stat_activity WHERE pid = ${barrierPid}
        UNION
        SELECT a.pid
        FROM pg_stat_activity a
        JOIN chain c ON c.pid = ANY (pg_blocking_pids(a.pid))
      )
      SELECT (count(*) - 1)::int AS blocked FROM chain`;
    const seen = Number(rows[0].blocked);
    if (seen >= count) {
      return seen;
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${count} session(s) blocked by pid ${barrierPid}; saw ${seen}`);
    }
    await new Promise(r => setTimeout(r, 20));
  }
}

async function readFeedUnits(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } });
  const inventory = Array.isArray(row?.settings?.inventory) ? row.settings.inventory : [];
  const feed = inventory.find(i => i.id === 'feed-basic');
  return feed ? feed.quantity : 0;
}

async function countFedHorses(horseIds) {
  const rows = await prisma.horse.findMany({
    where: { id: { in: horseIds } },
    select: { lastFedDate: true },
  });
  return rows.filter(h => h.lastFedDate !== null).length;
}

describe('Equoria-bvddn.13 — feeding never overwrites the feed inventory with a stale copy', () => {
  const cleanup = createCleanupTracker();
  let horseIds;
  let userIds;
  let user;
  let token;

  const makeHorse = () =>
    createTestHorse(
      prisma,
      {
        name: `${FIXTURE_PREFIX}-${uniq()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2022-01-01'),
        age: 4,
        userId: user.id,
        equippedFeedType: 'basic',
        lastFedDate: null,
      },
      horseIds,
    );

  beforeEach(async () => {
    horseIds = [];
    userIds = [];
    const tag = uniq();
    user = await prisma.user.create({
      data: {
        email: `${FIXTURE_PREFIX}-${tag}@example.com`,
        username: `${FIXTURE_PREFIX}-${tag}`,
        password: 'irrelevant-hash',
        firstName: 'Feed',
        lastName: 'Stale',
        money: 10000,
        settings: { inventory: [basicFeed(START_UNITS)] },
      },
    });
    userIds.push(user.id);
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'ledger');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
  }, 60000);

  afterEach(() => cleanup.run(), 60000);

  afterAll(async () => {
    await barrierClient.$disconnect();
  });

  it('A: a feed purchase committed mid-feed is not erased by the feed', async () => {
    const horse = await makeHorse();

    const purchaseCsrf = await csrfFor(token);
    const feedCsrf = await csrfFor(token);

    const barrier = await openUserRowBarrier(user.id);
    let purchasePromise;
    let feedPromise;
    try {
      // The purchase's money debit queues on the barrier's row lock.
      purchasePromise = authedPost('/api/v1/feed-shop/purchase', token, purchaseCsrf, {
        feedTier: 'basic',
        packs: 1,
      }).then(r => r);
      await waitForBlockedSessions(barrier.pid, 1);

      // The feed reads the PRE-purchase inventory (the purchase has not
      // committed), claims its horse, then queues its User write behind the
      // purchase.
      feedPromise = authedPost(`/api/v1/horses/${horse.id}/feed`, token, feedCsrf).then(r => r);
      await waitForBlockedSessions(barrier.pid, 2);
    } finally {
      await barrier.release();
    }

    const [purchaseRes, feedRes] = await Promise.all([purchasePromise, feedPromise]);

    expect(purchaseRes.status).toBe(200);
    // The loser of the race must be rejected, never applied on stale data.
    expect([200, 409]).toContain(feedRes.status);

    const successfulFeeds = feedRes.status === 200 ? 1 : 0;
    const units = await readFeedUnits(user.id);

    // Conservation: the 100 purchased units must all still be there.
    expect(units).toBe(START_UNITS + UNITS_PER_PACK - successfulFeeds);
    // A rejected feed leaves its horse unfed (the claim rolled back with it).
    expect(await countFedHorses([horse.id])).toBe(successfulFeeds);

    // A rejected feed is retryable and then consumes exactly one unit.
    if (feedRes.status === 409) {
      const retry = await authedPost(`/api/v1/horses/${horse.id}/feed`, token, await csrfFor(token));
      expect(retry.status).toBe(200);
      expect(await readFeedUnits(user.id)).toBe(START_UNITS + UNITS_PER_PACK - 1);
    }
  }, 120000);

  it('B: two horses fed at once never consume a single unit between them', async () => {
    const horseA = await makeHorse();
    const horseB = await makeHorse();

    const csrfA = await csrfFor(token);
    const csrfB = await csrfFor(token);

    const barrier = await openUserRowBarrier(user.id);
    let aPromise;
    let bPromise;
    try {
      aPromise = authedPost(`/api/v1/horses/${horseA.id}/feed`, token, csrfA).then(r => r);
      await waitForBlockedSessions(barrier.pid, 1);

      bPromise = authedPost(`/api/v1/horses/${horseB.id}/feed`, token, csrfB).then(r => r);
      await waitForBlockedSessions(barrier.pid, 2);
    } finally {
      await barrier.release();
    }

    const [aRes, bRes] = await Promise.all([aPromise, bPromise]);
    const statuses = [aRes.status, bRes.status];
    for (const s of statuses) {
      expect([200, 409]).toContain(s);
    }
    // At least one feed goes through; a lost race is a clean rejection.
    const successfulFeeds = statuses.filter(s => s === 200).length;
    expect(successfulFeeds).toBeGreaterThanOrEqual(1);

    // Conservation: every successful feed consumed exactly one unit.
    expect(await readFeedUnits(user.id)).toBe(START_UNITS - successfulFeeds);
    expect(await countFedHorses([horseA.id, horseB.id])).toBe(successfulFeeds);
  }, 120000);
});
