/* eslint-disable no-console */
import request from 'supertest';
import app from '../app.mjs';
import prisma from '../db/index.mjs';

describe('Trait Discovery API Integration Tests', () => {
  let testBreed;
  let testFoals = [];

  beforeAll(async () => {
    // Create test breed with unique name
    const uniqueName = `Test Breed for Trait Discovery ${Date.now()}`;
    testBreed = await prisma.breed.create({
      data: {
        name: uniqueName,
        description: 'Test breed for trait discovery testing',
      },
    });

    // Create test foals with different conditions
    const foal1 = await prisma.horse.create({
      data: {
        name: 'High Bond Foal',
        age: 0,
        sex: 'Filly',
        breed: { connect: { id: testBreed.id } },
        dateOfBirth: new Date('2024-01-01'),
        bondScore: 85,
        stressLevel: 15,
        epigeneticModifiers: {
          positive: [],
          negative: [],
          hidden: ['intelligent', 'calm', 'athletic', 'resilient', 'bold'],
        },
      },
    });

    const foal2 = await prisma.horse.create({
      data: {
        name: 'Low Stats Foal',
        age: 0,
        sex: 'Colt',
        breed: { connect: { id: testBreed.id } },
        dateOfBirth: new Date('2024-01-01'),
        bondScore: 30,
        stressLevel: 70,
        epigeneticModifiers: {
          positive: [],
          negative: [],
          hidden: ['resilient', 'nervous', 'stubborn'],
        },
      },
    });

    const foal3 = await prisma.horse.create({
      data: {
        name: 'Adult Horse',
        age: 5,
        sex: 'Stallion',
        breed: { connect: { id: testBreed.id } },
        dateOfBirth: new Date('2019-01-01'),
        bondScore: 90,
        stressLevel: 10,
        epigeneticModifiers: {
          positive: ['calm'],
          negative: [],
          hidden: [],
        },
      },
    });

    testFoals = [foal1, foal2, foal3];

    // Create foal development records
    await prisma.foalDevelopment.create({
      data: {
        foalId: foal1.id,
        currentDay: 3,
        bondingLevel: 85,
        stressLevel: 15,
      },
    });

    await prisma.foalDevelopment.create({
      data: {
        foalId: foal2.id,
        currentDay: 2,
        bondingLevel: 30,
        stressLevel: 70,
      },
    });

    // Create some enrichment activities for foal1
    await prisma.foalTrainingHistory.create({
      data: {
        horseId: foal1.id,
        day: 1,
        activity: 'gentle_handling',
        outcome: 'Gentle Touch - Successful bonding session',
        bondChange: 5,
        stressChange: -2,
      },
    });

    await prisma.foalTrainingHistory.create({
      data: {
        horseId: foal1.id,
        day: 2,
        activity: 'human_interaction',
        outcome: 'Human Bonding - Positive interaction',
        bondChange: 3,
        stressChange: -1,
      },
    });

    await prisma.foalTrainingHistory.create({
      data: {
        horseId: foal1.id,
        day: 3,
        activity: 'social_play',
        outcome: 'Social Time - Enjoyed playtime',
        bondChange: 2,
        stressChange: -1,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    for (const foal of testFoals) {
      try {
        await prisma.foalTrainingHistory.deleteMany({
          where: { horseId: foal.id },
        });
        await prisma.foalDevelopment.deleteMany({
          where: { foalId: foal.id },
        });
        await prisma.horse.delete({ where: { id: foal.id } });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    if (testBreed?.id) {
      try {
        await prisma.breed.delete({ where: { id: testBreed.id } });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    await prisma.$disconnect();
  });

  describe('POST /api/trait-discovery/discover/:foalId', () => {
    it('should discover traits for foal with high bonding', async () => {
      const response = await request(app).post(`/api/trait-discovery/discover/${testFoals[0].id}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseId', testFoals[0].id);
      expect(response.body.data).toHaveProperty('horseName', 'High Bond Foal');
      expect(response.body.data).toHaveProperty('conditionsMet');
      expect(response.body.data).toHaveProperty('traitsRevealed');
      expect(response.body.data).toHaveProperty('summary');

      // Should have met some conditions due to high bonding and low stress
      expect(response.body.data.conditionsMet.length).toBeGreaterThan(0);

      // Should have revealed some traits
      if (response.body.data.traitsRevealed.length > 0) {
        expect(response.body.data.traitsRevealed[0]).toHaveProperty('traitKey');
        expect(response.body.data.traitsRevealed[0]).toHaveProperty('traitName');
        expect(response.body.data.traitsRevealed[0]).toHaveProperty('category');
        expect(response.body.data.traitsRevealed[0]).toHaveProperty('revealedBy');
      }
    });

    it('should handle foal with no discoverable traits', async () => {
      const response = await request(app).post(`/api/trait-discovery/discover/${testFoals[1].id}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseId', testFoals[1].id);
      expect(response.body.data).toHaveProperty('horseName', 'Low Stats Foal');

      // Low stats foal should not meet many conditions
      expect(response.body.data.conditionsMet.length).toBeLessThanOrEqual(1);
    });

    it('should allow trait discovery for adult horses', async () => {
      const response = await request(app).post(`/api/trait-discovery/discover/${testFoals[2].id}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseId', testFoals[2].id);
      expect(response.body.data).toHaveProperty('horseName', 'Adult Horse');
      expect(response.body.data).toHaveProperty('conditionsMet');
      expect(response.body.data).toHaveProperty('traitsRevealed');

      // Adult horses can discover traits (e.g., mature bond traits)
      expect(Array.isArray(response.body.data.conditionsMet)).toBe(true);
      expect(Array.isArray(response.body.data.traitsRevealed)).toBe(true);
    });

    it('should return 404 for non-existent foal', async () => {
      const response = await request(app).post('/api/trait-discovery/discover/99999').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for invalid foal ID', async () => {
      const response = await request(app).post('/api/trait-discovery/discover/invalid').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse ID must be a positive integer');
    });
  });

  describe('GET /api/trait-discovery/progress/:foalId', () => {
    it('should return discovery progress for foal', async () => {
      const response = await request(app).get(`/api/trait-discovery/progress/${testFoals[0].id}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseId', testFoals[0].id);
      expect(response.body.data).toHaveProperty('horseName', 'High Bond Foal');
      expect(response.body.data).toHaveProperty('currentStats');
      expect(response.body.data).toHaveProperty('conditions');
      expect(response.body.data).toHaveProperty('hiddenTraitsCount');

      expect(response.body.data.currentStats).toEqual({
        bondScore: 85,
        stressLevel: 15,
        developmentDay: 3,
      });

      // Should have all discovery conditions
      const { conditions } = response.body.data;
      expect(conditions).toHaveProperty('high_bond');
      expect(conditions).toHaveProperty('low_stress');
      expect(conditions).toHaveProperty('perfect_care');
      expect(conditions).toHaveProperty('consistent_training');

      // High bond condition should be met
      expect(conditions.high_bond.met).toBe(true);
      expect(conditions.high_bond.progress).toBe(100);

      // Low stress condition should be met
      expect(conditions.low_stress.met).toBe(true);
      expect(conditions.low_stress.progress).toBe(100);

      // Perfect care should be met (high bond + low stress)
      expect(conditions.perfect_care.met).toBe(true);
      expect(conditions.perfect_care.progress).toBe(100);
    });

    it('should return 404 for non-existent foal', async () => {
      const response = await request(app).get('/api/trait-discovery/progress/99999').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('POST /api/trait-discovery/discover/batch', () => {
    it('should process multiple foals in batch', async () => {
      console.log('Batch test foal IDs:', [testFoals[0].id, testFoals[1].id]);

      const response = await request(app)
        .post('/api/trait-discovery/discover/batch')
        .send({
          horseIds: [testFoals[0].id, testFoals[1].id],
        });

      if (response.status !== 200) {
        console.log('Batch discovery error response:', response.body);
        console.log('Status:', response.status);
      }

      expect(response.status).toBe(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data).toHaveProperty('summary');

      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.data.summary).toHaveProperty('totalHorses', 2);
      expect(response.body.data.summary).toHaveProperty('successfulDiscoveries');
      expect(response.body.data.summary).toHaveProperty('failedDiscoveries');
    });

    it('should handle mixed valid and invalid foals', async () => {
      const response = await request(app)
        .post('/api/trait-discovery/discover/batch')
        .send({
          horseIds: [testFoals[0].id, 99999, testFoals[2].id], // Valid foal, non-existent, adult horse
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(3);

      // Should have some failures
      const failedResults = response.body.data.results.filter(r => r.error);
      expect(failedResults.length).toBeGreaterThan(0);
    });

    it('should return 400 for invalid request body', async () => {
      const response = await request(app)
        .post('/api/trait-discovery/discover/batch')
        .send({
          horseIds: [],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('horseIds must be an array with 1-10 elements');
    });
  });

  describe('GET /api/trait-discovery/conditions', () => {
    it('should return all discovery conditions', async () => {
      const response = await request(app).get('/api/trait-discovery/conditions').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('conditions');
      expect(response.body.data).toHaveProperty('totalConditions');
      expect(response.body.data).toHaveProperty('categories');

      const { conditions } = response.body.data;
      expect(conditions.length).toBeGreaterThan(0);

      // Check structure of conditions
      conditions.forEach(condition => {
        expect(condition).toHaveProperty('key');
        expect(condition).toHaveProperty('name');
        expect(condition).toHaveProperty('description');
        expect(condition).toHaveProperty('revealableTraits');
        expect(condition).toHaveProperty('category');
      });

      // Check categories
      const { categories } = response.body.data;
      expect(categories).toHaveProperty('bonding');
      expect(categories).toHaveProperty('stress');
      expect(categories).toHaveProperty('activities');
      expect(categories).toHaveProperty('milestones');
    });
  });

  describe('POST /api/trait-discovery/check-conditions/:foalId', () => {
    it('should check conditions without triggering discovery', async () => {
      const response = await request(app).post(`/api/trait-discovery/check-conditions/${testFoals[0].id}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseId', testFoals[0].id);
      expect(response.body.data).toHaveProperty('horseName', 'High Bond Foal');
      expect(response.body.data).toHaveProperty('currentStats');
      expect(response.body.data).toHaveProperty('conditions');
      expect(response.body.data).toHaveProperty('summary');

      const { conditions } = response.body.data;
      expect(Array.isArray(conditions)).toBe(true);
      expect(conditions.length).toBeGreaterThan(0);

      // Each condition should have proper structure
      conditions.forEach(condition => {
        expect(condition).toHaveProperty('key');
        expect(condition).toHaveProperty('name');
        expect(condition).toHaveProperty('met');
        expect(condition).toHaveProperty('progress');
        expect(typeof condition.progress).toBe('number');
        expect(condition.progress).toBeGreaterThanOrEqual(0);
        expect(condition.progress).toBeLessThanOrEqual(100);
      });

      // Summary should have proper structure
      const { summary } = response.body.data;
      expect(summary).toHaveProperty('totalConditions');
      expect(summary).toHaveProperty('conditionsMet');
      expect(summary).toHaveProperty('averageProgress');
      expect(summary).toHaveProperty('hiddenTraitsRemaining');
    });

    it('should return 404 for non-existent foal', async () => {
      const response = await request(app).post('/api/trait-discovery/check-conditions/99999').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('Real-time trait discovery workflow', () => {
    it('should demonstrate complete trait discovery workflow', async () => {
      // Create a fresh foal with guaranteed hidden traits for this test
      const freshFoal = await prisma.horse.create({
        data: {
          name: 'Fresh Workflow Foal',
          age: 0,
          sex: 'Filly',
          breed: { connect: { id: testBreed.id } },
          dateOfBirth: new Date('2024-01-01'),
          bondScore: 85,
          stressLevel: 15,
          epigeneticModifiers: {
            positive: [],
            negative: [],
            hidden: ['intelligent', 'calm', 'athletic', 'resilient', 'bold'],
          },
        },
      });

      // Add to cleanup array
      testFoals.push(freshFoal);

      // Create foal development record
      await prisma.foalDevelopment.create({
        data: {
          foalId: freshFoal.id,
          currentDay: 3,
          bondingLevel: 85,
          stressLevel: 15,
        },
      });

      // Create some enrichment activities
      await prisma.foalTrainingHistory.create({
        data: {
          horseId: freshFoal.id,
          day: 1,
          activity: 'gentle_handling',
          outcome: 'Gentle Touch - Successful bonding session',
          bondChange: 5,
          stressChange: -2,
        },
      });

      const foalId = freshFoal.id;

      // 1. Check initial progress
      const progressResponse = await request(app).get(`/api/trait-discovery/progress/${foalId}`).expect(200);

      const initialHiddenCount = progressResponse.body.data.hiddenTraitsCount;
      console.log('Initial hidden count:', initialHiddenCount);
      console.log('Progress response:', JSON.stringify(progressResponse.body.data, null, 2));
      expect(initialHiddenCount).toBeGreaterThan(0);

      // 2. Check conditions without discovery
      const conditionsResponse = await request(app).post(`/api/trait-discovery/check-conditions/${foalId}`).expect(200);

      const metConditions = conditionsResponse.body.data.conditions.filter(c => c.met);
      expect(metConditions.length).toBeGreaterThan(0);

      // 3. Trigger discovery
      const discoveryResponse = await request(app).post(`/api/trait-discovery/discover/${foalId}`).expect(200);

      // 4. Verify traits were revealed if conditions were met
      if (metConditions.length > 0) {
        expect(discoveryResponse.body.data.conditionsMet.length).toBeGreaterThan(0);

        // If traits were revealed, hidden count should decrease
        if (discoveryResponse.body.data.traitsRevealed.length > 0) {
          expect(discoveryResponse.body.data.summary.hiddenAfter).toBeLessThan(
            discoveryResponse.body.data.summary.hiddenBefore,
          );
        }
      }

      // 5. Check progress again to see changes
      const finalProgressResponse = await request(app).get(`/api/trait-discovery/progress/${foalId}`).expect(200);

      // Hidden count should be same or less than initial
      expect(finalProgressResponse.body.data.hiddenTraitsCount).toBeLessThanOrEqual(initialHiddenCount);
    });
  });
});
