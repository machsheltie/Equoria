/**
 * Equoria-po1fl: POST /api/v1/grooms/interact must commit its five
 * player-state writes as ONE transaction.
 *
 * The five writes are:
 *   1. Horse.update        — bondScore, stressLevel, taskLog, lastGroomed,
 *                            daysGroomedInARow, burnoutStatus
 *   2. GroomInteraction.create — the row the DAILY LIMIT check keys off
 *   3. FoalActivity.create     — the canonical foal-activity event log
 *                                (Equoria-2emg: taskLog is its derived cache)
 *   4. Groom.update            — +2 XP for the session
 *   5. GroomHorseSynergy       — sessionsTogether / synergyScore
 *
 * Before the fix these were five independent round-trips with no transaction
 * (writes 3-5 additionally wrapped in fail-soft try/catch arms that logged and
 * continued). A failure partway through left the player's horse, their
 * interaction history and their groom's progression disagreeing about whether
 * the session happened — and because the daily-limit check reads the
 * GroomInteraction row, a partial failure could spend the player's one
 * interaction for that horse that day and hand them nothing back.
 *
 * ── HOW THE FAILURE IS FORCED (no mocks; this is a real database event) ──────
 * A second, dedicated Prisma connection opens its own transaction and takes
 * `SELECT … FROM grooms WHERE id = $1 FOR UPDATE` on the groom row, then holds
 * it. The request then runs: writes 1-3 succeed, and write 4 (the groom's XP
 * `UPDATE`) BLOCKS on that row lock until the handler's interactive-transaction
 * timeout fires. That is a genuine mid-set failure of exactly the kind this
 * endpoint suffers under contention — not an injected throw, not a stubbed
 * client, and not a path that only exists in tests.
 *
 * The assertion is then the whole point: after the request fails, NONE of the
 * five writes may be visible. Against the pre-fix (non-transactional) handler
 * writes 1-3 are already committed by the time write 4 blocks, so the horse's
 * bond/stress/taskLog, the GroomInteraction row and the FoalActivity row all
 * survive and this test fails — which is how it was proved to detect the bug.
 *
 * ── WHAT THIS TEST CANNOT SEE ───────────────────────────────────────────────
 *  - It does not prove lock-ACQUISITION ORDER (Horse row before staff rows,
 *    per Equoria-6p398.9). Acquisition order inside a transaction is not
 *    observable from outside it; correct and deadlock-prone implementations
 *    commit identical state. That invariant is carried by the source-order
 *    sentinels in backend/__tests__/tx*LockOrder.sentinel.test.mjs.
 *  - It does not close the read-then-write window on the daily-limit check
 *    itself: `validateFoalInteractionLimits` still runs as an unlocked read
 *    BEFORE the transaction opens, so two simultaneous requests for the same
 *    horse can both pass it. That is a separate defect (a missing uniqueness
 *    guard), not an atomicity one, and is out of this fix's scope.
 *  - It forces the failure at write 4 only. Writes 1-3 and 5 are covered
 *    transitively (all-or-nothing is asserted over the whole set), but a
 *    failure originating inside write 5 is not separately provoked.
 *
 * Real DB, real HTTP, real auth, real CSRF. Scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
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
const TAG = `po1fl-${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;

// How long the blocking transaction keeps the groom row locked. Must exceed
// the handler's interactive-transaction timeout (Prisma default 5000 ms) so
// the handler gives up while the lock is still held; the barrier then releases
// on its own so the suite can never hang on it.
const LOCK_HOLD_MS = 9000;

// A dedicated client, so the lock-holding transaction never competes with the
// app singleton's connection pool for the connection the request needs.
const barrierClient = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl(process.env.DATABASE_URL, process.env) } },
  log: [],
  errorFormat: 'minimal',
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

describe('Equoria-po1fl: POST /api/v1/grooms/interact is atomic across its five writes', () => {
  let user;
  let token;
  let foal;
  let groom;
  let csrfToken;
  let cookieHeader;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: `${TAG}@test.com`,
        username: TAG,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Test',
        lastName: 'PO1FL',
        money: 5000,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 5);
    foal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${TAG}-Foal`,
        sex: 'colt',
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
        name: `${TAG}-Groom`,
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

    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
    csrfToken = csrf.csrfToken;
    cookieHeader = csrf.cookieHeader;

    // Fail-loud scoped cleanup (Equoria-1ohys). FK order: interaction/activity/
    // synergy children before the foal; foal + groom (Horse.userId is Restrict)
    // before the user. Every delete is scoped by this suite's own ids — never a
    // bare deleteMany, never a truncate (the dev DB is shared).
    cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { foalId: foal?.id } }), 'groomInteraction');
    cleanup.add(() => prisma.foalActivity.deleteMany({ where: { foalId: foal?.id } }), 'foalActivity');
    cleanup.add(() => prisma.groomHorseSynergy.deleteMany({ where: { horseId: foal?.id } }), 'groomHorseSynergy');
    cleanup.add(() => prisma.horse.delete({ where: { id: foal?.id } }), 'horse');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user?.id } }), 'grooms');
    cleanup.add(() => prisma.user.delete({ where: { id: user?.id } }), 'user');
  }, 60000);

  afterAll(async () => {
    await cleanup.run();
    await barrierClient.$disconnect();
  }, 60000);

  const interact = () =>
    request(app)
      .post('/api/v1/grooms/interact')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('X-CSRF-Token', csrfToken)
      .set('Cookie', cookieHeader)
      .send({
        foalId: foal.id,
        groomId: groom.id,
        interactionType: 'brushing',
        duration: 30,
      });

  it('rolls every write back when a write in the MIDDLE of the set fails', async () => {
    const horseBefore = await prisma.horse.findUnique({ where: { id: foal.id } });
    const groomBefore = await prisma.groom.findUnique({ where: { id: groom.id } });

    // Take and hold an exclusive row lock on the groom row. Write 4 of the
    // handler's set (the groom's XP UPDATE) must wait on it.
    let signalAcquired;
    const acquired = new Promise(resolve => {
      signalAcquired = resolve;
    });
    const barrier = barrierClient.$transaction(
      async tx => {
        await tx.$queryRaw`SELECT id FROM grooms WHERE id = ${groom.id} FOR UPDATE`;
        signalAcquired();
        await sleep(LOCK_HOLD_MS);
      },
      { timeout: 30000, maxWait: 20000 },
    );
    await acquired;

    const res = await interact();

    await barrier;

    // The request must NOT report success — the set could not complete. 503
    // (not 500, and NOT an early 4xx validation bounce) is asserted exactly so
    // this test cannot pass vacuously: it proves the request really entered the
    // transaction and died on the interactive-transaction timeout that the
    // held row lock provoked, and that the retryable classification survives
    // the handler's catch.
    expect(res.status).toBe(503);
    expect(res.body?.success).toBe(false);

    // …and not one of the five writes may have survived.
    const interactions = await prisma.groomInteraction.findMany({ where: { foalId: foal.id } });
    expect(interactions).toHaveLength(0);

    const activities = await prisma.foalActivity.findMany({ where: { foalId: foal.id } });
    expect(activities).toHaveLength(0);

    const synergy = await prisma.groomHorseSynergy.findFirst({
      where: { groomId: groom.id, horseId: foal.id },
    });
    expect(synergy).toBeNull();

    const horseAfter = await prisma.horse.findUnique({ where: { id: foal.id } });
    expect(horseAfter.bondScore).toBe(horseBefore.bondScore);
    expect(horseAfter.stressLevel).toBe(horseBefore.stressLevel);
    expect(horseAfter.daysGroomedInARow).toBe(horseBefore.daysGroomedInARow);
    expect(horseAfter.lastGroomed).toEqual(horseBefore.lastGroomed);
    expect(horseAfter.taskLog).toEqual(horseBefore.taskLog);

    const groomAfter = await prisma.groom.findUnique({ where: { id: groom.id } });
    expect(groomAfter.experience).toBe(groomBefore.experience);
    expect(groomAfter.level).toBe(groomBefore.level);
  }, 90000);

  it('still commits all five writes together on the happy path', async () => {
    // The rolled-back attempt above left no GroomInteraction row, so the
    // player has NOT spent their daily interaction for this horse — which is
    // itself part of the fix — and this request is allowed through.
    const horseBefore = await prisma.horse.findUnique({ where: { id: foal.id } });
    const groomBefore = await prisma.groom.findUnique({ where: { id: groom.id } });

    const res = await interact();
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const interactions = await prisma.groomInteraction.findMany({ where: { foalId: foal.id } });
    expect(interactions).toHaveLength(1);

    const activities = await prisma.foalActivity.findMany({ where: { foalId: foal.id } });
    expect(activities).toHaveLength(1);
    expect(activities[0].activityType).toBe('brushing');

    const synergy = await prisma.groomHorseSynergy.findFirst({
      where: { groomId: groom.id, horseId: foal.id },
    });
    expect(synergy).not.toBeNull();
    expect(synergy.sessionsTogether).toBe(1);

    const horseAfter = await prisma.horse.findUnique({ where: { id: foal.id } });
    expect(horseAfter.bondScore).toBeGreaterThan(horseBefore.bondScore);
    expect(horseAfter.lastGroomed).not.toBeNull();
    expect(horseAfter.taskLog).not.toEqual(horseBefore.taskLog);

    const groomAfter = await prisma.groom.findUnique({ where: { id: groom.id } });
    expect(groomAfter.experience).toBe(groomBefore.experience + 2);
  }, 60000);
});
