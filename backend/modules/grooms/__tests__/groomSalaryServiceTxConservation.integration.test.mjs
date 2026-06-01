/**
 * groomSalaryService.processWeeklySalaries — tx + SystemAccount-pair sentinel
 * (Equoria-7r67q, hjtys follow-up #3).
 *
 * Locks the three invariants introduced by the 7r67q rewrite of
 * `processWeeklySalaries`:
 *
 *   1. CONSERVATION — every successful salary debit pairs with a
 *      SYSTEM_ACCOUNT_BURN credit so
 *        sum(User.money) + sum(SystemAccount.balance)
 *      stays constant across the move. (Pre-7r67q the user was decremented
 *      with no paired credit — the salary money was destroyed invisibly.)
 *
 *   2. ATOMICITY — the per-user debit + `groomSalaryPayment.create` loop
 *      runs inside a single `prisma.$transaction`. The wallet and the
 *      payment rows commit together or roll back together — no orphan
 *      drift if the payment-row loop ever throws partway.
 *
 *   3. TOCTOU — the legacy `if (user.money < totalSalary)` pre-check + raw
 *      `prisma.user.update({ money: { decrement } })` shape (vulnerable to
 *      a concurrent purchase between the top-of-fn findMany read and the
 *      bottom-of-loop decrement) is gone. A user whose wallet is drained
 *      after the top-of-fn read but before the debit must surface as a
 *      typed `InsufficientFundsError` and route to the grace-period
 *      branch — never as a negative-money decrement.
 *
 * Real DB, no mocks, scoped TestFixture-7r67q cleanup.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { processWeeklySalaries, calculateWeeklySalary } from '../services/groomSalaryService.mjs';
import { SYSTEM_ACCOUNT_BURN } from '../../economy/services/financialLedgerService.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_PREFIX = 'TestFixture-7r67q';

const createdAssignmentIds = [];
const createdGroomIds = [];
const createdHorseIds = [];
const createdUserIds = [];
const createdPaymentIds = [];

function uniq() {
  return randomBytes(4).toString('hex');
}

async function makeUser(money) {
  const tag = uniq();
  const u = await prisma.user.create({
    data: {
      email: `${FIXTURE_PREFIX}-${tag}@test.com`,
      username: `${FIXTURE_PREFIX}-${tag}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: '7r67q',
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

async function getBurnBalance() {
  const row = await prisma.systemAccount.findUnique({
    where: { name: SYSTEM_ACCOUNT_BURN },
    select: { balance: true },
  });
  return row ? Number(row.balance) : 0;
}

async function getUserMoney(userId) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { money: true },
  });
  return row ? Number(row.money) : 0;
}

beforeAll(async () => {
  // Ensure burn SystemAccount exists (the si69u migration seeds it; this is a
  // belt-and-braces defense against the test running on a partially-migrated
  // DB — the credit path requires the row to be present).
  await prisma.systemAccount.upsert({
    where: { name: SYSTEM_ACCOUNT_BURN },
    create: { name: SYSTEM_ACCOUNT_BURN, balance: 0 },
    update: {},
  });
}, 30000);

afterAll(async () => {
  // Scoped cleanup — only the IDs this suite created.
  if (createdPaymentIds.length) {
    await prisma.groomSalaryPayment
      .deleteMany({ where: { id: { in: createdPaymentIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  // Also purge any payment rows tied to the fixture users (the service
  // creates these inside the tx; we need to wipe them with the user-id
  // predicate since we don't capture their ids).
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
// CODE-LEVEL SENTINEL — locks the architecture at source-text level so a
// future regression that strips the tx wrap / inlines the raw decrement /
// drops the SystemAccount pair is caught even if the integration path is
// difficult to reproduce on a given CI run.
// ────────────────────────────────────────────────────────────────────────────

describe('groomSalaryService.processWeeklySalaries — code sentinel (Equoria-7r67q)', () => {
  it('source uses debitMoneyOrThrow(systemAccount: SYSTEM_ACCOUNT_BURN) and $transaction (Equoria-kl16c)', () => {
    const servicePath = resolve(__dirname, '..', 'services', 'groomSalaryService.mjs');
    const source = readFileSync(servicePath, 'utf8');

    const fnStart = source.indexOf('export async function processWeeklySalaries');
    expect(fnStart).toBeGreaterThan(-1);
    const after = source.slice(fnStart + 1);
    const nextExport = after.indexOf('\nexport ');
    // Also bound on `\nasync function` (handleInsufficientFunds is the next
    // function), whichever comes first.
    const nextAsyncFn = after.indexOf('\nasync function');
    const stops = [nextExport, nextAsyncFn].filter(i => i > -1);
    const fnEnd = stops.length ? Math.min(...stops) : after.length;
    const body = after.slice(0, fnEnd);

    // (1) Per-user processing must be wrapped in a $transaction
    expect(body).toMatch(/prisma\.\$transaction\(\s*\n?\s*async\s+tx\s*=>/);

    // (2) Must call debitMoneyOrThrow on the tx client (not bare prisma)
    expect(body).toMatch(/debitMoneyOrThrow\(\s*tx\s*,/);

    // (3) Equoria-kl16c: the SystemAccount burn pairing is now done INTERNALLY
    //     by debitMoneyOrThrow (systemAccount + category are required args), so
    //     the conservation guarantee is expressed by passing
    //     `systemAccount: SYSTEM_ACCOUNT_BURN` to the debit helper rather than a
    //     separate creditSystemAccount call. Assert the required pairing arg is
    //     present so a regression that drops it (and thus the conservation
    //     pairing) is caught at source level.
    expect(body).toMatch(/systemAccount:\s*SYSTEM_ACCOUNT_BURN/);
    expect(body).toMatch(/category:\s*'groom_salary_burn'/);

    // (4) Must NOT use the historical TOCTOU shape — manual pre-check
    //     followed by raw `prisma.user.update({ money: { decrement } })`.
    expect(body).not.toMatch(/user\.money\s*<\s*userGroup\.totalSalary/);
    expect(body).not.toMatch(/prisma\.user\.update\(\s*\{[\s\S]{0,200}data:\s*\{\s*money:\s*\{\s*decrement:/);

    // (5) groomSalaryPayment.create must be on the tx client (inside the
    //     transaction), not bare prisma
    expect(body).toMatch(/tx\.groomSalaryPayment\.create/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// RUNTIME — happy path: conservation invariant + ledger + payment row
// ────────────────────────────────────────────────────────────────────────────

describe('groomSalaryService.processWeeklySalaries — happy path (Equoria-7r67q)', () => {
  let user;
  let groom;

  beforeEach(async () => {
    user = await makeUser(500);
    const made = await makeGroomAssignment(user, {
      skillLevel: 'expert', // 100
      speciality: 'showHandling', // +15 → 115/week
    });
    groom = made.groom;
  });

  it('preserves conservation: user.money delta + SystemAccount.burn delta = 0', async () => {
    const expectedSalary = calculateWeeklySalary({
      skillLevel: 'expert',
      speciality: 'showHandling',
    });
    expect(expectedSalary).toBe(115);

    const userBefore = await getUserMoney(user.id);
    const burnBefore = await getBurnBalance();

    const results = await processWeeklySalaries();

    // Top-level fn should not have thrown
    expect(results.successful).toBeGreaterThanOrEqual(1);

    const userAfter = await getUserMoney(user.id);
    const burnAfter = await getBurnBalance();

    expect(userAfter).toBe(userBefore - expectedSalary);
    expect(burnAfter).toBe(burnBefore + expectedSalary);

    // CONSERVATION — the principal invariant
    const deltaUser = userAfter - userBefore;
    const deltaBurn = burnAfter - burnBefore;
    expect(deltaUser + deltaBurn).toBe(0);
  }, 60000);

  it('writes a paid groomSalaryPayment row inside the same tx', async () => {
    await processWeeklySalaries();

    const payments = await prisma.groomSalaryPayment.findMany({
      where: {
        userId: user.id,
        groomId: groom.id,
        status: 'paid',
        paymentType: 'weekly_salary',
      },
    });
    expect(payments.length).toBeGreaterThanOrEqual(1);
    expect(Number(payments[0].amount)).toBe(115);
    // capture id for cleanup
    for (const p of payments) {
      createdPaymentIds.push(p.id);
    }
  }, 60000);

  it('writes a userTransaction ledger credit row attributed to the user', async () => {
    await processWeeklySalaries();

    const ledgerRows = await prisma.userTransaction.findMany({
      where: {
        userId: user.id,
        type: 'credit',
        category: 'groom_salary_burn',
      },
    });
    expect(ledgerRows.length).toBeGreaterThanOrEqual(1);
    expect(Number(ledgerRows[0].amount)).toBe(115);
    expect(ledgerRows[0].metadata?.systemAccount).toBe(SYSTEM_ACCOUNT_BURN);
    expect(ledgerRows[0].metadata?.systemAccountSide).toBe('credit');
  }, 60000);
});

// ────────────────────────────────────────────────────────────────────────────
// RUNTIME — insufficient funds branch
// ────────────────────────────────────────────────────────────────────────────

describe('groomSalaryService.processWeeklySalaries — insufficient funds (Equoria-7r67q)', () => {
  it('thin wallet does NOT debit, does NOT credit burn (for this user), and routes to grace-period branch', async () => {
    const user = await makeUser(10); // far less than 50 novice salary
    await makeGroomAssignment(user, { skillLevel: 'novice', speciality: 'general' });

    const userBefore = await getUserMoney(user.id);

    // Count user-scoped burn ledger rows BEFORE — we cannot use the global
    // SystemAccount.burn balance because processWeeklySalaries iterates over
    // every active assignment in the DB and may legitimately credit burn
    // for other (well-funded) fixture users from sibling suites. Instead
    // we assert that NO burn-credit ledger row was attributed to THIS user.
    const burnRowsBefore = await prisma.userTransaction.count({
      where: { userId: user.id, type: 'credit', category: 'groom_salary_burn' },
    });

    const results = await processWeeklySalaries();

    const userAfter = await getUserMoney(user.id);
    const burnRowsAfter = await prisma.userTransaction.count({
      where: { userId: user.id, type: 'credit', category: 'groom_salary_burn' },
    });

    // Wallet UNCHANGED — no partial debit, no negative wallet
    expect(userAfter).toBe(userBefore);
    expect(userAfter).toBe(10);
    // No burn-credit ledger row was attributed to this user (the tx rolled
    // back on InsufficientFundsError — debit + creditSystemAccount + payment
    // rows all together)
    expect(burnRowsAfter).toBe(burnRowsBefore);
    // failure recorded
    expect(results.failed).toBeGreaterThanOrEqual(1);

    // The grace-period branch should have been entered (the user gets a
    // missed_insufficient_funds payment row + a groomSalaryGracePeriod stamp).
    const missed = await prisma.groomSalaryPayment.findMany({
      where: { userId: user.id, status: 'missed_insufficient_funds' },
    });
    expect(missed.length).toBeGreaterThanOrEqual(1);

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { groomSalaryGracePeriod: true },
    });
    expect(after.groomSalaryGracePeriod).toBeTruthy();
  }, 60000);
});

// ────────────────────────────────────────────────────────────────────────────
// RUNTIME — TOCTOU race sentinel: the wallet must NEVER go negative
// ────────────────────────────────────────────────────────────────────────────

describe('groomSalaryService.processWeeklySalaries — TOCTOU sentinel (Equoria-7r67q)', () => {
  it('two concurrent processWeeklySalaries runs on a wallet sized for one debit yield exactly one debit', async () => {
    // Fund the wallet to exactly the novice salary so two parallel
    // processWeeklySalaries calls would, under the legacy TOCTOU shape,
    // both pass the stale `if (user.money < totalSalary)` check and both
    // decrement — taking the wallet to -50. Under the 7r67q rewrite, only
    // one debitMoneyOrThrow predicate wins; the other throws
    // InsufficientFundsError and routes to the grace-period branch.
    const user = await makeUser(50);
    await makeGroomAssignment(user, { skillLevel: 'novice', speciality: 'general' });

    const userBefore = await getUserMoney(user.id);
    expect(userBefore).toBe(50);

    // Count user-scoped burn-credit ledger rows BEFORE — same reason as
    // the insufficient-funds test: the global SystemAccount.burn delta
    // can include credits attributed to OTHER fixture users processed in
    // the same call. The per-user attribution via linkedUserId is what
    // we assert here.
    const burnRowsBefore = await prisma.userTransaction.count({
      where: { userId: user.id, type: 'credit', category: 'groom_salary_burn' },
    });

    // Fire two parallel passes. Each will iterate over all active
    // assignments (including ones from OTHER tests if any leaked), but
    // the per-user $transaction is independent — only THIS user's debit
    // is contended.
    const [a, b] = await Promise.all([processWeeklySalaries(), processWeeklySalaries()]);

    const userAfter = await getUserMoney(user.id);
    const burnRowsAfter = await prisma.userTransaction.count({
      where: { userId: user.id, type: 'credit', category: 'groom_salary_burn' },
    });

    // The wallet must NEVER go negative — this is the principal sentinel.
    // Pre-7r67q, the TOCTOU shape could drive this to -50.
    expect(userAfter).toBeGreaterThanOrEqual(0);

    // Exactly one of the two debits succeeded for THIS user
    expect(userAfter).toBe(0);

    // Exactly ONE burn-credit ledger row was attributed to this user.
    // Pre-7r67q with no SystemAccount pair at all, this delta would be
    // zero regardless of how many debits won — so this row also locks
    // the conservation pairing under contention.
    expect(burnRowsAfter - burnRowsBefore).toBe(1);

    // And the amount matches the single won debit
    const burnRows = await prisma.userTransaction.findMany({
      where: { userId: user.id, type: 'credit', category: 'groom_salary_burn' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(Number(burnRows[0].amount)).toBe(50);

    // Sum of successful + failed should reflect at least the two attempts on
    // this user — though either pass may have processed other users too.
    const totalProcessed = a.processed + b.processed;
    expect(totalProcessed).toBeGreaterThanOrEqual(2);
  }, 90000);
});

// ────────────────────────────────────────────────────────────────────────────
// SENTINEL-POSITIVE: prove the code sentinel FIRES on a planted regression
// (OPTIMAL_FIX_DISCIPLINE §2). We synthesize a minimal source-text
// representing the pre-7r67q shape and assert each individual regex would
// reject it. This guards against a future refactor that accidentally
// loosens the regex into a placebo check.
// ────────────────────────────────────────────────────────────────────────────

describe('groomSalaryService.processWeeklySalaries — code sentinel positive (Equoria-7r67q)', () => {
  it('code sentinel rejects a synthesized pre-7r67q (TOCTOU) processWeeklySalaries body', () => {
    const planted = `
      export async function processWeeklySalaries() {
        const activeAssignments = await prisma.groomAssignment.findMany({});
        for (const [userId, userGroup] of Object.entries({})) {
          if (user.money < userGroup.totalSalary) {
            await handleInsufficientFunds(userId, userGroup);
            continue;
          }
          await prisma.user.update({
            where: { id: userId },
            data: { money: { decrement: userGroup.totalSalary } },
          });
          await prisma.groomSalaryPayment.create({ data: {} });
        }
      }
    `;
    // The principal checks (tx wrap, debit helper, burn-pairing arg) all MUST
    // miss on the pre-fix shape. (Equoria-kl16c: the burn pairing is now the
    // `systemAccount: SYSTEM_ACCOUNT_BURN` arg to debitMoneyOrThrow, so that
    // is the check the planted body must fail.)
    expect(planted).not.toMatch(/prisma\.\$transaction\(\s*\n?\s*async\s+tx\s*=>/);
    expect(planted).not.toMatch(/debitMoneyOrThrow\(\s*tx\s*,/);
    expect(planted).not.toMatch(/systemAccount:\s*SYSTEM_ACCOUNT_BURN/);
    // And the TOCTOU shape MUST match (proving the regex fires on the
    // real bug rather than being a placebo)
    expect(planted).toMatch(/user\.money\s*<\s*userGroup\.totalSalary/);
    expect(planted).toMatch(/prisma\.user\.update\(\s*\{[\s\S]{0,200}data:\s*\{\s*money:\s*\{\s*decrement:/);
  });
});
