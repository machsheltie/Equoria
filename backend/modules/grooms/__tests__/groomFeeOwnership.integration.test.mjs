/**
 * Equoria-6p398.14 — the weekly groom fee counts only assignments on horses the
 * groom's employer still owns.
 *
 * Owner ruling 2026-10-28 (q228) made the fee the groom's star level price per week,
 * however many horses, so the count below no longer prices anything; it is still the
 * horse count the salary summary and groom salary read report. It used to be
 * 70 x the groom's ACTIVE assignments (Equoria-95yrv), counted by
 * `countActiveAssignments` with no look at who owns the horse. A sale ends the
 * seller's assignments (horseTransferReconciliation), but any other path that
 * moves a horse to another player without ending them — an admin transfer, an
 * anonymization — leaves an active row on a horse the employer no longer owns,
 * and the employer is billed for work on someone else's horse. The count now
 * requires the horse's owner to be the groom's employer.
 *
 * The same count feeds the weekly pass, the salary summary, and the groom salary
 * controller, so one fixture proves all of them.
 *
 * Real DB, no mocks. Every `processWeeklySalaries` call is scoped to this
 * suite's own fixture user (`groomSalaryPassScoped.sentinel.test.mjs`).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  calculateUserSalaryCost,
  processWeeklySalaries,
  countActiveAssignments,
} from '../services/groomSalaryService.mjs';

const fixturePrefix = 'TestFixture-6p398_14-fee';
const tag = () => randomBytes(6).toString('hex');

async function makeUser(label, money = 50000) {
  const suffix = tag();
  return prisma.user.create({
    data: {
      emailVerified: true,
      username: `${fixturePrefix}-${label}-${suffix}`.slice(0, 30),
      email: `${fixturePrefix}-${label}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Fee',
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
      name: `${fixturePrefix}-${label}-${tag()}`,
      sex: 'Filly',
      dateOfBirth: new Date('2023-05-01'),
      age: 3,
      userId,
      healthStatus: 'Excellent',
    },
  });
}

describe('Equoria-6p398.14 — fee counts only horses the employer owns', () => {
  let employer;
  let stranger;
  let groom;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ids = () => [employer?.id, stranger?.id].filter(Boolean);
    cleanup.add(() => prisma.groomSalaryPayment.deleteMany({ where: { userId: { in: ids() } } }), 'salary payments');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: ids() } } }), 'transactions');
    cleanup.add(() => prisma.groomEngagement.deleteMany({ where: { userId: { in: ids() } } }), 'engagements');
    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { groomId: groom.id } }), 'assignments');
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: ids() } } }), 'notifications');
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: groom.id } }), 'groom');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: ids() } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: ids() } } }), 'users');

    employer = await makeUser('employer');
    stranger = await makeUser('stranger');
    groom = await prisma.groom.create({
      data: {
        name: `${fixturePrefix}-groom-${tag()}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        starLevel: 'rookie',
        startAge: 20,
        userId: employer.id,
      },
    });

    const owned = await makeHorse(employer.id, 'owned');
    // A horse that now belongs to someone else but still carries the employer's
    // groom assignment (a non-sale transfer that never ended it).
    const transferred = await makeHorse(stranger.id, 'transferred');
    await prisma.groomAssignment.create({
      data: { groomId: groom.id, foalId: owned.id, userId: employer.id, isActive: true },
    });
    await prisma.groomAssignment.create({
      data: { groomId: groom.id, foalId: transferred.id, userId: employer.id, isActive: true },
    });
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('countActiveAssignments counts the owned horse and not the transferred one', async () => {
    const counts = await countActiveAssignments(prisma, [groom.id]);
    expect(counts.get(groom.id)).toBe(1);
  });

  it('the salary summary reports one horse and the Rookie groom price (q228)', async () => {
    const summary = await calculateUserSalaryCost(employer.id);
    expect(summary.totalWeeklyCost).toBe(100);
    expect(summary.breakdown.find(b => b.groomId === groom.id)).toMatchObject({
      assignedHorses: 1,
      weeklyFee: 100,
    });
  });

  it('the weekly pass debits the one groom price once (q228)', async () => {
    const row = await prisma.user.findUnique({ where: { id: employer.id }, select: { money: true } });
    const before = Number(row.money);

    const results = await processWeeklySalaries(new Date(), { userId: employer.id });
    expect(results.errors).toEqual([]);
    expect(results.totalAmount).toBe(100);

    const after = await prisma.user.findUnique({ where: { id: employer.id }, select: { money: true } });
    expect(Number(after.money)).toBe(before - 100);
  }, 60000);
});
