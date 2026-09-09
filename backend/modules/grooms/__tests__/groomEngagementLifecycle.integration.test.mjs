/**
 * Equoria-ypb7d.2 / .3 — hiring is an ENGAGEMENT, and a weekly fee sustains it.
 *
 * OWNER RULING (2026-09-09, verbatim, Equoria-m0w8n):
 *   "players never own grooms. If anyone owns them, Equoria does. They are free
 *    agents. They are HIRED by players and charged a weekly fee. Each groom can
 *    groom up to 10 horses per week. A groom is working for a player and so long as
 *    they pay their weekly fee, they keep the groom on their staff. If they fail to
 *    pay for a groom for a week, the groom goes back to the Grooms for hire section
 *    of the marketplace and can be hired by other players. So for clarity, a player
 *    gets one weeks grace period. The groom can't groom horse until paid for that
 *    week but they don't officially lose the groom once until they fail to pay for a
 *    whole week."
 *
 * THE DEFECT THIS REPLACES (Equoria-0aybn). `terminateGroomsForNonPayment` had
 * NEVER worked: it wrote `terminationReason` to `GroomAssignment`, a column that
 * does not exist, so Prisma rejected its first statement and the function's own
 * catch swallowed the throw. After the seven-day grace period expired, nothing was
 * deactivated, the grace period was never cleared, and no `terminated_non_payment`
 * row was written. A player who could not pay kept every groom, silently, forever.
 *
 * WHAT IS ASSERTED, AND WHY EACH FAILS ON THE PRE-FIX CODE:
 *   1. Hiring opens a `GroomEngagement`               -> the table did not exist
 *   2. The fee is per groom ON STAFF, not per active assignment
 *                                                     -> an unassigned groom was
 *                                                        free; a groom on three
 *                                                        horses cost triple
 *   3. One unpaid pay week -> grace: still on staff, CANNOT groom, player told
 *                                                     -> nothing happened at all
 *   4. A full unpaid week -> released to the pool: `userId` cleared, engagement
 *      closed `fee_unpaid`, ACTIVE assignments ENDED (never deleted), inactive
 *      history untouched, assignment logs closed, player told, audit row written
 *                                                     -> the whole path threw and
 *                                                        was swallowed
 *   5. Paying clears the arrears and the groom works again
 *   6. A released groom is in the pool and ANOTHER player can hire them, with
 *      experience, level and interaction history intact
 *   7. Two players racing for the same free agent: one 201, one 409, exactly one
 *      open engagement
 *   8. The database refuses two open engagements for one groom (partial unique)
 *   9. Retirement closes the engagement but KEEPS `userId`, so the player can still
 *      read their retired grooms
 *
 * Real DB, no mocks. `processWeeklySalaries` is called SCOPED to the fixture user:
 * unscoped it would put every underfunded player on the shared development database
 * into the grace period and release the ones already in it.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { processWeeklySalaries, getPayWeekStart, calculateWeeklySalary } from '../services/groomSalaryService.mjs';
import {
  ENGAGEMENT_END_REASONS,
  GROOM_FEE_UNPAID_NOTIFICATION_TYPE,
  GROOM_RELEASED_NOTIFICATION_TYPE,
  checkGroomMayWork,
  hasFullUnpaidWeek,
} from '../services/groomEngagementService.mjs';
import { processRetirement } from '../services/groomRetirementService.mjs';
import { ensureRetirementSchedule } from '../services/groomRetirementScheduleService.mjs';
import { hireGroom } from '../controllers/groomRosterController.mjs';
import { recordInteraction } from '../controllers/groomInteractionController.mjs';
import { performEnhancedInteraction } from '../controllers/enhancedGroomController.mjs';
import { listFreeAgentGrooms, hireFreeAgent } from '../controllers/groomFreeAgentController.mjs';

const FIXTURE_PREFIX = 'TestFixture-ypb7d-eng';
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
    // it. Sweep by the fixture name prefix as well, or a released groom leaks.
    await prisma.groom.deleteMany({ where: { userId: user.id } });
    if (horseIds.length) {
      await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
    }
    await prisma.user.delete({ where: { id: user.id } });
  }, `${label} user and dependents`);
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-ypb7d.2 — hiring opens an engagement, never an ownership', () => {
  let user;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('open', 20000);
    registerUserCleanup(cleanup, () => user, 'open');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('direct hire writes exactly one OPEN engagement, in the hire transaction', async () => {
    const res = fakeRes();
    await hireGroom(
      {
        user: { id: user.id },
        body: {
          name: `${FIXTURE_PREFIX}-open-hired-${tag()}`,
          speciality: 'foal_care',
          skill_level: 'novice',
          personality: 'gentle',
        },
      },
      res,
    );
    expect(res.statusCode).toBe(201);

    const engagements = await prisma.groomEngagement.findMany({
      where: { groomId: res.body.data.id },
    });
    expect(engagements).toHaveLength(1);
    expect(engagements[0].userId).toBe(user.id);
    expect(engagements[0].endedAt).toBeNull();
    expect(engagements[0].endReason).toBeNull();
  });

  it('the database refuses a SECOND open engagement for the same groom', async () => {
    // The partial unique index `groom_engagements_active_groomId_key ... WHERE
    // "endedAt" IS NULL` from migration 20260909120000. It is the schema's
    // statement that a groom works for at most one player at a time.
    const groom = await makeGroom(user.id, 'open-unique');
    const other = await makeUser('open-unique-other', 5000);
    try {
      await expect(prisma.groomEngagement.create({ data: { groomId: groom.id, userId: other.id } })).rejects.toThrow();

      // A CLOSED engagement alongside the open one is fine — history must be free
      // to hold many rows for the same groom. That is why the index is partial.
      const closed = await prisma.groomEngagement.create({
        data: {
          groomId: groom.id,
          userId: other.id,
          endedAt: new Date(),
          endReason: ENGAGEMENT_END_REASONS.FEE_UNPAID,
        },
      });
      expect(closed.id).toBeGreaterThan(0);
    } finally {
      await prisma.groomEngagement.deleteMany({ where: { userId: other.id } });
      await prisma.user.delete({ where: { id: other.id } });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-ypb7d.3 — the fee is per groom ON STAFF, not per assignment', () => {
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
    // One groom with NO assignment at all — free under the old basis.
    unassigned = await makeGroom(user.id, 'basis-unassigned');
    // One groom on three horses — charged three times under the old basis.
    busy = await makeGroom(user.id, 'basis-busy');
    for (const horse of horses) {
      await prisma.groomAssignment.create({
        data: { groomId: busy.id, foalId: horse.id, userId: user.id, isActive: true },
      });
    }
    registerUserCleanup(cleanup, () => user, 'basis');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('charges each groom exactly once — the unassigned one included', async () => {
    const expectedUnassigned = calculateWeeklySalary(unassigned);
    const expectedBusy = calculateWeeklySalary(busy);

    const before = Number((await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } })).money);

    const result = await processWeeklySalaries(WEEK_ONE, { userId: user.id });
    expect(result.errors).toEqual([]);
    expect(result.successful).toBe(1);
    expect(result.totalAmount).toBe(expectedUnassigned + expectedBusy);

    const after = Number((await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } })).money);
    expect(before - after).toBe(expectedUnassigned + expectedBusy);

    // Exactly one payment row per groom. Three under the old per-assignment basis
    // for `busy`, and none at all for `unassigned`.
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
describe('Equoria-ypb7d.2 — two players cannot hire the same free agent', () => {
  let owner;
  let bidderA;
  let bidderB;
  let groom;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    owner = await makeUser('race-owner', 1000);
    bidderA = await makeUser('race-a', 20000);
    bidderB = await makeUser('race-b', 20000);
    // A groom already released: free agent with a closed engagement, which is what
    // puts them in the pool.
    groom = await prisma.groom.create({
      data: {
        name: `${FIXTURE_PREFIX}-race-groom-${tag()}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        startAge: 21,
        userId: null,
      },
    });
    await prisma.groomEngagement.create({
      data: {
        groomId: groom.id,
        userId: owner.id,
        endedAt: new Date('2026-03-09T09:00:00.000Z'),
        endReason: ENGAGEMENT_END_REASONS.FEE_UNPAID,
      },
    });

    cleanup.add(() => prisma.groomEngagement.deleteMany({ where: { groomId: groom.id } }), 'engagements');
    cleanup.add(() => prisma.groom.delete({ where: { id: groom.id } }), 'groom');
    for (const [label, getUser] of [
      ['race-owner', () => owner],
      ['race-a', () => bidderA],
      ['race-b', () => bidderB],
    ]) {
      registerUserCleanup(cleanup, getUser, label);
    }
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('exactly one wins with 201, the other gets 409, and one engagement is open', async () => {
    const resA = fakeRes();
    const resB = fakeRes();
    await Promise.all([
      hireFreeAgent({ user: { id: bidderA.id }, body: { groomId: groom.id } }, resA),
      hireFreeAgent({ user: { id: bidderB.id }, body: { groomId: groom.id } }, resB),
    ]);

    const codes = [resA.statusCode, resB.statusCode].sort();
    // The guarded claim is the only thing stopping a double hire, so this is the
    // assertion that proves it works. 409 rather than 404: the groom exists and the
    // request was well formed; someone else got there first.
    expect(codes).toEqual([201, 409]);

    const open = await prisma.groomEngagement.findMany({
      where: { groomId: groom.id, endedAt: null },
    });
    expect(open).toHaveLength(1);

    const row = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { userId: true },
    });
    expect(row.userId).toBe(open[0].userId);
    expect([bidderA.id, bidderB.id]).toContain(row.userId);

    // The loser was not charged.
    const loserId = row.userId === bidderA.id ? bidderB.id : bidderA.id;
    const loserLedger = await prisma.userTransaction.count({
      where: { userId: loserId, category: 'groom_hire' },
    });
    expect(loserLedger).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-ypb7d.2 — retirement closes the engagement but keeps the history readable', () => {
  let user;
  let groom;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('retire-eng', 20000);
    groom = await makeGroom(user.id, 'retire-eng-groom', { startAge: 20 });
    const retirementAge = await ensureRetirementSchedule(prisma, groom.id);
    await prisma.groom.update({
      where: { id: groom.id },
      data: { careerWeeks: retirementAge - 20 },
    });
    registerUserCleanup(cleanup, () => user, 'retire-eng');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('closes the engagement with reason retirement and leaves Groom.userId set', async () => {
    const result = await processRetirement(groom.id);
    expect(result.groom.retired).toBe(true);
    expect(result.closedEngagementCount).toBe(1);

    const engagements = await prisma.groomEngagement.findMany({ where: { groomId: groom.id } });
    expect(engagements).toHaveLength(1);
    expect(engagements[0].endReason).toBe(ENGAGEMENT_END_REASONS.RETIREMENT);
    expect(engagements[0].endedAt).not.toBeNull();

    const row = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { userId: true, retired: true },
    });
    // DELIBERATELY still set, unlike a non-payment release: `retired` already bars
    // the groom from work and from the hire pool, and keeping the pointer is what
    // lets the player still read their retired grooms.
    expect(row.userId).toBe(user.id);
    expect(row.retired).toBe(true);

    // And a retired groom is NOT in the hire pool.
    const res = fakeRes();
    await listFreeAgentGrooms({ user: { id: user.id }, query: { limit: 100 } }, res);
    expect(res.body.data.grooms.map(g => g.id)).not.toContain(groom.id);
  });

  it('a retired groom is no longer billed the weekly fee', async () => {
    const before = Number((await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } })).money);
    const result = await processWeeklySalaries(WEEK_ONE, { userId: user.id });
    // No staff left to bill: the retired groom keeps its `userId` but is excluded by
    // `retired: false`. Billing a career that has ended would be a charge for
    // nothing.
    expect(result.processed).toBe(0);
    const after = Number((await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } })).money);
    expect(after).toBe(before);
  });
});
