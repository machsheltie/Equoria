/**
 * Equoria-ypb7d.3 — the weekly fee, one week of grace, and release to the pool.
 *
 * OWNER RULING (2026-09-09, verbatim, Equoria-m0w8n):
 *   "They are HIRED by players and charged a weekly fee. ... A groom is working for a
 *    player and so long as they pay their weekly fee, they keep the groom on their
 *    staff. If they fail to pay for a groom for a week, the groom goes back to the
 *    Grooms for hire section of the marketplace and can be hired by other players. So
 *    for clarity, a player gets one weeks grace period. The groom can't groom horse
 *    until paid for that week but they don't officially lose the groom once until they
 *    fail to pay for a whole week."
 *
 * THE DEFECT THIS REPLACES (Equoria-0aybn). `terminateGroomsForNonPayment` had NEVER
 * worked: it wrote `terminationReason` to `GroomAssignment`, a column that does not
 * exist, so Prisma rejected its first statement and the function's own catch swallowed
 * the throw. After the seven-day grace period expired, nothing was deactivated, the
 * grace period was never cleared, and no `terminated_non_payment` row was written. A
 * player who could not pay kept every groom, silently, forever.
 *
 * WHAT IS ASSERTED, AND WHY EACH FAILS ON THE PRE-FIX CODE:
 *   1. The fee is per groom ON STAFF, not per active assignment -> an unassigned groom
 *      was free; a groom on three horses cost triple
 *   2. One unpaid pay week -> grace: still on staff, CANNOT groom (both care doors),
 *      player told                                             -> nothing happened
 *   3. A SECOND failure in the same pay week -> no second notice, marker not moved, and
 *      the user-level pointer not rewritten (fix round 2, residual B)
 *   4. A full unpaid week -> released to the pool: `userId` cleared, engagement closed
 *      `fee_unpaid`, ACTIVE assignments ENDED (never deleted), inactive history
 *      untouched, logs closed, player told, audit row written
 *                                                              -> the whole path threw
 *                                                                 and was swallowed
 *   5. The released groom is in the pool and ANOTHER player can hire them, with
 *      experience, level and start age intact
 *   6. Paying clears the arrears and the groom works again
 *
 * SPLIT (fix round 2) from `groomEngagementLifecycle.integration.test.mjs` along the
 * service boundary — see that file's header. `processWeeklySalaries` is called SCOPED to
 * the fixture user: unscoped it would put every underfunded player on the shared
 * development database into grace and release the ones already in it.
 *
 * Real DB, no mocks, fail-loud cleanup in dependency order.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { processWeeklySalaries, getPayWeekStart, calculateWeeklyFee } from '../services/groomSalaryService.mjs';
import {
  ENGAGEMENT_END_REASONS,
  GROOM_FEE_UNPAID_NOTIFICATION_TYPE,
  GROOM_RELEASED_NOTIFICATION_TYPE,
  checkGroomMayWork,
  hasFullUnpaidWeek,
} from '../services/groomEngagementService.mjs';
import { recordInteraction } from '../controllers/groomInteractionController.mjs';
import { performEnhancedInteraction } from '../controllers/enhancedGroomController.mjs';
import { listFreeAgentGrooms, hireFreeAgent } from '../controllers/groomFreeAgentController.mjs';

const FIXTURE_PREFIX = 'TestFixture-ypb7d-fee';
const tag = () => randomBytes(6).toString('hex');

// Two consecutive pay weeks, both safely in the past so they cannot collide with a
// real cron run's pay week. Mondays, per SALARY_CONFIG.PAYMENT_DAY.
const WEEK_ONE = new Date('2026-03-02T09:00:00.000Z'); // a Monday
const WEEK_TWO = new Date('2026-03-09T09:00:00.000Z'); // the next Monday

function fakeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

async function makeUser(label, money) {
  const suffix = tag();
  return prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${label}-${suffix}`,
      email: `${FIXTURE_PREFIX}-${label}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Ypb7d',
      lastName: label,
      money,
      settings: {},
    },
  });
}

async function makeHorse(userId, label) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-${label}-${tag()}`,
      sex: 'Filly',
      dateOfBirth: new Date('2024-06-15'),
      age: 1,
      userId,
      healthStatus: 'Excellent',
    },
  });
}

async function makeGroom(userId, label, extra = {}) {
  const groom = await prisma.groom.create({
    data: {
      name: `${FIXTURE_PREFIX}-${label}-${tag()}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      startAge: 20,
      userId,
      ...extra,
    },
  });
  // Every groom on staff has an open engagement; the fixtures write it the way the
  // hire paths do rather than relying on the fee pass's backstop.
  await prisma.groomEngagement.create({ data: { groomId: groom.id, userId } });
  return groom;
}

/** Delete one fixture user and everything hanging off them, in FK order. */
function registerUserCleanup(cleanup, getUser, label) {
  cleanup.add(async () => {
    const user = getUser();
    if (!user?.id) {
      throw new Error(`[cleanup] ${label} user id missing — refusing an unscoped delete`);
    }
    const groomIds = (await prisma.groom.findMany({ where: { userId: user.id }, select: { id: true } })).map(g => g.id);
    const horseIds = (await prisma.horse.findMany({ where: { userId: user.id }, select: { id: true } })).map(h => h.id);
    if (groomIds.length) {
      await prisma.groomInteraction.deleteMany({ where: { groomId: { in: groomIds } } });
      await prisma.groomAssignmentLog.deleteMany({ where: { groomId: { in: groomIds } } });
      await prisma.groomAssignment.deleteMany({ where: { groomId: { in: groomIds } } });
      await prisma.groomHorseSynergy.deleteMany({ where: { groomId: { in: groomIds } } });
    }
    if (horseIds.length) {
      await prisma.groomInteraction.deleteMany({ where: { foalId: { in: horseIds } } });
      await prisma.groomAssignment.deleteMany({ where: { foalId: { in: horseIds } } });
      await prisma.groomAssignmentLog.deleteMany({ where: { horseId: { in: horseIds } } });
      await prisma.foalActivity.deleteMany({ where: { foalId: { in: horseIds } } });
    }
    await prisma.groomSalaryPayment.deleteMany({ where: { userId: user.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.userTransaction.deleteMany({ where: { userId: user.id } });
    await prisma.staffMarketplaceState.deleteMany({ where: { userId: user.id } });
    // A groom this user RELEASED is no longer theirs, so `userId` no longer finds
    // it. Fix round 1 (F11): the prefix sweep this comment described was NOT
    // actually here — cleanup worked only because the "ANOTHER player can hire
    // them" case's `finally` reassigns the groom back. If that case ever fails or
    // is skipped, a released fixture groom leaks permanently into the shared
    // database AND into the free-agent pool. Now the sweep exists. Its engagement
    // rows go first (FK), and it is narrowly scoped to this file's own prefix.
    const strays = await prisma.groom.findMany({
      where: { name: { startsWith: FIXTURE_PREFIX } },
      select: { id: true },
    });
    if (strays.length) {
      const strayIds = strays.map(g => g.id);
      // Fix round 2: `groomInteraction` and `groomSalaryPayment` were missing. Neither
      // was live — zero stray rows have ever been observed, and the tracker is
      // fail-loud so an FK refusal would surface rather than pass — but a sweep that
      // covers only some child tables of `Groom` is a sweep that will one day fail
      // loudly for a reason nobody expects. Dependency order: rows that reference a
      // groom before the groom itself.
      await prisma.groomInteraction.deleteMany({ where: { groomId: { in: strayIds } } });
      await prisma.groomSalaryPayment.deleteMany({ where: { groomId: { in: strayIds } } });
      await prisma.groomEngagement.deleteMany({ where: { groomId: { in: strayIds } } });
      await prisma.groomAssignment.deleteMany({ where: { groomId: { in: strayIds } } });
      await prisma.groomAssignmentLog.deleteMany({ where: { groomId: { in: strayIds } } });
      await prisma.groomRetirementSchedule.deleteMany({ where: { groomId: { in: strayIds } } });
    }
    await prisma.groom.deleteMany({ where: { userId: user.id } });
    await prisma.groom.deleteMany({ where: { name: { startsWith: FIXTURE_PREFIX } } });
    if (horseIds.length) {
      await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
    }
    await prisma.user.delete({ where: { id: user.id } });
  }, `${label} user and dependents`);
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-95yrv — the fee is per HORSE ASSIGNED, at $70 each', () => {
  let user;
  let horses;
  let unassigned;
  let busy;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('basis', 20000);
    horses = await Promise.all([
      makeHorse(user.id, 'basis-h1'),
      makeHorse(user.id, 'basis-h2'),
      makeHorse(user.id, 'basis-h3'),
    ]);
    // One groom with NO assignment at all. Charged a flat rate under the
    // superseded per-groom-on-staff basis (Equoria-ypb7d.3); free again now.
    unassigned = await makeGroom(user.id, 'basis-unassigned');
    // One groom on three horses: $210 a week, three times a groom on one.
    busy = await makeGroom(user.id, 'basis-busy');
    for (const horse of horses) {
      await prisma.groomAssignment.create({
        data: { groomId: busy.id, foalId: horse.id, userId: user.id, isActive: true },
      });
    }
    registerUserCleanup(cleanup, () => user, 'basis');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('charges 70 per assigned horse, and nothing for the groom on none', async () => {
    const expectedUnassigned = calculateWeeklyFee(0);
    const expectedBusy = calculateWeeklyFee(horses.length);
    expect(expectedUnassigned).toBe(0);
    expect(expectedBusy).toBe(210);

    const before = Number((await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } })).money);

    const result = await processWeeklySalaries(WEEK_ONE, { userId: user.id });
    expect(result.errors).toEqual([]);
    expect(result.successful).toBe(1);
    expect(result.totalAmount).toBe(expectedUnassigned + expectedBusy);

    const after = Number((await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } })).money);
    expect(before - after).toBe(expectedUnassigned + expectedBusy);

    // Still exactly one payment row per groom — the pay week is recorded for the
    // idle groom too, at 0, so a re-run stays a no-op for them.
    const rows = await prisma.groomSalaryPayment.findMany({
      where: { userId: user.id, status: 'paid' },
      select: { groomId: true, amount: true },
    });
    expect(rows).toHaveLength(2);
    expect(rows.filter(r => r.groomId === busy.id)).toHaveLength(1);
    expect(rows.filter(r => r.groomId === unassigned.id)).toHaveLength(1);
  });

  it('a re-run in the same pay week is a no-op (Equoria-icqqm idempotency holds)', async () => {
    const before = Number((await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } })).money);
    const result = await processWeeklySalaries(WEEK_ONE, { userId: user.id });
    expect(result.skipped).toBe(1);
    expect(result.totalAmount).toBe(0);
    const after = Number((await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } })).money);
    expect(after).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-ypb7d.3 — one week of grace, then release to the pool', () => {
  let user;
  let horse;
  let groom;
  let activeAssignmentId;
  let historicalAssignmentId;
  let logId;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    // No money at all: the fee cannot be paid.
    user = await makeUser('arrears', 0);
    horse = await makeHorse(user.id, 'arrears-horse');
    groom = await makeGroom(user.id, 'arrears-groom', { experience: 250, level: 4 });

    const historical = await prisma.groomAssignment.create({
      data: {
        groomId: groom.id,
        foalId: horse.id,
        userId: user.id,
        isActive: false,
        endDate: new Date('2026-01-05T00:00:00.000Z'),
      },
    });
    historicalAssignmentId = historical.id;
    const active = await prisma.groomAssignment.create({
      data: { groomId: groom.id, foalId: horse.id, userId: user.id, isActive: true },
    });
    activeAssignmentId = active.id;
    const log = await prisma.groomAssignmentLog.create({
      data: { groomId: groom.id, horseId: horse.id },
    });
    logId = log.id;

    registerUserCleanup(cleanup, () => user, 'arrears');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('week one unpaid: grace begins, the groom stays on staff, and the player is told', async () => {
    const result = await processWeeklySalaries(WEEK_ONE, { userId: user.id });
    expect(result.failed).toBe(1);
    expect(result.graced).toBe(1);
    expect(result.released).toBe(0);

    const row = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { userId: true, feeUnpaidSince: true, retired: true },
    });
    // Still on staff. "they don't officially lose the groom once until they fail to
    // pay for a whole week."
    expect(row.userId).toBe(user.id);
    expect(row.retired).toBe(false);
    // Marked with the pay week that went unpaid, not with "now".
    expect(row.feeUnpaidSince?.getTime()).toBe(getPayWeekStart(WEEK_ONE).getTime());

    // The engagement is still open.
    const open = await prisma.groomEngagement.findFirst({
      where: { groomId: groom.id, endedAt: null },
    });
    expect(open).not.toBeNull();

    // The assignment is untouched — grace does not end the working relationship.
    const active = await prisma.groomAssignment.findUnique({
      where: { id: activeAssignmentId },
      select: { isActive: true, endDate: true },
    });
    expect(active).toEqual({ isActive: true, endDate: null });

    // The player was told, and the notice says the groom cannot work.
    const notices = await prisma.notification.findMany({
      where: { userId: user.id, type: GROOM_FEE_UNPAID_NOTIFICATION_TYPE },
    });
    expect(notices).toHaveLength(1);
    expect(notices[0].payload).toEqual(expect.objectContaining({ groomId: groom.id, canWork: false, graceWeeks: 1 }));

    // And the audit row exists, with the status the existing vocabulary uses.
    const missed = await prisma.groomSalaryPayment.findMany({
      where: { userId: user.id, groomId: groom.id, status: 'missed_insufficient_funds' },
    });
    expect(missed).toHaveLength(1);

    // The user-level pointer the salary summary renders is in step.
    const userRow = await prisma.user.findUnique({
      where: { id: user.id },
      select: { groomSalaryGracePeriod: true },
    });
    expect(userRow.groomSalaryGracePeriod).not.toBeNull();
  });

  it('during grace the groom CANNOT groom a horse', async () => {
    // "The groom can't groom horse until paid for that week."
    const stored = await prisma.groom.findUnique({ where: { id: groom.id } });
    const check = checkGroomMayWork(stored);
    expect(check.allowed).toBe(false);
    expect(check.code).toBe('fee_unpaid');

    // And the care endpoint refuses, which is where it matters.
    const res = fakeRes();
    await recordInteraction(
      {
        user: { id: user.id },
        body: {
          foalId: horse.id,
          groomId: groom.id,
          interactionType: 'brushing',
          duration: 30,
        },
      },
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.data).toEqual(expect.objectContaining({ groomId: groom.id, groomUnavailable: 'fee_unpaid' }));
    // No interaction was recorded.
    expect(await prisma.groomInteraction.count({ where: { groomId: groom.id } })).toBe(0);
  });

  it('a SECOND failure in the SAME pay week: no second notice, no moved marker, no new pointer', async () => {
    // Fix round 2, residual B — the `entered: false` path, which had no case at all.
    // Reachable by a re-run of the pass inside the same pay week for a player who still
    // cannot pay: the groom is already in grace, so `enterFeeGraceTx`'s guard
    // (`feeUnpaidSince: null`) matches nothing and returns `entered: false`.
    //
    // Three things must hold, and the third is the decision this case exists to pin:
    //   1. the grace marker is NOT moved forward — otherwise grace silently lasts more
    //      than the one week the ruling allows;
    //   2. the player is NOT told twice;
    //   3. the user-level `groomSalaryGracePeriod` pointer is NOT rewritten. Round 1
    //      made that write unconditional as a side effect of reordering for F2; it is
    //      conditional again, and this is what says so.
    const markerBefore = (
      await prisma.groom.findUnique({
        where: { id: groom.id },
        select: { feeUnpaidSince: true },
      })
    ).feeUnpaidSince;
    expect(markerBefore).not.toBeNull();

    // THE DISCRIMINATING SETUP, and the reason the first version of this case was
    // worthless. Round 1's unconditional write is guarded on
    // `groomSalaryGracePeriod: null`, so with a pointer already SET both the conditional
    // and the unconditional version leave it alone — the case could not tell them apart,
    // and re-planting the unconditional write kept it green. The two differ only when
    // the pointer is NULL and `entered` is false. That state is reachable: a run whose
    // user write failed after the groom write committed, or an operator clearing the
    // pointer. So clear it.
    await prisma.user.update({
      where: { id: user.id },
      data: { groomSalaryGracePeriod: null },
    });

    const noticesBefore = await prisma.notification.count({
      where: { userId: user.id, type: GROOM_FEE_UNPAID_NOTIFICATION_TYPE },
    });
    expect(noticesBefore).toBe(1);

    // Same pay week, still no money. The pass reaches the debit (no `paid` row exists
    // for this pay week), fails it, and routes to the arrears handler again.
    const result = await processWeeklySalaries(WEEK_ONE, { userId: user.id });
    expect(result.failed).toBe(1);
    // Not counted as a NEW grace entry, and certainly not released — a full pay week
    // has not elapsed.
    expect(result.graced).toBe(0);
    expect(result.released).toBe(0);

    // 1. the marker is byte-identical: grace cannot be extended past one week.
    const markerAfter = (
      await prisma.groom.findUnique({
        where: { id: groom.id },
        select: { feeUnpaidSince: true },
      })
    ).feeUnpaidSince;
    expect(markerAfter?.toISOString()).toBe(markerBefore.toISOString());

    // 2. the player is not told twice.
    expect(
      await prisma.notification.count({
        where: { userId: user.id, type: GROOM_FEE_UNPAID_NOTIFICATION_TYPE },
      }),
    ).toBe(1);

    // 3. THE PINNED DECISION: on the `entered: false` path the user-level pointer is
    // NOT written. Round 1's unconditional write would set it to this pay week's Monday
    // here, telling the player they are inside a grace period that no groom of theirs
    // just entered — a lie about state. Re-planting the unconditional write fails on
    // exactly this line.
    const pointerAfter = (
      await prisma.user.findUnique({
        where: { id: user.id },
        select: { groomSalaryGracePeriod: true },
      })
    ).groomSalaryGracePeriod;
    expect(pointerAfter).toBeNull();

    // The audit row the existing vocabulary uses for exactly this case, and it is the
    // only new row.
    expect(
      await prisma.groomSalaryPayment.count({
        where: { userId: user.id, groomId: groom.id, status: 'missed_grace_period' },
      }),
    ).toBe(1);

    // Restore the pointer to the grace start, so the release case below sees the state a
    // real week-two run would.
    await prisma.user.update({
      where: { id: user.id },
      data: { groomSalaryGracePeriod: markerBefore },
    });
  }, 60000);

  it('the SECOND care path refuses too — a rule on one of two doors is not a rule', async () => {
    // `POST /grooms/enhanced/interact` is the other way a groom can work. The gate
    // is applied in both controllers, so both are driven; asserting only the first
    // would have left the rule bypassable by changing endpoint.
    const res = fakeRes();
    await performEnhancedInteraction(
      {
        user: { id: user.id },
        body: {
          groomId: groom.id,
          horseId: horse.id,
          interactionType: 'daily_care',
          variation: 'Morning Routine',
          duration: 30,
        },
      },
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.data).toEqual(expect.objectContaining({ groomId: groom.id, groomUnavailable: 'fee_unpaid' }));
    expect(await prisma.groomInteraction.count({ where: { groomId: groom.id } })).toBe(0);
  });

  it('week two unpaid: released to the pool, history ended and never deleted', async () => {
    // A full pay week has now gone by unpaid. The predicate is pay-week based, not
    // millisecond based — the reason the release cannot turn on cron jitter.
    expect(hasFullUnpaidWeek(getPayWeekStart(WEEK_ONE), getPayWeekStart(WEEK_TWO))).toBe(true);

    const result = await processWeeklySalaries(WEEK_TWO, { userId: user.id });
    expect(result.released).toBe(1);
    expect(result.terminated).toBe(1);

    const row = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { userId: true, feeUnpaidSince: true, retired: true, experience: true, level: true },
    });
    // A free agent again — this is the whole ruling: "the groom goes back to the
    // Grooms for hire section of the marketplace".
    expect(row.userId).toBeNull();
    expect(row.feeUnpaidSince).toBeNull();
    expect(row.retired).toBe(false);
    // Nothing about the groom was reset. Preserving is the reversible choice; what
    // SHOULD happen to accumulated experience and bond history on release is an
    // open question for the owner, and this asserts the current answer plainly.
    expect(row.experience).toBe(250);
    expect(row.level).toBe(4);

    // The engagement is closed, with the reason recorded.
    const engagements = await prisma.groomEngagement.findMany({ where: { groomId: groom.id } });
    expect(engagements).toHaveLength(1);
    expect(engagements[0].endedAt).not.toBeNull();
    expect(engagements[0].endReason).toBe(ENGAGEMENT_END_REASONS.FEE_UNPAID);

    // The ACTIVE assignment is ENDED. The INACTIVE one is untouched. Both rows
    // survive — a release must never destroy history, the Equoria-m9lz1 invariant.
    const active = await prisma.groomAssignment.findUnique({
      where: { id: activeAssignmentId },
      select: { isActive: true, endDate: true },
    });
    expect(active.isActive).toBe(false);
    expect(active.endDate).not.toBeNull();
    const historical = await prisma.groomAssignment.findUnique({
      where: { id: historicalAssignmentId },
      select: { isActive: true, endDate: true },
    });
    expect(historical.isActive).toBe(false);
    expect(historical.endDate?.toISOString()).toBe('2026-01-05T00:00:00.000Z');
    expect(await prisma.groomAssignment.count({ where: { groomId: groom.id } })).toBe(2);

    // The open assignment log was closed.
    const log = await prisma.groomAssignmentLog.findUnique({
      where: { id: logId },
      select: { unassignedAt: true },
    });
    expect(log.unassignedAt).not.toBeNull();

    // The player was told they lost the groom, and which horse is uncovered.
    const notices = await prisma.notification.findMany({
      where: { userId: user.id, type: GROOM_RELEASED_NOTIFICATION_TYPE },
    });
    expect(notices).toHaveLength(1);
    expect(notices[0].payload).toEqual(
      expect.objectContaining({
        groomId: groom.id,
        reason: ENGAGEMENT_END_REASONS.FEE_UNPAID,
        horsesLeftUnattended: 1,
        horses: [{ id: horse.id, name: expect.any(String) }],
      }),
    );

    // And the audit row the pre-fix code could never write.
    const terminated = await prisma.groomSalaryPayment.findMany({
      where: { userId: user.id, groomId: groom.id, status: 'terminated_non_payment' },
    });
    expect(terminated).toHaveLength(1);
  });

  it('the released groom is in the grooms-for-hire pool', async () => {
    const res = fakeRes();
    await listFreeAgentGrooms({ user: { id: user.id }, query: { limit: 100 } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.grooms.map(g => g.id)).toContain(groom.id);
  });

  it('ANOTHER player can hire them, with their history intact', async () => {
    const newEmployer = await makeUser('arrears-newboss', 20000);
    try {
      const res = fakeRes();
      await hireFreeAgent({ user: { id: newEmployer.id }, body: { groomId: groom.id } }, res);
      expect(res.statusCode).toBe(201);
      expect(res.body.data.groom.id).toBe(groom.id);

      const row = await prisma.groom.findUnique({
        where: { id: groom.id },
        select: { userId: true, experience: true, level: true, startAge: true },
      });
      expect(row.userId).toBe(newEmployer.id);
      // The same groom, not a copy: experience, level and start age all carried over.
      expect(row.experience).toBe(250);
      expect(row.level).toBe(4);
      expect(row.startAge).toBe(20);

      // A second engagement row, open; the first stays closed as history.
      const engagements = await prisma.groomEngagement.findMany({
        where: { groomId: groom.id },
        orderBy: { id: 'asc' },
      });
      expect(engagements).toHaveLength(2);
      expect(engagements[0].endReason).toBe(ENGAGEMENT_END_REASONS.FEE_UNPAID);
      expect(engagements[1].userId).toBe(newEmployer.id);
      expect(engagements[1].endedAt).toBeNull();
    } finally {
      await prisma.groom.updateMany({ where: { id: groom.id }, data: { userId: user.id } });
      await prisma.groomEngagement.deleteMany({ where: { userId: newEmployer.id } });
      await prisma.userTransaction.deleteMany({ where: { userId: newEmployer.id } });
      await prisma.user.delete({ where: { id: newEmployer.id } });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-ypb7d.3 — paying clears the arrears', () => {
  let user;
  let groom;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('cleared', 20000);
    groom = await makeGroom(user.id, 'cleared-groom', {
      // Already in grace for week one, and the user now has money.
      feeUnpaidSince: getPayWeekStart(WEEK_ONE),
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { groomSalaryGracePeriod: getPayWeekStart(WEEK_ONE) },
    });
    registerUserCleanup(cleanup, () => user, 'cleared');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('a paid pay week clears feeUnpaidSince, the user pointer, and lets the groom work', async () => {
    const result = await processWeeklySalaries(WEEK_TWO, { userId: user.id });
    expect(result.errors).toEqual([]);
    expect(result.successful).toBe(1);
    expect(result.released).toBe(0);

    const row = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { userId: true, feeUnpaidSince: true },
    });
    expect(row.userId).toBe(user.id);
    expect(row.feeUnpaidSince).toBeNull();
    expect(checkGroomMayWork(row).allowed).toBe(true);

    const userRow = await prisma.user.findUnique({
      where: { id: user.id },
      select: { groomSalaryGracePeriod: true },
    });
    expect(userRow.groomSalaryGracePeriod).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-ypb7d.3 — a retired groom is no longer billed', () => {
  let user;
  let groom;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('retired-billing', 20000);
    groom = await makeGroom(user.id, 'retired-billing-groom', { startAge: 20 });
    // Retire the groom directly on the row: this block is about what the FEE pass does
    // with a retired groom, not about how retirement happens (that is
    // groomEngagementLifecycle.integration's "closes the engagement" case).
    await prisma.groom.update({
      where: { id: groom.id },
      data: { retired: true, retirementReason: 'age', retirementTimestamp: new Date() },
    });
    registerUserCleanup(cleanup, () => user, 'retired-billing');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('is excluded from the staff read, so the player is charged nothing', async () => {
    const before = Number((await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } })).money);
    const result = await processWeeklySalaries(WEEK_ONE, { userId: user.id });
    // The retired groom KEEPS its `userId` (that is what lets the player still read
    // their retired grooms), so what excludes it from the fee is `retired: false` in
    // the staff read — the mechanism F10 corrected the comments to name. Billing a
    // career that has ended would be a charge for nothing.
    expect(result.processed).toBe(0);
    const after = Number((await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } })).money);
    expect(after).toBe(before);
  }, 60000);
});
