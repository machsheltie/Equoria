/**
 * Critical-health gate on conformation show entry (Equoria-71zs, parent: Equoria-3gqg).
 *
 * Spec §x: a horse whose `displayedHealth === 'critical'` cannot enter
 * any competition. The gate fires in `enterConformationShow` before the
 * service-level validation, so the rejection message is specifically
 * about critical health (not e.g. 'Horse must be healthy').
 *
 * Pattern: controller-direct (buildReq/buildRes) per the established
 * conformation-test pattern in modules/competition/__tests__/. Avoids
 * needing to know where the route is mounted in the app.
 *
 * Real DB. NO mocks. NO bypass headers.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../db/index.mjs';
import { enterConformationShow } from '../../modules/competition/controllers/conformationShowController.mjs';

const SUITE_PREFIX = 'a12';

const VALID_CONFORMATION_SCORES = {
  head: 80,
  neck: 75,
  shoulders: 70,
  back: 85,
  legs: 78,
  hooves: 72,
  topline: 80,
  hindquarters: 76,
  overallConformation: 78,
};

function buildReq({ body = {}, user }) {
  return { body, params: {}, user };
}

function buildRes() {
  let _status = 200;
  let _body = null;
  return {
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
  };
}

async function createUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'A12',
      lastName: 'Gate',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

async function createHorse(userId, overrides = {}) {
  return prisma.horse.create({
    data: {
      name: overrides.name ?? `${SUITE_PREFIX}-h-${randomBytes(4).toString('hex')}`,
      sex: overrides.sex ?? 'Mare',
      dateOfBirth: new Date('2021-01-01'),
      age: overrides.age ?? 4,
      healthStatus: overrides.healthStatus ?? 'Excellent',
      lastFedDate: overrides.lastFedDate ?? new Date(),
      lastVettedDate: overrides.lastVettedDate ?? new Date(),
      bondScore: 70,
      temperament: 'Calm',
      conformationScores: VALID_CONFORMATION_SCORES,
      user: { connect: { id: userId } },
    },
  });
}

async function createGroom(userId) {
  return prisma.groom.create({
    data: {
      name: `${SUITE_PREFIX}-g-${randomBytes(4).toString('hex')}`,
      speciality: 'show_handling',
      personality: 'gentle',
      skillLevel: 'expert',
      user: { connect: { id: userId } },
    },
  });
}

async function createGroomAssignment(groomId, horseId, userId) {
  return prisma.groomAssignment.create({
    data: {
      groom: { connect: { id: groomId } },
      foal: { connect: { id: horseId } },
      user: { connect: { id: userId } },
      isActive: true,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });
}

async function createConformationShow() {
  return prisma.show.create({
    data: {
      name: `${SUITE_PREFIX}-show-${randomBytes(4).toString('hex')}`,
      discipline: 'Conformation',
      levelMin: 1,
      levelMax: 10,
      entryFee: 50,
      prize: 0,
      runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      showType: 'conformation',
      status: 'open',
    },
  });
}

async function cleanupSuite() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) return;
  const userIds = users.map(u => u.id);
  const horses = await prisma.horse.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const horseIds = horses.map(h => h.id);
  const grooms = await prisma.groom.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const groomIds = grooms.map(g => g.id);
  if (groomIds.length > 0) {
    await prisma.groomAssignment.deleteMany({ where: { groomId: { in: groomIds } } });
  }
  if (horseIds.length > 0) {
    await prisma.showEntry.deleteMany({ where: { horseId: { in: horseIds } } });
  }
  await prisma.show.deleteMany({ where: { name: { startsWith: SUITE_PREFIX } } });
  await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.groom.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('Critical-health gate on conformation show entry', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  it('rejects entry with 400 when feed-derived health is critical (10 days un-fed)', async () => {
    const user = await createUser();
    // 10 days un-fed → feedHealth = 'critical' → displayedHealth = 'critical'
    // healthStatus 'Excellent' ensures the SERVICE-level health check would
    // pass, isolating the A12 gate as the actual rejector.
    const horse = await createHorse(user.id, {
      lastFedDate: new Date(Date.now() - 10 * 86_400_000),
      healthStatus: 'Excellent',
    });
    const groom = await createGroom(user.id);
    await createGroomAssignment(groom.id, horse.id, user.id);
    const show = await createConformationShow();

    const req = buildReq({
      body: { horseId: horse.id, groomId: groom.id, showId: show.id, className: 'Mares' },
      user: { id: user.id },
    });
    const res = buildRes();

    await enterConformationShow(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.success).toBe(false);
    expect(res.jsonValue.message).toMatch(/critical health|cannot enter/i);

    // No show entry was persisted.
    const entries = await prisma.showEntry.findMany({
      where: { showId: show.id, horseId: horse.id },
    });
    expect(entries).toHaveLength(0);
  });

  it('rejects entry when vet-finding override sets healthStatus to critical', async () => {
    // Sentinel-positive against a different path to displayedHealth='critical':
    // healthStatus override (case-insensitive normalization in getVetHealth).
    const user = await createUser();
    const horse = await createHorse(user.id, {
      lastFedDate: new Date(),
      healthStatus: 'Critical',
    });
    const groom = await createGroom(user.id);
    await createGroomAssignment(groom.id, horse.id, user.id);
    const show = await createConformationShow();

    const req = buildReq({
      body: { horseId: horse.id, groomId: groom.id, showId: show.id, className: 'Mares' },
      user: { id: user.id },
    });
    const res = buildRes();

    await enterConformationShow(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/critical health|cannot enter/i);
  });

  it('does NOT fire critical-health gate for a healthy horse', async () => {
    // Sentinel-positive that the gate isn't a rubber stamp: a healthy
    // horse must NOT be rejected by the A12 gate. (Other validations
    // may still fail — e.g. groom assignment freshness — but the gate
    // message specifically must not appear.)
    const user = await createUser();
    const horse = await createHorse(user.id, {
      lastFedDate: new Date(),
      lastVettedDate: new Date(),
      healthStatus: 'Excellent',
    });
    const groom = await createGroom(user.id);
    await createGroomAssignment(groom.id, horse.id, user.id);
    const show = await createConformationShow();

    const req = buildReq({
      body: { horseId: horse.id, groomId: groom.id, showId: show.id, className: 'Mares' },
      user: { id: user.id },
    });
    const res = buildRes();

    await enterConformationShow(req, res);

    // Either succeeds (201) or fails for a non-A12 reason. Either way,
    // the response must NOT match the A12 critical-health message.
    expect(res.jsonValue?.message ?? '').not.toMatch(/critical health/i);
  });

  it('does NOT fire for a retired horse (age >= 21) — retirement is not critical', async () => {
    // Per worseOf(): 'retired' is a terminal state, distinct from 'critical'.
    // A retired horse has displayedHealth='retired', NOT 'critical', so the
    // A12 gate must not fire. (The service may have its own retired-horse
    // policy; A12 specifically is about critical-health.)
    const user = await createUser();
    const horse = await createHorse(user.id, { age: 22 });
    const groom = await createGroom(user.id);
    await createGroomAssignment(groom.id, horse.id, user.id);
    const show = await createConformationShow();

    const req = buildReq({
      body: { horseId: horse.id, groomId: groom.id, showId: show.id, className: 'Mares' },
      user: { id: user.id },
    });
    const res = buildRes();

    await enterConformationShow(req, res);

    expect(res.jsonValue?.message ?? '').not.toMatch(/critical health/i);
  });
});
