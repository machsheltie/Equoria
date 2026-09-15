/**
 * Equoria-95yrv — the weekly groom fee is charged PER HORSE ASSIGNED.
 *
 * OWNER RULING (2026-09-14 10:23, verbatim, via the decision register):
 *   "Charge the player per horse assigned to a groom per week: $70 per horse per
 *    week, up to 10 horses per groom."
 *
 * This REPLACES the per-groom-on-staff basis Equoria-ypb7d.3 introduced, and with
 * it the whole skill/specialty rate table (50/75/100/150 plus 0/10/15). The fee no
 * longer depends on who the groom is — only on how many horses they are working:
 *
 *     weekly fee for a groom = 70 x (their ACTIVE assignments)
 *
 * So a groom on no horses costs NOTHING (hoarding is free again, and idle grooms
 * are not a sink), and a groom on three horses costs three times a groom on one.
 * The ten-horse cap is what bounds it, and it is now enforced at ASSIGNMENT time
 * rather than left implicit in the fee.
 *
 * WHAT EACH CASE WOULD HAVE DONE ON THE PRE-RULING CODE:
 *   1. fee arithmetic            -> was a skill/specialty lookup, horse count unread
 *   2. the weekly pass's debit   -> debited one flat rate per groom on staff
 *   3. the salary summary        -> reported that same flat rate
 *   4. a groom with no horses    -> still cost 50-165/week
 *   5. the 11th assignment       -> accepted (the live caps were 2..5 by skill on
 *                                   one door and ABSENT on the other)
 *
 * Real DB, no mocks. Every `processWeeklySalaries` call is scoped to this suite's
 * own fixture user (`groomSalaryPassScoped.sentinel.test.mjs` enforces that).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  FEE_PER_HORSE_PER_WEEK,
  MAX_HORSES_PER_GROOM,
  calculateWeeklyFee,
  calculateUserSalaryCost,
  processWeeklySalaries,
} from '../services/groomSalaryService.mjs';
import { createAssignment } from '../services/groomAssignmentService.mjs';
import { assignGroomToFoal } from '../../../utils/groomSystem.mjs';
import { SYSTEM_ACCOUNT_BURN } from '../../economy/index.mjs';

const FIXTURE_PREFIX = 'TestFixture-95yrv-fee';
const tag = () => randomBytes(6).toString('hex');

async function makeUser(label, money = 50000) {
  const suffix = tag();
  return prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${label}-${suffix}`.slice(0, 30),
      email: `${FIXTURE_PREFIX}-${label}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Fee',
      lastName: label,
      money,
      settings: {},
    },
  });
}

async function makeGroom(userId, label, extra = {}) {
  return prisma.groom.create({
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

async function assign(groomId, horseId, userId) {
  return prisma.groomAssignment.create({
    data: { groomId, foalId: horseId, userId, isActive: true },
  });
}

async function moneyOf(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. The arithmetic itself
// ─────────────────────────────────────────────────────────────────────────────

describe('Equoria-95yrv — the fee is 70 x horses assigned', () => {
  it('is $70 per horse per week, and a groom on no horses is free', () => {
    expect(FEE_PER_HORSE_PER_WEEK).toBe(70);
    expect(MAX_HORSES_PER_GROOM).toBe(10);

    expect(calculateWeeklyFee(0)).toBe(0);
    expect(calculateWeeklyFee(1)).toBe(70);
    expect(calculateWeeklyFee(3)).toBe(210);
    expect(calculateWeeklyFee(MAX_HORSES_PER_GROOM)).toBe(700);
  });

  it('REPORTS an over-cap groom honestly rather than truncating the charge', () => {
    // The cap is enforced where assignments are made. A row that predates the cap
    // must not be silently billed as though it were ten — a player would be told a
    // number that does not match their own roster.
    expect(calculateWeeklyFee(12)).toBe(840);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2/3/4. The weekly pass, the summary, and the idle groom — against the real DB
// ─────────────────────────────────────────────────────────────────────────────

describe('Equoria-95yrv — the weekly pass and the summary charge the same thing', () => {
  let user;
  let workingGroom;
  let idleGroom;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    await prisma.systemAccount.upsert({
      where: { name: SYSTEM_ACCOUNT_BURN },
      create: { name: SYSTEM_ACCOUNT_BURN, balance: 0 },
      update: {},
    });

    user = await makeUser('pass');
    workingGroom = await makeGroom(user.id, 'working');
    idleGroom = await makeGroom(user.id, 'idle');

    for (const label of ['h1', 'h2', 'h3']) {
      const horse = await makeHorse(user.id, label);
      await assign(workingGroom.id, horse.id, user.id);
    }

    cleanup.add(() => prisma.groomSalaryPayment.deleteMany({ where: { userId: user.id } }), 'salary payments');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: user.id } }), 'transactions');
    cleanup.add(() => prisma.groomEngagement.deleteMany({ where: { userId: user.id } }), 'engagements');
    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { userId: user.id } }), 'assignments');
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: user.id } }), 'notifications');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'grooms');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('the salary summary charges 70 per assigned horse and nothing for an idle groom', async () => {
    const summary = await calculateUserSalaryCost(user.id);

    expect(summary.totalWeeklyCost).toBe(210);
    expect(summary.groomCount).toBe(2);

    const working = summary.breakdown.find(b => b.groomId === workingGroom.id);
    const idle = summary.breakdown.find(b => b.groomId === idleGroom.id);
    expect(working).toMatchObject({ assignedHorses: 3, weeklyFee: 210 });
    expect(idle).toMatchObject({ assignedHorses: 0, weeklyFee: 0 });
  }, 30000);

  it('the weekly pass debits 70 x assigned horses, once, and bills the idle groom nothing', async () => {
    const before = await moneyOf(user.id);

    const results = await processWeeklySalaries(new Date(), { userId: user.id });
    expect(results.errors).toEqual([]);
    expect(results.totalAmount).toBe(210);

    expect(await moneyOf(user.id)).toBe(before - 210);

    const rows = await prisma.groomSalaryPayment.findMany({
      where: { userId: user.id, status: 'paid' },
      select: { groomId: true, amount: true },
    });
    const byGroom = Object.fromEntries(rows.map(r => [r.groomId, r.amount]));
    expect(byGroom[workingGroom.id]).toBe(210);
    expect(byGroom[idleGroom.id]).toBe(0);
  }, 60000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. The cap, at every door that creates an assignment
// ─────────────────────────────────────────────────────────────────────────────

describe('Equoria-95yrv — a groom works at most ten horses', () => {
  let user;
  let groom;
  let spareHorse;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('cap');
    groom = await makeGroom(user.id, 'capped');

    for (let i = 0; i < MAX_HORSES_PER_GROOM; i++) {
      const horse = await makeHorse(user.id, `capped-${i}`);
      await assign(groom.id, horse.id, user.id);
    }
    spareHorse = await makeHorse(user.id, 'eleventh');

    cleanup.add(() => prisma.groomAssignmentLog.deleteMany({ where: { groomId: groom.id } }), 'assignment logs');
    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { userId: user.id } }), 'assignments');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'grooms');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('refuses the eleventh horse through createAssignment, in words a player can read', async () => {
    await expect(createAssignment(groom.id, spareHorse.id, user.id)).rejects.toThrow(/already caring for 10 horses/i);

    const count = await prisma.groomAssignment.count({
      where: { groomId: groom.id, isActive: true },
    });
    expect(count).toBe(MAX_HORSES_PER_GROOM);
  }, 30000);

  it('refuses the eleventh horse through assignGroomToFoal too', async () => {
    await expect(assignGroomToFoal(spareHorse.id, groom.id, user.id)).rejects.toThrow(/already caring for 10 horses/i);

    const count = await prisma.groomAssignment.count({
      where: { groomId: groom.id, isActive: true },
    });
    expect(count).toBe(MAX_HORSES_PER_GROOM);
  }, 30000);
});
