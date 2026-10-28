/**
 * POST /api/trainers/marketplace/hire — roster-cap enforcement (Equoria-oey96.8).
 *
 * The trainer roster cap scales by the PLAYER's level (User.level). Owner rulings
 * 2026-10-28 (q222 and q245, Equoria-asmsy) replaced the 2026-07-07 curve keyed by
 * stable level (1/2/3/4/5), so these cases were rewritten to the new one: "2 for
 * level 1, then +1 per level, up to 10", i.e. User.level 1 → 2, level 4 → 5,
 * level 9+ → 10. GET /roster-cap reports the same number for the trainer page.
 *
 * Enforcement mirrors the landed groom pattern (Equoria-n4m5j / hduc5): a
 * fast-path pre-check PLUS an authoritative post-lock in-tx re-count of
 * non-retired trainers after the User row is locked, throwing
 * RosterCapExceededError → 400 so the create rolls back. Only NON-retired
 * trainers count; enforcement is hire-time only.
 *
 * Equoria-3kegj. OLD CONTRACT: a hire debited sessionRate * 4 and the debit
 * took the User row lock. NEW RULING (owner, 2026-10-22): hiring a trainer is
 * free; the hire locks the User row explicitly, and no coins move on any path.
 *
 * Real DB, no mocks, id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import config from '../../../config/config.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const FIXTURE_PREFIX = 'TestFixture-oey96_8-trainer';
const SESSION_RATE = 50; // the trainer's per-training fee; the hire itself is free

const createdUserIds = [];
const cleanup = createCleanupTracker();

async function makeUser({ level, money }) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: pw,
      firstName: 'Cap',
      lastName: 'Buyer',
      level,
      money,
    },
  });
  createdUserIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
  return { user, token };
}

/** Create `active` non-retired + `retired` retired trainers directly on the user. */
async function seedTrainers(userId, { active = 0, retired = 0 } = {}) {
  const rows = [];
  for (let i = 0; i < active; i++) {
    rows.push(false);
  }
  for (let i = 0; i < retired; i++) {
    rows.push(true);
  }
  for (const isRetired of rows) {
    await prisma.trainer.create({
      data: {
        userId,
        firstName: 'Seed',
        lastName: `Trainer${randomBytes(3).toString('hex')}`,
        personality: 'patient',
        skillLevel: 'expert',
        speciality: 'Dressage',
        sessionRate: SESSION_RATE,
        retired: isRetired,
      },
    });
  }
}

/** Seed a marketplace with `count` distinct hireable offers. */
async function seedMarketplace(userId, count) {
  const marketplaceIds = Array.from({ length: count }, () => `mid-${randomBytes(4).toString('hex')}`);
  const offers = marketplaceIds.map((mid, i) => ({
    marketplaceId: mid,
    firstName: 'Offer',
    lastName: `Trainer${i}`,
    personality: 'patient',
    skillLevel: 'expert',
    speciality: 'Dressage',
    sessionRate: SESSION_RATE,
    bio: 'roster-cap fixture',
  }));
  await prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId, staffType: 'trainer' } },
    create: { userId, staffType: 'trainer', offers, refreshCount: 0 },
    update: { offers },
  });
  return marketplaceIds;
}

async function hire(token, marketplaceId) {
  const csrf = await fetchCsrf(app);
  const res = await request(app)
    .post('/api/v1/trainers/marketplace/hire')
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ marketplaceId });
  return res;
}

beforeAll(() => {
  // FK-safe, id-scoped cleanup. Trainer.userId / UserTransaction.userId are
  // optional relations (onDelete: SetNull), so trainer + ledger rows must be
  // deleted BEFORE the user or they leak as orphaned fixtures.
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.trainer.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'trainer');
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.userTransaction.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'userTransaction');
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.staffMarketplaceState.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'staffMarketplaceState');
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    return undefined;
  }, 'user');
});

afterAll(() => cleanup.run(), 30000);

describe('POST /api/trainers/marketplace/hire — roster cap (Equoria-oey96.8)', () => {
  it('AT CAP (level 1, cap 2): hire is rejected 400 with NO debit, NO trainer row, NO ledger row', async () => {
    const { user, token } = await makeUser({ level: 1, money: 2000 });
    await seedTrainers(user.id, { active: 2 });
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(Number(after.money)).toBe(2000); // no debit
    const trainerCount = await prisma.trainer.count({ where: { userId: user.id } });
    expect(trainerCount).toBe(2); // no trainer row created
    const ledgerCount = await prisma.userTransaction.count({ where: { userId: user.id } });
    expect(ledgerCount).toBe(0); // no ledger row
  });

  it('BELOW CAP (level 1, cap 2): a 2nd trainer at level 1 is hired (the owner report)', async () => {
    const { user, token } = await makeUser({ level: 1, money: 2000 });
    await seedTrainers(user.id, { active: 1 });
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(201);
    const activeCount = await prisma.trainer.count({ where: { userId: user.id, retired: false } });
    expect(activeCount).toBe(2);
  });

  it('SCALING (level 2, cap 3): a 3rd hire succeeds when 2 non-retired trainers exist', async () => {
    const { user, token } = await makeUser({ level: 2, money: 2000 });
    await seedTrainers(user.id, { active: 2 });
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(201);
    const activeCount = await prisma.trainer.count({ where: { userId: user.id, retired: false } });
    expect(activeCount).toBe(3);
  });

  it('PLAYER LEVEL, NOT STABLE LEVEL (level 4, cap 5): a 5th hire succeeds; stable level 1 would have refused', async () => {
    const { user, token } = await makeUser({ level: 4, money: 2000 });
    await seedTrainers(user.id, { active: 4 });
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(201);
    const activeCount = await prisma.trainer.count({ where: { userId: user.id, retired: false } });
    expect(activeCount).toBe(5);
  });

  it('TOP (level 12, cap 10): an 11th trainer is refused', async () => {
    const { user, token } = await makeUser({ level: 12, money: 2000 });
    await seedTrainers(user.id, { active: 10 });
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(400);
    const activeCount = await prisma.trainer.count({ where: { userId: user.id, retired: false } });
    expect(activeCount).toBe(10);
  });

  it('RETIRED DO NOT COUNT (level 1, cap 2): hire succeeds with 0 non-retired + 2 retired trainers', async () => {
    const { user, token } = await makeUser({ level: 1, money: 2000 });
    await seedTrainers(user.id, { active: 0, retired: 2 });
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(201); // non-retired count (0) < cap (2)
    const activeCount = await prisma.trainer.count({ where: { userId: user.id, retired: false } });
    expect(activeCount).toBe(1);
  });

  it('CONCURRENT at cap-1 (level 1, cap 2): exactly one 201; roster == cap; no coins move', async () => {
    const { user, token } = await makeUser({ level: 1, money: 2000 });
    await seedTrainers(user.id, { active: 1 }); // one slot left (cap 2)
    const marketplaceIds = await seedMarketplace(user.id, 2);

    const results = await Promise.all(marketplaceIds.map(mid => hire(token, mid)));
    const successes = results.filter(r => r.status === 201);
    const rejects = results.filter(r => r.status === 400);

    expect(successes.length).toBe(1);
    expect(rejects.length).toBe(1);

    const activeCount = await prisma.trainer.count({ where: { userId: user.id, retired: false } });
    expect(activeCount).toBe(2); // exactly at cap, never over
    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(Number(after.money)).toBe(2000); // hiring is free (Equoria-3kegj)
  });
});

describe('GET /api/v1/trainers/roster-cap — the limit the trainer page shows (q222/q245)', () => {
  const rosterCap = async token =>
    request(app)
      .get('/api/v1/trainers/roster-cap')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`);

  it.each([
    [1, 2],
    [2, 3],
    [4, 5],
    [8, 9],
    [9, 10],
    [20, 10],
  ])('player level %i may hold %i trainers', async (level, cap) => {
    const { user, token } = await makeUser({ level, money: 0 });
    await seedTrainers(user.id, { active: 1, retired: 1 });

    const res = await rosterCap(token);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ rosterCap: cap, playerLevel: level, activeTrainers: 1 });
  });

  it('is the same number the hire path refuses at', async () => {
    const { user, token } = await makeUser({ level: 1, money: 0 });
    const { rosterCap: cap } = (await rosterCap(token)).body.data;
    await seedTrainers(user.id, { active: cap });
    const [mid] = await seedMarketplace(user.id, 1);

    expect((await hire(token, mid)).status).toBe(400);
  });

  it('requires a login', async () => {
    const res = await request(app).get('/api/v1/trainers/roster-cap').set('Origin', 'http://localhost:3000');
    expect(res.status).toBe(401);
  });
});
