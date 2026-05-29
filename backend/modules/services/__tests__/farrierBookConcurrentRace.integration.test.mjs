/**
 * POST /api/farrier/book-service — concurrent-race sentinel (Equoria-6g8wm).
 * Sibling of vetBookConcurrentRace — same shape, farrier surface.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { bookFarrierService, FARRIER_SERVICES } from '../controllers/farrierController.mjs';

const FIXTURE_PREFIX = 'TestFixture-6g8wm-farrier';
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
  const service = FARRIER_SERVICES[0];

  user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: pw,
      firstName: 'Farrier',
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
    await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }).catch(() => {});
  }
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
  }
}, 30000);

describe('farrier bookFarrierService concurrent-race sentinel (Equoria-6g8wm)', () => {
  it('SENTINEL: N parallel bookings with money for ONE — exactly 1 succeeds, money never negative', async () => {
    const service = FARRIER_SERVICES[0];
    const reqs = Array.from({ length: N }, () => ({
      user: { id: user.id },
      body: { horseId: horse.id, serviceId: service.id },
    }));
    const responses = await Promise.all(
      reqs.map(req => {
        const res = fakeRes();
        return bookFarrierService(req, res).then(() => res);
      }),
    );
    const successes = responses.filter(r => r.statusCode === 200);
    const failures = responses.filter(r => r.statusCode !== 200);
    expect(successes).toHaveLength(1);
    for (const f of failures) {
      expect(f.statusCode).toBe(400);
      expect(String(f.body?.message ?? '')).toMatch(/insufficient funds/i);
    }
    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(Number(after.money)).toBe(0);
    expect(Number(after.money)).toBeGreaterThanOrEqual(0);
  });
});
