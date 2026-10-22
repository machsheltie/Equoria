/**
 * Equoria-9a5ny + Equoria-mc22a: the two groom-care doors
 * (POST /api/v1/grooms/interact and POST /api/v1/grooms/enhanced/interact)
 * hold the one-interaction-per-horse-per-game-day limit under concurrency, and
 * the enhanced door commits its interaction row and the horse's bond/stress as
 * one transaction.
 *
 * THE DEFECTS
 *  - 9a5ny: both doors checked the daily limit with an UNLOCKED read before any
 *    write. Two requests in flight for one horse both read "no interaction
 *    today", both wrote, and the horse was groomed twice in one day.
 *  - mc22a: the enhanced door wrote GroomInteraction and then Horse
 *    bondScore/stressLevel as two independent autocommit statements, so the
 *    interaction row was committed (spending the day's interaction) before the
 *    bond change existed, and a failure between them kept it that way.
 *
 * HOW THE RACE IS FORCED (no mocks, no sleeps-as-synchronisation)
 *   A second Prisma client takes a real row lock on the horse and holds it.
 *   Both requests are fired; the test waits until BOTH sessions are blocked
 *   behind the barrier session (pg_blocking_pids chain from the barrier's own
 *   pid, so another Jest worker's lock waits cannot count), then releases it.
 *   Pre-fix, each request had already passed its unlocked limit read before it
 *   blocked on its first write, so both committed. Post-fix, each request's
 *   first transactional statement is the horse-row lock, the limit is re-read
 *   after it, and the second request sees the first one's committed row.
 *
 * HOW THE ATOMICITY GAP IS OBSERVED (mc22a)
 *   The barrier holds `FOR SHARE` on the horse. An insert into groom
 *   interactions only needs `FOR KEY SHARE` on its parent (compatible), while
 *   the horse UPDATE needs a conflicting lock. Pre-fix, the request therefore
 *   committed its interaction row and then blocked on the horse update, and an
 *   outside reader saw the row with the bond unchanged. Post-fix the request
 *   blocks on the horse lock inside its transaction before writing anything,
 *   so no interaction row is visible until the whole set commits.
 *
 * WHAT THIS CANNOT SEE: lock-acquisition order beyond the horse row (carried by
 * the tx*LockOrder sentinels), and any writer of GroomInteraction other than
 * these two doors (at the time of writing, the only production writers).
 *
 * Real DB, real HTTP, real auth, real CSRF. Scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma, { PrismaClient } from '../../../../packages/database/prismaClient.mjs';
import { buildDatabaseUrl } from '../../../../packages/database/dbPoolConfig.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const tag = () => `9a5ny-${randomBytes(5).toString('hex')}`;

// A dedicated client, so the barrier never competes with the requests for the
// app singleton's pooled connections.
const barrierClient = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl(process.env.DATABASE_URL, process.env) } },
  log: [],
  errorFormat: 'minimal',
});

/**
 * Hold a row lock on the horse (`lockClause` is 'UPDATE' or 'SHARE') on the
 * barrier client until `release()` is called.
 */
async function armHorseBarrier(horseId, lockClause) {
  let release;
  let ready;
  const released = new Promise(r => {
    release = r;
  });
  const armed = new Promise(r => {
    ready = r;
  });
  let barrierFailure = null;
  const barrier = { pid: null };
  const held = barrierClient
    .$transaction(
      async tx => {
        const rows = await tx.$queryRaw`SELECT pg_backend_pid()::int AS pid`;
        barrier.pid = Number(rows[0].pid);
        if (lockClause === 'SHARE') {
          await tx.$queryRaw`SELECT "id" FROM "horses" WHERE "id" = ${horseId} FOR SHARE`;
        } else {
          await tx.$queryRaw`SELECT "id" FROM "horses" WHERE "id" = ${horseId} FOR UPDATE`;
        }
        ready();
        await released;
      },
      { maxWait: 20000, timeout: 120000 },
    )
    .catch(err => {
      barrierFailure = err;
    });

  barrier.release = async () => {
    release();
    await held;
    if (barrierFailure) {
      throw barrierFailure;
    }
  };

  await Promise.race([
    armed,
    held.then(() => {
      throw barrierFailure ?? new Error('barrier transaction ended before it was armed');
    }),
  ]);
  return barrier;
}

/** Resolves once `count` sessions are transitively blocked by the barrier session. */
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

describe('groom-care daily limit and atomicity under concurrency (Equoria-9a5ny, Equoria-mc22a)', () => {
  let user;
  let token;
  let horse;
  let groom;
  let csrf;
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    const suffix = tag();
    user = await prisma.user.create({
      data: {
        email: `${suffix}@test.com`,
        username: suffix,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Test',
        lastName: 'Race',
        money: 5000,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 5);
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${suffix}-Horse`,
        sex: 'Mare',
        dateOfBirth: dob,
        age: 5,
        bondScore: 50,
        stressLevel: 10,
        daysGroomedInARow: 0,
        temperament: 'Calm',
        userId: user.id,
      },
    });
    groom = await prisma.groom.create({
      data: {
        name: `${suffix}-Groom`,
        speciality: 'foal_care',
        skillLevel: 'intermediate',
        personality: 'patient',
        experience: 5,
        level: 1,
        sessionRate: 20,
        userId: user.id,
        isActive: true,
      },
    });
    csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });

    cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { foalId: horse?.id } }), 'groomInteraction');
    cleanup.add(() => prisma.foalActivity.deleteMany({ where: { foalId: horse?.id } }), 'foalActivity');
    cleanup.add(() => prisma.groomHorseSynergy.deleteMany({ where: { horseId: horse?.id } }), 'groomHorseSynergy');
    cleanup.add(() => prisma.horse.delete({ where: { id: horse?.id } }), 'horse');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user?.id } }), 'grooms');
    cleanup.add(() => prisma.user.delete({ where: { id: user?.id } }), 'user');
  }, 60000);

  afterEach(() => cleanup.run(), 60000);

  afterAll(async () => {
    await barrierClient.$disconnect();
  }, 30000);

  const post = (url, body) => () =>
    request(app)
      .post(url)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('X-CSRF-Token', csrf.csrfToken)
      .set('Cookie', csrf.cookieHeader)
      .send(body);

  const doors = {
    interact: () =>
      post('/api/v1/grooms/interact', {
        foalId: horse.id,
        groomId: groom.id,
        interactionType: 'brushing',
        duration: 30,
      }),
    enhanced: () =>
      post('/api/v1/grooms/enhanced/interact', {
        groomId: groom.id,
        horseId: horse.id,
        interactionType: 'daily_care',
        variation: 'Morning Routine',
        duration: 30,
      }),
  };

  /** Fire `senders` together behind a horse-row barrier; settle all of them. */
  async function raceBehindHorseLock(senders) {
    const barrier = await armHorseBarrier(horse.id, 'UPDATE');
    let released = false;
    const releaseOnce = async () => {
      if (!released) {
        released = true;
        await barrier.release();
      }
    };
    // A supertest request is thenable, not a Promise; Promise.resolve starts it.
    const inFlight = senders.map(send => Promise.resolve(send()));
    try {
      await waitForBlockedSessions(barrier.pid, senders.length);
    } finally {
      await releaseOnce();
    }
    return Promise.all(inFlight);
  }

  function expectOneGroomedOneRefused(responses) {
    // Compare statuses, not whole response objects, so a failure stays readable.
    const statuses = responses.map(r => r.status).sort();
    expect(statuses.filter(s => s >= 200 && s < 300)).toHaveLength(1);
    expect(statuses.filter(s => s === 400)).toHaveLength(1);
    const refused = responses.find(r => r.status === 400);
    expect(refused.body?.data?.dailyLimitReached).toBe(true);
  }

  it.each([
    ['interact + interact', ['interact', 'interact']],
    ['enhanced + enhanced', ['enhanced', 'enhanced']],
    ['interact + enhanced', ['interact', 'enhanced']],
  ])(
    '%s: two requests in flight for one horse groom it exactly once',
    async (_label, pair) => {
      const responses = await raceBehindHorseLock(pair.map(door => doors[door]()));
      expectOneGroomedOneRefused(responses);

      const rows = await prisma.groomInteraction.count({ where: { foalId: horse.id } });
      expect(rows).toBe(1);
    },
    120000,
  );

  it('enhanced door: no interaction row is visible before the bond change commits', async () => {
    const before = await prisma.horse.findUnique({ where: { id: horse.id } });
    const barrier = await armHorseBarrier(horse.id, 'SHARE');
    const inFlight = Promise.resolve(doors.enhanced()());
    let visibleWhileBlocked;
    try {
      await waitForBlockedSessions(barrier.pid, 1);
      visibleWhileBlocked = await barrierClient.groomInteraction.count({ where: { foalId: horse.id } });
    } finally {
      await barrier.release();
    }
    const res = await inFlight;

    // While the request could not yet change the horse, its interaction row
    // must not exist for anyone else to see.
    expect(visibleWhileBlocked).toBe(0);

    expect(res.status).toBe(201);
    const after = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(after.bondScore).toBe(res.body.data.effects.newBondScore);
    expect(after.stressLevel).toBe(res.body.data.effects.newStressLevel);
    expect(after.bondScore).not.toBe(before.bondScore);
    expect(await prisma.groomInteraction.count({ where: { foalId: horse.id } })).toBe(1);
  }, 120000);
});
