/**
 * groomProgressionService unit tests (Equoria-rr7 coverage sprint).
 *
 * calculateGroomLevel: pure sync, no DB.
 * Async functions: DB fixture — user + groom + horse.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  calculateGroomLevel,
  awardGroomXP,
  updateGroomSynergy,
  logGroomAssignment,
  getGroomProfile,
} from '../../services/groomProgressionService.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;
let groom;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `groomprogress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `groomprogress${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'GroomProgress',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-GroomProgressHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-GroomProgressGroom-${Date.now()}`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.groom.delete({ where: { id: groom.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ── calculateGroomLevel ───────────────────────────────────────────────────────

describe('calculateGroomLevel', () => {
  it('returns 1 for 0 experience', () => {
    expect(calculateGroomLevel(0)).toBe(1);
  });

  it('returns 1 for 99 experience', () => {
    expect(calculateGroomLevel(99)).toBe(1);
  });

  it('returns 2 for 100 experience', () => {
    expect(calculateGroomLevel(100)).toBe(2);
  });

  it('returns 10 (cap) for very high experience', () => {
    expect(calculateGroomLevel(99999)).toBe(10);
  });

  it('returns a number between 1 and 10', () => {
    const level = calculateGroomLevel(500);
    expect(level).toBeGreaterThanOrEqual(1);
    expect(level).toBeLessThanOrEqual(10);
  });
});

// ── awardGroomXP ──────────────────────────────────────────────────────────────

describe('awardGroomXP', () => {
  it('returns error object for non-existent groom', async () => {
    const result = await awardGroomXP(999999999, 'milestone_completion', 50);
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });

  it('returns XP result shape for valid groom', async () => {
    const result = await awardGroomXP(groom.id, 'milestone_completion', 10);

    expect(result).toBeDefined();
    expect(typeof result.xpGained).toBe('number');
    expect(typeof result.newExperience).toBe('number');
    expect(typeof result.newLevel).toBe('number');
    expect(result.xpGained).toBe(10);
  });
});

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

// ── calculateGroomLevel — intermediate levels (Equoria-jkht) ──────────────────

describe('calculateGroomLevel — intermediate levels (Equoria-jkht)', () => {
  it('returns 3 for experience=400 (level-3 bracket)', () => {
    expect(calculateGroomLevel(400)).toBe(3);
  });

  it('returns 5 for experience=1200 (level-5 bracket)', () => {
    expect(calculateGroomLevel(1200)).toBe(5);
  });
});

// ── awardGroomXP — levelUp branch (Equoria-jkht) ──────────────────────────────

describe('awardGroomXP — levelUp branch (Equoria-jkht)', () => {
  let luUser;
  let luGroom;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    luUser = await prisma.user.create({
      data: {
        email: `gp-lu-${ts}-${rand()}@test.com`,
        username: `gplu${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GP',
        lastName: 'LU',
        money: 1000,
      },
    });

    luGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GP-LU-Groom-${ts}`,
        speciality: 'foal_care',
        personality: 'gentle',
        userId: luUser.id,
        experience: 0,
        level: 1,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.groom.delete({ where: { id: luGroom.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: luUser.id } }).catch(() => {});
  }, 30000);

  it('levelUp=true when XP crosses level boundary (0→200 XP → level 2)', async () => {
    const result = await awardGroomXP(luGroom.id, 'milestone_completion', 200);
    expect(result.success).toBe(true);
    expect(result.levelUp).toBe(true);
    expect(result.newLevel).toBe(2);
  });

  it('levelUp=false when XP stays within same level (200→210 XP → still level 2)', async () => {
    const result = await awardGroomXP(luGroom.id, 'milestone_completion', 10);
    expect(result.success).toBe(true);
    expect(result.levelUp).toBe(false);
    expect(result.newLevel).toBe(2);
  });
});

// ── updateGroomSynergy — branch coverage (Equoria-jkht) ──────────────────────

describe('updateGroomSynergy — branch coverage (Equoria-jkht)', () => {
  let sgUser;
  let sgGroom;
  let sgHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    sgUser = await prisma.user.create({
      data: {
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
        speciality: 'foal_care',
        personality: 'gentle',
        userId: sgUser.id,
      },
    });

    sgHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-GP-SG-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: sgUser.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.groomHorseSynergy.deleteMany({ where: { groomId: sgGroom.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: sgHorse.id } }).catch(() => {});
    await prisma.groom.delete({ where: { id: sgGroom.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: sgUser.id } }).catch(() => {});
  }, 30000);

  it('creates new synergy record with unknown action → synergyGained=0 (new-record + ||0 branches)', async () => {
    const result = await updateGroomSynergy(sgGroom.id, sgHorse.id, 'pet_horse');
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

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    laUser = await prisma.user.create({
      data: {
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
        speciality: 'foal_care',
        personality: 'gentle',
        userId: laUser.id,
      },
    });

    laHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-GP-LA-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: laUser.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.groomAssignmentLog.deleteMany({ where: { groomId: laGroom.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: laHorse.id } }).catch(() => {});
    await prisma.groom.delete({ where: { id: laGroom.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: laUser.id } }).catch(() => {});
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
    const result = await logGroomAssignment(laGroom.id, laHorse.id, 'invalid_action', {});
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});

// ── calculateSynergyEffects via getGroomProfile — branch coverage (Equoria-jkht)

describe('calculateSynergyEffects via getGroomProfile — branch coverage (Equoria-jkht)', () => {
  let seUser;
  let seGroom;
  let seHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    seUser = await prisma.user.create({
      data: {
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
        speciality: 'foal_care',
        personality: 'gentle',
        userId: seUser.id,
      },
    });

    seHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-GP-SE-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: seUser.id,
      },
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

  afterAll(async () => {
    await prisma.groomHorseSynergy.deleteMany({ where: { groomId: seGroom.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: seHorse.id } }).catch(() => {});
    await prisma.groom.delete({ where: { id: seGroom.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: seUser.id } }).catch(() => {});
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
