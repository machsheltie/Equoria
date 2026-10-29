/**
 * GroomSalaryPayment.weekKey — the database refuses a second paid salary for one groom in
 * one pay week (Equoria-h7518, owner ruling 2026-10-26 q65).
 *
 * The application already prevents a double payment (advisory lock plus a paid-rows read,
 * Equoria-icqqm). This pins the guarantee that survives a logic bug: a partial unique index
 * on (userId, groomId, weekKey, paymentType) WHERE status = 'paid'.
 *
 * Asserted here, against the real database:
 *   - a weekly run writes the paid row with weekKey = the Eastern Sunday of the pay week (q268);
 *   - a second paid row for the same groom, week and type is refused (P2002), whatever its
 *     paymentDate says;
 *   - the same groom can still be paid in a LATER week, and a missed row (a different
 *     status) never conflicts with a paid row or with another missed row of the same week.
 *
 * Real DB, no mocks, fail-loud scoped cleanup.
 */

import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { processWeeklySalaries, getPayWeekStart } from '../services/groomSalaryService.mjs';
import { gameDateKey } from '../../../utils/gameTime.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

// The economy's burn SystemAccount name (SYSTEM_ACCOUNT_BURN = 'burn').
const burnAccountName = 'burn';
const fixturePrefix = 'TestFixture-h7518';

const tag = () => randomBytes(4).toString('hex');

describe('groom_salary_payments weekKey (Equoria-h7518)', () => {
  const cleanup = createCleanupTracker();
  let user;
  let groom;

  beforeAll(async () => {
    await prisma.systemAccount.upsert({
      where: { name: burnAccountName },
      create: { name: burnAccountName, balance: 0 },
      update: {},
    });
  }, 30000);

  afterEach(() => cleanup.run(), 60000);

  async function setUp() {
    const suffix = tag();
    user = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `${fixturePrefix}-${suffix}@test.com`,
        username: `${fixturePrefix}-${suffix}`.slice(0, 30),
        password: 'irrelevant-hash',
        firstName: 'h7518',
        lastName: 'Tester',
        money: 1000,
      },
    });
    groom = await prisma.groom.create({
      data: {
        name: `${fixturePrefix}-Groom-${suffix}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        userId: user.id,
      },
    });
    const horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${fixturePrefix}-Horse-${suffix}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: user.id,
      },
    });
    const assignment = await prisma.groomAssignment.create({
      data: { foalId: horse.id, groomId: groom.id, userId: user.id, isActive: true },
    });
    cleanup.add(() => prisma.groomSalaryPayment.deleteMany({ where: { userId: user.id } }), 'salaryPayments');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: user.id } }), 'userTransactions');
    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { id: assignment.id } }), 'assignment');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
    cleanup.add(() => prisma.groomEngagement.deleteMany({ where: { userId: user.id } }), 'engagements');
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: groom.id } }), 'groom');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
  }

  const paidRow = (weekKey, extra = {}) => ({
    groomId: groom.id,
    userId: user.id,
    amount: 70,
    weekKey,
    paymentType: 'weeklySalary',
    status: 'paid',
    ...extra,
  });

  it('a weekly run writes the paid row with the Eastern Sunday of the pay week as its weekKey (q268; old: Monday)', async () => {
    await setUp();
    const now = new Date();

    const run = await processWeeklySalaries(now, { userId: user.id });
    expect(run.successful).toBe(1);

    const rows = await prisma.groomSalaryPayment.findMany({
      where: { userId: user.id, groomId: groom.id, status: 'paid' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].weekKey).toBe(gameDateKey(getPayWeekStart(now)));
  }, 60000);

  it('refuses a second PAID row for the same groom, pay week and type', async () => {
    await setUp();
    await prisma.groomSalaryPayment.create({ data: paidRow('2026-10-19') });

    await expect(
      prisma.groomSalaryPayment.create({
        data: paidRow('2026-10-19', { paymentDate: new Date('2026-10-21T15:00:00Z') }),
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    expect(await prisma.groomSalaryPayment.count({ where: { userId: user.id, status: 'paid' } })).toBe(1);
  }, 60000);

  it('still pays the same groom in a later week', async () => {
    await setUp();
    await prisma.groomSalaryPayment.create({ data: paidRow('2026-10-19') });
    await prisma.groomSalaryPayment.create({ data: paidRow('2026-10-26') });

    expect(await prisma.groomSalaryPayment.count({ where: { userId: user.id, status: 'paid' } })).toBe(2);
  }, 60000);

  it('never limits rows that record a missed week', async () => {
    await setUp();
    const missed = status => ({
      groomId: groom.id,
      userId: user.id,
      amount: 70,
      weekKey: '2026-10-19',
      paymentType: 'weeklySalary',
      status,
    });
    // A fee missed twice in one week, then paid later in that same week.
    await prisma.groomSalaryPayment.create({ data: missed('missedInsufficientFunds') });
    await prisma.groomSalaryPayment.create({ data: missed('missedGracePeriod') });
    await prisma.groomSalaryPayment.create({ data: missed('missedGracePeriod') });
    await prisma.groomSalaryPayment.create({ data: paidRow('2026-10-19') });

    expect(await prisma.groomSalaryPayment.count({ where: { userId: user.id } })).toBe(4);
  }, 60000);
});
