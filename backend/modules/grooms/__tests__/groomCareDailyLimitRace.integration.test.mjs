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
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  createBarrierClient,
  holdLock,
  horseRowLock,
  raceBehindLock,
} from '../../../__tests__/helpers/rowLockBarrier.mjs';

const ORIGIN = 'http://localhost:3000';
const tag = () => `9a5ny-${randomBytes(5).toString('hex')}`;
// A dedicated client, so the barrier never competes with the requests for the
// app singleton's pooled connections.
const barrierClient = createBarrierClient();

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
        speciality: 'foalCare',
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
        interactionType: 'enrichment',
        variation: 'Puzzle Feeding',
        duration: 30,
      }),
  };

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
      const responses = await raceBehindLock(
        barrierClient,
        horseRowLock(horse.id),
        pair.map(door => doors[door]()),
      );
      expectOneGroomedOneRefused(responses);

      const rows = await prisma.groomInteraction.count({ where: { foalId: horse.id } });
      expect(rows).toBe(1);
    },
    120000,
  );

  it('enhanced door: no interaction row is visible before the bond change commits', async () => {
    const before = await prisma.horse.findUnique({ where: { id: horse.id } });
    const barrier = await holdLock(barrierClient, horseRowLock(horse.id, 'SHARE'));
    const inFlight = Promise.resolve(doors.enhanced()());
    let visibleWhileBlocked;
    try {
      await barrier.waitForQueued(1);
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
