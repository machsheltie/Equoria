/**
 * groomProgressionService unit tests (Equoria-rr7 coverage sprint).
 *
 * Async functions: DB fixture — user + groom + horse.
 *
 * Owner ruling 2026-10-21 (Equoria-dea06): grooms are fixed NPCs that never
 * earn XP and keep their generated level. Old contract: this file also pinned
 * calculateGroomLevel (the XP-to-level curve) and awardGroomXP (shape, level-up
 * and fallback branches). Both functions were removed with the ruling, so their
 * blocks here were removed too; staffAreFixedNpcs.integration.test.mjs pins the
 * new contract.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { updateGroomSynergy, logGroomAssignment, getGroomProfile } from '../services/groomProgressionService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. Previously each afterAll swallowed
// its prisma deletes with a silent no-op catch arm, so a delete failure left
// fixtures leaked into the canonical DB while the suite stayed green. The
// tracker runs every scoped delete in FK order and throws loudly if any fail.
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

let user;
let horse;
let groom;
const topCleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `groomprogress-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `groomprogress${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'GroomProgress',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `TestFixture-GroomProgressHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    }),
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-GroomProgressGroom-${Date.now()}`,
      speciality: 'foalCare',
      personality: 'gentle',
      userId: user.id,
    },
  });
}, 30000);

// FK order: groom (Groom.userId Restrict) + horse (Horse.userId Restrict) → user.
afterAll(() => {
  topCleanup.add(() => prisma.groom.delete({ where: { id: groom.id } }), 'groom');
  topCleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  topCleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  return topCleanup.run();
}, 30000);

// ── updateGroomSynergy ────────────────────────────────────────────────────────

describe('updateGroomSynergy', () => {
  it('returns error object for non-existent groom', async () => {
    const result = await updateGroomSynergy(999999999, horse.id, 'assignment', 1);
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
  });

  it('returns synergy result for valid groom+horse', async () => {
    const result = await updateGroomSynergy(groom.id, horse.id, 'assignment', 1);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ── logGroomAssignment ────────────────────────────────────────────────────────

describe('logGroomAssignment', () => {
  it('returns log entry for valid groom+horse assign action', async () => {
    const result = await logGroomAssignment(groom.id, horse.id, 'assign', {});
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ── getGroomProfile ───────────────────────────────────────────────────────────

describe('getGroomProfile', () => {
  it('returns error object for non-existent groom', async () => {
    const result = await getGroomProfile(999999999);
    expect(result.success).toBe(false);
  });

  it('returns profile shape for valid groom', async () => {
    const result = await getGroomProfile(groom.id);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ── updateGroomSynergy — branch coverage (Equoria-jkht) ──────────────────────

describe('updateGroomSynergy — branch coverage (Equoria-jkht)', () => {
  let sgUser;
  let sgGroom;
  let sgHorse;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    sgUser = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `gp-sg-${ts}-${rand()}@test.com`,
        username: `gpsg${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GP',
        lastName: 'SG',
        money: 1000,
      },
    });

    sgGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GP-SG-Groom-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: sgUser.id,
      },
    });

    sgHorse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `TestFixture-GP-SG-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: sgUser.id,
      }),
    });
  }, 30000);

  // FK order: groomHorseSynergy children → horse + groom (both Restrict on user) → user.
  afterAll(() => {
    cleanup.add(() => prisma.groomHorseSynergy.deleteMany({ where: { groomId: sgGroom.id } }), 'sgSynergy');
    cleanup.add(() => prisma.horse.delete({ where: { id: sgHorse.id } }), 'sgHorse');
    cleanup.add(() => prisma.groom.delete({ where: { id: sgGroom.id } }), 'sgGroom');
    cleanup.add(() => prisma.user.delete({ where: { id: sgUser.id } }), 'sgUser');
    return cleanup.run();
  }, 30000);

  it('creates new synergy record with unknown action → synergyGained=0 (new-record + ||0 branches)', async () => {
    const result = await updateGroomSynergy(sgGroom.id, sgHorse.id, 'petHorse');
    expect(result.success).toBe(true);
    expect(result.synergyGained).toBe(0);
    expect(result.newSynergyScore).toBe(0);
    expect(result.sessionsTogether).toBe(1);
  });

  it('updates existing synergy record on second call (existing-record branch)', async () => {
    const result = await updateGroomSynergy(sgGroom.id, sgHorse.id, 'milestone_completed');
    expect(result.success).toBe(true);
    expect(result.synergyGained).toBe(1);
    expect(result.newSynergyScore).toBe(1);
    expect(result.sessionsTogether).toBe(2);
  });

  it('reassigned_early clamps synergy to 0 via Math.max (negative-gain branch)', async () => {
    // Current score=1, synergyGain=-5 → Math.max(0, 1-5) = 0
    const result = await updateGroomSynergy(sgGroom.id, sgHorse.id, 'reassigned_early');
    expect(result.success).toBe(true);
    expect(result.synergyGained).toBe(-5);
    expect(result.newSynergyScore).toBe(0);
  });
});

// ── logGroomAssignment — branch coverage (Equoria-jkht) ──────────────────────

describe('logGroomAssignment — branch coverage (Equoria-jkht)', () => {
  let laUser;
  let laGroom;
  let laHorse;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    laUser = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `gp-la-${ts}-${rand()}@test.com`,
        username: `gpla${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GP',
        lastName: 'LA',
        money: 1000,
      },
    });

    laGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GP-LA-Groom-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: laUser.id,
      },
    });

    laHorse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `TestFixture-GP-LA-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: laUser.id,
      }),
    });
  }, 30000);

  // FK order: groomAssignmentLog children → horse + groom (both Restrict on user) → user.
  afterAll(() => {
    cleanup.add(() => prisma.groomAssignmentLog.deleteMany({ where: { groomId: laGroom.id } }), 'laAssignmentLog');
    cleanup.add(() => prisma.horse.delete({ where: { id: laHorse.id } }), 'laHorse');
    cleanup.add(() => prisma.groom.delete({ where: { id: laGroom.id } }), 'laGroom');
    cleanup.add(() => prisma.user.delete({ where: { id: laUser.id } }), 'laUser');
    return cleanup.run();
  }, 30000);

  it("'assigned' action creates new assignment log (assigned branch)", async () => {
    const result = await logGroomAssignment(laGroom.id, laHorse.id, 'assigned', {});
    expect(result.success).toBe(true);
    expect(result.assignmentLog).toBeDefined();
    expect(result.assignmentLog.groomId).toBe(laGroom.id);
    expect(result.assignmentLog.unassignedAt).toBeNull();
  });

  it("'unassigned' action closes existing log with performanceData (unassigned branch)", async () => {
    const result = await logGroomAssignment(laGroom.id, laHorse.id, 'unassigned', {
      milestonesCompleted: 2,
      traitsShaped: ['brave'],
      xpGained: 50,
    });
    expect(result.success).toBe(true);
    expect(result.assignmentLog.milestonesCompleted).toBe(2);
    expect(result.assignmentLog.xpGained).toBe(50);
    expect(result.assignmentLog.unassignedAt).not.toBeNull();
  });

  it("'unassigned' with no active log returns {success:false} (no-active-log branch)", async () => {
    // Previous test closed the only active log; no active assignment remains
    const result = await logGroomAssignment(laGroom.id, laHorse.id, 'unassigned', {});
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });

  it('invalid action returns {success:false} (invalid-action catch branch)', async () => {
    const result = await logGroomAssignment(laGroom.id, laHorse.id, 'invalidAction', {});
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});

// ── calculateSynergyEffects via getGroomProfile — branch coverage (Equoria-jkht)

describe('calculateSynergyEffects via getGroomProfile — branch coverage (Equoria-jkht)', () => {
  let seUser;
  let seGroom;
  let seHorse;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    seUser = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `gp-se-${ts}-${rand()}@test.com`,
        username: `gpse${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GP',
        lastName: 'SE',
        money: 1000,
      },
    });

    seGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GP-SE-Groom-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: seUser.id,
      },
    });

    seHorse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `TestFixture-GP-SE-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: seUser.id,
      }),
    });

    // Create synergy record with score=110 to trigger all 3 effect thresholds (>=25, >=50, >=100)
    await prisma.groomHorseSynergy.create({
      data: {
        groomId: seGroom.id,
        horseId: seHorse.id,
        synergyScore: 110,
        sessionsTogether: 20,
        lastAssignedAt: new Date(),
      },
    });
  }, 30000);

  // FK order: groomHorseSynergy children → horse + groom (both Restrict on user) → user.
  afterAll(() => {
    cleanup.add(() => prisma.groomHorseSynergy.deleteMany({ where: { groomId: seGroom.id } }), 'seSynergy');
    cleanup.add(() => prisma.horse.delete({ where: { id: seHorse.id } }), 'seHorse');
    cleanup.add(() => prisma.groom.delete({ where: { id: seGroom.id } }), 'seGroom');
    cleanup.add(() => prisma.user.delete({ where: { id: seUser.id } }), 'seUser');
    return cleanup.run();
  }, 30000);

  it('effects.bondGrowthBonus=5 (>=25 branch) when synergyScore=110', async () => {
    const result = await getGroomProfile(seGroom.id);
    expect(result.success).toBe(true);
    const synergy = result.groom.synergyRecords.find(s => s.horseId === seHorse.id);
    expect(synergy).toBeDefined();
    expect(synergy.effects.bondGrowthBonus).toBe(5);
  });

  it('effects.milestoneTraitModifier=1 (>=50 branch) when synergyScore=110', async () => {
    const result = await getGroomProfile(seGroom.id);
    const synergy = result.groom.synergyRecords.find(s => s.horseId === seHorse.id);
    expect(synergy.effects.milestoneTraitModifier).toBe(1);
  });

  it('effects.cosmeticBonus=nameplate (>=100 branch) when synergyScore=110', async () => {
    const result = await getGroomProfile(seGroom.id);
    const synergy = result.groom.synergyRecords.find(s => s.horseId === seHorse.id);
    expect(synergy.effects.cosmeticBonus).toBe('nameplate');
  });
});

// ── groomProgressionService — null-coalesce fallback branches (Equoria-rr7) ──

describe('logGroomAssignment — default-param + null-coalesce fallback branches (lines 190+232-234, Equoria-rr7)', () => {
  let la2User;
  let la2Groom;
  let la2Horse;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    la2User = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `gp-la2-${ts}-${rand()}@test.com`,
        username: `gpla2${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GP',
        lastName: 'LA2',
        money: 1000,
      },
    });

    la2Groom = await prisma.groom.create({
      data: {
        name: `TestFixture-GP-LA2-Groom-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: la2User.id,
      },
    });

    la2Horse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `TestFixture-GP-LA2-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: la2User.id,
      }),
    });
  }, 30000);

  // FK order: groomAssignmentLog children → horse + groom (both Restrict on user) → user.
  afterAll(() => {
    cleanup.add(() => prisma.groomAssignmentLog.deleteMany({ where: { groomId: la2Groom.id } }), 'la2AssignmentLog');
    cleanup.add(() => prisma.horse.delete({ where: { id: la2Horse.id } }), 'la2Horse');
    cleanup.add(() => prisma.groom.delete({ where: { id: la2Groom.id } }), 'la2Groom');
    cleanup.add(() => prisma.user.delete({ where: { id: la2User.id } }), 'la2User');
    return cleanup.run();
  }, 30000);

  it('omitting performanceData arg hits default={} on line 190 (assigned action)', async () => {
    // No 4th arg → hits the `= {}` default parameter branch
    const result = await logGroomAssignment(la2Groom.id, la2Horse.id, 'assigned');
    expect(result.success).toBe(true);
    expect(result.assignmentLog).toBeDefined();
  });

  it('unassigned with empty performanceData hits || 0 and || [] fallbacks (lines 232-234)', async () => {
    // performanceData={} → milestonesCompleted=undefined || 0, traitsShaped=undefined || [], xpGained=undefined || 0
    const result = await logGroomAssignment(la2Groom.id, la2Horse.id, 'unassigned', {});
    expect(result.success).toBe(true);
    expect(result.assignmentLog.milestonesCompleted).toBe(0);
    expect(result.assignmentLog.xpGained).toBe(0);
    expect(Array.isArray(result.assignmentLog.traitsShaped)).toBe(true);
  });
});
