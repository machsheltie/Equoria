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
import { randomBytes } from 'node:crypto';
import { fixtureColor } from '../helpers/fixtureColor.mjs';
import {
  getGroomPersonalityTraits,
  calculatePersonalityModifiers,
  analyzePersonalityCompatibility,
  getPersonalityTraitDefinitions,
} from '../../modules/grooms/services/groomPersonalityTraits.mjs';
import { gameCalendarDate } from '../../utils/gameTime.mjs';
import { testHorseData } from '../../__tests__/helpers/createTestHorse.mjs';

describe('Groom Personality Trait System', () => {
  let testUser;
  let testGrooms = [];
  let testHorses = [];

  beforeAll(async () => {
    // Create test horses with different temperaments
    const now = new Date();
    const oneMonthAgo = gameCalendarDate(now, -30);

    await prisma.$transaction(
      async tx => {
        // Create test user
        testUser = await tx.user.create({
          data: {
            emailVerified: true,
            username: `groomtraits_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
            email: `groomtraits_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@test.com`,
            password: 'testHash',
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
              name: `Calm Expert Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              personality: 'calm',
              epigeneticInfluenceType: 'calm',
              skillLevel: 'expert',
              speciality: 'foalCare',
              userId: testUser.id,
              sessionRate: 35.0,
              experience: 150, // High experience
            },
          }),
          // Energetic personality groom
          tx.groom.create({
            data: {
              name: `Energetic Novice Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              personality: 'energetic',
              epigeneticInfluenceType: 'energetic',
              skillLevel: 'novice',
              speciality: 'generalGrooming',
              userId: testUser.id,
              sessionRate: 15.0,
              experience: 25, // Low experience
            },
          }),
          // Methodical personality groom
          tx.groom.create({
            data: {
              name: `Methodical Experienced Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              personality: 'methodical',
              epigeneticInfluenceType: 'methodical',
              skillLevel: 'experienced',
              speciality: 'foalCare',
              userId: testUser.id,
              sessionRate: 28.0,
              experience: 80, // Medium experience
            },
          }),
        ]);

        testHorses = await Promise.all([
          // Nervous/fearful horse
          tx.horse.create({
            data: await testHorseData(tx, {
              ...fixtureColor(),
              name: `Test Horse Nervous ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              sex: 'filly',
              dateOfBirth: oneMonthAgo,
              userId: testUser.id,
              bondScore: 10,
            }),
          }),
          // Confident/brave horse
          tx.horse.create({
            data: await testHorseData(tx, {
              ...fixtureColor(),
              name: `Test Horse Confident ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              sex: 'colt',
              dateOfBirth: oneMonthAgo,
              userId: testUser.id,
              bondScore: 35,
            }),
          }),
          // Neutral horse
          tx.horse.create({
            data: await testHorseData(tx, {
              ...fixtureColor(),
              name: `Test Horse Neutral ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              sex: 'Colt',
              dateOfBirth: oneMonthAgo,
              userId: testUser.id,
              bondScore: 20,
            }),
          }),
        ]);
      },
      // Equoria-v1qf: raise from 5000ms default — under --runInBand with 312
      // suites this beforeAll can start >20s into the run, expiring the default.
      { timeout: 30000 },
    );
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

  // CONTRACT CHANGED BY THE OWNER, 2026-10-29 (q300, Equoria-efs4j): the old
  // epigeneticFlags store is dropped with every reader. Old contract: these horses
  // carried flags (fearful/insecure, brave/confident, none), so a calm groom scored
  // > 0.7 with the nervous horse and an energetic groom < 0.5. New contract: no
  // horse has flags, so every pair gets the no-flag values a flagless horse always
  // got: overall compatibility 0.6, no strengths or challenges, moderate advice,
  // and modifiers that do not depend on the horse.
  describe('calculatePersonalityModifiers', () => {
    test.each([
      ['calm', 0, 'trustBuilding'],
      ['energetic', 1, 'desensitization'],
      ['methodical', 2, 'hoofHandling'],
    ])('a %s groom gets the same no-flag modifiers with every horse', async (_label, groomIndex, taskType) => {
      const groom = testGrooms[groomIndex];
      const results = [];
      for (const horse of testHorses) {
        results.push(await calculatePersonalityModifiers(groom.id, horse.id, taskType));
      }

      for (const modifiers of results) {
        expect(modifiers).toEqual(results[0]);
        expect(modifiers.compatibilityScore).toBe(0.6);
        expect(modifiers.bondingModifier).toBeGreaterThanOrEqual(1.0);
        expect(modifiers.qualityModifier).toBeGreaterThanOrEqual(1.0);
        expect(modifiers.taskEffectiveness).toBeGreaterThan(1.0);
      }
    });

    test('the result names no horse flags', async () => {
      const modifiers = await calculatePersonalityModifiers(testGrooms[0].id, testHorses[0].id, 'trustBuilding');
      expect(modifiers).not.toHaveProperty('horseFlags');
    });
  });

  describe('analyzePersonalityCompatibility', () => {
    test('every groom and horse pair is the moderate no-flag match', async () => {
      for (const groom of testGrooms) {
        for (const horse of testHorses) {
          const compatibility = await analyzePersonalityCompatibility(groom.id, horse.id);

          expect(compatibility.overallScore).toBe(0.6);
          expect(compatibility.compatibilityLevel).toBe('good');
          expect(compatibility.strengths).toEqual([]);
          expect(compatibility.challenges).toEqual([]);
          expect(compatibility.recommendations).toEqual([
            'Moderate compatibility - monitor interactions closely',
            "Adjust approach based on horse's daily mood",
          ]);
        }
      }
    });

    test('the result names no horse flags', async () => {
      const compatibility = await analyzePersonalityCompatibility(testGrooms[0].id, testHorses[0].id);
      expect(compatibility).not.toHaveProperty('horseFlags');
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
