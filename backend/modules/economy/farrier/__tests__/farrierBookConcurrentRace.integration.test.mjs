/**
 * Farrier shoeing: concurrency and money-integrity sentinels
 * (Equoria-6g8wm race sentinel, Equoria-u9mw9 ledger-in-tx sentinel; rewritten
 * for the one-action farrier, owner ruling 2026-10-23, Equoria-zmqzf).
 *
 * OLD CONTRACT: N parallel bookings with money for ONE service, exactly one
 * succeeds. NEW RULING: one shoeing per horse per week for 50 coins. So N
 * parallel shoeings of one horse with money for ALL of them must still shoe,
 * charge and raise a stat exactly once; and a failed shoeing leaves no ledger
 * row, no debit and no change on the horse.
 *
 * Real DB, no mocks; the controller is driven directly.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../../tests/helpers/fixtureColor.mjs';
import { HORSE_STAT_VALUES } from '../../../../constants/schema.mjs';
import { shoeHorse, shoeingCost } from '../controllers/farrierController.mjs';
import { testHorseData } from '../../../../__tests__/helpers/createTestHorse.mjs';

const FIXTURE_PREFIX = 'TestFixture-6g8wm-farrier';
const N = 5;
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

async function makeFixture(money) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: pw,
      firstName: 'Farrier',
      lastName: 'Race',
      money,
    },
  });
  createdUserIds.push(user.id);
  const horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${tag}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: user.id,
      healthStatus: 'healthy',
    }),
  });
  createdHorseIds.push(horse.id);
  return { user, horse };
}

const statSum = h => HORSE_STAT_VALUES.reduce((n, k) => n + (h[k] ?? 0), 0);

afterAll(async () => {
  await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
  await prisma.userTransaction.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
}, 30000);

describe('farrier shoeHorse (Equoria-6g8wm / Equoria-u9mw9 / Equoria-zmqzf)', () => {
  it('SENTINEL: N parallel shoeings of one horse shoe, charge and raise a stat exactly once', async () => {
    const { user, horse } = await makeFixture(shoeingCost * N * 2);
    const before = await prisma.horse.findUnique({ where: { id: horse.id } });

    const responses = await Promise.all(
      Array.from({ length: N }, () => {
        const res = fakeRes();
        return shoeHorse({ user: { id: user.id }, body: { horseId: horse.id } }, res).then(() => res);
      }),
    );

    expect(responses.filter(r => r.statusCode === 200)).toHaveLength(1);
    for (const f of responses.filter(r => r.statusCode !== 200)) {
      expect(f.statusCode).toBe(409);
    }
    const money = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(Number(money.money)).toBe(shoeingCost * N * 2 - shoeingCost);
    const after = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(statSum(after) - statSum(before)).toBe(1);
    const rows = await prisma.userTransaction.findMany({ where: { userId: user.id, category: 'farrierService' } });
    expect(rows).toHaveLength(1);
  });

  it('SENTINEL: the ledger row is written in the same tx, balanceAfter is the post-debit balance', async () => {
    const start = shoeingCost + 1000;
    const { user, horse } = await makeFixture(start);
    const res = fakeRes();
    await shoeHorse({ user: { id: user.id }, body: { horseId: horse.id } }, res);
    expect(res.statusCode).toBe(200);
    const rows = await prisma.userTransaction.findMany({ where: { userId: user.id, category: 'farrierService' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('debit');
    expect(Number(rows[0].amount)).toBe(shoeingCost);
    expect(Number(rows[0].balanceAfter)).toBe(start - shoeingCost);
  });

  it('SENTINEL: an insufficient-funds failure leaves no ledger row, no debit and an unchanged horse', async () => {
    const { user, horse } = await makeFixture(shoeingCost - 1);
    const before = await prisma.horse.findUnique({ where: { id: horse.id } });
    const res = fakeRes();
    await shoeHorse({ user: { id: user.id }, body: { horseId: horse.id } }, res);
    expect(res.statusCode).toBe(400);
    expect(await prisma.userTransaction.count({ where: { userId: user.id, category: 'farrierService' } })).toBe(0);
    const money = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(Number(money.money)).toBe(shoeingCost - 1);
    const after = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(after.lastShod).toEqual(before.lastShod);
    expect(statSum(after)).toBe(statSum(before));
  });

  it('SENTINEL: a refused second shoeing rolls its debit back (no money lost, one ledger row)', async () => {
    const { user, horse } = await makeFixture(1000);
    const first = fakeRes();
    await shoeHorse({ user: { id: user.id }, body: { horseId: horse.id } }, first);
    expect(first.statusCode).toBe(200);
    const second = fakeRes();
    await shoeHorse({ user: { id: user.id }, body: { horseId: horse.id } }, second);
    expect(second.statusCode).toBe(409);
    const money = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(Number(money.money)).toBe(1000 - shoeingCost);
    expect(await prisma.userTransaction.count({ where: { userId: user.id, category: 'farrierService' } })).toBe(1);
  });
});
