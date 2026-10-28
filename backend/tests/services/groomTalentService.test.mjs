/**
 * Groom Talent Service Tests
 *
 * Tests for the groom talent tree system including:
 * - Talent tree definitions and structure
 * - Talent selection and validation
 * - Level requirements and unlocking
 * - Perk effects and integration
 *
 * Testing Approach: NO MOCKING - Real database operations
 * This validates actual system behavior and database constraints
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import { randomBytes } from 'node:crypto';
import {
  getTalentTreeDefinitions,
  getGroomTalentSelections,
  selectTalent,
  validateTalentSelection,
  applyTalentEffects,
  TALENT_REQUIREMENTS,
} from '../../modules/grooms/services/groomTalentService.mjs';

describe('Groom Talent Service', () => {
  let testUser;
  let testGroom;

  beforeEach(async () => {
    const testSuffix = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}_${Math.random().toString(16).slice(2, 8)}`;

    testUser = await prisma.user.create({
      data: {
        username: `testuser_talent_${testSuffix}`,
        email: `test_talent_${testSuffix}@example.com`,
        password: 'hashedpassword123',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    testGroom = await prisma.groom.create({
      data: {
        name: `Test Groom ${testSuffix}`,
        personality: 'calm',
        skillLevel: 'intermediate',
        speciality: 'foalCare',
        userId: testUser.id,
        experience: 200,
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    if (testGroom) {
      await prisma.groomTalentSelections.deleteMany({
        where: { groomId: testGroom.id },
      });
      await prisma.groom.deleteMany({
        where: { id: testGroom.id },
      });
    }
    if (testUser) {
      await prisma.user.deleteMany({
        where: { id: testUser.id },
      });
    }
  });

  afterAll(async () => {
    // prisma.$disconnect() removed — global teardown handles disconnection
  });

  // Owner rulings 2026-10-28 (Equoria-2xxvd): q229 replaced the old 1-10 level with the
  // star level, and q244 says stars give no bonus for now, so the level that opens a
  // tier is the old level 1 (staffCareerStarLevel, Rookie) for every groom and no tier
  // opens. Old contract: a level 3/5/8 groom could select tier 1/2/3 here.
  // Selections made before q244 still exist and still apply, so the effect and retrieval
  // tests write a selection row directly instead of choosing one.
  const writeSelections = (groomId, tiers) => prisma.groomTalentSelections.create({ data: { groomId, ...tiers } });

  describe('Talent Tree Definitions', () => {
    test('should return complete talent tree definitions', async () => {
      const definitions = getTalentTreeDefinitions();

      expect(definitions).toHaveProperty('calm');
      expect(definitions).toHaveProperty('energetic');
      expect(definitions).toHaveProperty('methodical');

      // Check structure for calm personality
      const calmTree = definitions.calm;
      expect(calmTree).toHaveProperty('tier1');
      expect(calmTree).toHaveProperty('tier2');
      expect(calmTree).toHaveProperty('tier3');

      // Verify each tier has talents
      expect(calmTree.tier1).toBeInstanceOf(Array);
      expect(calmTree.tier1.length).toBeGreaterThan(0);

      // Verify talent structure
      calmTree.tier1.forEach(talent => {
        expect(talent).toHaveProperty('id');
        expect(talent).toHaveProperty('name');
        expect(talent).toHaveProperty('description');
        expect(talent).toHaveProperty('effect');
      });
    });

    test('should have consistent talent requirements', async () => {
      const requirements = TALENT_REQUIREMENTS;

      // q229: the star levels equivalent to the old levels 3, 5 and 8.
      expect(requirements.tier1.minStarLevel).toBe('novice');
      expect(requirements.tier2.minStarLevel).toBe('intermediate');
      expect(requirements.tier3.minStarLevel).toBe('advanced');
    });
  });

  describe('Talent Selection Validation', () => {
    test('refuses an otherwise valid selection: stars open no tier for now (q244)', async () => {
      await prisma.groom.update({ where: { id: testGroom.id }, data: { starLevel: 'expert' } });
      const validation = await validateTalentSelection(testGroom.id, 'tier1', 'gentle_hands');

      expect(validation).toEqual({ valid: false, reason: 'insufficient_level', requiredStarLevel: 'novice' });
    });

    test('should reject selection for insufficient level', async () => {
      // Create low-level groom
      const lowLevelGroom = await prisma.groom.create({
        data: {
          name: `Low Level Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
          personality: 'calm',
          skillLevel: 'novice',
          speciality: 'foalCare',
          userId: testUser.id,
          experience: 50,
        },
      });

      const validation = await validateTalentSelection(lowLevelGroom.id, 'tier1', 'gentle_hands');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('insufficient_level');
      expect(validation.requiredStarLevel).toBe('novice');

      // Cleanup
      await prisma.groom.deleteMany({ where: { id: lowLevelGroom.id } });
    });

    test('should reject invalid talent for personality', async () => {
      const validation = await validateTalentSelection(testGroom.id, 'tier1', 'invalid_talent');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('invalid_talent');
    });

    test('should reject selection if tier already selected', async () => {
      // A tier 1 selection made before q244
      await writeSelections(testGroom.id, { tier1: 'gentle_hands' });

      // Try to select a different talent in the same tier
      const validation = await validateTalentSelection(testGroom.id, 'tier1', 'patience_virtue');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('tier_already_selected');
    });

    test('should require prerequisite tiers', async () => {
      // Try to select tier 2 without tier 1
      const validation = await validateTalentSelection(testGroom.id, 'tier2', 'empathic_sync');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('prerequisite_required');
    });
  });

  describe('Talent Selection', () => {
    test('an Expert groom cannot select a tier 1 talent, and nothing is written (q244)', async () => {
      await prisma.groom.update({ where: { id: testGroom.id }, data: { starLevel: 'expert' } });

      await expect(selectTalent(testGroom.id, 'tier1', 'gentle_hands')).rejects.toThrow('insufficient_level');

      const selections = await prisma.groomTalentSelections.findUnique({
        where: { groomId: testGroom.id },
      });
      expect(selections).toBeNull();
    });

    test('with tier 1 already chosen, tier 2 is still closed by level (q244)', async () => {
      await prisma.groom.update({ where: { id: testGroom.id }, data: { starLevel: 'expert' } });
      await writeSelections(testGroom.id, { tier1: 'gentle_hands' });

      await expect(selectTalent(testGroom.id, 'tier2', 'empathic_sync')).rejects.toThrow('insufficient_level');
    });

    test('should reject invalid talent selection', async () => {
      await expect(selectTalent(testGroom.id, 'tier1', 'invalid_talent')).rejects.toThrow('Invalid talent selection');
    });

    test('should reject selection for insufficient level', async () => {
      // Create low-level groom
      const lowLevelGroom = await prisma.groom.create({
        data: {
          name: `Low Level Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
          personality: 'calm',
          skillLevel: 'novice',
          speciality: 'foalCare',
          userId: testUser.id,
          experience: 10,
        },
      });

      await expect(selectTalent(lowLevelGroom.id, 'tier1', 'gentle_hands')).rejects.toThrow('insufficient_level');

      // Cleanup
      await prisma.groom.deleteMany({ where: { id: lowLevelGroom.id } });
    });
  });

  describe('Talent Effects', () => {
    test('should apply talent effects to groom interactions', async () => {
      // A talent with bonding bonus, chosen before q244
      await writeSelections(testGroom.id, { tier1: 'gentle_hands' });

      // Apply talent effects to a mock interaction
      const baseInteraction = {
        bondingChange: 5,
        quality: 'good',
      };

      const enhancedInteraction = await applyTalentEffects(testGroom.id, baseInteraction);

      expect(enhancedInteraction.bondingChange).toBeGreaterThan(baseInteraction.bondingChange);
      expect(enhancedInteraction.talentBonuses).toBeDefined();
      expect(enhancedInteraction.talentBonuses.length).toBeGreaterThan(0);
    });

    test('should handle multiple talent effects', async () => {
      // Two talents chosen before q244
      await writeSelections(testGroom.id, { tier1: 'gentle_hands', tier2: 'empathic_sync' });

      const baseInteraction = {
        bondingChange: 5,
        quality: 'good',
      };

      const enhancedInteraction = await applyTalentEffects(testGroom.id, baseInteraction);

      expect(enhancedInteraction.talentBonuses.length).toBe(2);
      expect(enhancedInteraction.bondingChange).toBeGreaterThan(baseInteraction.bondingChange);
    });

    test('should handle groom with no talent selections', async () => {
      const baseInteraction = {
        bondingChange: 5,
        quality: 'good',
      };

      const enhancedInteraction = await applyTalentEffects(testGroom.id, baseInteraction);

      expect(enhancedInteraction.bondingChange).toBe(baseInteraction.bondingChange);
      expect(enhancedInteraction.talentBonuses).toEqual([]);
    });
  });

  describe('Talent Retrieval', () => {
    test('should get groom talent selections', async () => {
      // A talent chosen before q244
      await writeSelections(testGroom.id, { tier1: 'gentle_hands' });

      const selections = await getGroomTalentSelections(testGroom.id);

      expect(selections).toBeDefined();
      expect(selections.groomId).toBe(testGroom.id);
      expect(selections.tier1).toBe('gentle_hands');
      expect(selections.tier2).toBeNull();
      expect(selections.tier3).toBeNull();
    });

    test('should return null for groom with no selections', async () => {
      const selections = await getGroomTalentSelections(testGroom.id);

      expect(selections).toBeNull();
    });
  });
});
