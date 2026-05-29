/**
 * Stud Listing Controller — Real DB Integration Tests (Equoria-q072)
 *
 * Validates POST /horses/:id/stud-listing and DELETE /horses/:id/stud-listing
 * controller logic against the real test DB. No mocks.
 *
 * Tests use the controllers directly (not the HTTP router) so we focus on the
 * stud-listing business logic — ownership/auth wiring is exercised by the
 * router-level integration tests elsewhere.
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { listHorseAtStud, unlistHorseAtStud } from '../controllers/horseController.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const SUITE_PREFIX = 'studlist';

async function createUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'StudList',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

async function createBreed() {
  return prisma.breed.create({
    data: { name: `${SUITE_PREFIX}-breed-${randomBytes(4).toString('hex')}` },
  });
}

async function createHorse(userId, breedId, sex, overrides = {}) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${SUITE_PREFIX}-h-${randomBytes(4).toString('hex')}`,
      sex,
      dateOfBirth: new Date('2020-01-01'),
      user: { connect: { id: userId } },
      breed: { connect: { id: breedId } },
      ...overrides,
    },
  });
}

function makeRes() {
  let _status = 200;
  let _body = null;
  return {
    status(code) {
      _status = code;
      return this;
    },
    json(body) {
      _body = body;
      return this;
    },
    get statusValue() {
      return _status;
    },
    get jsonValue() {
      return _body;
    },
  };
}

async function cleanupSuite() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length > 0) {
    const userIds = users.map(u => u.id);
    await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.breed.deleteMany({ where: { name: { startsWith: SUITE_PREFIX } } });
}

describe('listHorseAtStud / unlistHorseAtStud controllers (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  test('listHorseAtStud: stallion + valid fee → 200, persists studStatus + studFee', async () => {
    const user = await createUser();
    const breed = await createBreed();
    const stallion = await createHorse(user.id, breed.id, 'Stallion');

    const req = { horse: stallion, body: { studFee: 5000 }, user: { id: user.id } };
    const res = makeRes();
    await listHorseAtStud(req, res);

    expect(res.statusValue).toBe(200);
    expect(res.jsonValue.success).toBe(true);
    expect(res.jsonValue.data.studStatus).toBe('At Public Stud');
    expect(res.jsonValue.data.studFee).toBe(5000);

    // Persistence check: re-read from DB
    const reread = await prisma.horse.findUnique({ where: { id: stallion.id } });
    expect(reread.studStatus).toBe('At Public Stud');
    expect(reread.studFee).toBe(5000);
  });

  test('listHorseAtStud: rejects mare with 400 (only stallions can be listed)', async () => {
    const user = await createUser();
    const breed = await createBreed();
    const mare = await createHorse(user.id, breed.id, 'Mare');

    const req = { horse: mare, body: { studFee: 1000 }, user: { id: user.id } };
    const res = makeRes();
    await listHorseAtStud(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.success).toBe(false);
    expect(res.jsonValue.message).toMatch(/stallion/i);

    // DB must remain unchanged
    const reread = await prisma.horse.findUnique({ where: { id: mare.id } });
    expect(reread.studStatus).toBe('Not at Stud');
    expect(reread.studFee).toBe(0);
  });

  test('listHorseAtStud: rejects negative studFee with 400', async () => {
    const user = await createUser();
    const breed = await createBreed();
    const stallion = await createHorse(user.id, breed.id, 'Stallion');

    const req = { horse: stallion, body: { studFee: -100 }, user: { id: user.id } };
    const res = makeRes();
    await listHorseAtStud(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.success).toBe(false);
    expect(res.jsonValue.message).toMatch(/non-negative integer/i);
  });

  test('listHorseAtStud: rejects non-integer studFee with 400', async () => {
    const user = await createUser();
    const breed = await createBreed();
    const stallion = await createHorse(user.id, breed.id, 'Stallion');

    const req = { horse: stallion, body: { studFee: 100.5 }, user: { id: user.id } };
    const res = makeRes();
    await listHorseAtStud(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/non-negative integer/i);
  });

  test('listHorseAtStud: accepts studFee = 0 (free public stud)', async () => {
    const user = await createUser();
    const breed = await createBreed();
    const stallion = await createHorse(user.id, breed.id, 'Stallion');

    const req = { horse: stallion, body: { studFee: 0 }, user: { id: user.id } };
    const res = makeRes();
    await listHorseAtStud(req, res);

    expect(res.statusValue).toBe(200);
    expect(res.jsonValue.data.studStatus).toBe('At Public Stud');
    expect(res.jsonValue.data.studFee).toBe(0);
  });

  test('unlistHorseAtStud: resets studStatus + studFee to defaults', async () => {
    const user = await createUser();
    const breed = await createBreed();
    const stallion = await createHorse(user.id, breed.id, 'Stallion', {
      studStatus: 'At Public Stud',
      studFee: 7500,
    });

    const req = { horse: stallion, user: { id: user.id } };
    const res = makeRes();
    await unlistHorseAtStud(req, res);

    expect(res.statusValue).toBe(200);
    expect(res.jsonValue.success).toBe(true);
    expect(res.jsonValue.data.studStatus).toBe('Not at Stud');
    expect(res.jsonValue.data.studFee).toBe(0);

    const reread = await prisma.horse.findUnique({ where: { id: stallion.id } });
    expect(reread.studStatus).toBe('Not at Stud');
    expect(reread.studFee).toBe(0);
  });

  test('listHorseAtStud: 500 when req.horse missing (ownership middleware did not run)', async () => {
    const req = { body: { studFee: 1000 }, user: { id: 'x' } };
    const res = makeRes();
    await listHorseAtStud(req, res);
    expect(res.statusValue).toBe(500);
  });

  test('unlistHorseAtStud: 500 when req.horse missing (ownership middleware did not run)', async () => {
    const req = { user: { id: 'x' } };
    const res = makeRes();
    await unlistHorseAtStud(req, res);
    expect(res.statusValue).toBe(500);
  });
});
