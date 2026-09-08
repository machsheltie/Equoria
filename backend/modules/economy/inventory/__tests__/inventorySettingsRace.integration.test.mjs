/**
 * Finding 1 (2026-09-05 security audit) — inventory/settings writers must not
 * erase economy state held in the SAME `User.settings` JSON document.
 * Tracker: Equoria-6p398.1, Equoria-q9nqm.
 *
 * THE DEFECT THIS FILE REPRODUCES
 *   `User.settings` is ONE jsonb document. It holds `inventory`, the weekly
 *   bank-claim marker `lastWeeklyClaimDate` (bankController), crafting
 *   materials, onboarding state and preferences. `equipItem` read the whole
 *   document, then wrote the whole document back from that earlier snapshot.
 *   A `POST /api/v1/bank/claim` that committed in between was silently
 *   erased: the marker vanished and the player could claim 5,000 coins a
 *   second time in the same week (0 -> 10,000).
 *
 * HOW THE INTERLEAVING IS FORCED (no mocks, no sleeps, no route interception)
 *   The barrier is a REAL PostgreSQL row lock taken by the test itself on a
 *   SECOND Prisma client (constructed from prismaClient.mjs's `PrismaClient`
 *   re-export — one @prisma/client copy per process, Equoria-fefh2.44):
 *
 *     1. barrier tx: SELECT ... FROM "User" WHERE id = <fixture> FOR UPDATE
 *     2. fire POST /bank/claim   -> its guarded UPDATE queues on that lock
 *     3. wait until it is really blocked (pg_blocking_pids, not a sleep)
 *     4. fire POST /inventory/equip -> its SELECT of settings succeeds and
 *        observes the pre-claim document (READ COMMITTED: the claim has not
 *        committed), then its own UPDATE queues BEHIND the claim
 *     5. wait until it too is really blocked
 *     6. release the barrier -> the claim (queued first) commits, then equip's
 *        write lands on top of it
 *
 *   That is exactly the audited ordering: equip read < claim commit < equip
 *   write. Nothing is stubbed; every query is the real production query, only
 *   DELAYED by a lock the database itself arbitrates. The barrier is always
 *   released in `finally`.
 *
 * A NOTE ON THE CONNECTION POOL
 *   Two request transactions are deliberately in flight at once, against the
 *   test worker's `connection_limit: 3` (packages/database/dbPoolConfig.mjs).
 *   That fits because each interactive transaction holds exactly ONE pooled
 *   connection for all of its statements, raw statements included. Before the
 *   `databaseConnectionMiddleware` repair in this same change it did not: raw
 *   statements were re-bound to the root client and needed a SECOND connection
 *   each, and this file's second request died on the pool queue (a P2028 -> 503
 *   at ~4,983 ms) instead of resolving at the lock.
 *
 * WHY IT CANNOT DEADLOCK
 *   The barrier holds only a row lock and releases unconditionally in
 *   `finally`; both requests are ordinary short transactions that finish once
 *   it is gone. The test never waits for a request while still holding a lock
 *   that request needs.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../../app.mjs';
import prisma, { PrismaClient } from '../../../../../packages/database/prismaClient.mjs';
import { buildDatabaseUrl } from '../../../../../packages/database/dbPoolConfig.mjs';
import { generateTestToken } from '../../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../../tests/helpers/csrfHelper.mjs';
import { createTestHorse } from '../../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const WEEKLY_REWARD = 5000;
const FIXTURE_PREFIX = 'TestFixture-Finding1';

// A dedicated client so the barrier transaction never competes with the app
// singleton's pool for the connections the blocked requests hold.
const barrierClient = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl(process.env.DATABASE_URL, process.env) } },
  log: [],
  errorFormat: 'minimal',
});

const uniq = () => `${randomBytes(6).toString('hex')}`;

const saddleItem = id => ({
  id,
  itemId: 'all-purpose-saddle',
  category: 'saddle',
  name: 'All-Purpose Saddle',
  bonus: 5,
  quantity: 1,
  equippedToHorseId: null,
});

/** Unrelated settings keys that every repaired writer must leave untouched. */
const UNRELATED_SETTINGS = Object.freeze({
  craftingMaterials: { leather: 3, cloth: 2, dye: 1, metal: 4, thread: 5 },
  milestones: { firstWin: '2026-01-01T00:00:00.000Z' },
  completedOnboarding: true,
  onboardingStep: 10,
});

const csrfFor = jwt => fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${jwt}`] });

async function post(endpoint, jwt, body) {
  const c = await csrfFor(jwt);
  return request(app)
    .post(endpoint)
    .set('Authorization', `Bearer ${jwt}`)
    .set('Origin', ORIGIN)
    .set('Cookie', c.cookieHeader)
    .set('X-CSRF-Token', c.csrfToken)
    .send(body ?? {});
}

async function patch(endpoint, jwt, body) {
  const c = await csrfFor(jwt);
  return request(app)
    .patch(endpoint)
    .set('Authorization', `Bearer ${jwt}`)
    .set('Origin', ORIGIN)
    .set('Cookie', c.cookieHeader)
    .set('X-CSRF-Token', c.csrfToken)
    .send(body ?? {});
}

async function put(endpoint, jwt, body) {
  const c = await csrfFor(jwt);
  return request(app)
    .put(endpoint)
    .set('Authorization', `Bearer ${jwt}`)
    .set('Origin', ORIGIN)
    .set('Cookie', c.cookieHeader)
    .set('X-CSRF-Token', c.csrfToken)
    .send(body ?? {});
}

/**
 * Opens a transaction on the barrier client that holds `FOR UPDATE` on the
 * fixture user's row until `release()` is called. Returns the backend pid of
 * the holding session so waiters can be detected precisely.
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
  // A barrier failure is RECORDED here (never swallowed) so the promise has a
  // handler while the test is between arming and releasing; `release()` rethrows
  // it, and the arming race below surfaces it immediately if the transaction
  // dies before it ever took the lock.
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

/**
 * Resolves once `count` database sessions are transitively blocked by the
 * barrier session. This is a real lock-state observation, not a sleep: the
 * assertion below can only pass when the requests are genuinely queued.
 */
async function waitForBlockedSessions(barrierPid, count, timeoutMs = 15000) {
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

const readSettings = async userId => {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } });
  return row?.settings && typeof row.settings === 'object' ? row.settings : {};
};

const readTack = async horseId => {
  const row = await prisma.horse.findUnique({ where: { id: horseId }, select: { tack: true } });
  return row?.tack && typeof row.tack === 'object' ? row.tack : {};
};

describe('Finding 1 — User.settings economy state survives inventory + settings writes', () => {
  const cleanup = createCleanupTracker();
  let horseIds;
  let userIds;
  let user;
  let token;

  beforeEach(async () => {
    horseIds = [];
    userIds = [];
    const tag = uniq();
    user = await prisma.user.create({
      data: {
        email: `${FIXTURE_PREFIX}-${tag}@example.com`,
        username: `${FIXTURE_PREFIX}-${tag}`,
        password: 'irrelevant-hash',
        firstName: 'Finding',
        lastName: 'One',
        money: 0,
        settings: {},
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

  it('does not erase lastWeeklyClaimDate when equip commits after a weekly claim', async () => {
    const itemId = `inv-${uniq()}`;
    await prisma.user.update({
      where: { id: user.id },
      data: { settings: { ...UNRELATED_SETTINGS, inventory: [saddleItem(itemId)] } },
    });
    const horse = await createTestHorse(
      prisma,
      {
        name: `${FIXTURE_PREFIX}-horse-${uniq()}`,
        sex: 'Filly',
        dateOfBirth: new Date('2022-01-01'),
        age: 3,
        userId: user.id,
      },
      horseIds,
    );

    // Pre-fetch CSRF so no extra request work happens while the barrier is held.
    const claimCsrf = await csrfFor(token);
    const equipCsrf = await csrfFor(token);

    const settleOrder = [];
    const barrier = await openUserRowBarrier(user.id);
    let claimPromise;
    let equipPromise;
    try {
      claimPromise = request(app)
        .post('/api/v1/bank/claim')
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', ORIGIN)
        .set('Cookie', claimCsrf.cookieHeader)
        .set('X-CSRF-Token', claimCsrf.csrfToken)
        .send({})
        .then(r => {
          settleOrder.push('claim');
          return r;
        });

      // The claim's guarded UPDATE is now queued on the barrier's row lock.
      await waitForBlockedSessions(barrier.pid, 1);

      equipPromise = request(app)
        .post('/api/v1/inventory/equip')
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', ORIGIN)
        .set('Cookie', equipCsrf.cookieHeader)
        .set('X-CSRF-Token', equipCsrf.csrfToken)
        .send({ inventoryItemId: itemId, horseId: horse.id })
        .then(r => {
          settleOrder.push('equip');
          return r;
        });

      // Equip has now read User.settings (the claim has NOT committed, so the
      // read cannot see the marker) and is queued behind the claim.
      await waitForBlockedSessions(barrier.pid, 2);
    } finally {
      await barrier.release();
    }

    const claimRes = await claimPromise;
    const equipRes = await equipPromise;

    // Both mutations succeeded — as they did in the audit's reproduction.
    // (`settleOrder` records only when each HTTP response was serialised, which
    // is a photo finish once the lock is released; the DATABASE ordering is
    // enforced by the lock queue, and the persisted assertions below are what
    // actually distinguish the defect from the fix.)
    expect({ claim: claimRes.status, equip: equipRes.status, settled: settleOrder.length }).toEqual({
      claim: 200,
      equip: 200,
      settled: 2,
    });

    // The marker must have survived equip's write.
    const settings = await readSettings(user.id);
    expect(typeof settings.lastWeeklyClaimDate).toBe('string');

    // Equip's own effect still persisted.
    expect(settings.inventory[0].equippedToHorseId).toBe(horse.id);
    expect((await readTack(horse.id)).saddle).toBe('all-purpose-saddle');

    // Unrelated keys untouched.
    expect(settings.craftingMaterials).toEqual(UNRELATED_SETTINGS.craftingMaterials);
    expect(settings.milestones).toEqual(UNRELATED_SETTINGS.milestones);

    // A second claim in the same week must be rejected, and money stays 5,000.
    const secondClaim = await post('/api/v1/bank/claim', token);
    expect(secondClaim.status).toBe(400);

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(after.money).toBe(WEEKLY_REWARD);

    const credits = await prisma.userTransaction.findMany({
      where: { userId: user.id, category: 'weekly_reward' },
    });
    expect(credits).toHaveLength(1);
  }, 120000);

  it('cannot leave one item equipped to two horses under concurrent equips', async () => {
    const itemId = `inv-${uniq()}`;
    await prisma.user.update({
      where: { id: user.id },
      data: { settings: { ...UNRELATED_SETTINGS, inventory: [saddleItem(itemId)] } },
    });
    const horseA = await createTestHorse(
      prisma,
      {
        name: `${FIXTURE_PREFIX}-a-${uniq()}`,
        sex: 'Filly',
        dateOfBirth: new Date('2022-01-01'),
        age: 3,
        userId: user.id,
      },
      horseIds,
    );
    const horseB = await createTestHorse(
      prisma,
      {
        name: `${FIXTURE_PREFIX}-b-${uniq()}`,
        sex: 'Filly',
        dateOfBirth: new Date('2022-01-01'),
        age: 3,
        userId: user.id,
      },
      horseIds,
    );

    const csrfA = await csrfFor(token);
    const csrfB = await csrfFor(token);

    const barrier = await openUserRowBarrier(user.id);
    let aPromise;
    let bPromise;
    try {
      // `.then()` dispatches the supertest request; without it nothing is sent.
      aPromise = request(app)
        .post('/api/v1/inventory/equip')
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', ORIGIN)
        .set('Cookie', csrfA.cookieHeader)
        .set('X-CSRF-Token', csrfA.csrfToken)
        .send({ inventoryItemId: itemId, horseId: horseA.id })
        .then(r => r);
      await waitForBlockedSessions(barrier.pid, 1);

      bPromise = request(app)
        .post('/api/v1/inventory/equip')
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', ORIGIN)
        .set('Cookie', csrfB.cookieHeader)
        .set('X-CSRF-Token', csrfB.csrfToken)
        .send({ inventoryItemId: itemId, horseId: horseB.id })
        .then(r => r);
      await waitForBlockedSessions(barrier.pid, 2);
    } finally {
      await barrier.release();
    }

    const [aRes, bRes] = await Promise.all([aPromise, bPromise]);

    // Exactly one equip wins the compare-and-swap; the other is REJECTED
    // rather than silently overwriting it. (Which one wins is not determined,
    // hence the sort.)
    expect([aRes.status, bRes.status].sort()).toEqual([200, 409]);

    const tackA = await readTack(horseA.id);
    const tackB = await readTack(horseB.id);
    const wearing = [
      tackA.saddle === 'all-purpose-saddle' ? horseA.id : null,
      tackB.saddle === 'all-purpose-saddle' ? horseB.id : null,
    ].filter(Boolean);

    // The forbidden final state: the same item's bonus on two horses.
    expect(wearing).toHaveLength(1);

    // Inventory placement must agree with the horse that actually wears it.
    const settings = await readSettings(user.id);
    expect(settings.inventory).toHaveLength(1);
    expect(settings.inventory[0].equippedToHorseId).toBe(wearing[0]);
  }, 120000);

  it('rolls the whole equip back when the horse is transferred mid-request', async () => {
    const itemId = `inv-${uniq()}`;
    const startingInventory = [saddleItem(itemId)];
    await prisma.user.update({
      where: { id: user.id },
      data: { settings: { ...UNRELATED_SETTINGS, inventory: startingInventory } },
    });

    const tag = uniq();
    const newOwner = await prisma.user.create({
      data: {
        email: `${FIXTURE_PREFIX}-new-${tag}@example.com`,
        username: `${FIXTURE_PREFIX}-new-${tag}`,
        password: 'irrelevant-hash',
        firstName: 'Finding',
        lastName: 'One',
        money: 0,
        settings: {},
      },
    });
    userIds.push(newOwner.id);

    const horse = await createTestHorse(
      prisma,
      {
        name: `${FIXTURE_PREFIX}-sold-${uniq()}`,
        sex: 'Filly',
        dateOfBirth: new Date('2022-01-01'),
        age: 3,
        userId: user.id,
        tack: {},
      },
      horseIds,
    );

    const csrf = await csrfFor(token);
    const barrier = await openUserRowBarrier(user.id);
    let equipPromise;
    try {
      equipPromise = request(app)
        .post('/api/v1/inventory/equip')
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ inventoryItemId: itemId, horseId: horse.id })
        .then(r => r);

      // Equip has read the horse as owned and is queued on the settings write.
      await waitForBlockedSessions(barrier.pid, 1);

      // The horse changes hands before equip's dependent writes run.
      await prisma.horse.update({ where: { id: horse.id }, data: { userId: newOwner.id } });
    } finally {
      await barrier.release();
    }

    const equipRes = await equipPromise;
    expect(equipRes.status).toBe(409);

    // The new owner's horse was NOT re-tacked by the former owner.
    expect(await readTack(horse.id)).toEqual({});

    // And the former owner's inventory write rolled back with it.
    const settings = await readSettings(user.id);
    expect(settings.inventory).toEqual(startingInventory);
    expect(settings.craftingMaterials).toEqual(UNRELATED_SETTINGS.craftingMaterials);
  }, 120000);

  describe('sibling User.settings writers preserve the weekly-claim marker', () => {
    const MARKER = '2026-09-06T00:00:00.000Z';

    const seed = async extra => {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          settings: { ...UNRELATED_SETTINGS, lastWeeklyClaimDate: MARKER, ...extra },
        },
      });
    };

    const expectPreserved = async ({ craftingMaterials = UNRELATED_SETTINGS.craftingMaterials } = {}) => {
      const settings = await readSettings(user.id);
      expect(settings.lastWeeklyClaimDate).toBe(MARKER);
      expect(settings.craftingMaterials).toEqual(craftingMaterials);
      expect(settings.milestones).toEqual(UNRELATED_SETTINGS.milestones);
      return settings;
    };

    it('inventory unequip preserves it', async () => {
      const itemId = `inv-${uniq()}`;
      const horse = await createTestHorse(
        prisma,
        {
          name: `${FIXTURE_PREFIX}-uneq-${uniq()}`,
          sex: 'Filly',
          dateOfBirth: new Date('2022-01-01'),
          age: 3,
          userId: user.id,
          tack: { saddle: 'all-purpose-saddle' },
        },
        horseIds,
      );
      await seed({ inventory: [{ ...saddleItem(itemId), equippedToHorseId: horse.id }] });

      const res = await post('/api/v1/inventory/unequip', token, { inventoryItemId: itemId });
      expect(res.status).toBe(200);

      const settings = await expectPreserved();
      expect(settings.inventory[0].equippedToHorseId).toBeNull();
      expect(await readTack(horse.id)).toEqual({});
    }, 60000);

    it('the inventory GET tack-seed preserves it', async () => {
      await seed({});
      const horse = await createTestHorse(
        prisma,
        {
          name: `${FIXTURE_PREFIX}-seed-${uniq()}`,
          sex: 'Filly',
          dateOfBirth: new Date('2022-01-01'),
          age: 3,
          userId: user.id,
          tack: { saddle: 'all-purpose-saddle' },
        },
        horseIds,
      );

      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', ORIGIN);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);

      const settings = await expectPreserved();
      expect(settings.inventory).toHaveLength(1);
      expect(settings.inventory[0].equippedToHorseId).toBe(horse.id);
    }, 60000);

    it('the feed shop purchase preserves it', async () => {
      await seed({});
      await prisma.user.update({ where: { id: user.id }, data: { money: 1000 } });

      const res = await post('/api/v1/feed-shop/purchase', token, {
        feedTier: 'basic',
        packs: 1,
      });
      expect(res.status).toBe(200);

      const settings = await expectPreserved();
      // The purchase's own effect landed …
      expect(settings.inventory).toEqual([expect.objectContaining({ id: 'feed-basic', quantity: 100 })]);
      // … and the coins actually left the wallet.
      const after = await prisma.user.findUnique({
        where: { id: user.id },
        select: { money: true },
      });
      expect(after.money).toBe(900);
    }, 60000);

    it('crafting preserves it', async () => {
      await seed({});
      await prisma.user.update({ where: { id: user.id }, data: { money: 1000 } });

      // Tier-0 recipe: 75 coins, 1 leather. The seeded materials hold 3 leather.
      const res = await post('/api/v1/crafting/craft', token, { recipeId: 'basic-halter' });
      expect(res.status).toBe(200);

      // Crafting DOES own craftingMaterials, so that key legitimately changes;
      // the marker and every key crafting does not own must not.
      const settings = await expectPreserved({
        craftingMaterials: { ...UNRELATED_SETTINGS.craftingMaterials, leather: 2 },
      });
      expect(settings.inventory).toEqual([expect.objectContaining({ itemId: 'crafted-basic-halter' })]);
      const after = await prisma.user.findUnique({
        where: { id: user.id },
        select: { money: true },
      });
      expect(after.money).toBe(925);
    }, 60000);

    it('PATCH /auth/profile/preferences preserves it', async () => {
      await seed({ preferences: { reducedMotion: false, soundEnabled: false } });

      const res = await patch('/api/v1/auth/profile/preferences', token, { reducedMotion: true });
      expect(res.status).toBe(200);

      const settings = await expectPreserved();
      expect(settings.preferences.reducedMotion).toBe(true);
      expect(settings.preferences.soundEnabled).toBe(false);
    }, 60000);

    it('PUT /auth/profile preserves it', async () => {
      await seed({ notifications: { emailSystem: true } });

      // Only `bio` survives this route's validator chain + sanitizeRequestData
      // (notifications/display are not declared on it), so bio is the settings
      // key this endpoint actually writes.
      const res = await put('/api/v1/auth/profile', token, { bio: 'A quiet barn at dusk.' });
      expect(res.status).toBe(200);

      const settings = await expectPreserved();
      expect(settings.bio).toBe('A quiet barn at dusk.');
      expect(settings.notifications).toEqual({ emailSystem: true });
    }, 60000);

    it('POST /auth/complete-onboarding preserves it', async () => {
      await seed({ completedOnboarding: false });

      const res = await post('/api/v1/auth/complete-onboarding', token);
      expect(res.status).toBe(200);

      const settings = await expectPreserved();
      expect(settings.completedOnboarding).toBe(true);
    }, 60000);

    it('PUT /users/:id preserves it', async () => {
      await seed({});

      const res = await put(`/api/v1/users/${user.id}`, token, {
        settings: { display: { compact: true } },
      });
      expect(res.status).toBe(200);

      const settings = await expectPreserved();
      expect(settings.display.compact).toBe(true);
    }, 60000);
  });
});
