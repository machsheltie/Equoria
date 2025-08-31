/**
 * Personality Evolution System Tests
 * 
 * Tests comprehensive personality evolution for both grooms and horses based on experience and interactions.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 * 
 * Business Rules Tested:
 * - Groom personality evolution based on interaction patterns and experience
 * - Horse temperament evolution based on care history and environmental factors
 * - Experience-driven personality trait development and strengthening
 * - Interaction-based personality shifts and adaptations
 * - Long-term personality stability vs dynamic evolution balance
 * - Cross-species personality influence (groom-horse personality convergence)
 */

import { jest } from '@jest/globals';
import prisma from '../../../packages/database/prismaClient.mjs';
import {
  evolveGroomPersonality,
  evolveHorseTemperament,
  calculatePersonalityEvolutionTriggers,
  analyzePersonalityStability,
  predictPersonalityEvolution,
  getPersonalityEvolutionHistory,
  applyPersonalityEvolutionEffects,
} from '../../services/personalityEvolutionSystem.mjs';

describe('Personality Evolution System', () => {
  let testUser;
  let testGroom;
  let testHorse;
  let testBreed;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `personality_evolution_${Date.now()}`,
        email: `personality_evolution_${Date.now()}@test.com`,
        password: 'test_hash',
        firstName: 'Test',
        lastName: 'User',
        money: 1000,
        xp: 0,
        level: 1,
      },
    });

    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: 'Test Breed',
        description: 'Test breed for personality evolution testing',
      },
    });

    // Create test groom
    testGroom = await prisma.groom.create({
      data: {
        userId: testUser.id,
        name: 'Evolution Test Groom',
        speciality: 'foal_care',
        personality: 'calm',
        groomPersonality: 'calm',
        skillLevel: 'intermediate',
        experience: 100,
        level: 5,
        sessionRate: 25.0,
        isActive: true,
      },
    });

    // Create test horse
    testHorse = await prisma.horse.create({
      data: {
        ownerId: testUser.id,
        breed: { connect: { id: testBreed.id } },
        name: 'Evolution Test Horse',
        sex: 'Filly',
        dateOfBirth: new Date('2022-01-01'),
        age: 2,
        temperament: 'nervous',
        stressLevel: 7,
        bondScore: 20,
        healthStatus: 'Good',
        speed: 50,
        stamina: 50,
        agility: 50,
        balance: 50,
        precision: 50,
        intelligence: 50,
        boldness: 50,
        flexibility: 50,
        obedience: 50,
        focus: 50,
        epigeneticFlags: [],
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.horse.deleteMany({ where: { ownerId: testUser.id } });
    await prisma.groom.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  });

  describe('Groom Personality Evolution', () => {
    test('should evolve groom personality based on interaction patterns', async () => {
      // Create interaction history showing consistent calm, patient interactions
      const interactions = [];
      for (let i = 0; i < 20; i++) {
        const interaction = await prisma.groomInteraction.create({
          data: {
            groomId: testGroom.id,
            foalId: testHorse.id,
            taskType: 'trust_building',
            interactionType: 'enrichment',
            bondingChange: 3,
            stressChange: -2,
            quality: 'excellent',
            cost: 25.0,
            duration: 30,
            notes: 'Calm, patient approach with excellent results',
          },
        });
        interactions.push(interaction);
      }

      const evolution = await evolveGroomPersonality(testGroom.id);

      expect(evolution.success).toBe(true);
      expect(evolution.personalityEvolved).toBe(true);
      expect(evolution.evolutionType).toBe('trait_strengthening');
      expect(evolution.newTraits).toContain('enhanced_patience');
      expect(evolution.experienceThreshold).toBeGreaterThan(0);
      expect(evolution.interactionPatterns).toBeDefined();
      expect(evolution.stabilityScore).toBeGreaterThan(0.5);
    });

    test('should not evolve personality with insufficient interaction data', async () => {
      // Create new groom with minimal interactions
      const newGroom = await prisma.groom.create({
        data: {
          userId: testUser.id,
          name: 'Minimal Interaction Groom',
          speciality: 'general_grooming',
          personality: 'energetic',
          groomPersonality: 'energetic',
          skillLevel: 'novice',
          experience: 20,
          level: 2,
          sessionRate: 20.0,
          isActive: true,
        },
      });

      const evolution = await evolveGroomPersonality(newGroom.id);

      expect(evolution.success).toBe(true);
      expect(evolution.personalityEvolved).toBe(false);
      expect(evolution.reason).toBe('insufficient_experience');
      expect(evolution.minimumInteractionsRequired).toBeGreaterThan(0);

      // Cleanup
      await prisma.groom.delete({ where: { id: newGroom.id } });
    });

    test('should calculate personality evolution triggers accurately', async () => {
      const triggers = await calculatePersonalityEvolutionTriggers(testGroom.id);

      expect(triggers.success).toBe(true);
      expect(triggers.triggers).toBeDefined();
      expect(triggers.triggers.experienceThreshold).toBeDefined();
      expect(triggers.triggers.interactionConsistency).toBeDefined();
      expect(triggers.triggers.performanceQuality).toBeDefined();
      expect(triggers.triggers.specialization).toBeDefined();
      expect(triggers.evolutionReadiness).toBeDefined();
      expect(triggers.nextEvolutionEstimate).toBeDefined();
    });
  });

  describe('Horse Temperament Evolution', () => {
    test('should evolve horse temperament based on care history', async () => {
      // Create consistent positive care history
      for (let i = 0; i < 15; i++) {
        await prisma.groomInteraction.create({
          data: {
            groomId: testGroom.id,
            foalId: testHorse.id,
            taskType: 'trust_building',
            interactionType: 'enrichment',
            bondingChange: 2,
            stressChange: -3,
            quality: 'good',
            cost: 25.0,
            duration: 30,
            notes: 'Consistent positive care reducing nervousness',
          },
        });
      }

      const evolution = await evolveHorseTemperament(testHorse.id);

      expect(evolution.success).toBe(true);
      expect(evolution.temperamentEvolved).toBe(true);
      expect(evolution.oldTemperament).toBe('nervous');
      expect(['developing', 'confident'].includes(evolution.newTemperament)).toBe(true);
      expect(evolution.evolutionFactors).toBeDefined();
      expect(evolution.careQualityScore).toBeGreaterThan(0.6);
      expect(evolution.stabilityPeriod).toBeGreaterThan(0);
    });

    test('should maintain temperament stability with mixed care patterns', async () => {
      // Create new horse for mixed care testing
      const mixedCareHorse = await prisma.horse.create({
        data: {
          ownerId: testUser.id,
          breed: { connect: { id: testBreed.id } },
          name: 'Mixed Care Horse',
          sex: 'Colt',
          dateOfBirth: new Date('2022-06-01'),
          age: 2,
          temperament: 'developing',
          stressLevel: 5,
          bondScore: 30,
          healthStatus: 'Good',
          speed: 50,
          stamina: 50,
          agility: 50,
          balance: 50,
          precision: 50,
          intelligence: 50,
          boldness: 50,
          flexibility: 50,
          obedience: 50,
          focus: 50,
          epigeneticFlags: [],
        },
      });

      // Create mixed quality interactions with more inconsistency
      for (let i = 0; i < 10; i++) {
        await prisma.groomInteraction.create({
          data: {
            groomId: testGroom.id,
            foalId: mixedCareHorse.id,
            taskType: i % 2 === 0 ? 'trust_building' : 'desensitization',
            interactionType: 'enrichment',
            bondingChange: i % 4 === 0 ? -1 : 1, // More inconsistent bonding
            stressChange: i % 3 === 0 ? 2 : -1, // More inconsistent stress changes
            quality: i % 3 === 0 ? 'poor' : (i % 2 === 0 ? 'fair' : 'good'), // More varied quality
            cost: 25.0,
            duration: 30,
            notes: 'Mixed quality care patterns',
          },
        });
      }

      const evolution = await evolveHorseTemperament(mixedCareHorse.id);

      expect(evolution.success).toBe(true);
      expect(evolution.temperamentEvolved).toBe(false);
      expect(evolution.reason).toBe('insufficient_consistency');
      expect(evolution.stabilityScore).toBeLessThan(0.7);

      // Cleanup
      await prisma.horse.delete({ where: { id: mixedCareHorse.id } });
    });

    test('should analyze personality stability accurately', async () => {
      const stability = await analyzePersonalityStability(testHorse.id, 'horse');

      expect(stability.success).toBe(true);
      expect(stability.stabilityScore).toBeGreaterThanOrEqual(0);
      expect(stability.stabilityScore).toBeLessThanOrEqual(1);
      expect(stability.stabilityFactors).toBeDefined();
      expect(stability.stabilityFactors.careConsistency).toBeDefined();
      expect(stability.stabilityFactors.environmentalStability).toBeDefined();
      expect(stability.stabilityFactors.ageStability).toBeDefined();
      expect(stability.evolutionRisk).toBeDefined();
      expect(stability.recommendedActions).toBeDefined();
    });
  });

  describe('Personality Evolution Prediction', () => {
    test('should predict future personality evolution accurately', async () => {
      const prediction = await predictPersonalityEvolution(testGroom.id, 'groom', 30);

      expect(prediction.success).toBe(true);
      expect(prediction.predictions).toBeDefined();
      expect(prediction.predictions.length).toBeGreaterThan(0);
      expect(prediction.predictions[0]).toHaveProperty('timeframe');
      expect(prediction.predictions[0]).toHaveProperty('evolutionProbability');
      expect(prediction.predictions[0]).toHaveProperty('predictedChanges');
      expect(prediction.predictions[0]).toHaveProperty('confidenceLevel');
      expect(prediction.influencingFactors).toBeDefined();
      expect(prediction.recommendedActions).toBeDefined();
    });

    test('should get personality evolution history', async () => {
      const history = await getPersonalityEvolutionHistory(testGroom.id, 'groom');

      expect(history.success).toBe(true);
      expect(Array.isArray(history.evolutionEvents)).toBe(true);
      expect(history.totalEvolutions).toBeGreaterThanOrEqual(0);
      expect(history.evolutionTimeline).toBeDefined();
      expect(history.personalityTrajectory).toBeDefined();
      expect(history.stabilityTrends).toBeDefined();
    });

    test('should apply personality evolution effects correctly', async () => {
      const evolutionData = {
        entityId: testGroom.id,
        entityType: 'groom',
        evolutionType: 'trait_strengthening',
        newTraits: ['enhanced_patience', 'stress_resistance'],
        oldPersonality: 'calm',
        newPersonality: 'calm',
        stabilityPeriod: 14,
        effectStrength: 0.8,
      };

      const effects = await applyPersonalityEvolutionEffects(evolutionData);

      expect(effects.success).toBe(true);
      expect(effects.effectsApplied).toBeDefined();
      expect(effects.effectsApplied.length).toBeGreaterThan(0);
      expect(effects.personalityUpdated).toBe(true);
      expect(effects.traitModifiersApplied).toBe(true);
      expect(effects.stabilityPeriodSet).toBe(true);
      expect(effects.evolutionLogged).toBe(true);
    });
  });

  describe('Cross-Species Personality Influence', () => {
    test('should detect personality convergence between groom and horse', async () => {
      // Create long-term interaction history
      for (let i = 0; i < 30; i++) {
        await prisma.groomInteraction.create({
          data: {
            groomId: testGroom.id,
            foalId: testHorse.id,
            taskType: 'trust_building',
            interactionType: 'enrichment',
            bondingChange: 2,
            stressChange: -2,
            quality: 'excellent',
            cost: 25.0,
            duration: 30,
            notes: 'Long-term bonding creating personality convergence',
          },
        });
      }

      const convergence = await analyzePersonalityStability(testHorse.id, 'horse');

      expect(convergence.success).toBe(true);
      expect(convergence.stabilityFactors.groomInfluence).toBeDefined();
      expect(convergence.stabilityFactors.groomInfluence).toBeGreaterThan(0);
    });
  });
});
