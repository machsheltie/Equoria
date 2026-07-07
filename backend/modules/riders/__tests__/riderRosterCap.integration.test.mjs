/**
 * POST /api/riders/marketplace/hire — roster-cap enforcement (Equoria-oey96.8).
 *
 * The rider roster cap scales by STABLE LEVEL, derived from User.level via
 * getStableLevel(user) = clamp(ceil(level/4), 1, 5). Curve (ratified
 * 2026-07-07, docs/design/2026-07-07-game-balance-formulas.md §3):
 *   RIDER_ROSTER_CAP_BY_STABLE_LEVEL = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }
 * so User.level 1–4 → SL1 → cap 2; level 5–8 → SL2 → cap 3.
 *
 * Enforcement mirrors the landed groom pattern (Equoria-n4m5j / hduc5): a
 * fast-path pre-check PLUS an authoritative post-lock in-tx re-count of
 * non-retired riders after debitMoneyOrThrow row-locks the User row, throwing
 * RosterCapExceededError → 400 so the create + debit + ledger roll back
 * together. Only NON-retired riders count; enforcement is hire-time only.
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

const FIXTURE_PREFIX = 'TestFixture-oey96_8-rider';
const WEEKLY_RATE = 100; // hiringCost = weeklyRate (one week upfront)

const createdUserIds = [];
const cleanup = createCleanupTracker();

async function makeUser({ level, money }) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const user = await prisma.user.create({
    data: {
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

/** Create `active` non-retired + `retired` retired riders directly on the user. */
async function seedRiders(userId, { active = 0, retired = 0 } = {}) {
  const rows = [];
  for (let i = 0; i < active; i++) {
    rows.push(false);
  }
  for (let i = 0; i < retired; i++) {
    rows.push(true);
  }
  for (const isRetired of rows) {
    await prisma.rider.create({
      data: {
        userId,
        firstName: 'Seed',
        lastName: `Rider${randomBytes(3).toString('hex')}`,
        personality: 'calm',
        skillLevel: 'experienced',
        speciality: 'Show Jumping',
        weeklyRate: WEEKLY_RATE,
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
    lastName: `Rider${i}`,
    personality: 'calm',
    skillLevel: 'experienced',
    speciality: 'Show Jumping',
    weeklyRate: WEEKLY_RATE,
    experience: 5,
    bio: 'roster-cap fixture',
  }));
  await prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId, staffType: 'rider' } },
    create: { userId, staffType: 'rider', offers, refreshCount: 0 },
    update: { offers },
  });
  return marketplaceIds;
}

async function hire(token, marketplaceId) {
  const csrf = await fetchCsrf(app);
  const res = await request(app)
    .post('/api/v1/riders/marketplace/hire')
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ marketplaceId });
  return res;
}

beforeAll(() => {
  // FK-safe, id-scoped cleanup. Rider.userId / UserTransaction.userId are
  // optional relations (onDelete: SetNull), so rider + ledger rows must be
  // deleted BEFORE the user or they leak as orphaned fixtures.
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.rider.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'rider');
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

describe('POST /api/riders/marketplace/hire — roster cap (Equoria-oey96.8)', () => {
  it('AT CAP (SL1, cap 2): hire is rejected 400 with NO debit, NO rider row, NO ledger row', async () => {
    const { user, token } = await makeUser({ level: 1, money: 1000 });
    await seedRiders(user.id, { active: 2 });
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(Number(after.money)).toBe(1000); // no debit
    const riderCount = await prisma.rider.count({ where: { userId: user.id } });
    expect(riderCount).toBe(2); // no rider row created
    const ledgerCount = await prisma.userTransaction.count({ where: { userId: user.id } });
    expect(ledgerCount).toBe(0); // no ledger row
  });

  it('CEIL BOUNDARY (level 4 → SL1, cap 2): still blocked at 2 non-retired riders', async () => {
    const { user, token } = await makeUser({ level: 4, money: 1000 });
    await seedRiders(user.id, { active: 2 });
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(400);
    const riderCount = await prisma.rider.count({ where: { userId: user.id } });
    expect(riderCount).toBe(2);
  });

  it('SCALING (level 5 → SL2, cap 3): a 3rd hire succeeds when 2 non-retired riders exist', async () => {
    const { user, token } = await makeUser({ level: 5, money: 1000 });
    await seedRiders(user.id, { active: 2 });
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(201);
    const activeCount = await prisma.rider.count({ where: { userId: user.id, retired: false } });
    expect(activeCount).toBe(3);
  });

  it('RETIRED DO NOT COUNT (SL1, cap 2): hire succeeds with 1 non-retired + 3 retired riders', async () => {
    const { user, token } = await makeUser({ level: 1, money: 1000 });
    await seedRiders(user.id, { active: 1, retired: 3 });
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(201); // non-retired count (1) < cap (2)
    const activeCount = await prisma.rider.count({ where: { userId: user.id, retired: false } });
    expect(activeCount).toBe(2);
  });

  it('CONCURRENT at cap-1 (SL1, cap 2): exactly one 201; roster == cap; money debited once', async () => {
    const { user, token } = await makeUser({ level: 1, money: 1000 });
    await seedRiders(user.id, { active: 1 }); // one slot left
    const marketplaceIds = await seedMarketplace(user.id, 2);

    const results = await Promise.all(marketplaceIds.map(mid => hire(token, mid)));
    const successes = results.filter(r => r.status === 201);
    const rejects = results.filter(r => r.status === 400);

    expect(successes.length).toBe(1);
    expect(rejects.length).toBe(1);

    const activeCount = await prisma.rider.count({ where: { userId: user.id, retired: false } });
    expect(activeCount).toBe(2); // exactly at cap, never over
    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(Number(after.money)).toBe(1000 - WEEKLY_RATE); // exactly one debit
  });
});
