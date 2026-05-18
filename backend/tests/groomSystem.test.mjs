import { describe, beforeAll, afterAll, afterEach, expect, it } from '@jest/globals';
import prisma from '../db/index.mjs';
import {
  assignGroomToFoal,
  ensureDefaultGroomAssignment,
  calculateGroomInteractionEffects,
  hasAlreadyCompletedFoalTaskToday,
  GROOM_SPECIALTIES,
  SKILL_LEVELS,
  PERSONALITY_TRAITS,
} from '../utils/groomSystem.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from './helpers/fixtureColor.mjs';

/**
 * Groom System Tests
 *
 * Pure function sections (System Constants, hasAlreadyCompletedFoalTaskToday,
 * calculateGroomInteractionEffects) need no DB fixtures.
 *
 * DB-dependent sections (assignGroomToFoal, ensureDefaultGroomAssignment) use
 * real Prisma with TestFixture-GroomSys-* prefixed records for scoped cleanup.
 * Groom fixtures use userId: null (the field is optional) so no User FK is required.
 * assignGroomToFoal checks groom.userId !== userId — passing null for both causes
 * null !== null = false, so the ownership check passes without a real User.
 */

// ─── Pure function: System Constants ─────────────────────────────────────────

describe('System Constants', () => {
  it('has all required groom specialties', () => {
    expect(GROOM_SPECIALTIES).toHaveProperty('foalCare');
    expect(GROOM_SPECIALTIES).toHaveProperty('general');
    expect(GROOM_SPECIALTIES).toHaveProperty('training');
    expect(GROOM_SPECIALTIES).toHaveProperty('medical');

    Object.values(GROOM_SPECIALTIES).forEach(specialty => {
      expect(specialty).toHaveProperty('name');
      expect(specialty).toHaveProperty('description');
      expect(specialty).toHaveProperty('bondingModifier');
      expect(specialty).toHaveProperty('stressReduction');
      expect(specialty).toHaveProperty('preferredActivities');
    });
  });

  it('has all required skill levels', () => {
    expect(SKILL_LEVELS).toHaveProperty('novice');
    expect(SKILL_LEVELS).toHaveProperty('intermediate');
    expect(SKILL_LEVELS).toHaveProperty('expert');
    expect(SKILL_LEVELS).toHaveProperty('master');

    Object.values(SKILL_LEVELS).forEach(level => {
      expect(level).toHaveProperty('name');
      expect(level).toHaveProperty('bondingModifier');
      expect(level).toHaveProperty('costModifier');
      expect(level).toHaveProperty('errorChance');
      expect(level).toHaveProperty('description');
    });
  });

  it('has all required personality traits', () => {
    expect(PERSONALITY_TRAITS).toHaveProperty('gentle');
    expect(PERSONALITY_TRAITS).toHaveProperty('energetic');
    expect(PERSONALITY_TRAITS).toHaveProperty('patient');
    expect(PERSONALITY_TRAITS).toHaveProperty('strict');

    Object.values(PERSONALITY_TRAITS).forEach(trait => {
      expect(trait).toHaveProperty('name');
      expect(trait).toHaveProperty('bondingModifier');
      expect(trait).toHaveProperty('stressReduction');
      expect(trait).toHaveProperty('description');
    });
  });
});

// ─── Pure function: hasAlreadyCompletedFoalTaskToday ─────────────────────────

describe('hasAlreadyCompletedFoalTaskToday', () => {
  const today = '2024-01-15';

  it('returns false when foal has no daily task record', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ id: 1, dailyTaskRecord: null }, today)).toBe(false);
  });

  it('returns false when foal has empty daily task record', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ id: 1, dailyTaskRecord: {} }, today)).toBe(false);
  });

  it('returns false when foal has no tasks for today', () => {
    const foal = {
      id: 1,
      dailyTaskRecord: { '2024-01-14': ['trust_building'], '2024-01-16': ['hoof_handling'] },
    };
    expect(hasAlreadyCompletedFoalTaskToday(foal, today)).toBe(false);
  });

  it('returns false when foal has empty task array for today', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ id: 1, dailyTaskRecord: { [today]: [] } }, today)).toBe(false);
  });

  it('returns true when foal has completed enrichment task today', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ id: 1, dailyTaskRecord: { [today]: ['trust_building'] } }, today)).toBe(
      true,
    );
  });

  it('returns true when foal has completed grooming task today', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ id: 1, dailyTaskRecord: { [today]: ['hoof_handling'] } }, today)).toBe(
      true,
    );
  });

  it('returns true when foal has completed multiple tasks today', () => {
    expect(
      hasAlreadyCompletedFoalTaskToday(
        { id: 1, dailyTaskRecord: { [today]: ['trust_building', 'early_touch'] } },
        today,
      ),
    ).toBe(true);
  });

  it('returns false when foal has completed only non-foal tasks today', () => {
    expect(
      hasAlreadyCompletedFoalTaskToday(
        { id: 1, dailyTaskRecord: { [today]: ['general_grooming', 'exercise', 'medical_check'] } },
        today,
      ),
    ).toBe(false);
  });

  it('returns true when foal has mixed tasks including foal tasks today', () => {
    expect(
      hasAlreadyCompletedFoalTaskToday(
        { id: 1, dailyTaskRecord: { [today]: ['general_grooming', 'trust_building', 'exercise'] } },
        today,
      ),
    ).toBe(true);
  });

  it('detects all enrichment tasks', () => {
    for (const task of ['desensitization', 'trust_building', 'showground_exposure']) {
      expect(hasAlreadyCompletedFoalTaskToday({ id: 1, dailyTaskRecord: { [today]: [task] } }, today)).toBe(true);
    }
  });

  it('detects all grooming tasks', () => {
    for (const task of [
      'early_touch',
      'hoof_handling',
      'tying_practice',
      'sponge_bath',
      'coat_check',
      'mane_tail_grooming',
    ]) {
      expect(hasAlreadyCompletedFoalTaskToday({ id: 1, dailyTaskRecord: { [today]: [task] } }, today)).toBe(true);
    }
  });

  it('handles edge cases gracefully', () => {
    expect(hasAlreadyCompletedFoalTaskToday({ id: 1, dailyTaskRecord: undefined }, today)).toBe(false);
    const foalWithRecord = { id: 1, dailyTaskRecord: { [today]: ['trust_building'] } };
    expect(hasAlreadyCompletedFoalTaskToday(foalWithRecord, null)).toBe(false);
    expect(hasAlreadyCompletedFoalTaskToday(foalWithRecord, '')).toBe(false);
  });
});

// ─── Pure function: calculateGroomInteractionEffects ─────────────────────────

describe('calculateGroomInteractionEffects', () => {
  const mockGroom = {
    id: 1,
    name: 'Sarah Johnson',
    speciality: 'foalCare',
    skillLevel: 'intermediate',
    personality: 'gentle',
    experience: 5,
    sessionRate: 18.0,
  };

  const mockFoal = { id: 1, name: 'Test Foal', bondScore: 50, stressLevel: 20 };

  it('returns all required effect properties', () => {
    const effects = calculateGroomInteractionEffects(mockGroom, mockFoal, 'dailyCare', 60);
    expect(effects).toHaveProperty('bondingChange');
    expect(effects).toHaveProperty('stressChange');
    expect(effects).toHaveProperty('cost');
    expect(effects).toHaveProperty('quality');
    expect(effects).toHaveProperty('modifiers');
    expect(effects.bondingChange).toBeGreaterThanOrEqual(0);
    expect(effects.bondingChange).toBeLessThanOrEqual(10);
    expect(effects.stressChange).toBeLessThanOrEqual(5);
    expect(effects.stressChange).toBeGreaterThanOrEqual(-15);
    expect(effects.cost).toBeGreaterThan(0);
    expect(['poor', 'fair', 'good', 'excellent']).toContain(effects.quality);
  });

  it('foalCare specialty modifier exceeds general specialty modifier', () => {
    const foalCareEffects = calculateGroomInteractionEffects(
      { ...mockGroom, speciality: 'foalCare' },
      mockFoal,
      'dailyCare',
      60,
    );
    const generalEffects = calculateGroomInteractionEffects(
      { ...mockGroom, speciality: 'general' },
      mockFoal,
      'dailyCare',
      60,
    );
    expect(foalCareEffects.modifiers.specialty).toBeGreaterThan(generalEffects.modifiers.specialty);
  });

  it('expert skill modifier exceeds novice skill modifier', () => {
    const expertEffects = calculateGroomInteractionEffects(
      { ...mockGroom, skillLevel: 'expert' },
      mockFoal,
      'dailyCare',
      60,
    );
    const noviceEffects = calculateGroomInteractionEffects(
      { ...mockGroom, skillLevel: 'novice' },
      mockFoal,
      'dailyCare',
      60,
    );
    expect(expertEffects.modifiers.skillLevel).toBeGreaterThan(noviceEffects.modifiers.skillLevel);
    expect(expertEffects.cost).toBeGreaterThan(noviceEffects.cost);
  });

  it('experienced groom has higher experience modifier than new groom', () => {
    const experiencedEffects = calculateGroomInteractionEffects(
      { ...mockGroom, experience: 15 },
      mockFoal,
      'dailyCare',
      60,
    );
    const newGroomEffects = calculateGroomInteractionEffects(
      { ...mockGroom, experience: 1 },
      mockFoal,
      'dailyCare',
      60,
    );
    expect(experiencedEffects.modifiers.experience).toBeGreaterThan(newGroomEffects.modifiers.experience);
  });

  it('longer duration produces higher cost', () => {
    const shortEffects = calculateGroomInteractionEffects(mockGroom, mockFoal, 'dailyCare', 30);
    const longEffects = calculateGroomInteractionEffects(mockGroom, mockFoal, 'dailyCare', 120);
    expect(longEffects.cost).toBeGreaterThan(shortEffects.cost);
  });
});

// ─── DB integration: assignGroomToFoal ───────────────────────────────────────

describe('assignGroomToFoal — DB integration', () => {
  let foal, groom, inactiveGroom, groom2;
  const dateOfBirth = new Date('2020-01-01');

  beforeAll(async () => {
    foal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'TestFixture-GroomSys-Foal',
        sex: 'Colt',
        dateOfBirth,
      },
    });
    groom = await prisma.groom.create({
      data: {
        name: 'TestFixture-GroomSys-Groom',
        speciality: 'foalCare',
        skillLevel: 'intermediate',
        personality: 'gentle',
        experience: 5,
        sessionRate: 18.0,
        isActive: true,
      },
    });
    inactiveGroom = await prisma.groom.create({
      data: {
        name: 'TestFixture-GroomSys-InactiveGroom',
        speciality: 'general',
        skillLevel: 'novice',
        personality: 'energetic',
        experience: 1,
        sessionRate: 12.0,
        isActive: false,
      },
    });
    groom2 = await prisma.groom.create({
      data: {
        name: 'TestFixture-GroomSys-Groom2',
        speciality: 'general',
        skillLevel: 'intermediate',
        personality: 'patient',
        experience: 3,
        sessionRate: 15.0,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.groomAssignment.deleteMany({
      where: { foal: { name: { startsWith: 'TestFixture-GroomSys-' } } },
    });
    await prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GroomSys-' } } });
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-GroomSys-' } } });
  });

  afterEach(async () => {
    await prisma.groomAssignment.deleteMany({ where: { foalId: foal.id } });
  });

  it('assigns groom to foal successfully', async () => {
    const result = await assignGroomToFoal(foal.id, groom.id, null);
    expect(result.success).toBe(true);
    expect(result.assignment.foalId).toBe(foal.id);
    expect(result.assignment.groomId).toBe(groom.id);
  });

  it('throws when foal not found', async () => {
    await expect(assignGroomToFoal(999999999, groom.id, null)).rejects.toThrow('Foal with ID 999999999 not found');
  });

  it('throws when groom not found', async () => {
    await expect(assignGroomToFoal(foal.id, 999999999, null)).rejects.toThrow('Groom with ID 999999999 not found');
  });

  it('throws when groom is not active', async () => {
    await expect(assignGroomToFoal(foal.id, inactiveGroom.id, null)).rejects.toThrow('is not currently active');
  });

  it('throws when groom is already assigned to this foal', async () => {
    await prisma.groomAssignment.create({
      data: { foalId: foal.id, groomId: groom.id, priority: 1, isActive: true },
    });
    await expect(assignGroomToFoal(foal.id, groom.id, null)).rejects.toThrow('already assigned to this foal');
  });

  it('deactivates existing primary assignment when new primary is assigned', async () => {
    await prisma.groomAssignment.create({
      data: { foalId: foal.id, groomId: groom.id, priority: 1, isActive: true },
    });

    const result = await assignGroomToFoal(foal.id, groom2.id, null, { priority: 1 });
    expect(result.success).toBe(true);

    const oldAssignment = await prisma.groomAssignment.findFirst({
      where: { foalId: foal.id, groomId: groom.id },
    });
    expect(oldAssignment.isActive).toBe(false);
  });
});

// ─── DB integration: ensureDefaultGroomAssignment ────────────────────────────

describe('ensureDefaultGroomAssignment — DB integration', () => {
  it('returns existing assignment when one is already active', async () => {
    const dateOfBirth = new Date('2023-01-01');
    const localFoal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'TestFixture-GroomSys-EnsureFoal1',
        sex: 'Filly',
        dateOfBirth,
      },
    });
    const localGroom = await prisma.groom.create({
      data: {
        name: 'TestFixture-GroomSys-EnsureGroom',
        speciality: 'foalCare',
        skillLevel: 'intermediate',
        personality: 'gentle',
        experience: 3,
        sessionRate: 15.0,
        isActive: true,
      },
    });
    await prisma.groomAssignment.create({
      data: { foalId: localFoal.id, groomId: localGroom.id, priority: 1, isActive: true },
    });

    try {
      const result = await ensureDefaultGroomAssignment(localFoal.id, null);
      expect(result.success).toBe(true);
      expect(result.isExisting).toBe(true);
    } finally {
      await prisma.groomAssignment.deleteMany({ where: { foalId: localFoal.id } });
      await prisma.horse.delete({ where: { id: localFoal.id } });
      await prisma.groom.delete({ where: { id: localGroom.id } });
    }
  });

  it('creates default assignment when none exists (test env auto-assigns)', async () => {
    const dateOfBirth = new Date('2023-06-01');
    const localFoal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'TestFixture-GroomSys-EnsureFoal2',
        sex: 'Colt',
        dateOfBirth,
      },
    });

    let createdGroomId = null;
    try {
      const result = await ensureDefaultGroomAssignment(localFoal.id, null);
      expect(result.success).toBe(true);
      expect(result.isNew).toBe(true);

      if (result.assignment) {
        createdGroomId = result.assignment.groomId;
      }
    } finally {
      await prisma.groomAssignment.deleteMany({ where: { foalId: localFoal.id } });
      await prisma.horse.delete({ where: { id: localFoal.id } });
      if (createdGroomId) {
        await prisma.groom.delete({ where: { id: createdGroomId } }).catch(() => {});
      }
    }
  });
});

// ─── Error handling: pure function fallback ───────────────────────────────────

describe('Error Handling', () => {
  it('handles invalid groom data in calculations without throwing', () => {
    const invalidGroom = {
      id: 1,
      name: 'Invalid Groom',
      speciality: 'invalid_specialty',
      skillLevel: 'invalid_level',
      personality: 'invalid_personality',
      experience: 5,
      sessionRate: 18.0,
    };

    const effects = calculateGroomInteractionEffects(invalidGroom, { id: 1, bondScore: 50 }, 'dailyCare', 60);
    expect(effects).toHaveProperty('bondingChange');
    expect(effects).toHaveProperty('stressChange');
    expect(effects).toHaveProperty('cost');
  });
});
