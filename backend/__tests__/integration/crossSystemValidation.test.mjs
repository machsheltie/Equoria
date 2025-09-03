/**
 * 🧪 Cross-System Validation Tests
 * 
 * Comprehensive tests validating integration between different game systems
 * and ensuring data consistency across system boundaries including:
 * - Epigenetic trait system integration with breeding and care
 * - Competition system integration with training and horse development
 * - Groom system integration with horse care and trait development
 * - Memory and performance system integration with all operations
 * - Documentation system integration with API endpoints
 * 
 * Testing Approach: TDD with NO MOCKING
 * - Real cross-system operations with authentic data flows
 * - Genuine system boundary validation
 * - Production-like integration scenarios
 * - Complete workflow validation
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { getMemoryManager } from '../../services/memoryResourceManagementService.mjs';
import logger from '../../utils/logger.mjs';

describe('Cross-System Validation Tests', () => {
  let testUser;
  let authToken;
  let testBreed;
  let testHorse;
  let testGroom;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: 'crossSystemTestUser',
        email: 'crosssystem@test.com',
        password: 'testPassword123',
        firstName: 'Cross',
        lastName: 'System',
      },
    });

    // Generate auth token
    const jwt = await import('jsonwebtoken');
    authToken = jwt.default.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: 'Cross System Test Breed',
        description: 'Test breed for cross-system validation',
      },
    });

    // Create test horse
    testHorse = await prisma.horse.create({
      data: {
        name: 'Cross System Test Horse',
        ownerId: testUser.id,
        breedId: testBreed.id,
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - (4 * 365 * 24 * 60 * 60 * 1000)), // 4 years old
        temperament: 'confident',
        healthStatus: 'Good',
        speed: 75,
        stamina: 80,
        agility: 70,
        balance: 75,
        precision: 65,
        intelligence: 85,
        boldness: 80,
        flexibility: 70,
        obedience: 90,
        focus: 85,
      },
    });

    // Create test groom
    testGroom = await prisma.groom.create({
      data: {
        name: 'Cross System Test Groom',
        userId: testUser.id,
        skillLevel: 'expert',
        experience: 200,
        personality: 'methodical',
        speciality: 'general_grooming',
        level: 4,
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.horse.deleteMany({ where: { ownerId: testUser.id } });
    await prisma.groom.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.breed.delete({ where: { id: testBreed.id } });
  });

  describe('Epigenetic Trait System Integration', () => {
    test('Trait discovery integration with groom care patterns', async () => {
      // Create a foal for trait development testing
      const foalData = {
        name: 'Trait Test Foal',
        breedId: testBreed.id,
        sex: 'Stallion',
        dateOfBirth: new Date(), // Newborn
        sireId: testHorse.id,
        damId: testHorse.id,
      };

      const foalResponse = await request(app)
        .post('/api/horses/foals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(foalData)
        .expect(201);

      const foal = foalResponse.body.data;

      // Perform groom interactions during critical development period
      const enrichmentData = {
        foalId: foal.id,
        activityType: 'trust_building',
      };

      const enrichmentResponse = await request(app)
        .post(`/api/foals/${foal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(enrichmentData)
        .expect(201);

      expect(enrichmentResponse.body.success).toBe(true);

      // Test trait discovery after care
      const traitDiscoveryResponse = await request(app)
        .post(`/api/traits/discover/${foal.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(traitDiscoveryResponse.body.success).toBe(true);

      // Verify trait discovery status
      const traitStatusResponse = await request(app)
        .get(`/api/traits/discovery-status/${foal.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(traitStatusResponse.body.success).toBe(true);
      expect(traitStatusResponse.body.data.discoveredTraits).toBeDefined();

      // Test milestone evaluation integration
      const milestoneResponse = await request(app)
        .post('/api/traits/evaluate-milestone')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          horseId: foal.id,
          milestoneType: 'imprinting',
          careHistory: [
            {
              taskType: 'trust_building',
              groomId: testGroom.id,
              bondingScore: 8,
              qualityRating: 'excellent',
              timestamp: new Date().toISOString(),
            },
          ],
        })
        .expect(200);

      expect(milestoneResponse.body.success).toBe(true);
    });

    test('Environmental trigger system integration', async () => {
      // Test environmental factors affecting trait expression
      const environmentalData = {
        horseId: testHorse.id,
        environmentalFactors: {
          temperature: 22,
          humidity: 65,
          noiseLevel: 'low',
          socialInteraction: 'high',
          exerciseLevel: 'moderate',
        },
      };

      const environmentalResponse = await request(app)
        .post('/api/traits/environmental-triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(environmentalData)
        .expect(200);

      expect(environmentalResponse.body.success).toBe(true);

      // Verify trait interaction matrix
      const interactionResponse = await request(app)
        .get(`/api/traits/interaction-matrix/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(interactionResponse.body.success).toBe(true);
      expect(interactionResponse.body.data.interactions).toBeDefined();
    });
  });

  describe('Competition System Integration', () => {
    test('Training system integration with competition performance', async () => {
      // Get initial horse stats
      const initialHorseResponse = await request(app)
        .get(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const initialStats = initialHorseResponse.body.data;

      // Perform training
      const trainingData = {
        horseId: testHorse.id,
        discipline: 'Racing',
      };

      const trainingResponse = await request(app)
        .post('/api/training/train')
        .set('Authorization', `Bearer ${authToken}`)
        .send(trainingData)
        .expect(201);

      expect(trainingResponse.body.success).toBe(true);

      // Verify training affects discipline scores
      const updatedHorseResponse = await request(app)
        .get(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const updatedStats = updatedHorseResponse.body.data;
      expect(updatedStats.disciplineScores.Racing).toBeGreaterThan(
        initialStats.disciplineScores.Racing || 0
      );

      // Test competition eligibility
      const eligibilityResponse = await request(app)
        .get(`/api/competition/eligibility/${testHorse.id}/Racing`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(eligibilityResponse.body.success).toBe(true);
      expect(eligibilityResponse.body.data.eligible).toBe(true);

      // Create and enter competition
      const showData = {
        name: 'Cross System Test Show',
        date: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)),
        location: 'Test Grounds',
        disciplines: ['Racing'],
        entryFee: 50,
        prizePool: 500,
      };

      const showResponse = await request(app)
        .post('/api/shows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(showData)
        .expect(201);

      const testShow = showResponse.body.data;

      // Enter competition
      const entryData = {
        horseId: testHorse.id,
        discipline: 'Racing',
        showId: testShow.id,
      };

      const entryResponse = await request(app)
        .post('/api/competition/enter')
        .set('Authorization', `Bearer ${authToken}`)
        .send(entryData)
        .expect(201);

      expect(entryResponse.body.success).toBe(true);

      // Execute competition
      const executeData = {
        showId: testShow.id,
        discipline: 'Racing',
      };

      const executeResponse = await request(app)
        .post('/api/competition/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send(executeData)
        .expect(200);

      expect(executeResponse.body.success).toBe(true);
      expect(executeResponse.body.data.results).toBeDefined();

      // Verify horse XP was awarded
      const horseXPResponse = await request(app)
        .get(`/api/horses/${testHorse.id}/xp`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(horseXPResponse.body.success).toBe(true);
      expect(horseXPResponse.body.data.totalXP).toBeGreaterThan(0);
    });

    test('Leaderboard integration with competition results', async () => {
      // Get competition leaderboard
      const leaderboardResponse = await request(app)
        .get('/api/leaderboard/competition?discipline=Racing&timeframe=all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(leaderboardResponse.body.success).toBe(true);
      expect(leaderboardResponse.body.data.leaderboard).toBeDefined();

      // Verify horse appears in results if competed
      const results = leaderboardResponse.body.data.leaderboard;
      const horseResult = results.find(r => r.horseId === testHorse.id);
      
      if (horseResult) {
        expect(horseResult.horseName).toBe(testHorse.name);
        expect(horseResult.totalEarnings).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Groom System Integration', () => {
    test('Groom career progression with horse development', async () => {
      // Get initial groom stats
      const initialGroomResponse = await request(app)
        .get(`/api/grooms/user/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const initialGrooms = initialGroomResponse.body.data;
      const initialGroom = initialGrooms.find(g => g.id === testGroom.id);

      // Perform multiple groom interactions
      const interactionData = {
        groomId: testGroom.id,
        horseId: testHorse.id,
        taskType: 'brushing',
      };

      const interactionResponse = await request(app)
        .post('/api/grooms/interact')
        .set('Authorization', `Bearer ${authToken}`)
        .send(interactionData)
        .expect(201);

      expect(interactionResponse.body.success).toBe(true);

      // Verify groom experience increased
      const updatedGroomResponse = await request(app)
        .get(`/api/grooms/user/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const updatedGrooms = updatedGroomResponse.body.data;
      const updatedGroom = updatedGrooms.find(g => g.id === testGroom.id);
      expect(updatedGroom.experience).toBeGreaterThan(initialGroom.experience);

      // Test talent system if groom is high enough level
      if (updatedGroom.level >= 3) {
        const talentResponse = await request(app)
          .get(`/api/grooms/${testGroom.id}/talents`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(talentResponse.body.success).toBe(true);
      }

      // Test retirement eligibility
      const retirementResponse = await request(app)
        .get(`/api/grooms/${testGroom.id}/retirement/eligibility`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(retirementResponse.body.success).toBe(true);
      expect(retirementResponse.body.data.eligible).toBeDefined();
    });

    test('Groom assignment integration with horse care', async () => {
      // Assign groom to horse
      const assignmentData = {
        groomId: testGroom.id,
        horseId: testHorse.id,
        priority: 'high',
        notes: 'Cross-system integration test assignment',
      };

      const assignmentResponse = await request(app)
        .post('/api/grooms/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send(assignmentData)
        .expect(201);

      expect(assignmentResponse.body.success).toBe(true);

      // Verify assignment exists
      const assignmentsResponse = await request(app)
        .get(`/api/grooms/assignments/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(assignmentsResponse.body.success).toBe(true);
      expect(assignmentsResponse.body.data.length).toBeGreaterThan(0);

      const assignment = assignmentsResponse.body.data[0];
      expect(assignment.groomId).toBe(testGroom.id);
      expect(assignment.horseId).toBe(testHorse.id);
    });
  });

  describe('Performance System Integration', () => {
    test('Memory management integration with API operations', async () => {
      // Get initial memory status
      const initialMemoryResponse = await request(app)
        .get('/api/memory/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(initialMemoryResponse.body.success).toBe(true);
      const initialMemory = initialMemoryResponse.body.data;

      // Perform memory-intensive operations
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          request(app)
            .get('/api/horses')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      await Promise.all(operations);

      // Check memory status after operations
      const finalMemoryResponse = await request(app)
        .get('/api/memory/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalMemoryResponse.body.success).toBe(true);
      const finalMemory = finalMemoryResponse.body.data;

      // Verify memory management is working
      expect(finalMemory.memoryUsage).toBeDefined();
      expect(finalMemory.resourceCounts).toBeDefined();

      // Test garbage collection
      const gcResponse = await request(app)
        .post('/api/memory/gc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(gcResponse.body.success).toBe(true);
      expect(gcResponse.body.data.memoryFreed).toBeGreaterThanOrEqual(0);
    });

    test('API optimization integration with response compression', async () => {
      // Test compressed response
      const compressedResponse = await request(app)
        .get('/api/horses')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(compressedResponse.body.success).toBe(true);
      
      // Verify response headers indicate optimization
      expect(compressedResponse.headers['x-response-time']).toBeDefined();

      // Test pagination
      const paginatedResponse = await request(app)
        .get('/api/horses?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(paginatedResponse.body.success).toBe(true);
      expect(paginatedResponse.body.pagination).toBeDefined();
      expect(paginatedResponse.body.pagination.page).toBe(1);
      expect(paginatedResponse.body.pagination.limit).toBe(5);
    });
  });

  describe('Documentation System Integration', () => {
    test('API documentation integration with live endpoints', async () => {
      // Test that API documentation reflects actual endpoints
      const swaggerResponse = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      const apiSpec = swaggerResponse.body;
      expect(apiSpec.paths).toBeDefined();

      // Verify key endpoints are documented
      expect(apiSpec.paths['/api/horses']).toBeDefined();
      expect(apiSpec.paths['/api/grooms/hire']).toBeDefined();
      expect(apiSpec.paths['/api/competition/enter']).toBeDefined();
      expect(apiSpec.paths['/api/traits/discover/{horseId}']).toBeDefined();

      // Test documentation health
      const docHealthResponse = await request(app)
        .get('/api/docs/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(docHealthResponse.body.success).toBe(true);
      expect(docHealthResponse.body.data.status).toBe('healthy');
    });

    test('User documentation integration with search functionality', async () => {
      // Test user documentation search
      const searchResponse = await request(app)
        .get('/api/user-docs/search?q=competition')
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(searchResponse.body.data.results.length).toBeGreaterThan(0);

      // Test specific document retrieval
      const featureGuideResponse = await request(app)
        .get('/api/user-docs/feature-guide')
        .expect(200);

      expect(featureGuideResponse.body.success).toBe(true);
      expect(featureGuideResponse.body.data.content).toContain('Equoria');

      // Test documentation analytics
      const analyticsResponse = await request(app)
        .get('/api/user-docs/analytics')
        .expect(200);

      expect(analyticsResponse.body.success).toBe(true);
      expect(analyticsResponse.body.data.totalViews).toBeGreaterThan(0);
    });
  });

  describe('System Health and Monitoring', () => {
    test('Overall system health validation', async () => {
      // Test main health endpoint
      const healthResponse = await request(app)
        .get('/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
      expect(healthResponse.body.database).toBe('connected');

      // Test ping endpoint
      const pingResponse = await request(app)
        .get('/ping')
        .expect(200);

      expect(pingResponse.body.message).toBe('pong');

      // Test memory system health
      const memoryHealthResponse = await request(app)
        .get('/api/memory/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(memoryHealthResponse.body.success).toBe(true);

      // Test documentation system health
      const docHealthResponse = await request(app)
        .get('/api/user-docs/health')
        .expect(200);

      expect(docHealthResponse.body.success).toBe(true);
      expect(docHealthResponse.body.data.status).toBe('healthy');
    });
  });
});
