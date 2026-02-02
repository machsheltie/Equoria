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
import {
  getTalentTreeDefinitions,
  getGroomTalentSelections,
  selectTalent,
  validateTalentSelection,
  applyTalentEffects,
  TALENT_REQUIREMENTS,
} from '../../services/groomTalentService.mjs';

describe('Groom Talent Service', () => {
  let testUser;
  let testGroom;

  beforeEach(async () => {
    const testSuffix = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

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
        speciality: 'foal_care',
        userId: testUser.id ,
        level: 5,
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
    await prisma.$disconnect();
  });

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

      expect(requirements.tier1.minLevel).toBe(3);
      expect(requirements.tier2.minLevel).toBe(5);
      expect(requirements.tier3.minLevel).toBe(8);
    });
  });

  describe('Talent Selection Validation', () => {
    test('should validate valid talent selection', async () => {
      const validation = await validateTalentSelection(testGroom.id, 'tier1', 'gentle_hands');

      expect(validation.valid).toBe(true);
      expect(validation.groomLevel).toBe(5);
      expect(validation.requiredLevel).toBe(3);
    });

    test('should reject selection for insufficient level', async () => {
      // Create low-level groom
      const lowLevelGroom = await prisma.groom.create({
        data: {
          name: `Low Level Groom ${Date.now()}`,
          personality: 'calm',
          skillLevel: 'novice',
          speciality: 'foal_care',
          userId: testUser.id ,
          level: 2,
          experience: 50,
        },
      });

      const validation = await validateTalentSelection(lowLevelGroom.id, 'tier1', 'gentle_hands');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('insufficient_level');
      expect(validation.groomLevel).toBe(2);
      expect(validation.requiredLevel).toBe(3);

      // Cleanup
      await prisma.groom.delete({ where: { id: lowLevelGroom.id } });
    });

    test('should reject invalid talent for personality', async () => {
      const validation = await validateTalentSelection(testGroom.id, 'tier1', 'invalid_talent');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('invalid_talent');
    });

    test('should reject selection if tier already selected', async () => {
      // First, make a valid selection
      await selectTalent(testGroom.id, 'tier1', 'gentle_hands');

      // Try to select a different talent in the same tier
      const validation = await validateTalentSelection(testGroom.id, 'tier1', 'patience_virtue');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('tier_already_selected');
    });

    test('should require prerequisite tiers', async () => {
      // Try to select tier 2 without tier 1
      const validation = await validateTalentSelection(testGroom.id, 'tier2', 'stress_whisperer');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('prerequisite_required');
    });
  });

  describe('Talent Selection', () => {
    test('should successfully select tier 1 talent', async () => {
      const result = await selectTalent(testGroom.id, 'tier1', 'gentle_hands');

      expect(result.success).toBe(true);
      expect(result.selection.tier1).toBe('gentle_hands');
      expect(result.selection.groomId).toBe(testGroom.id);

      // Verify database was updated
      const selections = await prisma.groomTalentSelections.findUnique({
        where: { groomId: testGroom.id },
      });
      expect(selections.tier1).toBe('gentle_hands');
    });

    test('should successfully select multiple tiers in sequence', async () => {
      // Update groom to level 8 to unlock all tiers
      await prisma.groom.update({
        where: { id: testGroom.id },
        data: { level: 8 },
      });

      // Select tier 1
      await selectTalent(testGroom.id, 'tier1', 'gentle_hands');

      // Select tier 2
      await selectTalent(testGroom.id, 'tier2', 'stress_whisperer');

      // Select tier 3
      const result = await selectTalent(testGroom.id, 'tier3', 'master_bonding');

      expect(result.success).toBe(true);
      expect(result.selection.tier1).toBe('gentle_hands');
      expect(result.selection.tier2).toBe('stress_whisperer');
      expect(result.selection.tier3).toBe('master_bonding');
    });

    test('should reject invalid talent selection', async () => {
      await expect(selectTalent(testGroom.id, 'tier1', 'invalid_talent')).rejects.toThrow('Invalid talent selection');
    });

    test('should reject selection for insufficient level', async () => {
      // Create low-level groom
      const lowLevelGroom = await prisma.groom.create({
        data: {
          name: `Low Level Groom ${Date.now()}`,
          personality: 'calm',
          skillLevel: 'novice',
          speciality: 'foal_care',
          userId: testUser.id ,
          level: 1,
          experience: 10,
        },
      });

      await expect(selectTalent(lowLevelGroom.id, 'tier1', 'gentle_hands')).rejects.toThrow('insufficient_level');

      // Cleanup
      await prisma.groom.delete({ where: { id: lowLevelGroom.id } });
    });
  });

  describe('Talent Effects', () => {
    test('should apply talent effects to groom interactions', async () => {
      // Select a talent with bonding bonus
      await selectTalent(testGroom.id, 'tier1', 'gentle_hands');

      // Apply talent effects to a mock interaction
      const baseInteraction = {
        bondingChange: 5,
        stressChange: -2,
        quality: 'good',
      };

      const enhancedInteraction = await applyTalentEffects(testGroom.id, baseInteraction);

      expect(enhancedInteraction.bondingChange).toBeGreaterThan(baseInteraction.bondingChange);
      // gentle_hands only has bonding bonus, not stress reduction
      expect(enhancedInteraction.stressChange).toBe(baseInteraction.stressChange);
      expect(enhancedInteraction.talentBonuses).toBeDefined();
      expect(enhancedInteraction.talentBonuses.length).toBeGreaterThan(0);
    });

    test('should handle multiple talent effects', async () => {
      // Update groom to level 8 and select multiple talents
      await prisma.groom.update({
        where: { id: testGroom.id },
        data: { level: 8 },
      });

      await selectTalent(testGroom.id, 'tier1', 'gentle_hands');
      await selectTalent(testGroom.id, 'tier2', 'stress_whisperer');

      const baseInteraction = {
        bondingChange: 5,
        stressChange: -2,
        quality: 'good',
      };

      const enhancedInteraction = await applyTalentEffects(testGroom.id, baseInteraction);

      expect(enhancedInteraction.talentBonuses.length).toBe(2);
      expect(enhancedInteraction.bondingChange).toBeGreaterThan(baseInteraction.bondingChange);
    });

    test('should handle groom with no talent selections', async () => {
      const baseInteraction = {
        bondingChange: 5,
        stressChange: -2,
        quality: 'good',
      };

      const enhancedInteraction = await applyTalentEffects(testGroom.id, baseInteraction);

      expect(enhancedInteraction.bondingChange).toBe(baseInteraction.bondingChange);
      expect(enhancedInteraction.stressChange).toBe(baseInteraction.stressChange);
      expect(enhancedInteraction.talentBonuses).toEqual([]);
    });
  });

  describe('Talent Retrieval', () => {
    test('should get groom talent selections', async () => {
      // Select some talents first
      await selectTalent(testGroom.id, 'tier1', 'gentle_hands');

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
