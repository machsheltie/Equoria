/**
 * nextActionsController.test.mjs — real DB
 *
 * NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted
 * from jest.unstable_mockModule of db + logger to a real-DB integration
 * test. Each test creates real users + horses (+ optional foals) with
 * controlled state, calls the real controller, asserts on response.
 *
 * Removed (per doctrine):
 *   - "gracefully handles foalDevelopment query failure" — required
 *     mocking foalDevelopment.findMany to reject. The controller's
 *     `.catch(() => [])` is observable in production, not synthetically
 *     testable without a mock. The graceful behavior IS still exercised
 *     by the empty-foals path (default DB state has no foals).
 *   - "returns 500 on unexpected error" — required mocking horse.findMany
 *     to reject. Same reason.
 */

import { describe, beforeAll, afterAll, beforeEach, it, expect } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../db/index.mjs';
import { getNextActions } from '../controllers/nextActionsController.mjs';

const SUITE_PREFIX = 'nact';

function makeReqRes(userId) {
  let _status = 200;
  let _body = null;
  return {
    req: { user: userId === undefined ? null : { id: userId }, body: {}, params: {}, query: {} },
    res: {
      status(c) {
        _status = c;
        return this;
      },
      json(b) {
        _body = b;
        return this;
      },
      get statusValue() {
        return _status;
      },
      get jsonValue() {
        return _body;
      },
    },
  };
}

async function createUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'Nact',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

async function createHorse(userId, overrides = {}) {
  return prisma.horse.create({
    data: {
      name: overrides.name ?? `${SUITE_PREFIX}-h-${randomBytes(4).toString('hex')}`,
      sex: overrides.sex ?? 'Stallion',
      dateOfBirth: overrides.dateOfBirth ?? new Date('2020-01-01'),
      age: overrides.age ?? 5,
      healthStatus: overrides.healthStatus ?? 'healthy',
      trainingCooldown: overrides.trainingCooldown ?? null,
      lastBredDate: overrides.lastBredDate ?? null,
      user: { connect: { id: userId } },
    },
  });
}

async function createActiveFoal(userId, foalName = 'Little Star') {
  // The controller queries foalDevelopment with isActive: true and
  // includes horse.name. Create a foal-horse + a foalDevelopment row
  // pointing at it.
  const foalHorse = await createHorse(userId, { name: foalName, age: 0 });
  return prisma.foalDevelopment.create({
    data: {
      foalId: foalHorse.id,
      horseId: foalHorse.id,
      isActive: true,
    },
  });
}

async function cleanupSuite() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) {
    return;
  }
  const userIds = users.map(u => u.id);
  const horses = await prisma.horse.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const horseIds = horses.map(h => h.id);
  if (horseIds.length > 0) {
    await prisma.foalDevelopment.deleteMany({ where: { foalId: { in: horseIds } } });
    await prisma.trainingLog.deleteMany({ where: { horseId: { in: horseIds } } });
    await prisma.competitionResult.deleteMany({ where: { horseId: { in: horseIds } } });
  }
  await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('getNextActions (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  beforeEach(cleanupSuite);

  it('returns 401 when user is not authenticated', async () => {
    const h = makeReqRes(undefined);
    await getNextActions(h.req, h.res);
    expect(h.res.statusValue).toBe(401);
    expect(h.res.jsonValue).toMatchObject({ success: false, message: 'Authentication required' });
  });

  it('returns empty actions when user has no horses', async () => {
    const user = await createUser();
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    expect(h.res.statusValue).toBe(200);
    expect(h.res.jsonValue.success).toBe(true);
    expect(h.res.jsonValue.data.actions).toEqual([]);
  });

  it('returns visit-vet action for an injured horse', async () => {
    const user = await createUser();
    const horse = await createHorse(user.id, { healthStatus: 'injured' });
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    const vetAction = h.res.jsonValue.data.actions.find(a => a.type === 'visit-vet');
    expect(vetAction).toBeDefined();
    expect(vetAction.horseId).toBe(horse.id);
  });

  it('detects injured horse with uppercase INJURED', async () => {
    const user = await createUser();
    await createHorse(user.id, { healthStatus: 'INJURED' });
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    expect(h.res.jsonValue.data.actions.some(a => a.type === 'visit-vet')).toBe(true);
  });

  // 21R-PROD-BUG-1 (Equoria-j8s2) — fix landed 2026-04-30.
  // Pre-fix the controller queried `where: { horse: { userId } }` but
  // FoalDevelopment has only a `foal` relation; the query threw and
  // the silent `.catch(() => [])` hid the bug. After fixing the
  // relation traversal, the active foal correctly produces a
  // groom-foal action with the foal's id and name.
  it('returns groom-foal action when user has an active foal in development', async () => {
    const user = await createUser();
    const foalDev = await createActiveFoal(user.id, 'Little Star');
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    const foalAction = h.res.jsonValue.data.actions.find(a => a.type === 'groom-foal');
    expect(foalAction).toBeDefined();
    expect(foalAction.horseId).toBe(foalDev.foalId);
    expect(foalAction.horseName).toBe('Little Star');
    expect(foalAction.metadata?.totalFoals).toBe(1);
  });

  it('reports correct totalFoals metadata when multiple active foals exist', async () => {
    const user = await createUser();
    await createActiveFoal(user.id, 'Foal A');
    await createActiveFoal(user.id, 'Foal B');
    await createActiveFoal(user.id, 'Foal C');
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    const foalAction = h.res.jsonValue.data.actions.find(a => a.type === 'groom-foal');
    expect(foalAction).toBeDefined();
    expect(foalAction.metadata.totalFoals).toBe(3);
  });

  it('does NOT return groom-foal action when foal is no longer active', async () => {
    const user = await createUser();
    const foalDev = await createActiveFoal(user.id, 'Inactive Foal');
    await prisma.foalDevelopment.update({
      where: { id: foalDev.id },
      data: { isActive: false },
    });
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    const foalAction = h.res.jsonValue.data.actions.find(a => a.type === 'groom-foal');
    expect(foalAction).toBeUndefined();
  });

  it("does NOT return another user's active foals (ownership isolation)", async () => {
    const user = await createUser();
    const otherUser = await createUser();
    await createActiveFoal(otherUser.id, 'Other User Foal');
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    const foalAction = h.res.jsonValue.data.actions.find(a => a.type === 'groom-foal');
    expect(foalAction).toBeUndefined();
  });

  it('returns train action for eligible horse (age>=3, healthy, no cooldown)', async () => {
    const user = await createUser();
    await createHorse(user.id, { age: 5 });
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    expect(h.res.jsonValue.data.actions.some(a => a.type === 'train')).toBe(true);
  });

  it('does not return train action for horse under age 3', async () => {
    const user = await createUser();
    await createHorse(user.id, { age: 2 });
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    expect(h.res.jsonValue.data.actions.some(a => a.type === 'train')).toBe(false);
  });

  it('does not return train action for horse with active cooldown', async () => {
    const user = await createUser();
    await createHorse(user.id, {
      trainingCooldown: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    expect(h.res.jsonValue.data.actions.some(a => a.type === 'train')).toBe(false);
  });

  it('returns train action when cooldown has expired', async () => {
    const user = await createUser();
    await createHorse(user.id, { trainingCooldown: new Date(Date.now() - 1000) });
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    expect(h.res.jsonValue.data.actions.some(a => a.type === 'train')).toBe(true);
  });

  it('returns compete action for eligible horse (age>=3, healthy)', async () => {
    const user = await createUser();
    await createHorse(user.id, { age: 4 });
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    expect(h.res.jsonValue.data.actions.some(a => a.type === 'compete')).toBe(true);
  });

  it('does not return compete action for injured horse', async () => {
    const user = await createUser();
    await createHorse(user.id, { healthStatus: 'injured', age: 5 });
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    expect(h.res.jsonValue.data.actions.some(a => a.type === 'compete')).toBe(false);
  });

  it('returns breed action for an eligible mare', async () => {
    const user = await createUser();
    await createHorse(user.id, { sex: 'Mare', age: 4 });
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    expect(h.res.jsonValue.data.actions.some(a => a.type === 'breed')).toBe(true);
  });

  it('handles mare sex check case-insensitively', async () => {
    const user = await createUser();
    await createHorse(user.id, { sex: 'mare', age: 4 });
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    expect(h.res.jsonValue.data.actions.some(a => a.type === 'breed')).toBe(true);
  });

  it('does not return breed action for a stallion', async () => {
    const user = await createUser();
    await createHorse(user.id, { sex: 'Stallion', age: 5 });
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    expect(h.res.jsonValue.data.actions.some(a => a.type === 'breed')).toBe(false);
  });

  it('does not return breed action for mare with active breeding cooldown', async () => {
    const user = await createUser();
    await createHorse(user.id, {
      sex: 'Mare',
      age: 5,
      lastBredDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    expect(h.res.jsonValue.data.actions.some(a => a.type === 'breed')).toBe(false);
  });

  it('assigns ascending priority numbers starting from 1', async () => {
    const user = await createUser();
    await createHorse(user.id, { id: undefined, healthStatus: 'injured', name: 'Injured' });
    await createHorse(user.id, { id: undefined, sex: 'Mare', age: 5, name: 'Mare' });
    await createActiveFoal(user.id, 'Foal');

    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    const priorities = h.res.jsonValue.data.actions.map(a => a.priority);
    expect(priorities).toEqual(priorities.map((_p, i) => i + 1));
    expect(priorities[0]).toBe(1);
  });

  it('limits output to 6 actions maximum', async () => {
    const user = await createUser();
    await createHorse(user.id, { healthStatus: 'injured', name: 'Injured1' });
    await createHorse(user.id, { healthStatus: 'injured', name: 'Injured2' });
    await createHorse(user.id, { sex: 'Mare', age: 5, name: 'Mare1' });
    await createHorse(user.id, { age: 5, name: 'Stallion1' });
    await createActiveFoal(user.id, 'Foal');

    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    expect(h.res.jsonValue.data.actions.length).toBeLessThanOrEqual(6);
  });

  it('includes horseName in each action', async () => {
    const user = await createUser();
    await createHorse(user.id, { name: 'Starfire', age: 5 });
    const h = makeReqRes(user.id);
    await getNextActions(h.req, h.res);
    for (const action of h.res.jsonValue.data.actions) {
      expect(action.horseName).toBe('Starfire');
    }
  });
});
