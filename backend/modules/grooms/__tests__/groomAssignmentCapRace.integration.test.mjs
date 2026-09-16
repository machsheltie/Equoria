/**
 * Equoria-95yrv fix round 1 (F1) — the ten-horse cap holds under a real race.
 *
 * THE DEFECT THIS REPRODUCES. The cap was a COUNT followed, later and outside any
 * transaction, by a CREATE. A groom sitting at nine horses, two `POST` requests in
 * flight (a double-tap, or two tabs): both counted nine, both passed `>= 10`, both
 * created. Eleven active assignments — and because the weekly fee deliberately does
 * NOT clamp an over-cap groom (it bills what the roster really holds), the player is
 * then billed 11 x 70 = 770 a week, above the maximum the owner's ruling defines,
 * with nothing in the game to bring it back.
 *
 * HOW THE RACE IS FORCED (no mocks, no sleeps, no route interception)
 *   The barrier is the REAL advisory lock the fix takes, held by the test itself on a
 *   SECOND Prisma client — the harness in
 *   modules/economy/inventory/__tests__/inventorySettingsRace.integration.test.mjs,
 *   reused here with `pg_advisory_xact_lock` in place of that file's `FOR UPDATE`:
 *
 *     1. barrier tx: take `pg_advisory_xact_lock(groomRoster:<groomId>)`
 *     2. fire assignment A -> its FIRST statement is that same lock; it queues
 *     3. fire assignment B -> it queues too
 *     4. wait until BOTH are genuinely blocked (pg_blocking_pids, not a sleep), which
 *        is the proof they overlap: neither has counted anything yet, and neither can
 *        until the other side of the race is also in flight
 *     5. release the barrier -> A commits, THEN B counts (and now sees A's committed
 *        row, because a fresh statement snapshot follows the lock wait) and refuses
 *
 *   On the pre-fix code there is no lock to queue on, so step 4 could never be
 *   reached — which is the honest shape of this proof: it pins the mechanism, and the
 *   outcome assertion (exactly ten, one player-readable refusal) is what would have
 *   been 11/0 before the fix.
 *
 * WHY IT CANNOT DEADLOCK. The barrier holds one advisory lock and releases it
 * unconditionally in `finally`; both racers are short transactions that finish once it
 * is gone. The test never waits on a racer while still holding what the racer needs.
 *
 * TIMING. The racers are ordinary interactive transactions (Prisma's 5s default), so
 * the barrier is released as soon as both are observed blocked — milliseconds, not a
 * fixed wait.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma, { PrismaClient } from '../../../../packages/database/prismaClient.mjs';
import { buildDatabaseUrl } from '../../../../packages/database/dbPoolConfig.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { jobNameToLockKey } from '../../../utils/cronLock.mjs';
import { MAX_HORSES_PER_GROOM } from '../services/groomFeeBasisService.mjs';
import { createAssignment } from '../services/groomAssignmentService.mjs';
import { assignGroomToFoal } from '../services/groomFoalAssignmentService.mjs';

const FIXTURE_PREFIX = 'TestFixture-95yrv-race';
const tag = () => randomBytes(6).toString('hex');

// A dedicated client so the barrier never competes with the racers for the app
// singleton's pooled connections.
const barrierClient = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl(process.env.DATABASE_URL, process.env) } },
  log: [],
  errorFormat: 'minimal',
});

/** Hold the fix's own roster lock for this groom until `release()` is called. */
async function armRosterBarrier(groomId) {
  const lockKey = jobNameToLockKey(`groomRoster:${groomId}`);
  let release;
  let ready;
  const released = new Promise(r => {
    release = r;
  });
  const armed = new Promise(r => {
    ready = r;
  });

  let barrierFailure = null;
  const held = barrierClient
    .$transaction(
      async tx => {
        const rows = await tx.$queryRaw`SELECT pg_backend_pid()::int AS pid`;
        barrier.pid = Number(rows[0].pid);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
        ready();
        await released;
      },
      { maxWait: 20000, timeout: 120000 },
    )
    .catch(err => {
      barrierFailure = err;
    });

  const barrier = {
    pid: null,
    async release() {
      release();
      await held;
      if (barrierFailure) {
        throw barrierFailure;
      }
    },
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

async function makeHorse(userId, label) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-${label}-${tag()}`,
      sex: 'Filly',
      dateOfBirth: new Date('2023-05-01'),
      age: 3,
      userId,
      healthStatus: 'Excellent',
    },
  });
}

describe('Equoria-95yrv F1 — two assignments racing at nine horses seat exactly ten', () => {
  let user;
  let groom;
  let contested;
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    const suffix = tag();
    user = await prisma.user.create({
      data: {
        username: `${FIXTURE_PREFIX}-${suffix}`.slice(0, 30),
        email: `${FIXTURE_PREFIX}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Cap',
        lastName: 'Race',
        money: 50000,
        settings: {},
      },
    });
    groom = await prisma.groom.create({
      data: {
        name: `${FIXTURE_PREFIX}-groom-${suffix}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        startAge: 20,
        userId: user.id,
      },
    });

    // Nine horses already in this groom's care — one seat left.
    for (let i = 0; i < MAX_HORSES_PER_GROOM - 1; i++) {
      const horse = await makeHorse(user.id, `seated-${i}`);
      await prisma.groomAssignment.create({
        data: { groomId: groom.id, foalId: horse.id, userId: user.id, isActive: true },
      });
    }
    // The two horses that will race for it.
    contested = [await makeHorse(user.id, 'racer-a'), await makeHorse(user.id, 'racer-b')];

    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { userId: user.id } }), 'assignments');
    cleanup.add(() => prisma.groomAssignmentLog.deleteMany({ where: { groomId: groom.id } }), 'assignment logs');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'grooms');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  }, 60000);

  afterEach(() => cleanup.run(), 60000);

  afterAll(async () => {
    await barrierClient.$disconnect();
  }, 30000);

  /**
   * Drive two concurrent attempts at the last seat through `door`, with both
   * provably in flight before either can count.
   */
  async function raceForTheLastSeat(door) {
    const barrier = await armRosterBarrier(groom.id);
    let releasedOnce = false;
    const releaseBarrier = async () => {
      if (!releasedOnce) {
        releasedOnce = true;
        await barrier.release();
      }
    };

    // Both attempts are launched before anything is awaited on them, so they queue
    // on the roster lock together. Nothing is swallowed: the barrier release and the
    // settle both run in `finally`, and a failure in either surfaces.
    const attempts = contested.map(horse => door(horse));
    let outcomes;
    try {
      // Both racers are genuinely queued on the roster lock before either proceeds.
      // This is the overlap the old code could not produce, because it took no lock.
      await waitForBlockedSessions(barrier.pid, 2);
    } finally {
      await releaseBarrier();
      outcomes = await Promise.allSettled(attempts);
    }
    return outcomes;
  }

  function expectExactlyOneSeated(outcomes) {
    const seated = outcomes.filter(o => o.status === 'fulfilled');
    const refused = outcomes.filter(o => o.status === 'rejected');
    expect(seated).toHaveLength(1);
    expect(refused).toHaveLength(1);
    // The loser is refused in the player's own words, not with a constraint error.
    expect(String(refused[0].reason?.message)).toMatch(/already caring for 10 horses/i);
  }

  it('createAssignment: the loser is refused and the roster holds ten', async () => {
    const outcomes = await raceForTheLastSeat(horse => createAssignment(groom.id, horse.id, user.id));
    expectExactlyOneSeated(outcomes);

    const active = await prisma.groomAssignment.count({
      where: { groomId: groom.id, isActive: true },
    });
    expect(active).toBe(MAX_HORSES_PER_GROOM);
  }, 120000);

  it('assignGroomToFoal: the loser is refused and the roster holds ten', async () => {
    const outcomes = await raceForTheLastSeat(horse => assignGroomToFoal(horse.id, groom.id, user.id));
    expectExactlyOneSeated(outcomes);

    const active = await prisma.groomAssignment.count({
      where: { groomId: groom.id, isActive: true },
    });
    expect(active).toBe(MAX_HORSES_PER_GROOM);
  }, 120000);
});
