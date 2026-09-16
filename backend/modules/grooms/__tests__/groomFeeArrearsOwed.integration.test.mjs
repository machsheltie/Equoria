/**
 * Equoria-bgdfb — the grace week's fee is OWED, not forgiven.
 *
 * OWNER RULING (2026-09-14 10:23, verbatim, via the decision register):
 *   "It's owed."
 *
 * WHAT THAT REPLACES. Equoria-ypb7d.3 recorded the missed week as an audit row and
 * never collected it: paying ANY later week cleared `feeUnpaidSince` and the groom
 * went back to work with the missed week written off. A player who skipped one week
 * in every two paid half price and lost only alternate weeks of work.
 *
 * WHAT IS ASSERTED, AND WHY EACH FAILS ON THE PRE-RULING CODE:
 *   1. The next successful collection takes the ARREARS PLUS the current week, in
 *      ONE debit (one burn-ledger row), and clears grace
 *                                                    -> took the current week only
 *   2. The settled week is marked settled, so it can never be collected twice: the
 *      following week charges the ordinary fee and nothing more
 *                                                    -> nothing to mark; nothing owed
 *   3. Arrears do not survive the groom. When a full unpaid week releases the groom
 *      to the grooms-for-hire pool, the outstanding week is WRITTEN OFF — losing the
 *      groom is the penalty for not paying, and a debt attached to a groom the
 *      player no longer has would be charged for nothing
 *                                                    -> no debt existed either way
 *   4. THIS WEEK FIRST, THEN THE DEBT (fix round 1, review F2). A player who can
 *      afford this week but not the debt pays THIS WEEK: the groom keeps working,
 *      grace clears, and the arrears stay owed for a later week
 *                                                    -> the first implementation of
 *                                                       this ruling charged both or
 *                                                       nothing, so that player paid
 *                                                       nothing and lost the groom on
 *                                                       the next pass
 *
 * PARTIAL FUNDS. The debt never blocks the current week. Both are attempted as ONE
 * debit (so a week cannot be marked settled without the money moving), and when the
 * wallet cannot cover both the pass falls back to the current week alone. Losing the
 * groom therefore still requires missing a CURRENT week while already in grace — a
 * debt alone cannot cost a player their groom.
 *
 * ARREARS AND COMPOUNDING, STATED RATHER THAN IMPLIED. Within a grace episode the
 * missed weeks that can accumulate are bounded by the release rule: a second
 * consecutive unpaid pay week releases the groom (and case 3 then writes the debt
 * off), so the insufficient-funds path can owe at most the one missed week. The
 * collection-error path (Equoria-2ti1j) never releases, so its uncollected weeks DO
 * accumulate — each week owed once, settled once, never doubled. That is the
 * "owed, not forgiven" reading applied consistently; it is not compounding, which
 * would mean charging a week more than once.
 *
 * Real DB, no mocks. `processWeeklySalaries` is called SCOPED to this suite's own
 * fixture user — unscoped it would put every underfunded player on the shared
 * development database into grace.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  processWeeklySalaries,
  calculateWeeklyFee,
  ARREARS_SETTLED_STATUS,
  ARREARS_WRITTEN_OFF_STATUS,
} from '../services/groomSalaryService.mjs';
import { checkGroomMayWork } from '../services/groomEngagementService.mjs';
import { processRetirement } from '../services/groomRetirementService.mjs';
import { ensureRetirementSchedule } from '../services/groomRetirementScheduleService.mjs';
import { SYSTEM_ACCOUNT_BURN } from '../../economy/index.mjs';

const FIXTURE_PREFIX = 'TestFixture-bgdfb-owed';
const tag = () => randomBytes(6).toString('hex');

// Three consecutive Mondays, safely in the past so they cannot collide with a real
// cron run's pay week.
const WEEK_ONE = new Date('2026-04-06T09:00:00.000Z');
const WEEK_TWO = new Date('2026-04-13T09:00:00.000Z');
const WEEK_THREE = new Date('2026-04-20T09:00:00.000Z');
const WEEK_FOUR = new Date('2026-04-27T09:00:00.000Z');

const ONE_HORSE_FEE = calculateWeeklyFee(1);

async function makeUser(label, money) {
  const suffix = tag();
  return prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${label}-${suffix}`.slice(0, 30),
      email: `${FIXTURE_PREFIX}-${label}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Owed',
      lastName: label,
      money,
      settings: {},
    },
  });
}

/** One groom on one horse, so the weekly fee is exactly ONE_HORSE_FEE. */
async function makeStaffedGroom(userId, label) {
  const groom = await prisma.groom.create({
    data: {
      name: `${FIXTURE_PREFIX}-${label}-${tag()}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      startAge: 20,
      userId,
    },
  });
  await prisma.groomEngagement.create({ data: { groomId: groom.id, userId } });
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-${label}-horse-${tag()}`,
      sex: 'Filly',
      dateOfBirth: new Date('2024-06-15'),
      age: 1,
      userId,
      healthStatus: 'Excellent',
    },
  });
  await prisma.groomAssignment.create({
    data: { groomId: groom.id, foalId: horse.id, userId, isActive: true },
  });
  return { groom, horse };
}

function registerUserCleanup(cleanup, getUser, label) {
  cleanup.add(async () => {
    const user = getUser();
    if (!user?.id) {
      throw new Error(`[cleanup] ${label} user id missing — refusing an unscoped delete`);
    }
    const groomIds = (await prisma.groom.findMany({ where: { userId: user.id }, select: { id: true } })).map(g => g.id);
    // A groom RELEASED for non-payment is no longer this user's, so the sweep above
    // cannot see it. This file's own prefix finds it, and nothing else.
    const strayIds = (
      await prisma.groom.findMany({
        where: { name: { startsWith: FIXTURE_PREFIX } },
        select: { id: true },
      })
    ).map(g => g.id);
    const allGroomIds = [...new Set([...groomIds, ...strayIds])];
    if (allGroomIds.length) {
      await prisma.groomAssignment.deleteMany({ where: { groomId: { in: allGroomIds } } });
      await prisma.groomAssignmentLog.deleteMany({ where: { groomId: { in: allGroomIds } } });
      await prisma.groomSalaryPayment.deleteMany({ where: { groomId: { in: allGroomIds } } });
      await prisma.groomEngagement.deleteMany({ where: { groomId: { in: allGroomIds } } });
    }
    await prisma.groomSalaryPayment.deleteMany({ where: { userId: user.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.userTransaction.deleteMany({ where: { userId: user.id } });
    if (allGroomIds.length) {
      await prisma.groom.deleteMany({ where: { id: { in: allGroomIds } } });
    }
    await prisma.horse.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }, `${label} user and dependents`);
}

async function moneyOf(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

beforeAll(async () => {
  await prisma.systemAccount.upsert({
    where: { name: SYSTEM_ACCOUNT_BURN },
    create: { name: SYSTEM_ACCOUNT_BURN, balance: 0 },
    update: {},
  });
}, 30000);

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-bgdfb — the missed week is collected with the next one, once', () => {
  let user;
  let groom;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('collect', 0); // no money: week one cannot be paid
    ({ groom } = await makeStaffedGroom(user.id, 'collect'));
    registerUserCleanup(cleanup, () => user, 'collect');
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('week one goes unpaid and is recorded as owed', async () => {
    const result = await processWeeklySalaries(WEEK_ONE, { userId: user.id });
    expect(result.graced).toBe(1);
    expect(result.released).toBe(0);

    const missed = await prisma.groomSalaryPayment.findMany({
      where: { userId: user.id, groomId: groom.id, status: 'missed_insufficient_funds' },
    });
    expect(missed).toHaveLength(1);
    expect(missed[0].amount).toBe(ONE_HORSE_FEE);
  }, 60000);

  it('the next successful collection takes the owed week AND the current one, in one debit', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { money: 1000 } });
    const before = await moneyOf(user.id);

    const result = await processWeeklySalaries(WEEK_TWO, { userId: user.id });
    expect(result.errors).toEqual([]);
    expect(result.successful).toBe(1);

    // Both weeks, together.
    expect(await moneyOf(user.id)).toBe(before - ONE_HORSE_FEE * 2);
    expect(result.arrearsCollected).toBe(ONE_HORSE_FEE);
    expect(result.totalAmount).toBe(ONE_HORSE_FEE * 2);

    // ONE debit, not two: a single burn-ledger row carries the whole move.
    const burnRows = await prisma.userTransaction.findMany({
      where: { userId: user.id, type: 'credit', category: 'groom_salary_burn' },
      select: { amount: true },
    });
    expect(burnRows).toHaveLength(1);
    expect(Number(burnRows[0].amount)).toBe(ONE_HORSE_FEE * 2);

    // The owed week is marked settled, so it cannot be collected a second time.
    const settled = await prisma.groomSalaryPayment.findMany({
      where: { userId: user.id, groomId: groom.id, status: ARREARS_SETTLED_STATUS },
    });
    expect(settled).toHaveLength(1);
    expect(settled[0].amount).toBe(ONE_HORSE_FEE);
    const stillOwed = await prisma.groomSalaryPayment.count({
      where: { userId: user.id, status: 'missed_insufficient_funds' },
    });
    expect(stillOwed).toBe(0);

    // Grace is over and the groom works again.
    const row = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { feeUnpaidSince: true, userId: true },
    });
    expect(row.feeUnpaidSince).toBeNull();
    expect(row.userId).toBe(user.id);
    expect(checkGroomMayWork(row).allowed).toBe(true);
    const owner = await prisma.user.findUnique({
      where: { id: user.id },
      select: { groomSalaryGracePeriod: true },
    });
    expect(owner.groomSalaryGracePeriod).toBeNull();
  }, 60000);

  it('the settled week is never charged again: the following week costs the ordinary fee', async () => {
    const before = await moneyOf(user.id);

    const result = await processWeeklySalaries(WEEK_THREE, { userId: user.id });
    expect(result.errors).toEqual([]);
    expect(result.arrearsCollected).toBe(0);
    expect(await moneyOf(user.id)).toBe(before - ONE_HORSE_FEE);
  }, 60000);
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-bgdfb — a debt does not outlive the groom it was owed for', () => {
  let user;
  let groom;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('release', 0); // never able to pay
    ({ groom } = await makeStaffedGroom(user.id, 'release'));
    registerUserCleanup(cleanup, () => user, 'release');
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('releasing the groom for a full unpaid week writes the owed week off', async () => {
    const graceRun = await processWeeklySalaries(WEEK_ONE, { userId: user.id });
    expect(graceRun.graced).toBe(1);

    const releaseRun = await processWeeklySalaries(WEEK_TWO, { userId: user.id });
    expect(releaseRun.released).toBe(1);

    // The groom is gone from this player's staff...
    const row = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { userId: true },
    });
    expect(row.userId).toBeNull();

    // ...and so is the debt. Nothing is left in a collectable state, and the
    // written-off week is still on the record rather than deleted.
    const owed = await prisma.groomSalaryPayment.count({
      where: {
        userId: user.id,
        groomId: groom.id,
        status: { in: ['missed_insufficient_funds', 'missed_collection_error'] },
      },
    });
    expect(owed).toBe(0);
    const writtenOff = await prisma.groomSalaryPayment.findMany({
      where: { userId: user.id, groomId: groom.id, status: ARREARS_WRITTEN_OFF_STATUS },
    });
    expect(writtenOff).toHaveLength(1);
    expect(writtenOff[0].amount).toBe(ONE_HORSE_FEE);
  }, 90000);
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-bgdfb F2 — the debt never blocks the current week', () => {
  let user;
  let groom;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('partial', 0); // week one cannot be paid
    ({ groom } = await makeStaffedGroom(user.id, 'partial'));
    registerUserCleanup(cleanup, () => user, 'partial');
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('a wallet that covers this week but not the debt pays this week, and the groom works', async () => {
    const graceRun = await processWeeklySalaries(WEEK_ONE, { userId: user.id });
    expect(graceRun.graced).toBe(1);

    // Enough for one week's fee, not for two.
    await prisma.user.update({
      where: { id: user.id },
      data: { money: ONE_HORSE_FEE + 10 },
    });
    const before = await moneyOf(user.id);
    expect(before).toBeLessThan(ONE_HORSE_FEE * 2);

    const result = await processWeeklySalaries(WEEK_TWO, { userId: user.id });
    expect(result.errors).toEqual([]);
    expect(result.successful).toBe(1);
    expect(result.graced).toBe(0);
    expect(result.released).toBe(0);

    // THIS week was taken; the debt was not.
    expect(await moneyOf(user.id)).toBe(before - ONE_HORSE_FEE);
    expect(result.arrearsCollected).toBe(0);
    expect(result.totalAmount).toBe(ONE_HORSE_FEE);

    // The groom is paid up for the week they are working, so they work.
    const row = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { feeUnpaidSince: true, userId: true },
    });
    expect(row.feeUnpaidSince).toBeNull();
    expect(row.userId).toBe(user.id);
    expect(checkGroomMayWork(row).allowed).toBe(true);

    // And the debt is still on the books, in the same owed state.
    const stillOwed = await prisma.groomSalaryPayment.findMany({
      where: { userId: user.id, groomId: groom.id, status: 'missed_insufficient_funds' },
    });
    expect(stillOwed).toHaveLength(1);
    expect(stillOwed[0].amount).toBe(ONE_HORSE_FEE);
  }, 90000);

  it('the debt is collected on the first week the player can afford both', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { money: 1000 } });
    const before = await moneyOf(user.id);

    const result = await processWeeklySalaries(WEEK_THREE, { userId: user.id });
    expect(result.errors).toEqual([]);
    expect(result.arrearsCollected).toBe(ONE_HORSE_FEE);
    expect(await moneyOf(user.id)).toBe(before - ONE_HORSE_FEE * 2);

    const settled = await prisma.groomSalaryPayment.findMany({
      where: { userId: user.id, groomId: groom.id, status: ARREARS_SETTLED_STATUS },
    });
    expect(settled).toHaveLength(1);

    // And it is not collected a second time on the following week.
    const afterSettling = await moneyOf(user.id);
    const nextWeek = await processWeeklySalaries(WEEK_FOUR, { userId: user.id });
    expect(nextWeek.arrearsCollected).toBe(0);
    expect(await moneyOf(user.id)).toBe(afterSettling - ONE_HORSE_FEE);
  }, 90000);
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-bgdfb F3 — a debt does not outlive the career either', () => {
  let user;
  let groom;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('retire', 0); // the week cannot be paid
    ({ groom } = await makeStaffedGroom(user.id, 'retire'));
    registerUserCleanup(cleanup, () => user, 'retire');
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('retirement writes the owed week off, as a release does', async () => {
    const graceRun = await processWeeklySalaries(WEEK_ONE, { userId: user.id });
    expect(graceRun.graced).toBe(1);

    // Age the groom exactly onto its hidden retirement age, so the GAME retires it.
    const retirementAge = await ensureRetirementSchedule(prisma, groom.id);
    const row = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { startAge: true },
    });
    await prisma.groom.update({
      where: { id: groom.id },
      data: { careerWeeks: retirementAge - row.startAge },
    });

    const result = await processRetirement(groom.id);
    expect(result.groom.retired).toBe(true);
    expect(result.writtenOffArrearsCount).toBe(1);

    // Nothing collectable is left: the weekly pass skips retired grooms, so an owed
    // row here would be a debt nobody could ever settle.
    const owed = await prisma.groomSalaryPayment.count({
      where: {
        userId: user.id,
        groomId: groom.id,
        status: { in: ['missed_insufficient_funds', 'missed_collection_error'] },
      },
    });
    expect(owed).toBe(0);

    const writtenOff = await prisma.groomSalaryPayment.findMany({
      where: { userId: user.id, groomId: groom.id, status: ARREARS_WRITTEN_OFF_STATUS },
    });
    expect(writtenOff).toHaveLength(1);
    expect(writtenOff[0].amount).toBe(ONE_HORSE_FEE);
  }, 90000);
});
