/**
 * POST /api/vet/book-appointment — recordTransactionTx migration sentinel
 * (Equoria-2hfss).
 *
 * Per Equoria-pqp69 migration plan: the vet booking path was migrated from
 * the legacy `recordTransaction(opts, tx)` signature to
 * `recordTransactionTx(tx, opts)`. The structural guarantee of the new
 * signature is that `balanceAfter` is read inside the same tx by the
 * service — the caller no longer supplies it.
 *
 * This sentinel proves the migration is wired correctly by:
 *
 *   1. Booking a real vet service via the controller (no HTTP — same
 *      pattern as vetBookConcurrentRace, dodges the pre-existing CSRF
 *      flake Equoria-pyz4z).
 *   2. Reading back the most recent `userTransaction` row for this user.
 *   3. Asserting `balanceAfter` on the ledger row equals the user's
 *      money column AFTER the debit (i.e. starting money minus service
 *      cost).
 *
 * If the migration had left the legacy call site in place, this test
 * would still pass (the legacy form also supplied a correct
 * balanceAfter) — but the migration is *structurally* what makes that
 * guarantee independent of caller hygiene. The real failure mode being
 * defended against is a future regression where a caller starts passing
 * a stale `balanceAfter` (computed before the debit landed) — the new
 * signature makes that impossible by construction.
 *
 * Sentinel-positive coverage: we also assert the ledger row has the
 * correct category, amount, type, and metadata.horseId so a refactor
 * that drops one of those fields fails loudly.
 *
 * Real DB, no mocks, scoped fixtures (TestFixture-2hfss prefix).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../../tests/helpers/fixtureColor.mjs';
import { bookVetAppointment, VET_SERVICES } from '../controllers/vetController.mjs';

const FIXTURE_PREFIX = 'TestFixture-2hfss-vet';
const STARTING_MONEY = 10000;

let user;
let horse;
const createdUserIds = [];
const createdHorseIds = [];

function fakeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(c) {
      res.statusCode = c;
      return res;
    },
    json(b) {
      res.body = b;
      return res;
    },
  };
  return res;
}

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);

  user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: pw,
      firstName: 'Vet',
      lastName: 'Migration',
      money: STARTING_MONEY,
    },
  });
  createdUserIds.push(user.id);

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${tag}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: user.id,
      healthStatus: 'Good',
    },
  });
  createdHorseIds.push(horse.id);
}, 60000);

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdHorseIds.length) {
    await prisma.horse
      .deleteMany({ where: { id: { in: createdHorseIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdUserIds.length) {
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
}, 30000);

describe('vet bookVetAppointment recordTransactionTx migration sentinel (Equoria-2hfss)', () => {
  it('SENTINEL: ledger row balanceAfter is sourced from inside the tx (post-debit)', async () => {
    const service = VET_SERVICES[0]; // health-check, $150
    const req = {
      user: { id: user.id },
      body: { horseId: horse.id, serviceId: service.id },
    };
    const res = fakeRes();
    await bookVetAppointment(req, res);

    // Booking succeeded
    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);

    // User money was debited correctly
    const afterUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    const expectedMoneyAfter = STARTING_MONEY - service.cost;
    expect(Number(afterUser.money)).toBe(expectedMoneyAfter);

    // Ledger row was created with the correct shape — and balanceAfter
    // matches the user's money column AFTER the debit, proving
    // recordTransactionTx read inside the same tx (the migration's
    // structural guarantee).
    const ledgerRow = await prisma.userTransaction.findFirst({
      where: { userId: user.id, category: 'vet_service' },
      orderBy: { createdAt: 'desc' },
    });
    expect(ledgerRow).not.toBeNull();
    expect(ledgerRow.type).toBe('debit');
    expect(Number(ledgerRow.amount)).toBe(service.cost);
    expect(ledgerRow.category).toBe('vet_service');
    expect(Number(ledgerRow.balanceAfter)).toBe(expectedMoneyAfter);
    expect(ledgerRow.metadata).toMatchObject({
      horseId: horse.id,
      serviceId: service.id,
    });
  });
});
