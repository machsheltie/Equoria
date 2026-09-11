/**
 * Equoria-ypb7d.1 — the groom age model, on the clock horses already use.
 *
 * OWNER RULING (2026-09-09, verbatim, Equoria-maeba):
 *   "grooms should have a built in start age. Anywhere from 18-24 years old. They
 *    should require [retire] at 50-65 years old. Just like horses, a groom ages a
 *    year per week."
 * ADDENDUM (same day):
 *   "Math.random determines when they retire between 50-65 years old. That is all."
 *
 * THE DEFECT THIS REPLACES. Pre-ypb7d a groom's age WAS `careerWeeks`, which
 * starts at 0 at hire. So a groom hired today was age 0, the first retirement was
 * 50-65 weekly passes away — about a real-world year — and a groom effectively
 * retired at roughly 75-90 rather than 50-65. Equoria-maeba raised it; the ruling
 * above settled it.
 *
 * WHAT IS ASSERTED, AND WHY EACH CASE FAILS ON THE PRE-FIX CODE:
 *   1. Both hire paths persist a start age in 18..24     -> `startAge` did not exist
 *   2. Age is `startAge + careerWeeks`, one year per pass -> age was careerWeeks
 *   3. A groom at its drawn retirement age retires; one short does not, and the
 *      comparison is on AGE                              -> compared careerWeeks
 *   4. Nothing but the two draws decides the timing: level 10, 5000 experience
 *      and 12 assignment logs do not retire a young groom
 *   5. The weekly pass draws a start age for grooms that predate this story, which
 *      is why the migration performs no backfill
 *   6. The database refuses a start age outside 18..24 (CHECK constraint)
 *   7. Time to retirement is 26..47 weekly passes — stated, not hidden
 *   8. The HIDDEN retirement age is still not readable through the new pool
 *      endpoint (the Equoria-m9lz1 guarantee must not regress)
 *
 * Real DB, no mocks. Controllers are driven directly with a fake req/res, the
 * Equoria-otii0 pattern in this directory, because none of this is an HTTP contract
 * question. Cleanup is id- and prefix-scoped through the fail-loud tracker.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { prismaRejectionOf } from '../../../__tests__/helpers/expectPrismaRejection.mjs';
import {
  START_AGE_MIN,
  START_AGE_MAX,
  drawStartAge,
  groomAgeYears,
  ensureStartAge,
} from '../services/groomAgeService.mjs';
import { checkRetirementEligibility } from '../services/groomRetirementService.mjs';
import { processWeeklyCareerProgression } from '../services/groomCareerProgressionService.mjs';
// The hidden retirement age. Imported BY PATH, never through the grooms barrel —
// scripts/doctrine-checks/check-no-retirement-schedule-leak.mjs skips __tests__ so
// a test may read it, and the arithmetic here needs it.
import {
  ensureRetirementSchedule,
  RETIREMENT_AGE_MIN,
  RETIREMENT_AGE_MAX,
} from '../services/groomRetirementScheduleService.mjs';
import { hireGroom } from '../controllers/groomRosterController.mjs';
import { hireFromMarketplace, refreshMarketplace } from '../controllers/groomMarketplaceController.mjs';
import { listFreeAgentGrooms } from '../controllers/groomFreeAgentController.mjs';

const FIXTURE_PREFIX = 'TestFixture-ypb7d-age';
const tag = () => randomBytes(6).toString('hex');

function fakeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

async function makeUser(label, money = 20000) {
  const suffix = tag();
  return prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${label}-${suffix}`,
      email: `${FIXTURE_PREFIX}-${label}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Ypb7d',
      lastName: label,
      money,
      settings: {},
    },
  });
}

async function makeGroom(userId, label, extra = {}) {
  return prisma.groom.create({
    data: {
      name: `${FIXTURE_PREFIX}-${label}-${tag()}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      userId,
      ...extra,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-ypb7d.1 — drawStartAge and groomAgeYears (pure)', () => {
  it('draws only integers inside the ruling band, and not always the same one', () => {
    const draws = Array.from({ length: 200 }, () => drawStartAge());
    for (const value of draws) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(START_AGE_MIN);
      expect(value).toBeLessThanOrEqual(START_AGE_MAX);
    }
    // The band the owner named, not an off-by-one reading of it.
    expect(START_AGE_MIN).toBe(18);
    expect(START_AGE_MAX).toBe(24);
    // A fixed value would satisfy every assertion above; this is what says the
    // draw is a draw. With 200 samples over 7 values, a single distinct value has
    // probability (1/7)^199 — this cannot flake.
    expect(new Set(draws).size).toBeGreaterThan(1);
    // Both ends of an inclusive band must be reachable; a half-open draw would
    // never produce 24. 200 samples miss a given value with probability (6/7)^200,
    // about 1e-14.
    expect(draws).toContain(START_AGE_MIN);
    expect(draws).toContain(START_AGE_MAX);
  });

  it('age is startAge + careerWeeks, and is NULL — not 0 — when the start age is unknown', () => {
    expect(groomAgeYears({ startAge: 20, careerWeeks: 0 })).toBe(20);
    expect(groomAgeYears({ startAge: 18, careerWeeks: 32 })).toBe(50);
    expect(groomAgeYears({ startAge: 24, careerWeeks: 41 })).toBe(65);
    // The distinction that matters: an unknown age must not read as "very young",
    // or a groom with no drawn start age would have its retirement postponed by up
    // to 24 game-years.
    expect(groomAgeYears({ startAge: null, careerWeeks: 40 })).toBeNull();
    expect(groomAgeYears({ careerWeeks: 40 })).toBeNull();
    expect(groomAgeYears(null)).toBeNull();
  });

  it('the wait from hire to retirement is 26 to 47 weekly passes — stated, not hidden', () => {
    // The honest consequence of the two bands, computed rather than asserted from
    // memory. It is the figure Equoria-ypb7d.1 requires be reported: still months
    // of real time, which is inherent to a year-per-week clock.
    const shortest = RETIREMENT_AGE_MIN - START_AGE_MAX;
    const longest = RETIREMENT_AGE_MAX - START_AGE_MIN;
    expect(shortest).toBe(26);
    expect(longest).toBe(47);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-ypb7d.1 — the start age is persisted, bounded and idempotent', () => {
  let user;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('persist');
    cleanup.add(
      () => prisma.groom.deleteMany({ where: { name: { startsWith: `${FIXTURE_PREFIX}-persist` } } }),
      'grooms',
    );
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('ensureStartAge draws once and every later call returns the same value', async () => {
    const groom = await makeGroom(user.id, 'persist-idem');
    expect(groom.startAge).toBeNull();

    const first = await ensureStartAge(prisma, groom.id);
    expect(first).toBeGreaterThanOrEqual(START_AGE_MIN);
    expect(first).toBeLessThanOrEqual(START_AGE_MAX);

    // Idempotent: the guarded conditional update no longer matches, so the second
    // call re-reads instead of drawing again. A second draw would be a silent
    // rejuvenation of a working groom.
    for (let i = 0; i < 5; i++) {
      expect(await ensureStartAge(prisma, groom.id)).toBe(first);
    }
    const row = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { startAge: true },
    });
    expect(row.startAge).toBe(first);
  });

  it('concurrent ensureStartAge calls agree on one value', async () => {
    const groom = await makeGroom(user.id, 'persist-race');
    const results = await Promise.all([
      ensureStartAge(prisma, groom.id),
      ensureStartAge(prisma, groom.id),
      ensureStartAge(prisma, groom.id),
      ensureStartAge(prisma, groom.id),
    ]);
    // Whoever wins the guarded update, every caller reports the persisted value.
    expect(new Set(results).size).toBe(1);
    const row = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { startAge: true },
    });
    expect(row.startAge).toBe(results[0]);
  });

  it('the DATABASE refuses a start age outside 18..24', async () => {
    const groom = await makeGroom(user.id, 'persist-check');
    // The `grooms_start_age_range` CHECK constraint from migration
    // 20260909120000_ypb7d_groom_age_and_engagement. Enforced in the database and
    // not only in the draw, so widening the band in one place without the other
    // produces a write error rather than a silently wider distribution.
    //
    // WHY NOT `.rejects.toThrow()` (it was that until 2026-09-11, task 27):
    //   1. It reported "Received function did not throw" for a promise that DID
    //      reject. Measured under `backend/jest.config.mjs` — the config the
    //      authoritative sharded profile runs — as the FIRST file in a fresh
    //      process, so no neighbouring suite is involved: the rejection arrives
    //      with `instanceof Error === false` and `@jest/expect-utils`'s
    //      `isError()` false, because `packages/database` evaluates in a
    //      different V8 realm from this file and Prisma's own
    //      `Symbol.toStringTag` denies `isError` its `[object Error]` fast path.
    //      `createMatcher` then leaves `thrown = null` and prints DID_NOT_THROW.
    //   2. It accepted ANY rejection, so it would have passed if the update had
    //      failed for a reason that has nothing to do with this constraint.
    // Both are fixed by asserting the refusal's own data. See
    // `backend/__tests__/helpers/expectPrismaRejection.mjs`. SQLSTATE 23514 is
    // PostgreSQL's check_violation; Prisma 6.8.2 maps it to no P-code, so the
    // helper reads the connector's passthrough of Postgres's own text.
    // Proven by plant: pointing either update at a non-existent groom id makes it
    // fail on P2025 instead, and this assertion fails
    // (`Expected "23514 on grooms_start_age_range", Received "P2025"`) where
    // `.rejects.toThrow()` would have passed.
    const refusedOutsideBand = '23514 on grooms_start_age_range';
    expect(await prismaRejectionOf(prisma.groom.update({ where: { id: groom.id }, data: { startAge: 17 } }))).toBe(
      refusedOutsideBand,
    );
    expect(await prismaRejectionOf(prisma.groom.update({ where: { id: groom.id }, data: { startAge: 25 } }))).toBe(
      refusedOutsideBand,
    );
    // The ends of the band are accepted, so the constraint is inclusive.
    await prisma.groom.update({ where: { id: groom.id }, data: { startAge: 18 } });
    await prisma.groom.update({ where: { id: groom.id }, data: { startAge: 24 } });
    const row = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { startAge: true },
    });
    expect(row.startAge).toBe(24);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-ypb7d.1 — both hire paths give a groom an age', () => {
  let user;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('hire');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: user.id } }), 'ledger rows');
    cleanup.add(
      () =>
        prisma.staffMarketplaceState.deleteMany({
          where: { userId: user.id },
        }),
      'marketplace state',
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'grooms');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('direct hire persists a start age in 18..24, and the groom is NOT age 0', async () => {
    const res = fakeRes();
    await hireGroom(
      {
        user: { id: user.id },
        body: {
          name: `${FIXTURE_PREFIX}-hire-direct-${tag()}`,
          speciality: 'foal_care',
          skill_level: 'novice',
          personality: 'gentle',
        },
      },
      res,
    );
    expect(res.statusCode).toBe(201);

    const groom = await prisma.groom.findUnique({
      where: { id: res.body.data.id },
      select: { startAge: true, careerWeeks: true },
    });
    expect(groom.startAge).toBeGreaterThanOrEqual(START_AGE_MIN);
    expect(groom.startAge).toBeLessThanOrEqual(START_AGE_MAX);
    // The whole point of the ruling: a freshly hired groom is an adult, not a
    // newborn. Pre-ypb7d their age was `careerWeeks`, which is 0 here.
    expect(groom.careerWeeks).toBe(0);
    expect(groomAgeYears(groom)).toBeGreaterThanOrEqual(START_AGE_MIN);
  });

  it('marketplace hire persists a start age too, independent of the offer experience', async () => {
    const refreshRes = fakeRes();
    await refreshMarketplace({ user: { id: user.id }, body: { force: false } }, refreshRes);
    expect(refreshRes.statusCode).toBe(200);
    const offers = refreshRes.body.data.grooms;
    expect(offers.length).toBeGreaterThan(0);

    // Pick the most experienced offer available. The generator emits `experience`
    // in YEARS by skill tier (novice 1-3 … master 15-20), and the start age must NOT
    // be derived from it: tying the two would make a master groom systematically
    // older and so systematically closer to retiring, which is precisely the
    // merit-based influence the owner's addendum forbids.
    const offer = offers.reduce((best, o) => (o.experience > best.experience ? o : best), offers[0]);

    const res = fakeRes();
    await hireFromMarketplace({ user: { id: user.id }, body: { marketplaceId: offer.marketplaceId } }, res);
    expect(res.statusCode).toBe(201);

    const groom = await prisma.groom.findUnique({
      where: { id: res.body.data.groom.id },
      select: { startAge: true, careerWeeks: true, experience: true },
    });
    expect(groom.startAge).toBeGreaterThanOrEqual(START_AGE_MIN);
    expect(groom.startAge).toBeLessThanOrEqual(START_AGE_MAX);
    expect(groom.careerWeeks).toBe(0);
    // Whatever the tier's experience is, the start age stays inside the flat band.
    expect(groom.experience).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-ypb7d.1 — retirement compares AGE, and only chance decides when', () => {
  const FIXTURE_START_AGE = 20;
  let user;
  let horse;
  // A groom this suite RELEASES, so the free-agent pool is provably non-empty when the
  // hiding audit walks it. See the audit case at the bottom for why that matters.
  let pooledGroom;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('retire');
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${FIXTURE_PREFIX}-retire-horse-${tag()}`,
        sex: 'Filly',
        dateOfBirth: new Date('2024-06-15'),
        age: 1,
        userId: user.id,
        healthStatus: 'Excellent',
      },
    });

    // Equoria-ypb7d.3 fix round 1 (F3): a groom in the grooms-for-hire pool — a free
    // agent (`userId: null`) WITH a closed engagement, which is what
    // `FREE_AGENT_WHERE` requires. Without it the hiding audit below walked an empty
    // array and asserted nothing, which is exactly how it stayed green with the
    // defect restored.
    pooledGroom = await prisma.groom.create({
      data: {
        name: `${FIXTURE_PREFIX}-retire-pooled-${tag()}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        startAge: FIXTURE_START_AGE,
        userId: null,
      },
    });
    await prisma.groomEngagement.create({
      data: {
        groomId: pooledGroom.id,
        userId: user.id,
        endedAt: new Date('2026-03-09T09:00:00.000Z'),
        endReason: 'fee_unpaid',
      },
    });

    // `userId` is NULL on the pooled groom, so the by-user sweep below cannot find it.
    // Delete it by id, before the user its closed engagement references.
    cleanup.add(
      () => prisma.groomEngagement.deleteMany({ where: { groomId: pooledGroom?.id } }),
      'pooled groom engagement',
    );
    cleanup.add(() => prisma.groom.delete({ where: { id: pooledGroom?.id } }), 'pooled groom');
    cleanup.add(() => prisma.groomAssignmentLog.deleteMany({ where: { horseId: horse.id } }), 'assignment logs');
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: user.id } }), 'notifications');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'grooms');
    cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('at the drawn age it retires; one year short it does not', async () => {
    const groom = await makeGroom(user.id, 'retire-exact', { startAge: FIXTURE_START_AGE });
    const retirementAge = await ensureRetirementSchedule(prisma, groom.id);

    // One year short in AGE. Pre-ypb7d this was `retirementAge - 1` careerWeeks,
    // which with a start age of 20 is twenty years past the line.
    await prisma.groom.update({
      where: { id: groom.id },
      data: { careerWeeks: retirementAge - FIXTURE_START_AGE - 1 },
    });
    expect(await checkRetirementEligibility(groom.id)).toEqual({
      eligible: false,
      reason: 'not_eligible',
      mandatory: false,
    });

    // Exactly on it.
    await prisma.groom.update({
      where: { id: groom.id },
      data: { careerWeeks: retirementAge - FIXTURE_START_AGE },
    });
    expect(await checkRetirementEligibility(groom.id)).toEqual({
      eligible: true,
      reason: 'age',
      mandatory: true,
    });
  });

  it('a groom with a schedule but NO start age is not retired — unknown is not old', async () => {
    const groom = await makeGroom(user.id, 'retire-unknown', { careerWeeks: 99 });
    await ensureRetirementSchedule(prisma, groom.id);
    // careerWeeks 99 is past every possible retirement age. Under the pre-ypb7d
    // comparison this groom retires; under the age comparison its age is unknown,
    // and refusing to act on an unknown age is the safe direction to fail.
    expect(await checkRetirementEligibility(groom.id)).toEqual({
      eligible: false,
      reason: 'age_unknown',
      mandatory: false,
    });
  });

  it('level, experience and assignment count do NOT bring retirement forward', async () => {
    // "Math.random determines when they retire between 50-65 years old. That is
    // all." A groom with every merit signal maxed, at age 25, must not retire.
    const groom = await makeGroom(user.id, 'retire-merit', {
      startAge: FIXTURE_START_AGE,
      careerWeeks: 5, // age 25
      level: 10,
      experience: 5000,
      skillLevel: 'master',
    });
    await ensureRetirementSchedule(prisma, groom.id);

    for (let i = 0; i < 12; i++) {
      await prisma.groomAssignmentLog.create({
        data: { groomId: groom.id, horseId: horse.id },
      });
    }

    expect(await checkRetirementEligibility(groom.id)).toEqual({
      eligible: false,
      reason: 'not_eligible',
      mandatory: false,
    });
  });

  it('the weekly pass draws a start age for a groom that predates this story', async () => {
    // This is the reason migration 20260909120000 performs no backfill: the pass
    // fills the column in idempotently, exactly as Equoria-m9lz1 did for the
    // hidden retirement age.
    const legacy = await makeGroom(user.id, 'retire-legacy', { careerWeeks: 3 });
    expect(legacy.startAge).toBeNull();

    const result = await processWeeklyCareerProgression(user.id);
    expect(result.errors).toEqual([]);
    expect(result.aged).toBeGreaterThanOrEqual(1);

    const row = await prisma.groom.findUnique({
      where: { id: legacy.id },
      select: { startAge: true, careerWeeks: true, retired: true },
    });
    expect(row.startAge).toBeGreaterThanOrEqual(START_AGE_MIN);
    expect(row.startAge).toBeLessThanOrEqual(START_AGE_MAX);
    // One year per pass: the counter advanced by exactly one, so the age did.
    expect(row.careerWeeks).toBe(4);
    expect(row.retired).toBe(false);
  });

  it('the weekly pass retires the groom whose AGE reaches its drawn age, in that week', async () => {
    const groom = await makeGroom(user.id, 'retire-pass', { startAge: FIXTURE_START_AGE });
    const retirementAge = await ensureRetirementSchedule(prisma, groom.id);
    // One year short, so the pass's single increment carries it over the line —
    // "the week they retire".
    await prisma.groom.update({
      where: { id: groom.id },
      data: { careerWeeks: retirementAge - FIXTURE_START_AGE - 1 },
    });

    const result = await processWeeklyCareerProgression(user.id);
    expect(result.errors).toEqual([]);
    expect(result.retirements.some(r => r.groomId === groom.id)).toBe(true);

    const row = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { retired: true, retirementReason: true, careerWeeks: true, startAge: true },
    });
    expect(row.retired).toBe(true);
    expect(row.retirementReason).toBe('age');
    // The groom retired at its drawn age, in the ruling's band.
    expect(row.startAge + row.careerWeeks).toBe(retirementAge);
    expect(retirementAge).toBeGreaterThanOrEqual(RETIREMENT_AGE_MIN);
    expect(retirementAge).toBeLessThanOrEqual(RETIREMENT_AGE_MAX);
  });

  it('the hidden retirement age is still absent from the new free-agent pool read', async () => {
    // Equoria-m9lz1's guarantee must not regress: the ORDINARY age may be visible,
    // the RETIREMENT age may not. This story added one player-facing read, so this
    // story audits it.
    const res = fakeRes();
    await listFreeAgentGrooms({ user: { id: user.id }, query: { limit: '100' } }, res);
    expect(res.statusCode).toBe(200);

    // Equoria-ypb7d.3 fix round 1 (F3) — THE ASSERTION THAT MAKES THE REST MEAN
    // ANYTHING. The first version of this case walked `res.body` for forbidden keys
    // without ever checking there was a groom in it. `FREE_AGENT_WHERE` matched ZERO
    // rows in the shared database, so it walked
    // `{ data: { grooms: [], total: 0, … } }` — and adding `retirementSchedule: true`
    // back to `listFreeAgents`'s select left it green. A key-walk over an empty
    // collection is not a guard; it is a guard-shaped no-op. So: there must be a
    // groom, and it must be the one this suite released, or this case fails before it
    // can pretend to pass.
    const returned = res.body.data.grooms;
    expect(Array.isArray(returned)).toBe(true);
    expect(returned.length).toBeGreaterThan(0);
    expect(returned.map(g => g.id)).toContain(pooledGroom.id);
    // And the walked object really is a groom, not just an envelope: the forbidden
    // keys below are asserted absent from a payload that provably carries groom fields.
    const mine = returned.find(g => g.id === pooledGroom.id);
    expect(mine.name).toBe(pooledGroom.name);
    expect(mine.skillLevel).toBe('novice');

    const keys = new Set();
    const walk = value => {
      if (Array.isArray(value)) {
        value.forEach(walk);
      } else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
          keys.add(k);
          walk(v);
        }
      }
    };
    walk(res.body);
    // Key NAMES, not values: a bare integer in 50..65 could coincide with a level
    // or a price, so a value scan would be both flaky and weak. Prisma can only
    // emit the age as `retirementAge` or nested under `retirementSchedule`.
    expect(keys.has('retirementAge')).toBe(false);
    expect(keys.has('retirementSchedule')).toBe(false);
  });
});
