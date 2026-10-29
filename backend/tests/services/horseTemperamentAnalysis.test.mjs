/**
 * Horse Temperament Analysis Tests
 *
 * Tests horse temperament analysis based on interaction history.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 *
 * Flag-based classification (classifyTemperamentFromFlags) and the fixtures'
 * flags went with the old epigeneticFlags store (owner ruling 2026-10-29, q300,
 * Equoria-efs4j). None of the remaining cases read a flag: each horse's result
 * came from its interactions or basic stats, as it still does.
 *
 * Business Rules Tested:
 * - Temperament analysis from interaction patterns
 * - Behavioral trend analysis over time
 * - Bonding preference analysis
 * - Temperament stability and change detection
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import { randomBytes } from 'node:crypto';
import { analyzeHorseTemperament } from '../../modules/horses/index.mjs';
import {
  analyzeBehavioralTrends,
  analyzeBondingPreferences,
  detectTemperamentChanges,
} from '../../modules/horses/services/horseTemperamentAnalysis.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
// Equoria-w5n8c: serialise arrange-step create burst (jpmza sibling).
import { createSequentially } from '../helpers/createSequentially.mjs';
import { gameCalendarDate } from '../../utils/gameTime.mjs';

describe('Horse Temperament Analysis', () => {
  let testUser;
  let testGrooms = [];
  let testHorses = [];

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `temperament_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        email: `temperament_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@test.com`,
        password: 'testHash',
        firstName: 'Test',
        lastName: 'User',
        money: 1000,
        xp: 0,
        level: 1,
      },
    });

    // Create test grooms with different personalities
    testGrooms = await createSequentially([
      () =>
        prisma.groom.create({
          data: {
            name: `Calm Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
            personality: 'calm',
            epigeneticInfluenceType: 'calm',
            skillLevel: 'expert',
            speciality: 'foalCare',
            userId: testUser.id,
            sessionRate: 30.0,
          },
        }),
      () =>
        prisma.groom.create({
          data: {
            name: `Energetic Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
            personality: 'energetic',
            epigeneticInfluenceType: 'energetic',
            skillLevel: 'expert',
            speciality: 'generalGrooming',
            userId: testUser.id,
            sessionRate: 25.0,
          },
        }),
    ]);

    // Create test horses with different interaction histories
    const now = new Date();
    const oneMonthAgo = gameCalendarDate(now, -30);

    testHorses = await createSequentially([
      // Nervous/reactive horse
      () =>
        prisma.horse.create({
          data: {
            ...fixtureColor(),
            name: `Test Horse Nervous ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
            sex: 'filly',
            dateOfBirth: oneMonthAgo,
            userId: testUser.id,
            bondScore: 12,
          },
        }),
      // Confident/social horse
      () =>
        prisma.horse.create({
          data: {
            ...fixtureColor(),
            name: `Test Horse Confident ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
            sex: 'colt',
            dateOfBirth: oneMonthAgo,
            userId: testUser.id,
            bondScore: 35,
          },
        }),
      // Mixed temperament horse
      () =>
        prisma.horse.create({
          data: {
            ...fixtureColor(),
            name: `Test Horse Mixed ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
            sex: 'Colt',
            dateOfBirth: oneMonthAgo,
            userId: testUser.id,
            bondScore: 22,
          },
        }),
      // Developing temperament horse (no interactions)
      () =>
        prisma.horse.create({
          data: {
            ...fixtureColor(),
            name: `Test Horse Developing ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
            sex: 'mare',
            dateOfBirth: oneMonthAgo,
            userId: testUser.id,
            bondScore: 18,
          },
        }),
    ]);
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

  describe('analyzeHorseTemperament', () => {
    test('should analyze temperament for nervous horse with interaction history', async () => {
      const [nervousHorse] = testHorses;

      // Create interaction history showing nervous behavior
      await createSequentially([
        () =>
          prisma.groomInteraction.create({
            data: {
              groomId: testGrooms[0].id, // Calm groom
              foalId: nervousHorse.id,
              interactionType: 'enrichment',
              duration: 30,
              taskType: 'trustBuilding',
              bondingChange: 1, // Slow bonding
              quality: 'fair',
              cost: 30.0,
            },
          }),
        () =>
          prisma.groomInteraction.create({
            data: {
              groomId: testGrooms[1].id, // Energetic groom
              foalId: nervousHorse.id,
              interactionType: 'grooming',
              duration: 25,
              taskType: 'desensitization',
              bondingChange: -1, // Negative bonding
              quality: 'poor',
              cost: 25.0,
            },
          }),
      ]);

      const temperament = await analyzeHorseTemperament(nervousHorse.id);

      expect(temperament).toBeDefined();
      expect(temperament.horseId).toBe(nervousHorse.id);
      expect(temperament.primaryTemperament).toBeDefined();
      expect(temperament.temperamentTraits).toBeDefined();
      expect(Array.isArray(temperament.temperamentTraits)).toBe(true);
      expect(temperament.confidenceLevel).toBeDefined();
      expect(temperament.socialTendency).toBeDefined();
      expect(temperament.adaptability).toBeDefined();

      // Old contract: two interactions (< 5) and fearful/reactive/insecure flags took
      // the flag path and read 'nervous'. The flag store is gone (owner ruling
      // 2026-10-29, q300, Equoria-efs4j): with fewer than 5 interactions a horse uses
      // basic stats, as every real (flagless) horse always did; bond 12 / 40 = 0.3.
      expect(temperament.reliabilityScore).toBe(0.3);
      expect(temperament.primaryTemperament).toBe('developing');
      expect(temperament.confidenceLevel).toBeLessThan(0.5);
    });

    test('should analyze temperament for confident horse', async () => {
      const confidentHorse = testHorses[1];

      // Create interaction history showing confident behavior
      await createSequentially([
        () =>
          prisma.groomInteraction.create({
            data: {
              groomId: testGrooms[0].id,
              foalId: confidentHorse.id,
              interactionType: 'enrichment',
              duration: 30,
              taskType: 'showgroundExposure',
              bondingChange: 3, // Good bonding
              quality: 'excellent',
              cost: 30.0,
            },
          }),
        () =>
          prisma.groomInteraction.create({
            data: {
              groomId: testGrooms[1].id,
              foalId: confidentHorse.id,
              interactionType: 'enrichment',
              duration: 35,
              taskType: 'desensitization',
              bondingChange: 4, // Excellent bonding
              quality: 'excellent',
              cost: 25.0,
            },
          }),
      ]);

      const temperament = await analyzeHorseTemperament(confidentHorse.id);

      expect(temperament.primaryTemperament).toBeDefined();
      // Old contract: brave/confident/social flags took the flag path ('confident',
      // social 0.8). Without the flag store (Equoria-efs4j) two interactions (< 5)
      // mean basic stats: bond 35 / 40 = 0.875, social and adaptability neutral 0.5.
      expect(temperament.reliabilityScore).toBe(0.3);
      expect(temperament.primaryTemperament).toBe('developing');
      expect(temperament.confidenceLevel).toBeGreaterThan(0.6);
      expect(temperament.socialTendency).toBe(0.5);
    });

    test('should analyze temperament for horse with no interaction history', async () => {
      const developingHorse = testHorses[3];

      const temperament = await analyzeHorseTemperament(developingHorse.id);

      expect(temperament).toBeDefined();
      expect(temperament.primaryTemperament).toBe('developing');
      expect(temperament.dataSource).toBe('basic_stats'); // No interactions, so uses basic stats
      expect(temperament.reliabilityScore).toBeLessThan(0.7); // Lower reliability without interaction data
    });
  });

  describe('analyzeBehavioralTrends', () => {
    test('should analyze behavioral trends over time', async () => {
      const horse = testHorses[2]; // Mixed temperament horse

      // Create a series of interactions showing behavioral trends
      const interactions = [];
      for (let i = 0; i < 5; i++) {
        const interaction = await prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[0].id,
            foalId: horse.id,
            interactionType: 'enrichment',
            duration: 30,
            taskType: 'trustBuilding',
            bondingChange: 2 + i, // Improving bonding over time
            quality: i < 2 ? 'fair' : i < 4 ? 'good' : 'excellent',
            cost: 30.0,
            createdAt: new Date(Date.now() - (5 - i) * 24 * 60 * 60 * 1000),
          },
        });
        interactions.push(interaction);
      }

      const trends = await analyzeBehavioralTrends(horse.id);

      expect(trends).toBeDefined();
      expect(trends.bondingTrend).toBeDefined();
      expect(trends.qualityTrend).toBeDefined();
      expect(trends.overallDirection).toBeDefined();
      expect(trends.trendStrength).toBeDefined();

      // Should detect improving trends
      expect(trends.bondingTrend).toBe('improving');
      expect(trends.overallDirection).toBe('positive');
      expect(trends.trendStrength).toBeGreaterThan(0.5);
    });
  });

  describe('analyzeBondingPreferences', () => {
    test('should analyze bonding preferences', async () => {
      const horse = testHorses[1]; // Confident horse

      const preferences = await analyzeBondingPreferences(horse.id);

      expect(preferences).toBeDefined();
      expect(preferences.preferredGroomTypes).toBeDefined();
      expect(Array.isArray(preferences.preferredGroomTypes)).toBe(true);
      expect(preferences.preferredInteractionTypes).toBeDefined();
      expect(preferences.bondingSpeed).toBeDefined();
      expect(preferences.socialNature).toBeDefined();
      expect(preferences.trustLevel).toBeDefined();

      // Should show preferences based on interaction history
      expect(preferences.bondingSpeed).toBeGreaterThan(0.5);
      expect(preferences.socialNature).toBeGreaterThan(0.5);
    });
  });

  describe('detectTemperamentChanges', () => {
    test('should detect temperament changes over time', async () => {
      const horse = testHorses[3]; // Developing horse

      // Create interactions showing temperament development
      await createSequentially([
        () =>
          prisma.groomInteraction.create({
            data: {
              groomId: testGrooms[0].id,
              foalId: horse.id,
              interactionType: 'enrichment',
              duration: 30,
              taskType: 'trustBuilding',
              bondingChange: 3,
              quality: 'good',
              cost: 30.0,
              createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
            },
          }),
        () =>
          prisma.groomInteraction.create({
            data: {
              groomId: testGrooms[0].id,
              foalId: horse.id,
              interactionType: 'enrichment',
              duration: 30,
              taskType: 'showgroundExposure',
              bondingChange: 4,
              quality: 'excellent',
              cost: 30.0,
              createdAt: new Date(), // Recent
            },
          }),
      ]);

      const changes = await detectTemperamentChanges(horse.id);

      expect(changes).toBeDefined();
      expect(changes.changeDetected).toBeDefined();
      expect(changes.changeDirection).toBeDefined();
      expect(changes.changeStrength).toBeDefined();
      expect(changes.timeframe).toBeDefined();
      expect(changes.contributingFactors).toBeDefined();

      if (changes.changeDetected) {
        expect(['positive', 'negative', 'neutral'].includes(changes.changeDirection)).toBe(true);
        expect(changes.changeStrength).toBeGreaterThan(0);
      }
    });
  });
});
