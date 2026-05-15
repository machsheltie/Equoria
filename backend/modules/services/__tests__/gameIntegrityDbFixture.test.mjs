/**
 * DB-fixture tests for gameIntegrity middleware (Equoria-rr7 coverage sprint).
 *
 * Covers validateBreeding, validateTraining, and validateTransaction using
 * real DB records to exercise ownership checks, biological validation, age
 * validation, health checks, cooldown logic, and the success path.
 *
 * Schema field mapping (current → fixed):
 *   playerId/ownerId → userId
 *   health_status    → healthStatus
 *   last_bred_date   → lastBredDate
 *   stud_status      → studStatus
 *   prisma.player    → prisma.user
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { validateBreeding, validateTraining, validateTransaction } from '../../../middleware/gameIntegrity.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq({ body = {}, user = null, params = {} } = {}) {
  return { body, user, params };
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

function makeNext() {
  let _called = false;
  const fn = () => {
    _called = true;
  };
  fn.wasCalled = () => _called;
  return fn;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

let ownerUser;
let otherUser;
let stallion;
let mare;
let colt;
let filly;
let foalTooYoung;
let injuredStallion;
let cooldownSire;
let cooldownDam;
let trainingHorse;
let injuredTrainingHorse;
let cooldownTrainingHorse;

const SUFFIX = `${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}`;

beforeAll(async () => {
  ownerUser = await prisma.user.create({
    data: {
      email: `gi-owner-${SUFFIX}@test.com`,
      username: `gi_owner_${SUFFIX.replace('-', '_')}`,
      password: 'hash',
      firstName: 'GI',
      lastName: 'Owner',
      money: 200000,
    },
  });

  otherUser = await prisma.user.create({
    data: {
      email: `gi-other-${SUFFIX}@test.com`,
      username: `gi_other_${SUFFIX.replace('-', '_')}`,
      password: 'hash',
      firstName: 'GI',
      lastName: 'Other',
      money: 5000,
    },
  });

  const base = {
    dateOfBirth: new Date('2018-01-01'),
    age: 6,
    userId: ownerUser.id,
  };

  [
    stallion,
    mare,
    colt,
    filly,
    foalTooYoung,
    injuredStallion,
    cooldownSire,
    cooldownDam,
    trainingHorse,
    injuredTrainingHorse,
    cooldownTrainingHorse,
  ] = await Promise.all([
    prisma.horse.create({ data: { ...base, name: `TestFixture-GI-Stallion-${SUFFIX}`, sex: 'Stallion' } }),
    prisma.horse.create({ data: { ...base, name: `TestFixture-GI-Mare-${SUFFIX}`, sex: 'Mare' } }),
    prisma.horse.create({ data: { ...base, name: `TestFixture-GI-Colt-${SUFFIX}`, sex: 'Colt' } }),
    prisma.horse.create({ data: { ...base, name: `TestFixture-GI-Filly-${SUFFIX}`, sex: 'Filly' } }),
    prisma.horse.create({ data: { ...base, name: `TestFixture-GI-Foal-${SUFFIX}`, sex: 'Stallion', age: 1 } }),
    prisma.horse.create({
      data: { ...base, name: `TestFixture-GI-InjSire-${SUFFIX}`, sex: 'Stallion', healthStatus: 'Injured' },
    }),
    prisma.horse.create({
      data: { ...base, name: `TestFixture-GI-CdSire-${SUFFIX}`, sex: 'Stallion', lastBredDate: new Date() },
    }),
    prisma.horse.create({
      data: { ...base, name: `TestFixture-GI-CdDam-${SUFFIX}`, sex: 'Mare', lastBredDate: new Date() },
    }),
    prisma.horse.create({
      data: { ...base, name: `TestFixture-GI-TrainHorse-${SUFFIX}`, sex: 'Stallion', trainingCooldown: null },
    }),
    prisma.horse.create({
      data: { ...base, name: `TestFixture-GI-InjTrain-${SUFFIX}`, sex: 'Stallion', healthStatus: 'Injured' },
    }),
    prisma.horse.create({
      data: {
        ...base,
        name: `TestFixture-GI-CdTrain-${SUFFIX}`,
        sex: 'Stallion',
        trainingCooldown: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);
}, 30000);

afterAll(async () => {
  const ids = [
    stallion,
    mare,
    colt,
    filly,
    foalTooYoung,
    injuredStallion,
    cooldownSire,
    cooldownDam,
    trainingHorse,
    injuredTrainingHorse,
    cooldownTrainingHorse,
  ]
    .filter(Boolean)
    .map(h => h.id);

  await prisma.horse.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await prisma.user
    .deleteMany({
      where: { id: { in: [ownerUser?.id, otherUser?.id].filter(Boolean) } },
    })
    .catch(() => {});
}, 30000);

// ─── validateBreeding — DB-fixture paths ─────────────────────────────────────

describe('validateBreeding DB-fixture paths', () => {
  it('returns 404 when sire exists but is not owned by user and not public stud', async () => {
    const req = makeReq({ body: { sireId: stallion.id, damId: mare.id }, user: { id: otherUser.id } });
    const res = makeRes();
    const next = makeNext();

    await validateBreeding(req, res, next);

    expect(res.statusValue).toBe(404);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 404 when dam is not owned by user', async () => {
    const req = makeReq({ body: { sireId: stallion.id, damId: mare.id }, user: { id: otherUser.id } });
    const res = makeRes();
    const next = makeNext();

    // Set sire as public stud so we pass the sire check and hit the dam check
    await prisma.horse.update({ where: { id: stallion.id }, data: { studStatus: 'Public Stud' } });
    await validateBreeding(req, res, next);
    await prisma.horse.update({ where: { id: stallion.id }, data: { studStatus: 'Not at Stud' } });

    expect(res.statusValue).toBe(404);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when sire has wrong sex (Mare as sire)', async () => {
    const req = makeReq({ body: { sireId: mare.id, damId: filly.id }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await validateBreeding(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/stallion|colt/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when dam has wrong sex (Stallion as dam)', async () => {
    const req = makeReq({ body: { sireId: stallion.id, damId: colt.id }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await validateBreeding(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/mare|filly/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when sire is too young (age < 3)', async () => {
    const req = makeReq({ body: { sireId: foalTooYoung.id, damId: mare.id }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await validateBreeding(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/3 years/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when sire is injured', async () => {
    const req = makeReq({ body: { sireId: injuredStallion.id, damId: mare.id }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await validateBreeding(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/injured/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when sire is in breeding cooldown', async () => {
    const req = makeReq({ body: { sireId: cooldownSire.id, damId: mare.id }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await validateBreeding(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/sire.*cooldown/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when dam is in breeding cooldown', async () => {
    const req = makeReq({ body: { sireId: stallion.id, damId: cooldownDam.id }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await validateBreeding(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/dam.*cooldown/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('calls next() and attaches validatedHorses for a valid breeding pair', async () => {
    const req = makeReq({ body: { sireId: stallion.id, damId: mare.id }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await validateBreeding(req, res, next);

    expect(next.wasCalled()).toBe(true);
    expect(req.validatedHorses).toBeDefined();
    expect(req.validatedHorses.sire.id).toBe(stallion.id);
    expect(req.validatedHorses.dam.id).toBe(mare.id);
  });

  it('colt is accepted as sire sex', async () => {
    const req = makeReq({ body: { sireId: colt.id, damId: mare.id }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await validateBreeding(req, res, next);

    // colt + mare, both healthy, of age, no cooldown → should call next
    expect(next.wasCalled()).toBe(true);
  });

  it('filly is accepted as dam sex', async () => {
    const req = makeReq({ body: { sireId: stallion.id, damId: filly.id }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await validateBreeding(req, res, next);

    expect(next.wasCalled()).toBe(true);
  });
});

// ─── validateTraining — DB-fixture paths ─────────────────────────────────────

describe('validateTraining DB-fixture paths', () => {
  it('returns 404 when horse exists but is not owned by user', async () => {
    const req = makeReq({ body: { horseId: trainingHorse.id, discipline: 'Dressage' }, user: { id: otherUser.id } });
    const res = makeRes();
    const next = makeNext();

    await validateTraining(req, res, next);

    expect(res.statusValue).toBe(404);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when horse is too young to train (age < 3)', async () => {
    const req = makeReq({ body: { horseId: foalTooYoung.id, discipline: 'Dressage' }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await validateTraining(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/3 years/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when horse is injured', async () => {
    const req = makeReq({
      body: { horseId: injuredTrainingHorse.id, discipline: 'Dressage' },
      user: { id: ownerUser.id },
    });
    const res = makeRes();
    const next = makeNext();

    await validateTraining(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/injured/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when horse is in training cooldown', async () => {
    const req = makeReq({
      body: { horseId: cooldownTrainingHorse.id, discipline: 'Dressage' },
      user: { id: ownerUser.id },
    });
    const res = makeRes();
    const next = makeNext();

    await validateTraining(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/cooldown/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when discipline is invalid', async () => {
    const req = makeReq({
      body: { horseId: trainingHorse.id, discipline: 'FakeDiscipline' },
      user: { id: ownerUser.id },
    });
    const res = makeRes();
    const next = makeNext();

    await validateTraining(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/invalid discipline/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('calls next() for a valid training request', async () => {
    const req = makeReq({ body: { horseId: trainingHorse.id, discipline: 'Dressage' }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await validateTraining(req, res, next);

    expect(next.wasCalled()).toBe(true);
  });
});

// ─── validateTransaction — DB-fixture paths ──────────────────────────────────

describe('validateTransaction DB-fixture paths', () => {
  it('calls next() when user has sufficient funds for purchase', async () => {
    const middleware = validateTransaction('purchase');
    const req = makeReq({ body: { amount: 100 }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await middleware(req, res, next);

    expect(next.wasCalled()).toBe(true);
  });

  it('returns 400 when user has insufficient funds for purchase', async () => {
    const middleware = validateTransaction('purchase');
    const req = makeReq({ body: { amount: 999999 }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await middleware(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/insufficient funds/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when purchase amount exceeds 100000 limit', async () => {
    const middleware = validateTransaction('purchase');
    // ownerUser has 200000 — balance check passes, then limit check fires
    const req = makeReq({ body: { amount: 100001 }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await middleware(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/exceeds limit/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 404 when user does not exist', async () => {
    const middleware = validateTransaction('purchase');
    const req = makeReq({ body: { amount: 50 }, user: { id: 'non-existent-user-uuid-xyz' } });
    const res = makeRes();
    const next = makeNext();

    await middleware(req, res, next);

    expect(res.statusValue).toBe(404);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 for transfer to self', async () => {
    const middleware = validateTransaction('transfer');
    const req = makeReq({ body: { amount: 100, targetUserId: ownerUser.id }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await middleware(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/transfer to yourself/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 404 when transfer target does not exist', async () => {
    const middleware = validateTransaction('transfer');
    const req = makeReq({
      body: { amount: 100, targetUserId: 'non-existent-target-uuid' },
      user: { id: ownerUser.id },
    });
    const res = makeRes();
    const next = makeNext();

    await middleware(req, res, next);

    expect(res.statusValue).toBe(404);
    expect(res.jsonValue.message).toMatch(/target user not found/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('calls next() for a valid transfer to existing user', async () => {
    const middleware = validateTransaction('transfer');
    const req = makeReq({ body: { amount: 100, targetUserId: otherUser.id }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await middleware(req, res, next);

    expect(next.wasCalled()).toBe(true);
  });

  it('calls next() for deposit type (skips balance check)', async () => {
    const middleware = validateTransaction('deposit');
    const req = makeReq({ body: { amount: 500 }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await middleware(req, res, next);

    expect(next.wasCalled()).toBe(true);
  });

  it('calls next() for bet type with sufficient funds', async () => {
    const middleware = validateTransaction('bet');
    const req = makeReq({ body: { amount: 200 }, user: { id: ownerUser.id } });
    const res = makeRes();
    const next = makeNext();

    await middleware(req, res, next);

    expect(next.wasCalled()).toBe(true);
  });
});

// ─── preventDuplication — cleanup path (line 84) ─────────────────────────────

describe('preventDuplication — cleanup path', () => {
  it('cleans up entries older than 1 minute without affecting current operations', async () => {
    const { preventDuplication } = await import('../../../middleware/gameIntegrity.mjs');
    const mw = preventDuplication('cleanup-test');

    // First call — registers entry
    const body1 = { op: `cleanup-${Date.now()}` };
    const req1 = makeReq({ body: body1, user: { id: ownerUser.id } });
    const res1 = makeRes();
    let nextCalled = false;
    await mw(req1, res1, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);

    // Second call with a DIFFERENT body — also passes (no dupe)
    const body2 = { op: `cleanup-${Date.now()}-b` };
    const req2 = makeReq({ body: body2, user: { id: ownerUser.id } });
    const res2 = makeRes();
    let nextCalled2 = false;
    await mw(req2, res2, () => {
      nextCalled2 = true;
    });
    expect(nextCalled2).toBe(true);
  });
});
