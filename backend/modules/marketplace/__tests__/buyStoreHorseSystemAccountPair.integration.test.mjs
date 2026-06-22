/**
 * buyStoreHorse — debitMoneyOrThrow + SystemAccount pair sentinel
 * (Equoria-en1ab, hjtys follow-up #2).
 *
 * Locks two invariants that the en1ab migration introduced:
 *
 *   1. The store-horse debit routes through `debitMoneyOrThrow` (atomic
 *      `updateMany` with `money >= STORE_PRICE` predicate) — closes the
 *      historical TOCTOU race where two concurrent purchases on a thin
 *      wallet both passed the `findUnique + if(money<cost)` pre-check and
 *      both decremented. Asserted at the code level (source-text grep) AND
 *      at the runtime level (concurrent purchase race: only one wins, the
 *      other gets 400).
 *   2. Money-conservation parallels `showEscrowMoneyConservation`: every
 *      successful store-horse purchase pairs the user debit with a
 *      SYSTEM_ACCOUNT_BURN credit so
 *        sum(User.money) + sum(SystemAccount.balance)
 *      stays constant across the move. Asserted by snapshotting both sides
 *      before and after the purchase.
 *
 * Real-DB only — no mocks. Cleanup is scoped to the test fixtures the suite
 * creates (per CLAUDE.md §3 / CONTRIBUTING fixture discipline).
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { SYSTEM_ACCOUNT_BURN } from '../../economy/index.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function uniqueEmail(prefix = 'en1ab') {
  return `${prefix}-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`;
}
function uniqueUsername(prefix = 'en1ab') {
  return `${prefix}${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
}

const STORE_PRICE = 1000; // mirrors marketplaceController.STORE_PRICE

let realBreedId;
let createdHorseIds = [];

beforeAll(async () => {
  const statsPath = resolve(__dirname, '../../../data/breedStarterStats.json');
  const validBreedNames = Object.keys(JSON.parse(readFileSync(statsPath, 'utf8')));
  const breed = await prisma.breed.findFirst({
    where: { name: { in: validBreedNames } },
    select: { id: true },
  });
  realBreedId = breed?.id ?? null;
  // Equoria-fefh2.37: fail LOUD, do not graceful-skip. These tests assert
  // money-conservation invariants that REQUIRE a real seeded breed; on an empty
  // DB the old `if (!realBreedId) return` guards made every test silently pass
  // (Constitution §2 graceful-skip). Surface the missing precondition instead.
  if (!realBreedId) {
    throw new Error(
      'buyStoreHorseSystemAccountPair requires a seeded breed in the test DB ' +
        '(run `npm run seed:breeds`); none found. Refusing to skip silently.',
    );
  }
}, 30000);

describe('buyStoreHorse — debitMoneyOrThrow + SystemAccount pair (Equoria-en1ab)', () => {
  let user;
  let token;
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    createdHorseIds = [];
    user = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'irrelevant-hash',
        firstName: 'EN1AB',
        lastName: 'Tester',
        money: 5000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    // Fail-loud, id-scoped, FK-ordered cleanup (Equoria-0y9f5). The previous
    // `.catch(console.warn)` form silently leaked the fixture user (and its
    // store-bought horses, which RESTRICT-block user deletion since v58ta)
    // whenever a delete failed. Horses before user; userTransaction and
    // notification rows cascade with the user row.
    const userId = user.id;
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: userId } }), 'user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  // ─── CODE-LEVEL SENTINEL ──────────────────────────────────────────────────

  it('CODE SENTINEL: buyStoreHorse calls debitMoneyOrThrow with systemAccount: SYSTEM_ACCOUNT_BURN (Equoria-kl16c)', () => {
    // Per OPTIMAL_FIX_DISCIPLINE §2 — sentinel-positive test required for
    // any check the fix introduces. The race window is too narrow to
    // reliably reproduce in CI (the first tx commits before the second
    // reads), so we also lock the architecture at source-text level.
    const controllerPath = resolve(__dirname, '..', 'controllers', 'marketplaceController.mjs');
    const source = readFileSync(controllerPath, 'utf8');

    const buyStoreHorseStart = source.indexOf('export async function buyStoreHorse');
    expect(buyStoreHorseStart).toBeGreaterThan(-1);

    // Find end of function — the next top-level export
    const afterStart = source.slice(buyStoreHorseStart + 1);
    const nextExportRel = afterStart.indexOf('\nexport ');
    const buyStoreHorseBody = nextExportRel === -1 ? afterStart : afterStart.slice(0, nextExportRel);

    // (1) Must call debitMoneyOrThrow inside the tx — closes TOCTOU
    expect(buyStoreHorseBody).toMatch(/debitMoneyOrThrow\(\s*tx\s*,/);

    // (2) Equoria-kl16c: the burn pairing is now done INTERNALLY by
    //     debitMoneyOrThrow (systemAccount + category are required args), so
    //     the conservation pairing is expressed by passing
    //     `systemAccount: SYSTEM_ACCOUNT_BURN` to the debit helper rather than
    //     a separate creditSystemAccount call (which would double-credit).
    expect(buyStoreHorseBody).toMatch(/systemAccount:\s*SYSTEM_ACCOUNT_BURN/);
    expect(buyStoreHorseBody).toMatch(/category:\s*'store_horse_purchase_burn'/);

    // (3) Must NOT use the historical raw `tx.user.findUnique` + manual
    //     `money < STORE_PRICE` pre-check — that's the TOCTOU shape.
    //     A manual pre-check followed by an unconditional decrement is the
    //     exact bug debitMoneyOrThrow exists to prevent.
    expect(buyStoreHorseBody).not.toMatch(/buyer\.money\s*<\s*STORE_PRICE/);
    expect(buyStoreHorseBody).not.toMatch(/data:\s*\{\s*money:\s*\{\s*decrement:\s*STORE_PRICE\s*\}/);
  });

  // ─── RUNTIME INVARIANT ────────────────────────────────────────────────────

  it('preserves money-conservation: user debit pairs with SystemAccount.burn credit', async () => {
    // Snapshot conservation totals BEFORE the purchase
    const burnBefore = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_BURN },
      select: { balance: true },
    });
    const userBefore = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });

    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ breedId: realBreedId, sex: 'Mare' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    if (res.body.data?.horse?.id) {
      createdHorseIds.push(res.body.data.horse.id);
    }

    const burnAfter = await prisma.systemAccount.findUnique({
      where: { name: SYSTEM_ACCOUNT_BURN },
      select: { balance: true },
    });
    const userAfter = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });

    // User lost STORE_PRICE
    expect(Number(userAfter.money)).toBe(Number(userBefore.money) - STORE_PRICE);
    // SystemAccount.burn gained STORE_PRICE
    expect(Number(burnAfter.balance)).toBe(Number(burnBefore.balance) + STORE_PRICE);

    // CONSERVATION: the sum of the two sides is invariant across the move.
    const deltaUser = Number(userAfter.money) - Number(userBefore.money);
    const deltaBurn = Number(burnAfter.balance) - Number(burnBefore.balance);
    expect(deltaUser + deltaBurn).toBe(0);
  }, 60000);

  it('pairs the ledger: a horse_trader_purchase debit row AND a burn-credit row are written', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ breedId: realBreedId, sex: 'Mare' });

    expect(res.status).toBe(201);
    if (res.body.data?.horse?.id) {
      createdHorseIds.push(res.body.data.horse.id);
    }

    // The original purchase debit row (Equoria-9hja2 — unchanged)
    const debitRows = await prisma.userTransaction.findMany({
      where: { userId: user.id, type: 'debit', category: 'horse_trader_purchase' },
    });
    expect(debitRows).toHaveLength(1);
    expect(Number(debitRows[0].amount)).toBe(STORE_PRICE);

    // The new paired SystemAccount.burn credit ledger row (Equoria-en1ab)
    const burnRows = await prisma.userTransaction.findMany({
      where: {
        userId: user.id,
        type: 'credit',
        category: 'store_horse_purchase_burn',
      },
    });
    expect(burnRows).toHaveLength(1);
    expect(Number(burnRows[0].amount)).toBe(STORE_PRICE);
    // The systemAccount counterparty is recorded in metadata
    expect(burnRows[0].metadata).toBeTruthy();
    expect(burnRows[0].metadata?.systemAccount).toBe(SYSTEM_ACCOUNT_BURN);
    expect(burnRows[0].metadata?.systemAccountSide).toBe('credit');
  }, 60000);

  // ─── TOCTOU RACE — runtime sentinel ───────────────────────────────────────

  it('TOCTOU: two concurrent purchases on a wallet sized for exactly one debit yield exactly one success', async () => {
    // Fund the wallet to STORE_PRICE exactly — two concurrent debits
    // cannot both succeed if the conditional updateMany predicate is
    // intact. Pre-en1ab, the findUnique + if(money<cost) + decrement
    // shape would let both transactions race past the check and both
    // decrement, taking the wallet to -STORE_PRICE.
    await prisma.user.update({
      where: { id: user.id },
      data: { money: STORE_PRICE },
    });

    // Issue two concurrent purchases. They share the same auth token /
    // CSRF — the goal is just to fire two requests against the controller
    // such that both enter the tx before either commits.
    const csrf = await fetchCsrf(app);
    const fire = () =>
      request(app)
        .post('/api/v1/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ breedId: realBreedId, sex: 'Mare' });

    const [resA, resB] = await Promise.all([fire(), fire()]);

    // Collect successful horse ids for cleanup
    for (const r of [resA, resB]) {
      if (r.status === 201 && r.body.data?.horse?.id) {
        createdHorseIds.push(r.body.data.horse.id);
      }
    }

    const successes = [resA, resB].filter(r => r.status === 201).length;
    const failures = [resA, resB].filter(r => r.status === 400).length;

    // Exactly one of the two wins. The other must fail with 400 (insufficient
    // funds — InsufficientFundsError surfaced through err.statusCode).
    expect(successes).toBe(1);
    expect(failures).toBe(1);

    // Wallet must NOT be negative. Pre-en1ab this could go to -STORE_PRICE.
    const userAfter = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(Number(userAfter.money)).toBe(0);
  }, 60000);
});
