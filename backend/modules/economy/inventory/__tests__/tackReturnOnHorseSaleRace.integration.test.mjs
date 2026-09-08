/**
 * The sale's tack return and a concurrent inventory write contend for ONE
 * value — the seller's `User.settings.inventory` array (owner ruling
 * Equoria-6p398.12, built on Finding 1 / Equoria-6p398.1).
 *
 * WHY THIS FILE EXISTS
 *   `marketplaceController.buyHorse` now writes the SELLER's inventory inside
 *   the buy transaction (the tack coming off the sold horse). The seller can be
 *   equipping something else at that moment. Both writers compute a new array
 *   from a prior read of the same array, so mechanism (1) of the concurrency
 *   ruling — one atomic statement touching only the intended path — is not
 *   sufficient on its own: whoever writes second from a stale snapshot silently
 *   discards the other's change. That is exactly the Finding 1 defect, and it
 *   would let a seller's in-flight equip resurrect an inventory record pointing
 *   at a horse they no longer own.
 *
 *   Mechanism (2) closes it: `updateUserSettingsPaths(..., { expect })` is a
 *   compare-and-swap. Whoever loses affects zero rows and MUST reject.
 *
 * HOW THE INTERLEAVING IS FORCED (no mocks, no sleeps, no route interception)
 *   A real PostgreSQL row lock taken by the test on a SECOND Prisma client —
 *   the same technique as inventorySettingsRace.integration.test.mjs:
 *
 *     1. barrier tx: SELECT id FROM "User" WHERE id = <seller> FOR UPDATE
 *     2. fire POST /marketplace/buy  -> queues on that lock at `creditSeller`
 *     3. wait until it is really blocked (pg_blocking_pids, not a sleep)
 *     4. fire POST /inventory/equip  -> its SELECT of settings succeeds and
 *        observes the pre-sale document; its own UPDATE queues BEHIND the sale
 *     5. wait until it too is really blocked
 *     6. release the barrier -> the sale (queued first) commits; the equip then
 *        finds `inventory` changed underneath it and rejects with 409
 *
 *   Nothing is stubbed. Every query is the production query, only DELAYED by a
 *   lock the database itself arbitrates. The barrier is released in `finally`.
 *
 * WHY IT CANNOT DEADLOCK
 *   The barrier holds one row lock and releases unconditionally; both requests
 *   are ordinary transactions that finish once it is gone. The test never waits
 *   on a request while holding a lock that request needs.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../../app.mjs';
import prisma, { PrismaClient } from '../../../../../packages/database/prismaClient.mjs';
import { buildDatabaseUrl } from '../../../../../packages/database/dbPoolConfig.mjs';
import { generateTestToken } from '../../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-6p398-12-race';
const LIST_PRICE = 400;
const SOLD_SADDLE = 'all-purpose-saddle'; // 400, category `saddle`
const SPARE_BRIDLE = 'snaffle-bridle'; // 200, category `bridle`

// A dedicated client so the barrier transaction never competes with the app
// singleton's pool for the connections the blocked requests hold.
const barrierClient = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl(process.env.DATABASE_URL, process.env) } },
  log: [],
  errorFormat: 'minimal',
});

const uniq = () => randomBytes(6).toString('hex');

async function makeUser(role, money) {
  const suffix = uniq();
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${role}-${suffix}`,
      email: `${FIXTURE_PREFIX}-${role}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'TackRace',
      lastName: role,
      money,
    },
  });
  return {
    id: user.id,
    token: generateTestToken({ id: user.id, email: user.email, role: 'user' }),
  };
}

async function makeHorse(ownerId, { forSale = false, salePrice = 0 } = {}) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${uniq()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: ownerId,
      healthStatus: 'Excellent',
      forSale,
      salePrice,
    },
  });
}

async function post(endpoint, token, body) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post(endpoint)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body ?? {});
}

/** Settled-safe: a rejected supertest promise must not surface as an unhandled rejection. */
function settled(promise) {
  return promise.then(
    res => ({ status: res.status, body: res.body }),
    err => ({ status: 0, body: { message: String(err?.message ?? err) } }),
  );
}

/**
 * Opens a transaction on the barrier client holding `FOR UPDATE` on the
 * seller's row until `release()`. Returns the holding session's backend pid so
 * waiters can be detected precisely.
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
    .catch(err => {
      barrierFailure = err;
    });

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

/** Resolves once `count` sessions are transitively blocked by the barrier session. */
async function waitForBlockedSessions(barrierPid, count, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let seen;
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
    seen = Number(rows[0].blocked);
    if (seen >= count) {
      return seen;
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${count} session(s) blocked by pid ${barrierPid}; saw ${seen}`);
    }
    await new Promise(r => setTimeout(r, 20));
  }
}

async function readInventory(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } });
  const inv = row?.settings?.inventory;
  return Array.isArray(inv) ? inv : [];
}

async function readTack(horseId) {
  const row = await prisma.horse.findUnique({ where: { id: horseId }, select: { tack: true } });
  return row?.tack && typeof row.tack === 'object' ? row.tack : {};
}

describe('tack return on sale vs a concurrent inventory write (Equoria-6p398.12)', () => {
  const cleanup = createCleanupTracker();
  let seller;
  let buyer;
  let listedHorse;
  let keptHorse;
  let saddleRecordId;
  let bridleRecordId;

  beforeEach(async () => {
    seller = await makeUser('seller', 5000);
    buyer = await makeUser('buyer', 10000);
    listedHorse = await makeHorse(seller.id, { forSale: true, salePrice: LIST_PRICE });
    keptHorse = await makeHorse(seller.id);

    const userIds = [seller.id, buyer.id];
    const horseIds = [listedHorse.id, keptHorse.id];
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notification');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'userTransaction');
    cleanup.add(() => prisma.horseSale.deleteMany({ where: { horseId: { in: horseIds } } }), 'horseSale');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');

    // Real provenance, through the real endpoints: a saddle on the LISTED horse
    // (which the sale must return) and a spare bridle the seller is free to
    // move (the concurrent write that races the sale).
    expect(
      (await post('/api/v1/tack-shop/purchase', seller.token, { horseId: listedHorse.id, itemId: SOLD_SADDLE })).status,
    ).toBe(200);
    expect(
      (await post('/api/v1/tack-shop/purchase', seller.token, { horseId: keptHorse.id, itemId: SPARE_BRIDLE })).status,
    ).toBe(200);

    const seeded = await request(app)
      .get('/api/v1/inventory')
      .set('Authorization', `Bearer ${seller.token}`)
      .set('Origin', ORIGIN);
    expect(seeded.status).toBe(200);
    saddleRecordId = seeded.body.data.items.find(i => i.itemId === SOLD_SADDLE).id;
    bridleRecordId = seeded.body.data.items.find(i => i.itemId === SPARE_BRIDLE).id;

    // Free the bridle so the racing action is an ordinary equip.
    expect((await post('/api/v1/inventory/unequip', seller.token, { inventoryItemId: bridleRecordId })).status).toBe(
      200,
    );
  }, 90000);

  afterEach(() => cleanup.run(), 60000);

  afterAll(async () => {
    await barrierClient.$disconnect();
  });

  it('rejects the seller’s equip queued behind the sale instead of losing the tack return', async () => {
    const barrier = await openUserRowBarrier(seller.id);
    let sale;
    let equip;
    try {
      // 1. The sale queues first, at `creditSeller`.
      sale = settled(post(`/api/v1/marketplace/buy/${listedHorse.id}`, buyer.token));
      await waitForBlockedSessions(barrier.pid, 1);

      // 2. The seller's equip reads the PRE-sale inventory, then queues behind.
      equip = settled(
        post('/api/v1/inventory/equip', seller.token, {
          inventoryItemId: bridleRecordId,
          horseId: keptHorse.id,
        }),
      );
      await waitForBlockedSessions(barrier.pid, 2);
    } finally {
      // 3. Release unconditionally — a failed assertion must not strand either
      //    request on the lock.
      await barrier.release();
    }

    const saleResult = await sale;
    const equipResult = await equip;

    // The sale committed; the equip computed its array from a snapshot the sale
    // has since replaced, so its compare-and-swap affected zero rows.
    expect(saleResult.status).toBe(200);
    expect(equipResult.status).toBe(409);
    expect(equipResult.body.message).toMatch(/inventory changed/i);

    // Final state — the forbidden outcome is the equip's stale array winning,
    // which would restore `equippedToHorseId: <sold horse>` on the saddle.
    const soldHorse = await prisma.horse.findUnique({
      where: { id: listedHorse.id },
      select: { userId: true, tack: true },
    });
    expect(soldHorse.userId).toBe(buyer.id);
    expect(soldHorse.tack.saddle).toBeUndefined();

    const inventory = await readInventory(seller.id);
    const saddle = inventory.find(i => i.id === saddleRecordId);
    expect(saddle).toBeDefined();
    expect(saddle.equippedToHorseId).toBeNull();

    // The rejected equip changed nothing: the bridle is still free and the
    // horse the seller kept is still bare.
    const bridle = inventory.find(i => i.id === bridleRecordId);
    expect(bridle.equippedToHorseId).toBeNull();
    expect((await readTack(keptHorse.id)).bridle).toBeUndefined();

    // The seller can simply retry against fresh state.
    const retry = await post('/api/v1/inventory/equip', seller.token, {
      inventoryItemId: bridleRecordId,
      horseId: keptHorse.id,
    });
    expect(retry.status).toBe(200);
    expect((await readTack(keptHorse.id)).bridle).toBe(SPARE_BRIDLE);
    // The sale's return still stands after the retry.
    expect((await readInventory(seller.id)).find(i => i.id === saddleRecordId).equippedToHorseId).toBeNull();
  }, 120000);
});
