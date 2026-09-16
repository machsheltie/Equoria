/**
 * groomRetirementService branch-coverage tests (Equoria-jkht coverage sprint,
 * retargeted onto the Equoria-m9lz1 contract).
 *
 * WHY THIS FILE CHANGED (Equoria-m9lz1, owner ruling 2026-09-08)
 *   The contract these cases described no longer exists, and the change is
 *   deliberate rather than an accommodation of new code. Retirement used to fire
 *   on three triggers — a fixed 104 career weeks for everybody, level >= 10, and
 *   12+ assignment logs — and `checkRetirementEligibility` returned a
 *   `weeksUntilRetirement` countdown plus a `noticeRequired` one-week warning.
 *   Under the ruling ("Grooms retire automatically at a randomly selected age by
 *   the game… any time between age 50-65… not known until the week they retire")
 *   the trigger is ONE per-groom hidden age, and the countdown and the warning
 *   are exactly the disclosure the ruling forbids: a client that knows
 *   `careerWeeks` recovers the hidden age from either by subtraction. So the
 *   fixed threshold, the two early triggers, the countdown and the notice flag
 *   are all gone, and the cases that asserted them are replaced by cases that
 *   assert their ABSENCE. The new behaviour is covered end-to-end by
 *   groomRetirementGameDriven.integration.test.mjs and the closed player surface
 *   by groomRetirementEndpointClosed.integration.test.mjs.
 *
 * Pure-path tests (non-existent groomId → throws):
 *   incrementCareerWeeks — throws for non-existent groom
 *   checkRetirementEligibility — throws for non-existent groom
 *
 * DB-fixture branch coverage (checkRetirementEligibility):
 *   retired=true → 'already_retired'
 *   no schedule drawn → 'not_scheduled' (and no age is invented)
 *   careerWeeks >= its own hidden retirementAge → RETIREMENT_REASONS.AGE (mandatory=true)
 *   careerWeeks one short of it → not_eligible, and NO countdown field
 *   level >= 10 / 12+ assignment logs → NOT eligible any more (no early triggers)
 *
 * incrementCareerWeeks with real groom → careerWeeks+1
 * processRetirement non-eligible + !voluntary → throws
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  RETIREMENT_REASONS,
  CAREER_CONSTANTS,
  incrementCareerWeeks,
  checkRetirementEligibility,
  processRetirement,
  getRetirementStatistics,
} from '../services/groomRetirementService.mjs';
// Equoria-ypb7d.1: the weekly pass moved to its own service when the age model
// pushed groomRetirementService.mjs past the 600-line cap. Same function, same
// behaviour; only its file changed.
import { processWeeklyCareerProgression } from '../services/groomCareerProgressionService.mjs';
import { ensureRetirementSchedule, readRetirementAge } from '../services/groomRetirementScheduleService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

// Equoria-ypb7d.1: a groom's age is `startAge + careerWeeks`. Fixtures that need a
// groom of a known age fix the start age here rather than drawing one, so
// `careerWeeks = targetAge - FIXTURE_START_AGE` is exact. 20 sits inside the
// 18..24 band the `grooms_start_age_range` CHECK constraint enforces.
const FIXTURE_START_AGE = 20;
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. A cleanup delete that fails must
// fail the suite (not be swallowed by a silent no-op catch arm) so a leaked
// fixture surfaces at the source instead of tripping a canonical sentinel later.
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
// Equoria-m9lz1 fix round 2: realm-safe date assertion. `toBeInstanceOf(Date)`
// fails across the module realms --experimental-vm-modules creates, which is
// load-order dependent (green alone, red in a shard).
import { realDateOrReason } from '../../../__tests__/helpers/expectRealDate.mjs';

/**
 * Equoria-m9lz1 fix round 1 — a scoped-delete guard.
 *
 * `where: { userId: someUser?.id }` looks safe and is not: when the fixture
 * variable is undefined (a failed `beforeAll`, a reordered hook), Prisma DROPS an
 * `undefined` filter rather than matching nothing, so the cleanup silently becomes
 * a TABLE-WIDE `deleteMany()` — the exact thing CONTRIBUTING.md forbids, arriving
 * by accident at the moment the suite is already broken. Every id used in a
 * cleanup filter goes through this instead, so a missing fixture fails the
 * cleanup loudly (createCleanupTracker surfaces the throw) rather than deleting
 * another suite's rows.
 */
function requireFixtureId(value, label) {
  if (value === undefined || value === null || value === '') {
    throw new Error(
      `[groomRetirementService.test] refusing to run a cleanup with no ${label} — an undefined ` +
        'filter would widen this delete to the whole table',
    );
  }
  return value;
}

// ── Pure-path tests — non-existent groom ─────────────────────────────────────

describe('incrementCareerWeeks — non-existent groom', () => {
  it('throws when groomId does not exist', async () => {
    await expect(incrementCareerWeeks(999999999)).rejects.toThrow('not found');
  });
});

describe('checkRetirementEligibility — non-existent groom', () => {
  it('throws when groomId does not exist', async () => {
    await expect(checkRetirementEligibility(999999999)).rejects.toThrow('not found');
  });
});

// ── DB fixture branch coverage ────────────────────────────────────────────────

describe('groomRetirementService — DB fixture branch coverage (Equoria-jkht)', () => {
  let grsUser;
  let grsHorse; // needed for GroomAssignmentLog (horseId required)
  let grsGroomRetired; // retired=true → already_retired
  let grsGroomMandatory; // careerWeeks == its hidden retirementAge → AGE
  let grsGroomMandatoryAge; // that groom's drawn retirement age
  let grsGroomLevelCap; // level=10 → NOT eligible any more (Equoria-m9lz1)
  let grsGroomAssignmentLimit; // 12 assignment logs → NOT eligible any more
  let grsGroomNotice; // one tick short of its retirementAge → not_eligible, no countdown
  let grsGroomNoticeAge; // that groom's drawn retirement age
  let grsGroomNormal; // no schedule drawn → not_scheduled
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    grsUser = await prisma.user.create({
      data: {
        email: `grs-${ts}-${rand()}@test.com`,
        username: `grs${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GRS',
        lastName: 'Tester',
        money: 1000,
      },
    });

    grsHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-GRS-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: grsUser.id,
      },
    });

    grsGroomRetired = await prisma.groom.create({
      data: {
        name: `TestFixture-GRS-Retired-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        retired: true,
        userId: grsUser.id,
      },
    });

    grsGroomMandatory = await prisma.groom.create({
      data: {
        name: `TestFixture-GRS-Mandatory-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        // Equoria-ypb7d.1: a groom's age is `startAge + careerWeeks`, so a fixture
        // that wants a groom OF A GIVEN AGE must set both. FIXTURE_START_AGE is a
        // fixed value inside the 18..24 band the CHECK constraint enforces, so the
        // arithmetic below is deterministic rather than depending on a draw.
        startAge: FIXTURE_START_AGE,
        userId: grsUser.id,
      },
    });
    // Equoria-m9lz1: the threshold is this groom's OWN drawn age, not a shared
    // constant. Draw it, then park the groom exactly ON it — which after
    // Equoria-ypb7d.1 means `startAge + careerWeeks === retirementAge`.
    grsGroomMandatoryAge = await ensureRetirementSchedule(prisma, grsGroomMandatory.id);
    await prisma.groom.update({
      where: { id: grsGroomMandatory.id },
      data: { careerWeeks: grsGroomMandatoryAge - FIXTURE_START_AGE },
    });

    grsGroomLevelCap = await prisma.groom.create({
      data: {
        name: `TestFixture-GRS-LevelCap-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        level: 10, // was EARLY_RETIREMENT_LEVEL; no longer a retirement trigger
        startAge: FIXTURE_START_AGE,
        careerWeeks: 5, // age 25 — far below any retirement age
        userId: grsUser.id,
      },
    });
    await ensureRetirementSchedule(prisma, grsGroomLevelCap.id);

    grsGroomAssignmentLimit = await prisma.groom.create({
      data: {
        name: `TestFixture-GRS-AssignLimit-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        level: 1,
        startAge: FIXTURE_START_AGE,
        careerWeeks: 10, // age 30 — below every drawn retirement age
        userId: grsUser.id,
      },
    });

    await ensureRetirementSchedule(prisma, grsGroomAssignmentLimit.id);

    // 12 GroomAssignmentLogs — the count that USED to force early retirement.
    // Equoria-m9lz1 removed that trigger; the assertion below proves it.
    for (let i = 0; i < 12; i++) {
      await prisma.groomAssignmentLog.create({
        data: {
          groomId: grsGroomAssignmentLimit.id,
          horseId: grsHorse.id,
        },
      });
    }

    grsGroomNotice = await prisma.groom.create({
      data: {
        name: `TestFixture-GRS-Notice-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        level: 1,
        startAge: FIXTURE_START_AGE,
        userId: grsUser.id,
      },
    });
    // One tick short of its own hidden age: the last week it keeps working.
    grsGroomNoticeAge = await ensureRetirementSchedule(prisma, grsGroomNotice.id);
    await prisma.groom.update({
      where: { id: grsGroomNotice.id },
      data: { careerWeeks: grsGroomNoticeAge - FIXTURE_START_AGE - 1 },
    });

    grsGroomNormal = await prisma.groom.create({
      data: {
        name: `TestFixture-GRS-Normal-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        level: 1,
        careerWeeks: 0,
        userId: grsUser.id,
      },
    });

    // Equoria-1ohys: fail-loud scoped cleanup. FK order — GroomAssignmentLog
    // (Cascade child of groom+horse) before grooms; grooms + horse (children of
    // user; Horse.userId is Restrict) before the user. Scoped by id-in /
    // TestFixture- name-prefix / id; never a bare deleteMany. The name-prefix
    // groom sweep covers grsGroom* AND the in-test tempGroom (TestFixture-GRS-
    // VolRetire-*); the WCP suite uses the narrower TestFixture-GRS-WCP- prefix
    // and its own tracker, so the two suites do not delete each other's rows.
    cleanup.add(() => {
      const groomIds = [
        grsGroomRetired?.id,
        grsGroomMandatory?.id,
        grsGroomLevelCap?.id,
        grsGroomAssignmentLimit?.id,
        grsGroomNotice?.id,
        grsGroomNormal?.id,
      ].filter(Boolean);
      return prisma.groomAssignmentLog.deleteMany({ where: { groomId: { in: groomIds } } });
    }, 'groomAssignmentLog');
    // Equoria-m9lz1: GroomRetirementSchedule is a Cascade child of groom, and
    // Notification is a Cascade child of user, but both are deleted explicitly
    // and narrowly so a leak surfaces here rather than as a mystery row.
    cleanup.add(() => {
      const groomIds = [
        grsGroomRetired?.id,
        grsGroomMandatory?.id,
        grsGroomLevelCap?.id,
        grsGroomAssignmentLimit?.id,
        grsGroomNotice?.id,
        grsGroomNormal?.id,
      ].filter(Boolean);
      return prisma.groomRetirementSchedule.deleteMany({ where: { groomId: { in: groomIds } } });
    }, 'groomRetirementSchedule');
    cleanup.add(
      () =>
        prisma.notification.deleteMany({
          where: { userId: requireFixtureId(grsUser?.id, 'grsUser.id') },
        }),
      'notifications',
    );
    cleanup.add(
      () =>
        prisma.groomAssignment.deleteMany({
          where: { userId: requireFixtureId(grsUser?.id, 'grsUser.id') },
        }),
      'groomAssignments',
    );
    cleanup.add(
      () =>
        prisma.groomLegacyLog.deleteMany({
          where: { retiredGroom: { userId: requireFixtureId(grsUser?.id, 'grsUser.id') } },
        }),
      'legacy logs',
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GRS-' } } }), 'grooms');
    cleanup.add(() => prisma.horse.delete({ where: { id: grsHorse?.id } }), 'horse');
    cleanup.add(() => prisma.user.delete({ where: { id: grsUser?.id } }), 'user');
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  it('checkRetirementEligibility: retired=true → already_retired', async () => {
    const result = await checkRetirementEligibility(grsGroomRetired.id);
    expect(result).toEqual({ eligible: false, reason: 'already_retired', mandatory: false });
  });

  it('checkRetirementEligibility: careerWeeks at its own hidden age → AGE, mandatory', async () => {
    const result = await checkRetirementEligibility(grsGroomMandatory.id);
    expect(result).toEqual({
      eligible: true,
      reason: RETIREMENT_REASONS.AGE,
      mandatory: true,
    });
    // The threshold really was per-groom, drawn in the ruling's band.
    expect(grsGroomMandatoryAge).toBeGreaterThanOrEqual(CAREER_CONSTANTS.RETIREMENT_AGE_MIN);
    expect(grsGroomMandatoryAge).toBeLessThanOrEqual(CAREER_CONSTANTS.RETIREMENT_AGE_MAX);
  });

  it('checkRetirementEligibility: level=10 is NOT a retirement trigger any more', async () => {
    // Pre-m9lz1 this returned { eligible: true, reason: 'early_level_cap' }.
    // The ruling retires grooms by AGE; retiring a level-10 groom at career week
    // 5 contradicts "any time between age 50-65".
    const result = await checkRetirementEligibility(grsGroomLevelCap.id);
    expect(result).toEqual({ eligible: false, reason: 'not_eligible', mandatory: false });
  });

  it('checkRetirementEligibility: 12 assignment logs is NOT a retirement trigger any more', async () => {
    // Pre-m9lz1 this returned { eligible: true, reason: 'early_assignment_limit' }.
    // A dozen re-assignments is ordinary play, so this trigger fired long before
    // age 50 and would have made the ruling's age rule almost never fire.
    const result = await checkRetirementEligibility(grsGroomAssignmentLimit.id);
    expect(result).toEqual({ eligible: false, reason: 'not_eligible', mandatory: false });
  });

  it('checkRetirementEligibility: one tick short of its age → not_eligible, and NO countdown', async () => {
    const result = await checkRetirementEligibility(grsGroomNotice.id);
    expect(result).toEqual({ eligible: false, reason: 'not_eligible', mandatory: false });
    // The three fields that WERE the disclosure. A client knows careerWeeks, so
    // any of them hands it the hidden age by subtraction.
    expect(result).not.toHaveProperty('weeksUntilRetirement');
    expect(result).not.toHaveProperty('noticeRequired');
    expect(result).not.toHaveProperty('retirementAge');
  });

  it('checkRetirementEligibility: groom with no drawn schedule → not_scheduled', async () => {
    expect(await readRetirementAge(prisma, grsGroomNormal.id)).toBeNull();
    const result = await checkRetirementEligibility(grsGroomNormal.id);
    expect(result).toEqual({ eligible: false, reason: 'not_scheduled', mandatory: false });
  });

  it('incrementCareerWeeks: increments careerWeeks by 1', async () => {
    const updated = await incrementCareerWeeks(grsGroomNormal.id);
    expect(updated.careerWeeks).toBe(1);
  });

  it('processRetirement: throws when groom not eligible and !voluntary', async () => {
    // grsGroomNormal is not eligible for retirement and voluntary=false (default)
    // After incrementCareerWeeks above, careerWeeks=1 — still not eligible
    await expect(processRetirement(grsGroomNormal.id, null, false)).rejects.toThrow('not eligible for retirement');
  });

  it('processRetirement: voluntary=true retires groom successfully (lines 167-198)', async () => {
    const ts = Date.now();
    const tempGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GRS-VolRetire-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        careerWeeks: 0,
        level: 1,
        userId: grsUser.id,
      },
    });
    const result = await processRetirement(tempGroom.id, RETIREMENT_REASONS.VOLUNTARY, true);
    expect(result.groom.retired).toBe(true);
    expect(result.retirementReason).toBe(RETIREMENT_REASONS.VOLUNTARY);
    // Realm-independent — see __tests__/helpers/expectRealDate.mjs. Do not
    // replace with toBeInstanceOf(Date).
    expect(realDateOrReason(result.retirementTimestamp)).toBe('valid date');
    expect(typeof result.assignmentCount).toBe('number');
    expect(typeof result.synergyRecords).toBe('number');
    // cleanup handled by afterAll groom.deleteMany startsWith 'TestFixture-GRS-'
  });

  it('CAREER_CONSTANTS and RETIREMENT_REASONS exports are correctly shaped', () => {
    // Equoria-m9lz1: the fixed thresholds are gone; the band from the owner's
    // ruling replaces them. The DB CHECK constraint
    // `groom_retirement_schedules_age_range` enforces the same numbers, so
    // widening either without the other is a write error, not a silent change.
    expect(CAREER_CONSTANTS.RETIREMENT_AGE_MIN).toBe(50);
    expect(CAREER_CONSTANTS.RETIREMENT_AGE_MAX).toBe(65);
    expect(CAREER_CONSTANTS).not.toHaveProperty('MANDATORY_RETIREMENT_WEEKS');
    expect(CAREER_CONSTANTS).not.toHaveProperty('RETIREMENT_NOTICE_WEEKS');
    expect(RETIREMENT_REASONS.AGE).toBe('age');
    // Retained for historical Groom.retirementReason rows only.
    expect(RETIREMENT_REASONS.MANDATORY_CAREER_LIMIT).toBe('mandatory_career_limit');
    expect(RETIREMENT_REASONS.VOLUNTARY).toBe('voluntary');
  });

  it('getRetirementStatistics: returns object with required numeric keys and NO approaching count', async () => {
    const result = await getRetirementStatistics(grsUser.id);
    expect(typeof result.activeGrooms).toBe('number');
    expect(typeof result.retiredGrooms).toBe('number');
    expect(typeof result.totalGrooms).toBe('number');
    expect(typeof result.retirementRate).toBe('number');
    expect(typeof result.averageCareerYears).toBe('number');
    expect(result.totalGrooms).toBe(result.activeGrooms + result.retiredGrooms);
    // Equoria-m9lz1: a count of grooms about to retire is still a disclosure —
    // it tells the player one of them goes this week.
    expect(result).not.toHaveProperty('approachingRetirement');
  });
});

// ── processWeeklyCareerProgression branch coverage ────────────────────────────

describe('groomRetirementService — processWeeklyCareerProgression branch coverage (Equoria-rr7)', () => {
  let wcpUser;
  let wcpGroomNormal;
  let wcpGroomMandatory;
  let wcpGroomMandatoryAge;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    wcpUser = await prisma.user.create({
      data: {
        email: `wcp-${ts}-${rand()}@test.com`,
        username: `wcp${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'WCP',
        lastName: 'Tester',
        money: 1000,
      },
    });

    wcpGroomNormal = await prisma.groom.create({
      data: {
        name: `TestFixture-GRS-WCP-Normal-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        careerWeeks: 0,
        level: 1,
        isActive: true,
        userId: wcpUser.id,
      },
    });

    wcpGroomMandatory = await prisma.groom.create({
      data: {
        name: `TestFixture-GRS-WCP-Mandatory-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        level: 1,
        isActive: true,
        // Equoria-ypb7d.1: fixed so the arithmetic below is exact. wcpGroomNormal
        // deliberately leaves it NULL, which exercises the pass's `ensureStartAge`
        // backstop for grooms that predate this story.
        startAge: FIXTURE_START_AGE,
        userId: wcpUser.id,
      },
    });
    // Equoria-m9lz1: park this groom one tick short of its OWN hidden retirement
    // age, so the pass's increment carries it over the line — "the week they
    // retire". Pre-m9lz1 the fixture used the shared constant 104.
    // Equoria-ypb7d.1: "one tick short" is now one tick short in AGE, and age is
    // `startAge + careerWeeks`.
    wcpGroomMandatoryAge = await ensureRetirementSchedule(prisma, wcpGroomMandatory.id);
    await prisma.groom.update({
      where: { id: wcpGroomMandatory.id },
      data: { careerWeeks: wcpGroomMandatoryAge - FIXTURE_START_AGE - 1 },
    });

    // Equoria-1ohys: fail-loud scoped cleanup. FK order — schedules and
    // notifications (Cascade children, deleted explicitly so a leak is loud),
    // then grooms (children of user), then the user. Scoped by
    // TestFixture-GRS-WCP- name-prefix / id; never a bare deleteMany. These
    // grooms own no Horse/AssignmentLog/synergy fixtures.
    cleanup.add(() => {
      const groomIds = [wcpGroomNormal?.id, wcpGroomMandatory?.id].filter(Boolean);
      return prisma.groomRetirementSchedule.deleteMany({ where: { groomId: { in: groomIds } } });
    }, 'groomRetirementSchedule');
    cleanup.add(
      () =>
        prisma.notification.deleteMany({
          where: { userId: requireFixtureId(wcpUser?.id, 'wcpUser.id') },
        }),
      'notifications',
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GRS-WCP-' } } }), 'grooms');
    cleanup.add(() => prisma.user.delete({ where: { id: wcpUser?.id } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('processWeeklyCareerProgression: userId scoped — increments normal groom + auto-retires the groom that reached its age', async () => {
    const result = await processWeeklyCareerProgression(wcpUser.id);
    // Both grooms processed (incremented)
    expect(result.processed).toBeGreaterThanOrEqual(2);
    // The groom that reached its hidden age auto-retired
    expect(result.retired).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(Array.isArray(result.retirements)).toBe(true);
    const mandatoryEntry = result.retirements.find(r => r.groomId === wcpGroomMandatory.id);
    expect(mandatoryEntry).toBeDefined();
    // Equoria-m9lz1: the reason is AGE, not the retired MANDATORY_CAREER_LIMIT.
    expect(mandatoryEntry.reason).toBe(RETIREMENT_REASONS.AGE);
    // Equoria-maeba: the pass reports the AGE the groom retired at, in years.
    expect(mandatoryEntry.ageYears).toBe(wcpGroomMandatoryAge);
    // Normal groom incremented to careerWeeks=1 and given a schedule of its own
    const updated = await prisma.groom.findUnique({ where: { id: wcpGroomNormal.id } });
    expect(updated.careerWeeks).toBe(1);
    // Equoria-ypb7d.1: the pass also drew this groom's START AGE, because it had
    // none — the backstop that lets the migration ship with no backfill. The value
    // is inside the ruling's band, and the groom's age is now startAge + 1.
    expect(updated.startAge).toBeGreaterThanOrEqual(18);
    expect(updated.startAge).toBeLessThanOrEqual(24);
    expect(result.aged).toBeGreaterThanOrEqual(1);
    expect(updated.retired).toBe(false);
    const normalAge = await readRetirementAge(prisma, wcpGroomNormal.id);
    expect(normalAge).toBeGreaterThanOrEqual(CAREER_CONSTANTS.RETIREMENT_AGE_MIN);
    expect(normalAge).toBeLessThanOrEqual(CAREER_CONSTANTS.RETIREMENT_AGE_MAX);
    // The retirement announced itself to the groom's own user, in its own
    // transaction (see groomRetirementGameDriven.integration.test.mjs).
    expect(await prisma.notification.count({ where: { userId: wcpUser.id, type: 'groom_retired' } })).toBe(1);
  });
});
