/**
 * Breeding Analytics Service Tests
 *
 * Tests for breeding program analytics including lineage tracking,
 * trait inheritance patterns, breeding success rates, and foal development
 * using TDD with NO MOCKING approach.
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import prisma from '../../db/index.mjs';
import { breedingAnalyticsService } from '../../services/breedingAnalyticsService.mjs';

describe('Breeding Analytics Service', () => {
  let testUser;
  let testBreed;
  let testStallion;
  let testMare;
  let testFoals;

  const cleanupBreedingData = async () => {
    if (testUser) {
      await prisma.horse.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.deleteMany({
        where: { id: testUser.id },
      });
    }
    if (testBreed) {
      await prisma.breed.deleteMany({
        where: { id: testBreed.id },
      });
    }
  };

  const seedBreedingData = async () => {
    await cleanupBreedingData();

    const timestamp = Date.now();
    await prisma.$transaction(async (tx) => {
      // Create test user
      testUser = await tx.user.create({
        data: {
          username: `breeding_test_user_${timestamp}`,
          email: `breeding_${timestamp}@test.com`,
          password: 'test_password',
          firstName: 'Breeding',
          lastName: 'Test',
        },
      });

      // Create test breed
      testBreed = await tx.breed.create({
        data: {
          name: `Breeding Test Breed ${timestamp}`,
          description: 'Test breed for breeding analytics',
        },
      });

      // Create test stallion
      testStallion = await tx.horse.create({
        data: {
          name: `Test Stallion ${timestamp}`,
          user: { connect: { id: testUser.id } },
          age: 8,
          sex: 'stallion',
          dateOfBirth: new Date('2017-01-01'),
          breed: { connect: { id: testBreed.id } },
          speed: 85,
          stamina: 80,
          agility: 75,
          balance: 82,
          precision: 78,
          intelligence: 88,
          boldness: 76,
          flexibility: 74,
          obedience: 80,
          focus: 85,
          epigeneticModifiers: {
            positive: ['athletic', 'intelligent'],
            negative: [],
            hidden: ['discipline_affinity_racing'],
          },
        },
      });

      // Create test mare
      testMare = await tx.horse.create({
        data: {
          name: `Test Mare ${timestamp}`,
          user: { connect: { id: testUser.id } },
          age: 6,
          sex: 'mare',
          dateOfBirth: new Date('2019-01-01'),
          breed: { connect: { id: testBreed.id } },
          speed: 78,
          stamina: 85,
          agility: 80,
          balance: 75,
          precision: 82,
          intelligence: 79,
          boldness: 73,
          flexibility: 81,
          obedience: 87,
          focus: 76,
          epigeneticModifiers: {
            positive: ['calm', 'resilient'],
            negative: ['nervous'],
            hidden: ['discipline_affinity_dressage'],
          },
        },
      });

      // Create test foals from this breeding pair
      testFoals = [];
      for (let i = 0; i < 5; i++) {
        const foal = await tx.horse.create({
          data: {
            name: `Test Foal ${timestamp} ${i + 1}`,
            user: { connect: { id: testUser.id } },
            age: i + 1, // Different ages
            sex: i % 2 === 0 ? 'colt' : 'filly',
            dateOfBirth: new Date(`202${i + 1}-01-01`),
            breed: { connect: { id: testBreed.id } },
            sire: { connect: { id: testStallion.id } },
            dam: { connect: { id: testMare.id } },
            speed: 70 + Math.floor(Math.random() * 20),
            stamina: 70 + Math.floor(Math.random() * 20),
            agility: 70 + Math.floor(Math.random() * 20),
            balance: 70 + Math.floor(Math.random() * 20),
            precision: 70 + Math.floor(Math.random() * 20),
            intelligence: 70 + Math.floor(Math.random() * 20),
            boldness: 70 + Math.floor(Math.random() * 20),
            flexibility: 70 + Math.floor(Math.random() * 20),
            obedience: 70 + Math.floor(Math.random() * 20),
            focus: 70 + Math.floor(Math.random() * 20),
            epigeneticModifiers: {
              positive: i % 2 === 0 ? ['athletic'] : ['calm'],
              negative: i % 3 === 0 ? ['nervous'] : [],
              hidden: [],
            },
          },
        });
        testFoals.push(foal);
      }
    });
  };

  const ensureBreedingData = async () => {
    if (!testUser || !testBreed || !testStallion || !testMare || !testFoals) {
      await seedBreedingData();
      return;
    }

    const [userExists, breedExists, stallionExists, mareExists] = await Promise.all([
      prisma.user.findUnique({ where: { id: testUser.id } }),
      prisma.breed.findUnique({ where: { id: testBreed.id } }),
      prisma.horse.findUnique({ where: { id: testStallion.id } }),
      prisma.horse.findUnique({ where: { id: testMare.id } }),
    ]);

    if (!userExists || !breedExists || !stallionExists || !mareExists) {
      await seedBreedingData();
      return;
    }

    const foalCount = await prisma.horse.count({
      where: { userId: testUser.id, sireId: testStallion.id, damId: testMare.id },
    });
    if (foalCount < 5) {
      await seedBreedingData();
    }
  };

  beforeAll(async () => {
    await seedBreedingData();
  });

  beforeEach(async () => {
    await ensureBreedingData();
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupBreedingData();
    await prisma.$disconnect();
  });

  describe('Lineage Tracking', () => {
    test('should track breeding pair lineage', async () => {
      const analytics = await breedingAnalyticsService.getBreedingAnalytics(testUser.id);

      expect(analytics).toBeDefined();
      expect(analytics.breedingPairs).toBeDefined();
      expect(Array.isArray(analytics.breedingPairs)).toBe(true);
      expect(analytics.breedingPairs.length).toBeGreaterThan(0);

      // Check breeding pair data structure
      // eslint-disable-next-line prefer-destructuring
      const pair = analytics.breedingPairs[0];
      expect(pair.stallion).toBeDefined();
      expect(pair.mare).toBeDefined();
      expect(pair.foalCount).toBeDefined();
      expect(pair.foals).toBeDefined();
    });

    test('should identify parent-offspring relationships', async () => {
      const analytics = await breedingAnalyticsService.getBreedingAnalytics(testUser.id);

      const pair = analytics.breedingPairs.find(p =>
        p.stallion.id === testStallion.id && p.mare.id === testMare.id,
      );

      expect(pair).toBeDefined();
      expect(pair.foalCount).toBe(5);
      expect(pair.foals.length).toBe(5);

      // Check that all foals have correct parentage
      pair.foals.forEach(foal => {
        expect(foal.sireId).toBe(testStallion.id);
        expect(foal.damId).toBe(testMare.id);
      });
    });
  });

  describe('Trait Inheritance Analysis', () => {
    test('should analyze trait inheritance patterns', async () => {
      const analytics = await breedingAnalyticsService.getBreedingAnalytics(testUser.id);

      expect(analytics.traitInheritance).toBeDefined();
      expect(typeof analytics.traitInheritance).toBe('object');
      expect(analytics.traitInheritance.positiveTraits).toBeDefined();
      expect(analytics.traitInheritance.negativeTraits).toBeDefined();
      expect(analytics.traitInheritance.inheritanceRates).toBeDefined();
    });

    test('should calculate trait inheritance rates', async () => {
      const analytics = await breedingAnalyticsService.getBreedingAnalytics(testUser.id);

      const inheritance = analytics.traitInheritance;
      expect(typeof inheritance.inheritanceRates).toBe('object');

      // Check that inheritance rates are calculated for traits present in parents
      Object.keys(inheritance.inheritanceRates).forEach(trait => {
        const rate = inheritance.inheritanceRates[trait];
        expect(typeof rate).toBe('number');
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Breeding Success Metrics', () => {
    test('should calculate breeding success rates', async () => {
      const analytics = await breedingAnalyticsService.getBreedingAnalytics(testUser.id);

      expect(analytics.successMetrics).toBeDefined();
      expect(typeof analytics.successMetrics).toBe('object');
      expect(analytics.successMetrics.totalBreedings).toBeDefined();
      expect(analytics.successMetrics.successfulBreedings).toBeDefined();
      expect(analytics.successMetrics.successRate).toBeDefined();
      expect(analytics.successMetrics.averageFoalsPerBreeding).toBeDefined();
    });

    test('should track foal development outcomes', async () => {
      const analytics = await breedingAnalyticsService.getBreedingAnalytics(testUser.id);

      expect(analytics.foalDevelopment).toBeDefined();
      expect(typeof analytics.foalDevelopment).toBe('object');
      expect(analytics.foalDevelopment.totalFoals).toBe(5);
      expect(analytics.foalDevelopment.averageStats).toBeDefined();
      expect(typeof analytics.foalDevelopment.averageStats).toBe('object');
    });
  });

  describe('Statistical Analysis', () => {
    test('should calculate average offspring stats', async () => {
      const analytics = await breedingAnalyticsService.getBreedingAnalytics(testUser.id);

      const avgStats = analytics.foalDevelopment.averageStats;
      expect(avgStats.speed).toBeDefined();
      expect(avgStats.stamina).toBeDefined();
      expect(avgStats.agility).toBeDefined();
      expect(avgStats.balance).toBeDefined();
      expect(avgStats.precision).toBeDefined();
      expect(avgStats.intelligence).toBeDefined();
      expect(avgStats.boldness).toBeDefined();
      expect(avgStats.flexibility).toBeDefined();
      expect(avgStats.obedience).toBeDefined();
      expect(avgStats.focus).toBeDefined();

      // Check that averages are reasonable numbers
      Object.values(avgStats).forEach(stat => {
        expect(typeof stat).toBe('number');
        expect(stat).toBeGreaterThan(0);
        expect(stat).toBeLessThan(100);
      });
    });

    test('should compare offspring to parent averages', async () => {
      const analytics = await breedingAnalyticsService.getBreedingAnalytics(testUser.id);

      expect(analytics.parentComparison).toBeDefined();
      expect(typeof analytics.parentComparison).toBe('object');
      expect(analytics.parentComparison.parentAverages).toBeDefined();
      expect(analytics.parentComparison.offspringAverages).toBeDefined();
      expect(analytics.parentComparison.improvement).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle user with no breeding data', async () => {
      const newUser = await prisma.user.create({
        data: {
          username: `no_breeding_user_${Date.now()}`,
          email: `no_breeding_${Date.now()}@test.com`,
          password: 'test_password',
          firstName: 'No',
          lastName: 'Breeding',
        },
      });

      const analytics = await breedingAnalyticsService.getBreedingAnalytics(newUser.id);

      expect(analytics).toBeDefined();
      expect(analytics.breedingPairs).toEqual([]);
      expect(analytics.successMetrics.totalBreedings).toBe(0);
      expect(analytics.foalDevelopment.totalFoals).toBe(0);

      // Clean up
      await prisma.user.delete({ where: { id: newUser.id } });
    });

    test('should handle non-existent user gracefully', async () => {
      await expect(breedingAnalyticsService.getBreedingAnalytics('non-existent-user-id'))
        .rejects.toThrow('User not found');
    });
  });
});
