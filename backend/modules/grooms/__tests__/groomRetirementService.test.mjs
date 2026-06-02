/**
 * groomRetirementService branch-coverage tests (Equoria-jkht coverage sprint).
 *
 * Pure-path tests (non-existent groomId → throws):
 *   incrementCareerWeeks — throws for non-existent groom
 *   checkRetirementEligibility — throws for non-existent groom
 *
 * DB-fixture branch coverage (checkRetirementEligibility):
 *   retired=true → 'already_retired'
 *   careerWeeks >= 104 → MANDATORY_CAREER_LIMIT (mandatory=true)
 *   level >= 10 → EARLY_LEVEL_CAP
 *   assignmentLogs.length >= 12 → EARLY_ASSIGNMENT_LIMIT
 *   careerWeeks=103 → noticeRequired=true, not_eligible (1 week left)
 *   careerWeeks=0, level=1 → not_eligible (noticeRequired=false)
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
  getGroomsApproachingRetirement,
  getRetirementStatistics,
  processWeeklyCareerProgression,
} from '../services/groomRetirementService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. A cleanup delete that fails must
// fail the suite (not be swallowed by a silent no-op catch arm) so a leaked
// fixture surfaces at the source instead of tripping a canonical sentinel later.
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

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
  let grsGroomMandatory; // careerWeeks=104 → MANDATORY_CAREER_LIMIT
  let grsGroomLevelCap; // level=10, careerWeeks=5 → EARLY_LEVEL_CAP
  let grsGroomAssignmentLimit; // 12 assignment logs → EARLY_ASSIGNMENT_LIMIT
  let grsGroomNotice; // careerWeeks=103 → noticeRequired=true, not_eligible
  let grsGroomNormal; // careerWeeks=0, level=1 → not_eligible, noticeRequired=false
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
        careerWeeks: CAREER_CONSTANTS.MANDATORY_RETIREMENT_WEEKS, // 104
        userId: grsUser.id,
      },
    });

    grsGroomLevelCap = await prisma.groom.create({
      data: {
        name: `TestFixture-GRS-LevelCap-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        level: CAREER_CONSTANTS.EARLY_RETIREMENT_LEVEL, // 10
        careerWeeks: 5, // not at mandatory limit
        userId: grsUser.id,
      },
    });

    grsGroomAssignmentLimit = await prisma.groom.create({
      data: {
        name: `TestFixture-GRS-AssignLimit-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        level: 1,
        careerWeeks: 10, // below mandatory and level cap
        userId: grsUser.id,
      },
    });

    // Create 12 GroomAssignmentLogs for the EARLY_ASSIGNMENT_LIMIT branch
    for (let i = 0; i < CAREER_CONSTANTS.EARLY_RETIREMENT_ASSIGNMENTS; i++) {
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
        careerWeeks: CAREER_CONSTANTS.MANDATORY_RETIREMENT_WEEKS - CAREER_CONSTANTS.RETIREMENT_NOTICE_WEEKS, // 103
        userId: grsUser.id,
      },
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
    cleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GRS-' } } }), 'grooms');
    cleanup.add(() => prisma.horse.delete({ where: { id: grsHorse?.id } }), 'horse');
    cleanup.add(() => prisma.user.delete({ where: { id: grsUser?.id } }), 'user');
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  it('checkRetirementEligibility: retired=true → already_retired', async () => {
    const result = await checkRetirementEligibility(grsGroomRetired.id);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('already_retired');
    expect(result.weeksUntilRetirement).toBe(0);
    expect(result.noticeRequired).toBe(false);
  });

  it('checkRetirementEligibility: careerWeeks=104 → MANDATORY_CAREER_LIMIT', async () => {
    const result = await checkRetirementEligibility(grsGroomMandatory.id);
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(RETIREMENT_REASONS.MANDATORY_CAREER_LIMIT);
    expect(result.mandatory).toBe(true);
    expect(result.weeksUntilRetirement).toBe(0);
  });

  it('checkRetirementEligibility: level=10 → EARLY_LEVEL_CAP', async () => {
    const result = await checkRetirementEligibility(grsGroomLevelCap.id);
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(RETIREMENT_REASONS.EARLY_LEVEL_CAP);
    expect(result.mandatory).toBe(false);
  });

  it('checkRetirementEligibility: 12 assignment logs → EARLY_ASSIGNMENT_LIMIT', async () => {
    const result = await checkRetirementEligibility(grsGroomAssignmentLimit.id);
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(RETIREMENT_REASONS.EARLY_ASSIGNMENT_LIMIT);
    expect(result.mandatory).toBe(false);
  });

  it('checkRetirementEligibility: careerWeeks=103 → noticeRequired=true, not_eligible', async () => {
    // weeksUntilMandatory = 104-103 = 1 ≤ RETIREMENT_NOTICE_WEEKS (1) → noticeRequired=true
    const result = await checkRetirementEligibility(grsGroomNotice.id);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('not_eligible');
    expect(result.noticeRequired).toBe(true);
    expect(result.weeksUntilRetirement).toBe(1);
  });

  it('checkRetirementEligibility: normal groom → not_eligible, noticeRequired=false', async () => {
    const result = await checkRetirementEligibility(grsGroomNormal.id);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('not_eligible');
    expect(result.noticeRequired).toBe(false);
    expect(result.weeksUntilRetirement).toBe(CAREER_CONSTANTS.MANDATORY_RETIREMENT_WEEKS);
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
    expect(result.retirementTimestamp).toBeInstanceOf(Date);
    expect(typeof result.assignmentCount).toBe('number');
    expect(typeof result.synergyRecords).toBe('number');
    // cleanup handled by afterAll groom.deleteMany startsWith 'TestFixture-GRS-'
  });

  it('CAREER_CONSTANTS and RETIREMENT_REASONS exports are correctly shaped', () => {
    expect(CAREER_CONSTANTS.MANDATORY_RETIREMENT_WEEKS).toBe(104);
    expect(CAREER_CONSTANTS.EARLY_RETIREMENT_LEVEL).toBe(10);
    expect(CAREER_CONSTANTS.EARLY_RETIREMENT_ASSIGNMENTS).toBe(12);
    expect(RETIREMENT_REASONS.MANDATORY_CAREER_LIMIT).toBe('mandatory_career_limit');
    expect(RETIREMENT_REASONS.VOLUNTARY).toBe('voluntary');
  });

  it('getGroomsApproachingRetirement: grsGroomNotice (careerWeeks=103) triggers map callback (lines 230-231)', async () => {
    // noticeThreshold = 104 - 1 = 103, grsGroomNotice.careerWeeks = 103 → appears in result
    const result = await getGroomsApproachingRetirement(grsUser.id);
    expect(Array.isArray(result)).toBe(true);
    const notice = result.find(g => g.id === grsGroomNotice.id);
    expect(notice).toBeDefined();
    expect(notice.eligibility).toBeDefined();
    expect(notice.eligibility.noticeRequired).toBe(true);
  });

  it('getRetirementStatistics: returns object with required numeric keys', async () => {
    const result = await getRetirementStatistics(grsUser.id);
    expect(typeof result.activeGrooms).toBe('number');
    expect(typeof result.retiredGrooms).toBe('number');
    expect(typeof result.totalGrooms).toBe('number');
    expect(typeof result.approachingRetirement).toBe('number');
    expect(typeof result.retirementRate).toBe('number');
    expect(typeof result.averageCareerLength).toBe('number');
    expect(result.totalGrooms).toBe(result.activeGrooms + result.retiredGrooms);
  });
});

// ── processWeeklyCareerProgression branch coverage ────────────────────────────

describe('groomRetirementService — processWeeklyCareerProgression branch coverage (Equoria-rr7)', () => {
  let wcpUser;
  let wcpGroomNormal;
  let wcpGroomMandatory;
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
        careerWeeks: CAREER_CONSTANTS.MANDATORY_RETIREMENT_WEEKS,
        level: 1,
        isActive: true,
        userId: wcpUser.id,
      },
    });

    // Equoria-1ohys: fail-loud scoped cleanup. FK order — grooms (children of
    // user) before the user. Scoped by TestFixture-GRS-WCP- name-prefix / id;
    // never a bare deleteMany. These grooms own no Horse/AssignmentLog/synergy
    // fixtures, so no Cascade-child delete precedes them.
    cleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GRS-WCP-' } } }), 'grooms');
    cleanup.add(() => prisma.user.delete({ where: { id: wcpUser?.id } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('processWeeklyCareerProgression: userId scoped — increments normal groom + auto-retires mandatory groom (lines 311-377)', async () => {
    const result = await processWeeklyCareerProgression(wcpUser.id);
    // Both grooms processed (incremented)
    expect(result.processed).toBeGreaterThanOrEqual(2);
    // Mandatory groom auto-retired
    expect(result.retired).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(Array.isArray(result.retirements)).toBe(true);
    const mandatoryEntry = result.retirements.find(r => r.groomId === wcpGroomMandatory.id);
    expect(mandatoryEntry).toBeDefined();
    expect(mandatoryEntry.reason).toBe(RETIREMENT_REASONS.MANDATORY_CAREER_LIMIT);
    // Normal groom incremented to careerWeeks=1
    const updated = await prisma.groom.findUnique({ where: { id: wcpGroomNormal.id } });
    expect(updated.careerWeeks).toBe(1);
  });
});
