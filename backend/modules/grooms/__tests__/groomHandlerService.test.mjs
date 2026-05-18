import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  HANDLER_SKILL_BONUSES,
  PERSONALITY_DISCIPLINE_SYNERGY,
  SPECIALTY_DISCIPLINE_BONUSES,
  calculateHandlerBonus,
  getAssignedHandler,
  validateHandlerEligibility,
  recordHandlerPerformance,
  calculateGroomExperienceGain,
} from '../../../services/groomHandlerService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

// ── HANDLER_SKILL_BONUSES ────────────────────────────────────────────────────

describe('HANDLER_SKILL_BONUSES', () => {
  it('exports constants for all four skill levels', () => {
    for (const level of ['novice', 'intermediate', 'expert', 'master']) {
      expect(HANDLER_SKILL_BONUSES).toHaveProperty(level);
      const entry = HANDLER_SKILL_BONUSES[level];
      expect(typeof entry.baseBonus).toBe('number');
      expect(typeof entry.maxBonus).toBe('number');
      expect(typeof entry.experienceMultiplier).toBe('number');
      expect(entry.maxBonus).toBeGreaterThan(entry.baseBonus);
    }
  });
});

// ── PERSONALITY_DISCIPLINE_SYNERGY ───────────────────────────────────────────

describe('PERSONALITY_DISCIPLINE_SYNERGY', () => {
  it('has entries for all expected personality types', () => {
    for (const p of ['gentle', 'energetic', 'patient', 'strict', 'calm', 'confident']) {
      expect(PERSONALITY_DISCIPLINE_SYNERGY).toHaveProperty(p);
      const entry = PERSONALITY_DISCIPLINE_SYNERGY[p];
      expect(Array.isArray(entry.beneficial)).toBe(true);
      expect(typeof entry.bonus).toBe('number');
      expect(entry.bonus).toBeGreaterThan(0);
    }
  });
});

// ── SPECIALTY_DISCIPLINE_BONUSES ─────────────────────────────────────────────

describe('SPECIALTY_DISCIPLINE_BONUSES', () => {
  it('has entries for all expected specialties', () => {
    for (const s of ['showHandling', 'racing', 'western', 'training', 'foalCare', 'general']) {
      expect(SPECIALTY_DISCIPLINE_BONUSES).toHaveProperty(s);
      const entry = SPECIALTY_DISCIPLINE_BONUSES[s];
      expect(Array.isArray(entry.disciplines)).toBe(true);
      expect(typeof entry.bonus).toBe('number');
    }
  });
});

// ── calculateHandlerBonus ────────────────────────────────────────────────────

const mockGroom = {
  name: 'TestGroom',
  skillLevel: 'intermediate',
  speciality: 'showHandling',
  personality: 'gentle',
  experience: 50,
};
const mockHorse = { id: 1, name: 'TestHorse', bondScore: 60 };

describe('calculateHandlerBonus', () => {
  it('returns handlerBonus=0 and isConformationShow=false for a non-conformation discipline', () => {
    const result = calculateHandlerBonus(mockGroom, mockHorse, 'Racing', {});
    expect(result.handlerBonus).toBe(0);
    expect(result.isConformationShow).toBe(false);
    expect(result.bonusBreakdown.totalBonus).toBe(0);
    expect(result.groomName).toBe('TestGroom');
  });

  it('returns handlerBonus=0.15 and isConformationShow=true for a valid conformation class', () => {
    const result = calculateHandlerBonus(mockGroom, mockHorse, 'Mares', {});
    expect(result.isConformationShow).toBe(true);
    expect(result.handlerBonus).toBe(0.15);
    expect(result.bonusBreakdown.totalBonus).toBe(0.15);
  });

  it('returns isConformationShow=true for "Stallions" class', () => {
    const result = calculateHandlerBonus(mockGroom, mockHorse, 'Stallions', {});
    expect(result.isConformationShow).toBe(true);
  });

  it('returns error-default result when groom is null (error handler branch)', () => {
    const result = calculateHandlerBonus(null, mockHorse, 'Racing', {});
    expect(result.handlerBonus).toBe(0);
    expect(result.groomName).toBe('Unknown');
    expect(result.groomSkillLevel).toBe('novice');
  });

  it('groomName/skillLevel/specialty/personality are reflected in result', () => {
    const result = calculateHandlerBonus(mockGroom, mockHorse, 'Barrel Racing', {});
    expect(result.groomSkillLevel).toBe('intermediate');
    expect(result.groomSpecialty).toBe('showHandling');
    expect(result.groomPersonality).toBe('gentle');
  });
});

// ── calculateGroomExperienceGain ─────────────────────────────────────────────

describe('calculateGroomExperienceGain', () => {
  it('awards +3 extra XP for 1st place', () => {
    const xp = calculateGroomExperienceGain(1, 5, 'novice');
    expect(xp).toBe(4); // base 1 + placement bonus 3, novice multiplier 1.0
  });

  it('awards +2 extra XP for 2nd place', () => {
    const xp = calculateGroomExperienceGain(2, 5, 'novice');
    expect(xp).toBe(3); // base 1 + 2 = 3 * 1.0
  });

  it('awards +1 extra XP for 3rd place', () => {
    const xp = calculateGroomExperienceGain(3, 5, 'novice');
    expect(xp).toBe(2); // base 1 + 1 = 2 * 1.0
  });

  it('awards only base XP for 4th place', () => {
    const xp = calculateGroomExperienceGain(4, 5, 'novice');
    expect(xp).toBe(1); // base 1 only
  });

  it('adds +1 for large competitions (>=10 entries)', () => {
    const xp = calculateGroomExperienceGain(4, 10, 'novice');
    expect(xp).toBe(2); // base 1 + field bonus 1
  });

  it('does NOT add field bonus for <10 entries', () => {
    const xp = calculateGroomExperienceGain(4, 9, 'novice');
    expect(xp).toBe(1); // base 1 only
  });

  it('applies novice multiplier 1.0', () => {
    expect(calculateGroomExperienceGain(1, 5, 'novice')).toBe(4);
  });

  it('applies intermediate multiplier 0.8', () => {
    // (1 + 3) * 0.8 = 3.2 → rounded to 3
    expect(calculateGroomExperienceGain(1, 5, 'intermediate')).toBe(3);
  });

  it('applies expert multiplier 0.6', () => {
    // (1 + 3) * 0.6 = 2.4 → rounded to 2
    expect(calculateGroomExperienceGain(1, 5, 'expert')).toBe(2);
  });

  it('applies master multiplier 0.4', () => {
    // (1 + 3) * 0.4 = 1.6 → rounded to 2
    expect(calculateGroomExperienceGain(1, 5, 'master')).toBe(2);
  });

  it('defaults to 1.0 multiplier for unknown skill level', () => {
    expect(calculateGroomExperienceGain(4, 5, 'legendary')).toBe(1);
  });

  it('returns an integer (Math.round applied)', () => {
    const xp = calculateGroomExperienceGain(2, 5, 'intermediate');
    expect(Number.isInteger(xp)).toBe(true);
  });
});

// ── recordHandlerPerformance ─────────────────────────────────────────────────

describe('recordHandlerPerformance', () => {
  it('returns competitionResult unchanged when hasHandler=false', async () => {
    const result = { placement: 1, score: 95 };
    const returned = await recordHandlerPerformance(result, { hasHandler: false });
    expect(returned).toBe(result);
  });
});

// ── DB-fixture branch coverage (Equoria-rr7) ─────────────────────────────────
// Covers getAssignedHandler (170-225), validateHandlerEligibility (234-292),
// and recordHandlerPerformance hasHandler=true path (307-344).

describe('groomHandlerService — DB fixture branch coverage (Equoria-rr7)', () => {
  let ghsUser;
  let ghsGroom;
  let ghsHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    ghsUser = await prisma.user.create({
      data: {
        email: `ghs-${ts}-${rand()}@test.com`,
        username: `ghs${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GHS',
        lastName: 'Branch',
        money: 1000,
      },
    });

    ghsGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GHS-Groom-${ts}`,
        speciality: 'showHandling',
        personality: 'gentle',
        skillLevel: 'novice',
        isActive: true,
        userId: ghsUser.id,
      },
    });

    ghsHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-GHS-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: ghsUser.id,
      },
    });

    await prisma.groomAssignment.create({
      data: {
        groomId: ghsGroom.id,
        foalId: ghsHorse.id,
        userId: ghsUser.id,
        isActive: true,
        priority: 1,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.groomAssignment.deleteMany({ where: { userId: ghsUser?.id } }).catch(() => {});
    await prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GHS-' } } }).catch(() => {});
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-GHS-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: ghsUser?.id } }).catch(() => {});
  }, 30000);

  it('getAssignedHandler: no assignment → hasHandler:false (lines 201-208)', async () => {
    const result = await getAssignedHandler(999999999, ghsUser.id);
    expect(result.hasHandler).toBe(false);
    expect(result.assignment).toBeNull();
    expect(result.groom).toBeNull();
  });

  it('getAssignedHandler: assignment found → hasHandler:true with groom (lines 210-215)', async () => {
    const result = await getAssignedHandler(ghsHorse.id, ghsUser.id);
    expect(result.hasHandler).toBe(true);
    expect(result.groom.name).toBe(ghsGroom.name);
    expect(result.horse).toBeDefined();
  });

  it('validateHandlerEligibility: non-conformation class → eligible:true, isConformationShow:false (lines 238-245)', async () => {
    const result = await validateHandlerEligibility(ghsHorse.id, ghsUser.id, 'Racing');
    expect(result.eligible).toBe(true);
    expect(result.isConformationShow).toBe(false);
    expect(result.handlerBonus).toBe(0);
  });

  it('validateHandlerEligibility: conformation class + no handler → eligible:false (lines 249-256)', async () => {
    const result = await validateHandlerEligibility(999999999, ghsUser.id, 'Mares');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('No handler assigned');
    expect(result.isConformationShow).toBe(true);
  });

  it('validateHandlerEligibility: conformation class + handler assigned → eligible:true (lines 274-282)', async () => {
    const result = await validateHandlerEligibility(ghsHorse.id, ghsUser.id, 'Mares');
    expect(result.eligible).toBe(true);
    expect(result.groom).toBeDefined();
    expect(typeof result.handlerBonus).toBe('number');
  });

  it('recordHandlerPerformance: hasHandler=true, experienceGain>0 → updates groom XP (lines 307-341)', async () => {
    const competitionResult = { placement: 1, totalEntries: 5, score: 95 };
    const handlerData = {
      hasHandler: true,
      groom: { id: ghsGroom.id, name: ghsGroom.name, skillLevel: 'novice' },
      handlerBonus: 0.1,
      bonusBreakdown: { skillBonus: 0.1 },
    };
    const result = await recordHandlerPerformance(competitionResult, handlerData);
    expect(result).toHaveProperty('handlerInfo');
    expect(result.handlerInfo.groomId).toBe(ghsGroom.id);
    expect(result.handlerInfo.experienceGained).toBeGreaterThan(0);
    const updatedGroom = await prisma.groom.findUnique({ where: { id: ghsGroom.id } });
    expect(updatedGroom.experience).toBeGreaterThan(0);
  });

  it('recordHandlerPerformance: hasHandler=true, experienceGain=0 → skips XP update (line 324 false arm)', async () => {
    // master + 4th place + 1 entry: (1+0)*0.4 = 0.4 → Math.round(0.4) = 0
    const competitionResult = { placement: 4, totalEntries: 1, score: 75 };
    const handlerData = {
      hasHandler: true,
      groom: { id: ghsGroom.id, name: ghsGroom.name, skillLevel: 'master' },
      handlerBonus: 0.05,
      bonusBreakdown: {},
    };
    const result = await recordHandlerPerformance(competitionResult, handlerData);
    expect(result).toHaveProperty('handlerInfo');
    expect(result.handlerInfo).not.toHaveProperty('experienceGained');
  });
});
