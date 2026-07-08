/**
 * nextActions priority-table integration tests (Equoria-oey96.28).
 *
 * Proves the endpoint implements the Story 23.4 priority table (docs/epics.md
 * :724-735) for the four items in scope for oey96.28:
 *   - open-show gating for `compete` (metadata.showId sourced from a real open Show)
 *   - `breed` matches Mare AND Stallion, off the real 30-day breeding cooldown
 *   - per-type `metadata` (cooldownEndsAt / showId / foalAge)
 *   - cap of 10 (was 6), with per-entity action emission and priority ordering
 *
 * `check-results` (spec priority 2) and `claim-prize` (spec priority 1) are NOT
 * exercised here: check-results is blocked on a schema decision (AC1 note on the
 * issue), claim-prize is out of scope for oey96.28.
 *
 * REAL DB, NO MOCKS (Constitution §3). Determinism against the shared canonical
 * DB is achieved by pinning fixture horses to UNREACHABLE XP-bracket levels
 * (>= 1500). Player-created shows cap at level 999 (showController.createShow
 * validates `lvl < 1 || lvl > 999`), so a level-1500+ horse can NEVER be
 * eligible for any REAL open show — only for the fixture show a given arm
 * creates at that exact level. Each arm uses a distinct unreachable level so
 * fixture shows from other arms cannot cross-contaminate.
 *
 * Cleanup is registered BEFORE seeding (scoped to id-collector arrays) so a
 * mid-seed failure still removes every fixture it created — no leak into the
 * canonical DB (CLAUDE.md §2).
 *
 * Route lives under authRouter at /api/v1/next-actions (Equoria-myfc5).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';

const ORIGIN = 'http://localhost:3000';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const rand = () => randomBytes(6).toString('hex');
// XP that yields exactly the given XP-bracket level: floor(xp/100)+1 = level.
const xpForLevel = level => (level - 1) * 100;

async function makeUser(userIds) {
  const user = await prisma.user.create({
    data: {
      email: `nextact-${rand()}-${rand()}@test.com`,
      username: `nextact${rand()}${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'NextAct',
      lastName: 'Priority',
      money: 5000,
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeOpenShow(level, showIds) {
  const now = new Date();
  const show = await prisma.show.create({
    data: {
      name: `TestFixture-nextact-show-${rand()}`,
      discipline: 'Dressage',
      levelMin: level,
      levelMax: level,
      entryFee: 100,
      prize: 1000,
      runDate: new Date(now.getTime() + 3 * MS_PER_DAY),
      status: 'open',
      openDate: now,
      closeDate: new Date(now.getTime() + 3 * MS_PER_DAY),
    },
  });
  showIds.push(show.id);
  return show;
}

// Registers scoped cleanups (in FK-safe order: shows → horses → users) that run
// in afterAll. Called at describe-body time, BEFORE beforeAll seeds — so a
// mid-seed throw still cleans whatever was created.
function registerCleanup(cleanup, { showIds, horseIds, userIds }) {
  if (showIds) {
    cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  }
  cleanup.add(() => cleanupTestHorses(prisma, horseIds), 'horses'); // cascades foalDevelopment
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
}

function getActions(user) {
  const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  return request(app).get('/api/v1/next-actions').set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);
}

// ─── Arm A: full priority ordering + per-type metadata ───────────────────────

describe('GET /api/v1/next-actions — priority ordering + metadata (Equoria-oey96.28)', () => {
  const cleanup = createCleanupTracker();
  const horseIds = [];
  const showIds = [];
  const userIds = [];
  registerCleanup(cleanup, { showIds, horseIds, userIds });

  let user;
  let stallionId;
  let mareId;
  let foalId;
  let show;
  const now = new Date();
  const cooldownEndedAt = new Date(now.getTime() - 1 * MS_PER_DAY); // trainingCooldown expired yesterday

  beforeAll(async () => {
    user = await makeUser(userIds);
    show = await makeOpenShow(1500, showIds);

    // Trainable + breedable Stallion, level 1500 (matches ONLY the fixture show).
    const stallion = await createTestHorse(
      prisma,
      {
        name: `TestFixture-nextact-stallion-${rand()}`,
        sex: 'Stallion',
        age: 5,
        dateOfBirth: new Date(now.getTime() - 5 * 365 * MS_PER_DAY),
        healthStatus: 'Excellent',
        horseXp: xpForLevel(1500),
        trainingCooldown: cooldownEndedAt,
        lastBredDate: new Date(now.getTime() - 40 * MS_PER_DAY), // off 30-day cooldown
        userId: user.id,
      },
      horseIds,
    );
    stallionId = stallion.id;

    // Injured Mare — canonical 'Injured' value (default health is 'Excellent').
    const mare = await createTestHorse(
      prisma,
      {
        name: `TestFixture-nextact-mare-${rand()}`,
        sex: 'Mare',
        age: 5,
        dateOfBirth: new Date(now.getTime() - 5 * 365 * MS_PER_DAY),
        healthStatus: 'Injured',
        horseXp: xpForLevel(1500),
        userId: user.id,
      },
      horseIds,
    );
    mareId = mare.id;

    // Active foal (age ~3 days, too young to train/compete/breed).
    const foal = await createTestHorse(
      prisma,
      {
        name: `TestFixture-nextact-foal-${rand()}`,
        sex: 'Colt',
        age: 0,
        dateOfBirth: new Date(now.getTime() - 3 * MS_PER_DAY),
        healthStatus: 'Excellent',
        userId: user.id,
      },
      horseIds,
    );
    foalId = foal.id;
    await prisma.foalDevelopment.create({ data: { foalId: foal.id, isActive: true } });
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('returns train, compete, breed, groom-foal, visit-vet in spec-priority order', async () => {
    const res = await getActions(user);
    expect(res.status).toBe(200);
    const { actions } = res.body.data;
    expect(actions.map(a => a.type)).toEqual(['train', 'compete', 'breed', 'groom-foal', 'visit-vet']);
    // priorities renumbered 1..N ascending (frontend gold-accents priority === 1).
    expect(actions.map(a => a.priority)).toEqual([1, 2, 3, 4, 5]);
  });

  it('attaches cooldownEndsAt to train, showId to compete, foalAge to groom-foal', async () => {
    const res = await getActions(user);
    const byType = Object.fromEntries(res.body.data.actions.map(a => [a.type, a]));

    // train — cooldownEndsAt is the real (expired) trainingCooldown timestamp.
    expect(byType.train.horseId).toBe(stallionId);
    expect(byType.train.metadata).toBeDefined();
    expect(new Date(byType.train.metadata.cooldownEndsAt).getTime()).toBe(cooldownEndedAt.getTime());

    // compete — showId references the real fixture OPEN show.
    expect(byType.compete.metadata.showId).toBe(show.id);
    expect(byType.compete.horseId).toBe(stallionId);

    // breed — Stallion matched; cooldownEndsAt = lastBredDate + 30d (in the past).
    expect(byType.breed.horseId).toBe(stallionId);
    expect(new Date(byType.breed.metadata.cooldownEndsAt).getTime()).toBeLessThan(Date.now());

    // groom-foal — foalAge in days (~3), horseId is the foal.
    expect(byType['groom-foal'].horseId).toBe(foalId);
    expect(byType['groom-foal'].metadata.foalAge).toBeGreaterThanOrEqual(2);
    expect(byType['groom-foal'].metadata.foalAge).toBeLessThanOrEqual(4);

    // visit-vet — the injured mare (canonical 'Injured' value must be detected).
    expect(byType['visit-vet'].horseId).toBe(mareId);
  });
});

// ─── Arm B: compete open-show gating ─────────────────────────────────────────

describe('GET /api/v1/next-actions — compete gated on open shows (Equoria-oey96.28)', () => {
  const cleanup = createCleanupTracker();
  const horseIds = [];
  const showIds = [];
  const userIds = [];
  registerCleanup(cleanup, { showIds, horseIds, userIds });

  let posUser;
  let negUser;
  let posShow;
  const now = new Date();

  beforeAll(async () => {
    // POSITIVE: eligible horse (level 1600) + a fixture open show at [1600,1600].
    posUser = await makeUser(userIds);
    posShow = await makeOpenShow(1600, showIds);
    await createTestHorse(
      prisma,
      {
        name: `TestFixture-nextact-posH-${rand()}`,
        sex: 'Rig',
        age: 5,
        dateOfBirth: new Date(now.getTime() - 5 * 365 * MS_PER_DAY),
        healthStatus: 'Excellent',
        horseXp: xpForLevel(1600),
        userId: posUser.id,
      },
      horseIds,
    );

    // NEGATIVE: eligible-by-age/health horse at level 1700, NO fixture show.
    // No real or fixture open show can accept level 1700 → compete must NOT fire.
    negUser = await makeUser(userIds);
    await createTestHorse(
      prisma,
      {
        name: `TestFixture-nextact-negH-${rand()}`,
        sex: 'Rig',
        age: 5,
        dateOfBirth: new Date(now.getTime() - 5 * 365 * MS_PER_DAY),
        healthStatus: 'Excellent',
        horseXp: xpForLevel(1700),
        userId: negUser.id,
      },
      horseIds,
    );
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('emits compete with the open showId when an eligible open show exists', async () => {
    const res = await getActions(posUser);
    expect(res.status).toBe(200);
    const compete = res.body.data.actions.filter(a => a.type === 'compete');
    expect(compete.length).toBeGreaterThanOrEqual(1);
    // level-1600 horse is eligible for exactly ONE open show — the fixture.
    expect(compete.some(a => a.metadata?.showId === posShow.id)).toBe(true);
  });

  it('does NOT emit compete when no open show accepts the horse', async () => {
    const res = await getActions(negUser);
    expect(res.status).toBe(200);
    const compete = res.body.data.actions.filter(a => a.type === 'compete');
    expect(compete).toHaveLength(0);
  });
});

// ─── Arm C: Stallion breed + real 30-day cooldown ────────────────────────────

describe('GET /api/v1/next-actions — Stallion breed off/on cooldown (Equoria-oey96.28)', () => {
  const cleanup = createCleanupTracker();
  const horseIds = [];
  const userIds = [];
  registerCleanup(cleanup, { horseIds, userIds });

  let offUser;
  let onUser;
  const now = new Date();

  beforeAll(async () => {
    // Stallion off cooldown (bred 40d ago) → breed emitted.
    offUser = await makeUser(userIds);
    await createTestHorse(
      prisma,
      {
        name: `TestFixture-nextact-studOff-${rand()}`,
        sex: 'Stallion',
        age: 5,
        dateOfBirth: new Date(now.getTime() - 5 * 365 * MS_PER_DAY),
        healthStatus: 'Excellent',
        horseXp: xpForLevel(1750), // unreachable level → no compete pollution
        lastBredDate: new Date(now.getTime() - 40 * MS_PER_DAY),
        userId: offUser.id,
      },
      horseIds,
    );

    // Stallion in cooldown (bred 5d ago) → breed NOT emitted.
    onUser = await makeUser(userIds);
    await createTestHorse(
      prisma,
      {
        name: `TestFixture-nextact-studOn-${rand()}`,
        sex: 'Stallion',
        age: 5,
        dateOfBirth: new Date(now.getTime() - 5 * 365 * MS_PER_DAY),
        healthStatus: 'Excellent',
        horseXp: xpForLevel(1750),
        lastBredDate: new Date(now.getTime() - 5 * MS_PER_DAY),
        userId: onUser.id,
      },
      horseIds,
    );
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('emits breed for a Stallion off the 30-day cooldown', async () => {
    const res = await getActions(offUser);
    const breed = res.body.data.actions.filter(a => a.type === 'breed');
    expect(breed).toHaveLength(1);
  });

  it('does NOT emit breed for a Stallion still within the 30-day cooldown', async () => {
    const res = await getActions(onUser);
    const breed = res.body.data.actions.filter(a => a.type === 'breed');
    expect(breed).toHaveLength(0);
  });
});

// ─── Arm D: cap of 10 (was 6), per-entity emission ───────────────────────────

describe('GET /api/v1/next-actions — caps at 10 actions (Equoria-oey96.28)', () => {
  const cleanup = createCleanupTracker();
  const horseIds = [];
  const userIds = [];
  registerCleanup(cleanup, { horseIds, userIds });

  let user;
  const now = new Date();
  const TRAINABLE_COUNT = 12;

  beforeAll(async () => {
    user = await makeUser(userIds);
    // 12 trainable Rigs at an unreachable level (no compete), never bred,
    // so each yields exactly ONE `train` candidate → 12 candidates → cap 10.
    for (let i = 0; i < TRAINABLE_COUNT; i += 1) {
      await createTestHorse(
        prisma,
        {
          name: `TestFixture-nextact-cap-${i}-${rand()}`,
          sex: 'Rig',
          age: 5,
          dateOfBirth: new Date(now.getTime() - 5 * 365 * MS_PER_DAY),
          healthStatus: 'Excellent',
          horseXp: xpForLevel(1800),
          userId: user.id,
        },
        horseIds,
      );
    }
  }, 90000);

  afterAll(() => cleanup.run(), 60000);

  it('returns exactly 10 actions when 12 candidates exist, all train, priorities 1..10', async () => {
    const res = await getActions(user);
    expect(res.status).toBe(200);
    const { actions } = res.body.data;
    expect(actions).toHaveLength(10);
    expect(actions.every(a => a.type === 'train')).toBe(true);
    expect(actions.map(a => a.priority)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
