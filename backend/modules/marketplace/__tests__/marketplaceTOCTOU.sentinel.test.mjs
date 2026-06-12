/**
 * Sentinel test: marketplace purchase TOCTOU race (Equoria-alei5).
 *
 * Bug: marketplaceController.buyHorse uses tx.horse.findUnique → checks
 * !horse.forSale → does money.decrement → does horse.update in a single
 * transaction, but under default READ COMMITTED both concurrent buyers
 * pass the forSale check, both get debited, and only one actually owns
 * the horse. The other is silently charged for nothing.
 *
 * Fix: replace the read-then-write with a conditional
 *   prisma.horse.updateMany({ where: { id, forSale: true, userId: { not: buyerId } } })
 * and abort the transaction BEFORE any money.decrement when affected
 * rows != 1.
 *
 * This test fires two concurrent buy requests at the same listed horse
 * and asserts:
 *   - exactly one HTTP 200, one HTTP 4xx (409 or 400)
 *   - exactly one buyer debit (the winner)
 *   - the loser's balance is unchanged
 *   - exactly one HorseSale row
 *   - the horse's userId is the HTTP-200 winner
 *
 * Real DB, no mocks. Per CLAUDE.md §3 and OPTIMAL_FIX_DISCIPLINE §2:
 * this is the sentinel-positive test — it FAILS today (loser is debited)
 * and PASSES after the conditional-updateMany fix lands.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf, attachCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ORIGIN = 'http://localhost:3000';

function uniqueEmail(prefix) {
  return `${prefix}-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`;
}
function uniqueUsername(prefix) {
  return `${prefix}${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
}

describe('SENTINEL: marketplace purchase TOCTOU (Equoria-alei5)', () => {
  let seller;
  let buyerA;
  let buyerB;
  let horse;
  let tokenA;
  let tokenB;
  let csrf;
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    seller = await prisma.user.create({
      data: {
        email: uniqueEmail('mp_toctou_seller'),
        username: uniqueUsername('mptocs'),
        password: 'irrelevant',
        firstName: 'TOCTOU',
        lastName: 'Seller',
        money: 0,
      },
    });
    buyerA = await prisma.user.create({
      data: {
        email: uniqueEmail('mp_toctou_buyerA'),
        username: uniqueUsername('mptocb'),
        password: 'irrelevant',
        firstName: 'TOCTOU',
        lastName: 'BuyerA',
        money: 10000,
      },
    });
    buyerB = await prisma.user.create({
      data: {
        email: uniqueEmail('mp_toctou_buyerB'),
        username: uniqueUsername('mptoctb'),
        password: 'irrelevant',
        firstName: 'TOCTOU',
        lastName: 'BuyerB',
        money: 10000,
      },
    });
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-MpTOCTOU-${randomBytes(4).toString('hex')}`,
        sex: 'Stallion',
        dateOfBirth: new Date('2019-01-01'),
        age: 6,
        userId: seller.id,
        forSale: true,
        salePrice: 500,
      },
    });
    tokenA = generateTestToken({ id: buyerA.id, email: buyerA.email, role: 'user' });
    tokenB = generateTestToken({ id: buyerB.id, email: buyerB.email, role: 'user' });
    csrf = await fetchCsrf(app);

    // Fail-loud, id-scoped, FK-ordered cleanup (Equoria-0y9f5). The previous
    // `.catch(console.warn)` form silently leaked the whole fixture graph
    // into the canonical DB whenever a delete failed (e.g. a horseSale row
    // RESTRICT-blocking the horse/users). Registration order = run order:
    // children before parents (notifications/transactions cascade with user
    // deletion but are deleted explicitly as defence; horseSale is RESTRICT
    // on horseId/buyerId/sellerId so it MUST precede horse + users).
    const userIds = [seller.id, buyerA.id, buyerB.id];
    const horseId = horse.id;
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notifications');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'userTransactions');
    cleanup.add(() => prisma.horseSale.deleteMany({ where: { horseId } }), 'horseSale');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: horseId } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
  }, 60000);

  afterEach(() => cleanup.run(), 60000);

  it('concurrent buyers: exactly one debit, one owner, loser balance untouched', async () => {
    // Fire both purchases at the same time (Promise.all). Under the
    // pre-fix code, both pass !horse.forSale and both decrement money.
    // Under the conditional-updateMany fix, only one transaction commits;
    // the loser's transaction throws and rolls back BEFORE any decrement.
    const purchaseA = attachCsrf(
      request(app)
        .post(`/api/v1/marketplace/buy/${horse.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', ORIGIN),
      csrf,
    );
    const purchaseB = attachCsrf(
      request(app)
        .post(`/api/v1/marketplace/buy/${horse.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .set('Origin', ORIGIN),
      csrf,
    );

    const [resA, resB] = await Promise.all([purchaseA, purchaseB]);

    const successes = [resA, resB].filter(r => r.status === 200);
    const failures = [resA, resB].filter(r => r.status !== 200);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    // The loser must get a clean 4xx (400 not-for-sale OR 409 conflict),
    // never a 500 — the conditional updateMany maps to a controlled abort.
    expect([400, 404, 409]).toContain(failures[0].status);

    // Determine winner / loser from HTTP result
    const winnerId = resA.status === 200 ? buyerA.id : buyerB.id;
    const loserId = resA.status === 200 ? buyerB.id : buyerA.id;

    // Horse ownership transferred to winner, forSale cleared
    const horseAfter = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(horseAfter.userId).toBe(winnerId);
    expect(horseAfter.forSale).toBe(false);

    // Winner debited exactly 500, loser balance unchanged at 10000
    const winnerAfter = await prisma.user.findUnique({ where: { id: winnerId } });
    const loserAfter = await prisma.user.findUnique({ where: { id: loserId } });
    expect(winnerAfter.money).toBe(9500);
    expect(loserAfter.money).toBe(10000);

    // Exactly one HorseSale row for this horse
    const sales = await prisma.horseSale.findMany({ where: { horseId: horse.id } });
    expect(sales).toHaveLength(1);
    expect(sales[0].buyerId).toBe(winnerId);
    expect(sales[0].salePrice).toBe(500);

    // Exactly one debit transaction for the winner; zero for the loser
    const winnerDebits = await prisma.userTransaction.findMany({
      where: { userId: winnerId, type: 'debit', category: 'marketplace_purchase' },
    });
    const loserDebits = await prisma.userTransaction.findMany({
      where: { userId: loserId, type: 'debit', category: 'marketplace_purchase' },
    });
    expect(winnerDebits).toHaveLength(1);
    expect(loserDebits).toHaveLength(0);
  }, 90000);

  it('CODE SENTINEL: marketplaceController uses conditional updateMany (TOCTOU guard intact)', () => {
    // Per OPTIMAL_FIX_DISCIPLINE §2 — sentinel-positive test required
    // for any fix that adds/strengthens a check. The race-condition
    // window between findUnique and update is too tight to reliably
    // reproduce via HTTP in CI (the first transaction usually commits
    // before the second one reads), so this code-level sentinel locks
    // the architectural guarantee: the buyHorse controller MUST use a
    // conditional updateMany WHERE forSale=true to atomically claim
    // ownership. If this sentinel ever fails, the TOCTOU fix has
    // regressed.
    const controllerPath = resolve(__dirname, '..', 'controllers', 'marketplaceController.mjs');
    const source = readFileSync(controllerPath, 'utf8');
    // Find the buyHorse function body
    const buyHorseStart = source.indexOf('export async function buyHorse');
    expect(buyHorseStart).toBeGreaterThan(-1);
    const buyStoreHorseStart = source.indexOf('export async function buyStoreHorse');
    expect(buyStoreHorseStart).toBeGreaterThan(buyHorseStart);
    const buyHorseBody = source.slice(buyHorseStart, buyStoreHorseStart);
    // Must contain conditional updateMany with forSale: true in WHERE
    expect(buyHorseBody).toMatch(/\.updateMany\(\s*\{\s*where:\s*\{[\s\S]*?forSale:\s*true/);
    // Must check transferResult.count !== 1 and throw 409
    expect(buyHorseBody).toMatch(/transferResult\.count\s*!==\s*1/);
    expect(buyHorseBody).toMatch(/statusCode:\s*409/);
  });
});
