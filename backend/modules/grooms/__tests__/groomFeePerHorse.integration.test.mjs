/**
 * The weekly groom fee is the groom's star level's price, per groom per week.
 *
 * OWNER RULING 2026-10-28 (q228, Equoria-nawn5): "The star price per groom, however
 * many horses (like riders)." Rookie 100, Novice 200, Intermediate 300, Advanced 400,
 * Expert 500 (backend/constants/staffLevels.mjs).
 *
 * This file used to specify Equoria-95yrv's basis (owner ruling 2026-09-14: 70 per
 * horse assigned, a groom on no horses free). The 2026-10-28 ruling replaced that
 * behaviour, so these cases were rewritten to the new contract:
 *   1. fee arithmetic            -> the level price, whatever the horse count
 *   2. the weekly pass's debit   -> one level price per groom on staff
 *   3. the salary summary        -> reports that same price, plus the horse count
 *   4. a groom with no horses    -> costs their level price, like an idle rider
 * The horse cap (case 5) is unchanged.
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

describe('q228 — the weekly fee is the groom star level price', () => {
  it('is 100-500 by level, and the horse cap is twenty (q68)', () => {
    expect(MAX_HORSES_PER_GROOM).toBe(20);
    expect(
      ['rookie', 'novice', 'intermediate', 'advanced', 'expert'].map(starLevel => calculateWeeklyFee({ starLevel })),
    ).toEqual([100, 200, 300, 400, 500]);
  });

  it('refuses a groom row without a star level rather than charging nothing', () => {
    expect(() => calculateWeeklyFee({})).toThrow('Unknown staff level');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2/3/4. The weekly pass, the summary, and the idle groom — against the real DB
// ─────────────────────────────────────────────────────────────────────────────

describe('q228 — the weekly pass and the summary charge the same thing', () => {
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
    workingGroom = await makeGroom(user.id, 'working', { starLevel: 'intermediate' });
    idleGroom = await makeGroom(user.id, 'idle', { starLevel: 'novice' });

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

  it('the salary summary charges each groom their level price, however many horses', async () => {
    const summary = await calculateUserSalaryCost(user.id);

    expect(summary.totalWeeklyCost).toBe(500);
    expect(summary.groomCount).toBe(2);
    expect(summary).not.toHaveProperty('feePerHorsePerWeek');

    const working = summary.breakdown.find(b => b.groomId === workingGroom.id);
    const idle = summary.breakdown.find(b => b.groomId === idleGroom.id);
    expect(working).toMatchObject({ assignedHorses: 3, weeklyFee: 300 });
    expect(idle).toMatchObject({ assignedHorses: 0, weeklyFee: 200 });
  }, 30000);

  it('the weekly pass debits one level price per groom, once, idle grooms included', async () => {
    const before = await moneyOf(user.id);

    const results = await processWeeklySalaries(new Date(), { userId: user.id });
    expect(results.errors).toEqual([]);
    expect(results.totalAmount).toBe(500);

    expect(await moneyOf(user.id)).toBe(before - 500);

    const rows = await prisma.groomSalaryPayment.findMany({
      where: { userId: user.id, status: 'paid' },
      select: { groomId: true, amount: true },
    });
    const byGroom = Object.fromEntries(rows.map(r => [r.groomId, r.amount]));
    expect(byGroom[workingGroom.id]).toBe(300);
    expect(byGroom[idleGroom.id]).toBe(200);
  }, 60000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. The cap, at every door that creates an assignment
// ─────────────────────────────────────────────────────────────────────────────

describe('Equoria-95yrv — a groom works at most twenty horses (q68)', () => {
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

  it('refuses the horse past the cap through createAssignment, in words a player can read', async () => {
    await expect(createAssignment(groom.id, spareHorse.id, user.id)).rejects.toThrow(/already caring for 20 horses/i);

    const count = await prisma.groomAssignment.count({
      where: { groomId: groom.id, isActive: true },
    });
    expect(count).toBe(MAX_HORSES_PER_GROOM);
  }, 30000);

  it('refuses the horse past the cap through assignGroomToFoal too', async () => {
    await expect(assignGroomToFoal(spareHorse.id, groom.id, user.id)).rejects.toThrow(/already caring for 20 horses/i);

    const count = await prisma.groomAssignment.count({
      where: { groomId: groom.id, isActive: true },
    });
    expect(count).toBe(MAX_HORSES_PER_GROOM);
  }, 30000);
});
