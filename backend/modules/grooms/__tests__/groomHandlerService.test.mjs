import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  HANDLER_SKILL_BONUSES,
  PERSONALITY_DISCIPLINE_SYNERGY,
  SPECIALTY_DISCIPLINE_BONUSES,
  calculateHandlerBonus,
  getAssignedHandler,
  validateHandlerEligibility,
} from '../services/groomHandlerService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

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

  it('derives a REAL per-skill conformation bonus (Equoria-axad9.1): mockGroom has no showHandlingSkill so falls back to novice 0.05 + showHandling specialty 0.05 = 0.10', () => {
    // mockGroom.speciality === 'showHandling' but no showHandlingSkill set → novice fallback
    const result = calculateHandlerBonus(mockGroom, mockHorse, 'Mares', {});
    expect(result.isConformationShow).toBe(true);
    expect(result.handlerBonus).toBe(0.1);
    expect(result.bonusBreakdown.skillBonus).toBe(0.05);
    expect(result.bonusBreakdown.specialtyBonus).toBe(0.05);
    expect(result.bonusBreakdown.totalBonus).toBe(0.1);
  });

  it('returns isConformationShow=true for "Stallions" class', () => {
    const result = calculateHandlerBonus(mockGroom, mockHorse, 'Stallions', {});
    expect(result.isConformationShow).toBe(true);
  });

  // Sentinel: the conformation bonus must DIFFER by showHandlingSkill — proving
  // it is no longer the fabricated flat 0.15 placeholder (Equoria-axad9.1).
  it('produces different bonuses for different showHandlingSkill levels (no flat 0.15 placeholder)', () => {
    const base = { name: 'G', skillLevel: 'novice', speciality: 'general', personality: 'gentle', experience: 0 };
    const novice = calculateHandlerBonus({ ...base, showHandlingSkill: 'novice' }, mockHorse, 'Mares', {});
    const master = calculateHandlerBonus({ ...base, showHandlingSkill: 'master' }, mockHorse, 'Mares', {});
    expect(novice.handlerBonus).toBe(0.05);
    expect(master.handlerBonus).toBe(0.25);
    expect(master.handlerBonus).toBeGreaterThan(novice.handlerBonus);
    // None of them is the old fabricated flat 0.15.
    expect(novice.handlerBonus).not.toBe(0.15);
    expect(master.handlerBonus).not.toBe(0.15);
  });

  it('adds the showHandling specialty bonus on top of skill (skilled 0.15 + specialty 0.05 = 0.20)', () => {
    const groom = {
      name: 'G',
      skillLevel: 'skilled',
      speciality: 'showHandling',
      personality: 'gentle',
      experience: 0,
      showHandlingSkill: 'skilled',
    };
    const result = calculateHandlerBonus(groom, mockHorse, 'Mares', {});
    expect(result.bonusBreakdown.skillBonus).toBe(0.15);
    expect(result.bonusBreakdown.specialtyBonus).toBe(0.05);
    expect(result.handlerBonus).toBe(0.2);
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

// Owner ruling 2026-10-21 (Equoria-dea06): grooms are fixed NPCs and earn no
// XP. Old contract: calculateGroomExperienceGain priced a handler's XP by
// placement/field/skill and recordHandlerPerformance wrote it to the groom.
// Both functions were removed with that ruling, and so were their tests here.

// ── DB-fixture branch coverage (Equoria-rr7) ─────────────────────────────────
// Covers getAssignedHandler (170-225) and validateHandlerEligibility (234-292).

describe('groomHandlerService — DB fixture branch coverage (Equoria-rr7)', () => {
  let ghsUser;
  let ghsGroom;
  let ghsHorse;
  const ghsCleanup = createCleanupTracker();

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
    // Equoria-1ohys: fail-loud, scoped cleanup. Each delete is scoped (by
    // userId or TestFixture- name-prefix) and registered on the tracker so a
    // cleanup failure REDS the suite instead of leaking rows into the canonical
    // DB (CLAUDE.md §2). FK order: groomAssignment (child) before groom/horse
    // before user (Horse.userId / Groom.userId Restrict).
    ghsCleanup.add(() => prisma.groomAssignment.deleteMany({ where: { userId: ghsUser?.id } }), 'assignments');
    ghsCleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GHS-' } } }), 'grooms');
    ghsCleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-GHS-' } } }), 'horses');
    ghsCleanup.add(() => prisma.user.delete({ where: { id: ghsUser?.id } }), 'ghsUser');
    await ghsCleanup.run();
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
});
