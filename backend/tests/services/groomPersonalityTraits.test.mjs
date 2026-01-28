/**
 * Groom Personality Trait System Tests
 *
 * Tests detailed personality traits for grooms with specific interaction modifiers.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 *
 * Business Rules Tested:
 * - Detailed personality trait definitions and effects
 * - Personality-specific interaction modifiers
 * - Experience-based personality trait development
 * - Trait compatibility with different horse types
 * - Personality trait influence on task effectiveness
 * - Dynamic trait expression based on context
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import {
  getGroomPersonalityTraits,
  calculatePersonalityModifiers,
  analyzePersonalityCompatibility,
  updatePersonalityTraits,
  getPersonalityTraitDefinitions,
} from '../../services/groomPersonalityTraits.mjs';

describe('Groom Personality Trait System', () => {
  let testUser;
  let testGrooms = [];
  let testHorses = [];

  beforeAll(async () => {
    // Create test horses with different temperaments
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      // Create test user
      testUser = await tx.user.create({
        data: {
          username: `groomtraits_${Date.now()}`,
          email: `groomtraits_${Date.now()}@test.com`,
          password: 'test_hash',
          firstName: 'Test',
          lastName: 'User',
          money: 1000,
          xp: 0,
          level: 1,
        },
      });

      // Create test grooms with different personalities and experience levels
      testGrooms = await Promise.all([
        // Calm personality groom
        tx.groom.create({
          data: {
            name: `Calm Expert Groom ${Date.now()}`,
            personality: 'calm',
            groomPersonality: 'calm',
            skillLevel: 'expert',
            speciality: 'foal_care',
            userId: testUser.id,
            sessionRate: 35.0,
            experience: 150, // High experience
            level: 8,
          },
        }),
        // Energetic personality groom
        tx.groom.create({
          data: {
            name: `Energetic Novice Groom ${Date.now()}`,
            personality: 'energetic',
            groomPersonality: 'energetic',
            skillLevel: 'novice',
            speciality: 'general_grooming',
            userId: testUser.id,
            sessionRate: 15.0,
            experience: 25, // Low experience
            level: 2,
          },
        }),
        // Methodical personality groom
        tx.groom.create({
          data: {
            name: `Methodical Experienced Groom ${Date.now()}`,
            personality: 'methodical',
            groomPersonality: 'methodical',
            skillLevel: 'experienced',
            speciality: 'foal_care',
            userId: testUser.id,
            sessionRate: 28.0,
            experience: 80, // Medium experience
            level: 5,
          },
        }),
      ]);

      testHorses = await Promise.all([
        // Nervous/fearful horse
        tx.horse.create({
          data: {
            name: `Test Horse Nervous ${Date.now()}`,
            sex: 'filly',
            dateOfBirth: oneMonthAgo,
            ownerId: testUser.id,
            bondScore: 10,
            stressLevel: 8,
            epigeneticFlags: ['fearful', 'insecure'],
          },
        }),
        // Confident/brave horse
        tx.horse.create({
          data: {
            name: `Test Horse Confident ${Date.now()}`,
            sex: 'colt',
            dateOfBirth: oneMonthAgo,
            ownerId: testUser.id,
            bondScore: 35,
            stressLevel: 2,
            epigeneticFlags: ['brave', 'confident'],
          },
        }),
        // Neutral horse
        tx.horse.create({
          data: {
            name: `Test Horse Neutral ${Date.now()}`,
            sex: 'gelding',
            dateOfBirth: oneMonthAgo,
            ownerId: testUser.id,
            bondScore: 20,
            stressLevel: 5,
            epigeneticFlags: [],
          },
        }),
      ]);
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.groomInteraction.deleteMany({
      where: { groomId: { in: testGrooms.map(g => g.id) } },
    });
    await prisma.groomAssignment.deleteMany({
      where: { groomId: { in: testGrooms.map(g => g.id) } },
    });
    await prisma.groom.deleteMany({
      where: { id: { in: testGrooms.map(g => g.id) } },
    });
    await prisma.horse.deleteMany({
      where: { id: { in: testHorses.map(h => h.id) } },
    });
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
  });

  describe('getGroomPersonalityTraits', () => {
    test('should return detailed personality traits for calm groom', async () => {
      const [calmGroom] = testGrooms; // Expert calm groom

      const traits = await getGroomPersonalityTraits(calmGroom.id);

      expect(traits).toBeDefined();
      expect(traits.groomId).toBe(calmGroom.id);
      expect(traits.primaryPersonality).toBe('calm');
      expect(traits.traits).toBeDefined();
      expect(Array.isArray(traits.traits)).toBe(true);

      // Should have calm-specific traits
      const traitNames = traits.traits.map(t => t.name);
      expect(traitNames).toContain('patient');
      expect(traitNames).toContain('gentle');
      expect(traitNames).toContain('consistent');

      // Should have experience-based trait development
      expect(traits.experienceLevel).toBe('high');
      expect(traits.traitStrength).toBeGreaterThan(0.7); // High experience = strong traits
    });

    test('should return detailed personality traits for energetic groom', async () => {
      // eslint-disable-next-line prefer-destructuring
      const energeticGroom = testGrooms[1]; // Novice energetic groom

      const traits = await getGroomPersonalityTraits(energeticGroom.id);

      expect(traits).toBeDefined();
      expect(traits.primaryPersonality).toBe('energetic');

      // Should have energetic-specific traits
      const traitNames = traits.traits.map(t => t.name);
      expect(traitNames).toContain('enthusiastic');
      expect(traitNames).toContain('dynamic');
      expect(traitNames).toContain('stimulating');

      // Should have lower trait strength due to low experience
      expect(traits.experienceLevel).toBe('low');
      expect(traits.traitStrength).toBeLessThan(0.5);
    });

    test('should return detailed personality traits for methodical groom', async () => {
      // eslint-disable-next-line prefer-destructuring
      const methodicalGroom = testGrooms[2]; // Experienced methodical groom

      const traits = await getGroomPersonalityTraits(methodicalGroom.id);

      expect(traits).toBeDefined();
      expect(traits.primaryPersonality).toBe('methodical');

      // Should have methodical-specific traits
      const traitNames = traits.traits.map(t => t.name);
      expect(traitNames).toContain('systematic');
      expect(traitNames).toContain('thorough');
      expect(traitNames).toContain('precise');

      // Should have medium trait strength
      expect(traits.experienceLevel).toBe('medium');
      expect(traits.traitStrength).toBeGreaterThan(0.5);
      expect(traits.traitStrength).toBeLessThan(0.8);
    });
  });

  describe('calculatePersonalityModifiers', () => {
    test('should calculate modifiers for calm groom with nervous horse', async () => {
      const [calmGroom] = testGrooms;
      const [nervousHorse] = testHorses;

      const modifiers = await calculatePersonalityModifiers(calmGroom.id, nervousHorse.id, 'trust_building');

      expect(modifiers).toBeDefined();
      expect(modifiers.bondingModifier).toBeGreaterThan(1.0); // Calm grooms excel with nervous horses
      expect(modifiers.stressModifier).toBeLessThan(1.0); // Reduce stress
      expect(modifiers.qualityModifier).toBeGreaterThan(1.0); // Higher quality interactions
      expect(modifiers.taskEffectiveness).toBeGreaterThan(1.0); // More effective
      expect(modifiers.compatibilityScore).toBeGreaterThan(0.7); // High compatibility
    });

    test('should calculate modifiers for energetic groom with confident horse', async () => {
      // eslint-disable-next-line prefer-destructuring
      const energeticGroom = testGrooms[1];
      // eslint-disable-next-line prefer-destructuring
      const confidentHorse = testHorses[1];

      const modifiers = await calculatePersonalityModifiers(energeticGroom.id, confidentHorse.id, 'desensitization');

      expect(modifiers).toBeDefined();
      expect(modifiers.bondingModifier).toBeGreaterThan(1.0); // Good match
      expect(modifiers.taskEffectiveness).toBeGreaterThan(1.0); // Effective for stimulating tasks
      expect(modifiers.compatibilityScore).toBeGreaterThan(0.6); // Good compatibility
    });

    test('should calculate modifiers for energetic groom with nervous horse', async () => {
      // eslint-disable-next-line prefer-destructuring
      const energeticGroom = testGrooms[1];
      const [nervousHorse] = testHorses;

      const modifiers = await calculatePersonalityModifiers(energeticGroom.id, nervousHorse.id, 'trust_building');

      expect(modifiers).toBeDefined();
      expect(modifiers.stressModifier).toBeGreaterThan(1.0); // May increase stress
      expect(modifiers.compatibilityScore).toBeLessThan(0.5); // Poor compatibility
      expect(modifiers.taskEffectiveness).toBeLessThan(1.0); // Less effective
    });

    test('should calculate modifiers for methodical groom with any horse', async () => {
      // eslint-disable-next-line prefer-destructuring
      const methodicalGroom = testGrooms[2];
      // eslint-disable-next-line prefer-destructuring
      const neutralHorse = testHorses[2];

      const modifiers = await calculatePersonalityModifiers(methodicalGroom.id, neutralHorse.id, 'hoof_handling');

      expect(modifiers).toBeDefined();
      expect(modifiers.qualityModifier).toBeGreaterThan(1.0); // Consistent high quality
      expect(modifiers.taskEffectiveness).toBeGreaterThan(1.0); // Methodical approach effective
      expect(modifiers.compatibilityScore).toBeGreaterThan(0.5); // Generally compatible
    });
  });

  describe('analyzePersonalityCompatibility', () => {
    test('should analyze compatibility between groom and horse personalities', async () => {
      const [calmGroom] = testGrooms;
      const [nervousHorse] = testHorses;

      const compatibility = await analyzePersonalityCompatibility(calmGroom.id, nervousHorse.id);

      expect(compatibility).toBeDefined();
      expect(compatibility.overallScore).toBeGreaterThan(0.7); // High compatibility
      expect(compatibility.strengths).toBeDefined();
      expect(Array.isArray(compatibility.strengths)).toBe(true);
      expect(compatibility.challenges).toBeDefined();
      expect(Array.isArray(compatibility.challenges)).toBe(true);
      expect(compatibility.recommendations).toBeDefined();
      expect(Array.isArray(compatibility.recommendations)).toBe(true);

      // Should identify specific strengths
      expect(compatibility.strengths.length).toBeGreaterThan(0);
      expect(compatibility.strengths.some(s => s.includes('calm') || s.includes('patient'))).toBe(true);
    });

    test('should identify poor compatibility combinations', async () => {
      // eslint-disable-next-line prefer-destructuring
      const energeticGroom = testGrooms[1];
      const [nervousHorse] = testHorses;

      const compatibility = await analyzePersonalityCompatibility(energeticGroom.id, nervousHorse.id);

      expect(compatibility).toBeDefined();
      expect(compatibility.overallScore).toBeLessThan(0.5); // Poor compatibility
      expect(compatibility.challenges.length).toBeGreaterThan(0);
      expect(compatibility.recommendations.length).toBeGreaterThan(0);

      // Should suggest alternatives or modifications
      expect(compatibility.recommendations.some(r =>
        r.includes('calm') || r.includes('gentle') || r.includes('avoid'),
      )).toBe(true);
    });
  });

  describe('updatePersonalityTraits', () => {
    test('should update personality traits based on interaction outcomes', async () => {
      // eslint-disable-next-line prefer-destructuring
      const groom = testGrooms[1]; // Energetic novice groom

      // Create some interactions to base trait updates on
      await prisma.groomInteraction.create({
        data: {
          groomId: groom.id,
          foalId: testHorses[1].id, // Confident horse
          interactionType: 'enrichment',
          duration: 30,
          taskType: 'desensitization',
          bondingChange: 3,
          stressChange: -1,
          quality: 'excellent',
          cost: 15.0,
        },
      });

      const initialTraits = await getGroomPersonalityTraits(groom.id);
      const result = await updatePersonalityTraits(groom.id);
      const updatedTraits = await getGroomPersonalityTraits(groom.id);

      expect(result).toBeDefined();
      expect(result.traitsUpdated).toBeDefined();
      expect(result.experienceGained).toBeGreaterThan(0);

      // Should show some development (though may be minimal with one interaction)
      expect(updatedTraits.traitStrength).toBeGreaterThanOrEqual(initialTraits.traitStrength);
    });
  });

  describe('getPersonalityTraitDefinitions', () => {
    test('should return comprehensive trait definitions', async () => {
      const definitions = await getPersonalityTraitDefinitions();

      expect(definitions).toBeDefined();
      expect(definitions.personalities).toBeDefined();
      expect(definitions.personalities.calm).toBeDefined();
      expect(definitions.personalities.energetic).toBeDefined();
      expect(definitions.personalities.methodical).toBeDefined();

      // Each personality should have detailed trait definitions
      const calmTraits = definitions.personalities.calm.traits;
      expect(Array.isArray(calmTraits)).toBe(true);
      expect(calmTraits.length).toBeGreaterThan(0);

      // Each trait should have proper structure
      const [firstTrait] = calmTraits;
      expect(firstTrait).toHaveProperty('name');
      expect(firstTrait).toHaveProperty('description');
      expect(firstTrait).toHaveProperty('effects');
      expect(firstTrait).toHaveProperty('compatibleWith');
      expect(firstTrait).toHaveProperty('incompatibleWith');
    });
  });
});
