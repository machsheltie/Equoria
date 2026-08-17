/**
 * groomSalaryService.processWeeklySalaries — pay-week idempotency sentinel
 * (Equoria-icqqm).
 *
 * Defect: processWeeklySalaries() debits every user with active groom
 * assignments UNCONDITIONALLY on every invocation. The cron advisory lock
 * (Equoria-dx65z) only prevents CONCURRENT double-execution; a second
 * SEQUENTIAL run in the same pay week (admin manual trigger after the cron,
 * ops re-run after partial failure, scheduler double-tick) re-debits every
 * groom-owning player a full weekly salary. Money is burned both times, so
 * the conservation sentinel stays green while players are silently
 * over-charged.
 *
 * Invariant locked here: exactly ONE salary debit per user per pay week,
 * with per-groom granularity (a partial re-run pays ONLY the grooms that
 * were not already paid this week), and a NEW pay week still debits
 * (idempotency must not become never-pays-again).
 *
 * Real DB, no mocks, scoped TestFixture-icqqm cleanup.
 *
 * NOTE: the pay-week oracle below is deliberately test-local (NOT imported
 * from the service) so the test checks the service against an independent
 * definition of "pay week" rather than the code under test's own helper.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { processWeeklySalaries, getPayWeekStart } from '../services/groomSalaryService.mjs';
import { SYSTEM_ACCOUNT_BURN } from '../../economy/index.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const FIXTURE_PREFIX = 'TestFixture-icqqm';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const createdAssignmentIds = [];
const createdGroomIds = [];
const createdHorseIds = [];
const createdUserIds = [];

function uniq() {
  return randomBytes(4).toString('hex');
}

/**
 * Independent pay-week oracle: UTC start-of-day of the most recent Monday
 * (SALARY_CONFIG.PAYMENT_DAY = 1) at-or-before `now`. The pay week is the
 * half-open interval [start, start + 7 days).
 */
function payWeekStartOf(now) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diff = (d.getUTCDay() - 1 + 7) % 7; // 1 = Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function payWeekWindowOf(now) {
  const start = payWeekStartOf(now);
  return { start, end: new Date(start.getTime() + 7 * MS_PER_DAY) };
}

async function makeUser(money) {
  const tag = uniq();
  const u = await prisma.user.create({
    data: {
      email: `${FIXTURE_PREFIX}-${tag}@test.com`,
      username: `${FIXTURE_PREFIX}-${tag}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'icqqm',
      lastName: 'Tester',
      money,
    },
  });
  createdUserIds.push(u.id);
  return u;
}

async function makeGroomAssignment(user, { skillLevel = 'novice', speciality = 'general' } = {}) {
  const tag = uniq();
  const groom = await prisma.groom.create({
    data: {
      name: `${FIXTURE_PREFIX}-Groom-${tag}`,
      speciality,
      personality: 'gentle',
      skillLevel,
      userId: user.id,
    },
  });
  createdGroomIds.push(groom.id);

  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-Horse-${tag}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });
  createdHorseIds.push(horse.id);

  const assignment = await prisma.groomAssignment.create({
    data: {
      foalId: horse.id,
      groomId: groom.id,
      userId: user.id,
      isActive: true,
    },
  });
  createdAssignmentIds.push(assignment.id);

  return { groom, horse, assignment };
}

async function getUserMoney(userId) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { money: true },
  });
  return row ? Number(row.money) : 0;
}

async function paidRowsInWindow(userId, groomId, window) {
  return prisma.groomSalaryPayment.findMany({
    where: {
      userId,
      groomId,
      paymentType: 'weekly_salary',
      status: 'paid',
      paymentDate: { gte: window.start, lt: window.end },
    },
  });
}

beforeAll(async () => {
  // Belt-and-braces: the burn SystemAccount must exist for the debit pairing.
  await prisma.systemAccount.upsert({
    where: { name: SYSTEM_ACCOUNT_BURN },
    create: { name: SYSTEM_ACCOUNT_BURN, balance: 0 },
    update: {},
  });
}, 30000);

afterAll(async () => {
  // Scoped cleanup — only rows tied to this suite's fixture users/ids.
  if (createdUserIds.length) {
    await prisma.groomSalaryPayment
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdAssignmentIds.length) {
    await prisma.groomAssignment
      .deleteMany({ where: { id: { in: createdAssignmentIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdHorseIds.length) {
    await prisma.horse
      .deleteMany({ where: { id: { in: createdHorseIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdGroomIds.length) {
    await prisma.groom
      .deleteMany({ where: { id: { in: createdGroomIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdUserIds.length) {
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
}, 60000);

// ────────────────────────────────────────────────────────────────────────────
// SENTINEL — the double-debit defect itself (must FAIL on pre-fix code)
// ────────────────────────────────────────────────────────────────────────────

describe('processWeeklySalaries — same-pay-week idempotency (Equoria-icqqm)', () => {
  it('a second sequential run in the same pay week debits NOTHING and reports the user as skipped', async () => {
    const now = new Date();
    const window = payWeekWindowOf(now);

    const user = await makeUser(1000);
    const { groom } = await makeGroomAssignment(user, {
      skillLevel: 'expert', // 100
      speciality: 'showHandling', // +15 → 115/week
    });

    const run1 = await processWeeklySalaries(now);
    expect(run1.successful).toBeGreaterThanOrEqual(1);

    const afterRun1 = await getUserMoney(user.id);
    expect(afterRun1).toBe(1000 - 115);

    // THE DEFECT: this second run, same pay week, must be a no-op for
    // this user. Pre-fix it double-debits (wallet → 770, 2 paid rows).
    const run2 = await processWeeklySalaries(now);

    const afterRun2 = await getUserMoney(user.id);
    expect(afterRun2).toBe(1000 - 115); // debited exactly ONCE

    const paidRows = await paidRowsInWindow(user.id, groom.id, window);
    expect(paidRows.length).toBe(1); // exactly one 'paid' row for the pay week

    // Run 2 reports the user as skipped, not re-paid and not failed.
    expect(run2.skipped).toBeGreaterThanOrEqual(1);

    // Exactly ONE burn-credit ledger row attributed to this user.
    const burnRows = await prisma.userTransaction.count({
      where: { userId: user.id, type: 'credit', category: 'groom_salary_burn' },
    });
    expect(burnRows).toBe(1);
  }, 120000);

  it('a run in a NEW pay week still debits (idempotency must not become never-pays-again)', async () => {
    const now = new Date();
    const weekA = payWeekWindowOf(now);
    const nextWeekNow = new Date(now.getTime() + 7 * MS_PER_DAY);
    const weekB = payWeekWindowOf(nextWeekNow);

    const user = await makeUser(1000);
    const { groom } = await makeGroomAssignment(user, {
      skillLevel: 'expert',
      speciality: 'showHandling',
    });

    await processWeeklySalaries(now);
    expect(await getUserMoney(user.id)).toBe(1000 - 115);

    // NEW pay week → the guard must NOT suppress this debit.
    await processWeeklySalaries(nextWeekNow);
    expect(await getUserMoney(user.id)).toBe(1000 - 115 - 115);

    // One paid row per groom per pay week, each dated inside its own window.
    const rowsWeekA = await paidRowsInWindow(user.id, groom.id, weekA);
    const rowsWeekB = await paidRowsInWindow(user.id, groom.id, weekB);
    expect(rowsWeekA.length).toBe(1);
    expect(rowsWeekB.length).toBe(1);
  }, 120000);

  it('partial-run heal: a re-run pays ONLY the grooms that were not already paid this week', async () => {
    const now = new Date();
    const window = payWeekWindowOf(now);

    const user = await makeUser(1000);
    const { groom: groomA } = await makeGroomAssignment(user, {
      skillLevel: 'novice', // 50
      speciality: 'general',
    });
    const { groom: groomB } = await makeGroomAssignment(user, {
      skillLevel: 'expert', // 115
      speciality: 'showHandling',
    });

    // Simulate a partial prior run: groom A was already paid this week
    // (paid row committed, e.g. before a mid-loop crash of a previous run).
    await prisma.groomSalaryPayment.create({
      data: {
        groomId: groomA.id,
        userId: user.id,
        amount: 50,
        paymentDate: now,
        paymentType: 'weekly_salary',
        status: 'paid',
      },
    });

    await processWeeklySalaries(now);

    // Only groom B's salary (115) may be debited — NOT the full 165.
    expect(await getUserMoney(user.id)).toBe(1000 - 115);

    // Groom A still has exactly the one (pre-planted) paid row; groom B one.
    const rowsA = await paidRowsInWindow(user.id, groomA.id, window);
    const rowsB = await paidRowsInWindow(user.id, groomB.id, window);
    expect(rowsA.length).toBe(1);
    expect(rowsB.length).toBe(1);
  }, 120000);

  it('two CONCURRENT same-pay-week runs on a well-funded wallet yield exactly one debit', async () => {
    // The debitMoneyOrThrow predicate only prevents a NEGATIVE wallet; on a
    // well-funded wallet two concurrent runs would both pass the "already
    // paid?" read under READ COMMITTED and both debit. The per-(user, week)
    // advisory xact lock must serialize them so the loser sees the winner's
    // committed payment rows and skips.
    const now = new Date();
    const window = payWeekWindowOf(now);

    const user = await makeUser(1000);
    const { groom } = await makeGroomAssignment(user, {
      skillLevel: 'novice', // 50
      speciality: 'general',
    });

    await Promise.all([processWeeklySalaries(now), processWeeklySalaries(now)]);

    expect(await getUserMoney(user.id)).toBe(1000 - 50); // exactly one debit

    const paidRows = await paidRowsInWindow(user.id, groom.id, window);
    expect(paidRows.length).toBe(1);

    const burnRows = await prisma.userTransaction.count({
      where: { userId: user.id, type: 'credit', category: 'groom_salary_burn' },
    });
    expect(burnRows).toBe(1);
  }, 120000);
});

// ────────────────────────────────────────────────────────────────────────────
// getPayWeekStart — pay-week boundary unit checks against the independent
// oracle above (guards the helper against Monday-anchor / UTC drift)
// ────────────────────────────────────────────────────────────────────────────

describe('getPayWeekStart — UTC Monday anchoring (Equoria-icqqm)', () => {
  it('a Monday maps to that same UTC day regardless of time-of-day', () => {
    // 2026-08-17 is a Monday.
    const morning = new Date('2026-08-17T00:00:00.000Z');
    const night = new Date('2026-08-17T23:59:59.999Z');
    expect(getPayWeekStart(morning).toISOString()).toBe('2026-08-17T00:00:00.000Z');
    expect(getPayWeekStart(night).toISOString()).toBe('2026-08-17T00:00:00.000Z');
  });

  it('a Sunday maps back to the PREVIOUS Monday (6 days earlier)', () => {
    const sunday = new Date('2026-08-23T12:00:00.000Z');
    expect(getPayWeekStart(sunday).toISOString()).toBe('2026-08-17T00:00:00.000Z');
  });

  it('exactly one week later lands on the NEXT Monday (windows tile with no gap/overlap)', () => {
    const monday = new Date('2026-08-17T09:00:00.000Z'); // the cron's Monday 09:00 UTC tick
    const nextTick = new Date(monday.getTime() + 7 * MS_PER_DAY);
    expect(getPayWeekStart(nextTick).toISOString()).toBe('2026-08-24T00:00:00.000Z');
  });

  it('agrees with the test-local independent oracle across a full week of days', () => {
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(2026, 7, 17 + i, 9, 0, 0)); // Mon..Sun
      expect(getPayWeekStart(d).toISOString()).toBe(payWeekStartOf(d).toISOString());
    }
  });
});
