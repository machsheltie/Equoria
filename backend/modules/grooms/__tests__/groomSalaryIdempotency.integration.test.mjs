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
 * Real DB, no mocks, scoped TestFixture-icqqm cleanup. Note that "debits every user"
 * above describes the SERVICE's production behaviour, not these tests: every call below
 * is scoped to this suite's own fixture user (see the block after the imports).
 *
 * NOTE: the pay-week oracle below is deliberately test-local (NOT imported
 * from the service) so the test checks the service against an independent
 * definition of "pay week" rather than the code under test's own helper.
 */

/**
 * Equoria-ypb7d.3 — EVERY `processWeeklySalaries` CALL IN THIS FILE IS SCOPED.
 *
 * Before Equoria-ypb7d.3 a non-payment was a silent no-op: `terminateGroomsForNonPayment`
 * wrote `terminationReason` to a column that does not exist and its own catch swallowed
 * the throw. An unscoped pass against the shared development database was therefore
 * merely wasteful — it debited real wallets and wrote payment rows, but it could not
 * take anything away.
 *
 * It can now. An unscoped pass puts every underfunded player's grooms into the one-week
 * grace period, and RELEASES the ones already in it — back to the grooms-for-hire pool,
 * assignments ended, gone from that player's staff. The shared development database
 * holds real player data. So every call below passes
 * `{ userId: <this suite's fixture user> }`, and
 * `groomSalaryPassScoped.sentinel.test.mjs` fails if one ever loses it again.
 *
 * Nothing is weakened by the scope. Assertions that were `>= 1` purely to tolerate other
 * users' rows became exact, which is stronger.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { processWeeklySalaries, getPayWeekStart } from '../services/groomSalaryService.mjs';
import { SYSTEM_ACCOUNT_BURN } from '../../economy/index.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const FIXTURE_PREFIX = 'TestFixture-icqqm';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Owner ruling 2026-10-28 (q228): the weekly fee is the groom's star level price,
 * however many horses. Every `makeGroomAssignment` fixture below is a Rookie groom
 * (the column default), so one groom costs exactly this much a week. (It was 70 per
 * horse under Equoria-95yrv; the ruling changed it.)
 */
const FEE_ONE_HORSE = 100;

const createdAssignmentIds = [];
const createdGroomIds = [];
const createdHorseIds = [];
const createdUserIds = [];

function uniq() {
  return randomBytes(4).toString('hex');
}

/**
 * Independent pay-week oracle: Eastern start-of-day of the most recent Sunday
 * (SALARY_CONFIG.PAYMENT_DAY = 0) at-or-before `now`. The pay week is the
 * half-open interval [start, start + 7 days).
 */
// Owner ruling 2026-10-09: the pay week starts at 00:00 EASTERN (America/New_York, with
// daylight saving). Old contract: 00:00 UTC.
// Owner ruling 2026-10-29 (q268, Equoria-hc96y): the pay week ends Sunday midnight Eastern,
// so it starts on SUNDAY. Old contract: it started on Monday.
// Independent oracle: walk back to the Eastern Sunday, then pick whichever of
// 04:00Z (EDT) / 05:00Z (EST) reads as Eastern midnight on that date.
const easternFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: 'numeric',
  hourCycle: 'h23',
});
function easternParts(date) {
  return Object.fromEntries(easternFormatter.formatToParts(date).map(p => [p.type, p.value]));
}
const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function payWeekStartOf(now) {
  const p = easternParts(now);
  const back = WEEKDAY[p.weekday]; // 0 = Sunday
  const sundayUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) - back);
  for (const offsetHours of [4, 5]) {
    const candidate = new Date(sundayUtc + offsetHours * 60 * 60 * 1000);
    const c = easternParts(candidate);
    if (c.weekday === 'Sun' && Number(c.hour) === 0) {
      return candidate;
    }
  }
  throw new Error(`no Eastern midnight found for ${now.toISOString()}`);
}

function payWeekWindowOf(now) {
  const start = payWeekStartOf(now);
  // The next Sunday's start (a DST week is 7 days +/- 1 hour long).
  return { start, end: payWeekStartOf(new Date(start.getTime() + 8 * MS_PER_DAY)) };
}

async function makeUser(money) {
  const tag = uniq();
  const u = await prisma.user.create({
    data: {
      emailVerified: true,
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
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-Horse-${tag}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    }),
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
      paymentType: 'weeklySalary',
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
      skillLevel: 'expert',
      speciality: 'showHandling',
    });

    const run1 = await processWeeklySalaries(now, { userId: user.id });
    // Exact, not `>= 1`: the pass is scoped to this suite's own user, so one successful
    // payer is the whole population. The old `>= 1` existed only to tolerate every
    // other row in the table.
    expect(run1.successful).toBe(1);

    const afterRun1 = await getUserMoney(user.id);
    expect(afterRun1).toBe(1000 - FEE_ONE_HORSE);

    // THE DEFECT: this second run, same pay week, must be a no-op for
    // this user. Pre-fix it double-debits (two debits, 2 paid rows).
    const run2 = await processWeeklySalaries(now, { userId: user.id });

    const afterRun2 = await getUserMoney(user.id);
    expect(afterRun2).toBe(1000 - FEE_ONE_HORSE); // debited exactly ONCE

    const paidRows = await paidRowsInWindow(user.id, groom.id, window);
    expect(paidRows.length).toBe(1); // exactly one 'paid' row for the pay week

    // Run 2 reports the user as skipped, not re-paid and not failed.
    expect(run2.skipped).toBe(1);

    // Exactly ONE burn-credit ledger row attributed to this user.
    const burnRows = await prisma.userTransaction.count({
      where: { userId: user.id, type: 'credit', category: 'groomSalaryBurn' },
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

    await processWeeklySalaries(now, { userId: user.id });
    expect(await getUserMoney(user.id)).toBe(1000 - FEE_ONE_HORSE);

    // NEW pay week → the guard must NOT suppress this debit.
    await processWeeklySalaries(nextWeekNow, { userId: user.id });
    expect(await getUserMoney(user.id)).toBe(1000 - FEE_ONE_HORSE - FEE_ONE_HORSE);

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
      skillLevel: 'novice',
      speciality: 'general',
    });
    const { groom: groomB } = await makeGroomAssignment(user, {
      skillLevel: 'expert',
      speciality: 'showHandling',
    });

    // Simulate a partial prior run: groom A was already paid this week
    // (paid row committed, e.g. before a mid-loop crash of a previous run).
    await prisma.groomSalaryPayment.create({
      data: {
        groomId: groomA.id,
        userId: user.id,
        amount: FEE_ONE_HORSE,
        paymentDate: now,
        paymentType: 'weeklySalary',
        status: 'paid',
      },
    });

    await processWeeklySalaries(now, { userId: user.id });

    // Only groom B's fee may be debited — NOT both grooms'.
    expect(await getUserMoney(user.id)).toBe(1000 - FEE_ONE_HORSE);

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
      skillLevel: 'novice',
      speciality: 'general',
    });

    // Both runs scoped to the same fixture user: the contention this case is about is
    // per-(user, pay week) on the advisory lock, which the scope does not touch.
    await Promise.all([
      processWeeklySalaries(now, { userId: user.id }),
      processWeeklySalaries(now, { userId: user.id }),
    ]);

    expect(await getUserMoney(user.id)).toBe(1000 - FEE_ONE_HORSE); // exactly one debit

    const paidRows = await paidRowsInWindow(user.id, groom.id, window);
    expect(paidRows.length).toBe(1);

    const burnRows = await prisma.userTransaction.count({
      where: { userId: user.id, type: 'credit', category: 'groomSalaryBurn' },
    });
    expect(burnRows).toBe(1);
  }, 120000);
});

// ────────────────────────────────────────────────────────────────────────────
// getPayWeekStart — pay-week boundary unit checks against the independent
// oracle above (guards the helper against Sunday-anchor / UTC drift)
// ────────────────────────────────────────────────────────────────────────────

describe('getPayWeekStart — Eastern Sunday anchoring (Equoria-icqqm; owner rulings 2026-10-09, q268)', () => {
  // Owner ruling 2026-10-29 (q268, Equoria-hc96y) moved the pay week from Monday to Sunday.
  it('a Sunday maps to that same Eastern day regardless of time-of-day', () => {
    // 2026-08-16 is a Sunday; Eastern is EDT (UTC-4).
    const morning = new Date('2026-08-16T04:00:00.000Z'); // Sun 00:00 EDT
    const night = new Date('2026-08-17T03:59:59.999Z'); // Sun 23:59:59.999 EDT
    expect(getPayWeekStart(morning).toISOString()).toBe('2026-08-16T04:00:00.000Z');
    expect(getPayWeekStart(night).toISOString()).toBe('2026-08-16T04:00:00.000Z');
  });

  it('Saturday evening Eastern still belongs to the previous pay week, even though it is Sunday in UTC', () => {
    const saturdayNight = new Date('2026-08-16T02:00:00.000Z'); // Sat 22:00 EDT
    expect(getPayWeekStart(saturdayNight).toISOString()).toBe('2026-08-09T04:00:00.000Z');
  });

  it('a Saturday maps back to the PREVIOUS Sunday (6 days earlier)', () => {
    const saturday = new Date('2026-08-22T12:00:00.000Z');
    expect(getPayWeekStart(saturday).toISOString()).toBe('2026-08-16T04:00:00.000Z');
  });

  it('exactly one week later lands on the NEXT Sunday (windows tile with no gap/overlap)', () => {
    const sunday = new Date('2026-08-16T13:00:00.000Z');
    const nextTick = new Date(sunday.getTime() + 7 * MS_PER_DAY);
    expect(getPayWeekStart(nextTick).toISOString()).toBe('2026-08-23T04:00:00.000Z');
  });

  it('across the autumn daylight-saving change each Sunday starts at its own Eastern midnight', () => {
    // 2026-11-01: the clocks go back at 02:00, so that Sunday began at 00:00 EDT.
    const mondayAfterDst = new Date('2026-11-02T14:00:00.000Z');
    expect(getPayWeekStart(mondayAfterDst).toISOString()).toBe('2026-11-01T04:00:00.000Z');
    const nextWeek = new Date('2026-11-09T14:00:00.000Z');
    expect(getPayWeekStart(nextWeek).toISOString()).toBe('2026-11-08T05:00:00.000Z');
    const weekBefore = new Date('2026-10-30T12:00:00.000Z'); // Fri, still EDT
    expect(getPayWeekStart(weekBefore).toISOString()).toBe('2026-10-25T04:00:00.000Z');
  });

  it('agrees with the test-local independent oracle across a full week of days, DST weeks included', () => {
    for (const [month, day] of [
      [7, 17], // August (EDT)
      [9, 26], // Oct 26 – Nov 1 (crosses the autumn change)
      [11, 14], // December (EST)
    ]) {
      for (let i = 0; i < 7; i++) {
        for (const hour of [2, 13, 23]) {
          const d = new Date(Date.UTC(2026, month, day + i, hour, 0, 0));
          expect(getPayWeekStart(d).toISOString()).toBe(payWeekStartOf(d).toISOString());
        }
      }
    }
  });
});
