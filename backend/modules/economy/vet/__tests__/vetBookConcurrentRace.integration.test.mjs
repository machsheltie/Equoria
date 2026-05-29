/**
 * POST /api/vet/book-appointment — concurrent-race sentinel (Equoria-6g8wm).
 *
 * Sibling of trainerHireConcurrentRace + zz1ii. The vet controller was a
 * canonical check-then-debit money pattern (findUnique → if<cost → update).
 * Two concurrent bookings could both pass the pre-check and both decrement,
 * taking the wallet negative.
 *
 * Fix: route through debitMoneyOrThrow inside the existing $transaction.
 * InsufficientFundsError on count===0 rolls back the horse update and surfaces
 * as a 400 from the outer try/catch.
 *
 * Real DB, no mocks, scoped fixtures. We invoke the controller directly
 * (no HTTP) so the pre-existing CSRF flake (Equoria-pyz4z) doesn't mask the
 * race we're asserting.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../../tests/helpers/fixtureColor.mjs';
import { bookVetAppointment, VET_SERVICES } from '../controllers/vetController.mjs';

const FIXTURE_PREFIX = 'TestFixture-6g8wm-vet';
const N = 5;

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

  // Seed user with EXACTLY one service cost — so a double-debit would
  // produce a negative balance, the sharpest possible signal.
  const service = VET_SERVICES[0];
  user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: pw,
      firstName: 'Vet',
      lastName: 'Race',
      money: service.cost,
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
      healthStatus: 'healthy',
    },
  });
  createdHorseIds.push(horse.id);
}, 60000);

afterAll(async () => {
  if (createdHorseIds.length) {
    await prisma.horse
      .deleteMany({ where: { id: { in: createdHorseIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
}, 30000);

describe('vet bookVetAppointment concurrent-race sentinel (Equoria-6g8wm)', () => {
  it('SENTINEL: N parallel bookings with money for ONE — exactly 1 succeeds, money never negative', async () => {
    const service = VET_SERVICES[0];
    const reqs = Array.from({ length: N }, () => ({
      user: { id: user.id },
      body: { horseId: horse.id, serviceId: service.id },
    }));
    const responses = await Promise.all(
      reqs.map(req => {
        const res = fakeRes();
        return bookVetAppointment(req, res).then(() => res);
      }),
    );
    const successes = responses.filter(r => r.statusCode === 200);
    const failures = responses.filter(r => r.statusCode !== 200);
    expect(successes).toHaveLength(1);
    for (const f of failures) {
      expect(f.statusCode).toBe(400);
      expect(String(f.body?.message ?? '')).toMatch(/insufficient funds/i);
    }

    // Wallet never goes negative — the entire point.
    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(Number(after.money)).toBe(0);
    expect(Number(after.money)).toBeGreaterThanOrEqual(0);
  });
});
