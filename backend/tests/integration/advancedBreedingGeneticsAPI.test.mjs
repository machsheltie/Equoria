/**
 * Advanced Breeding Genetics API Integration Tests
 * 
 * Tests for API endpoints that integrate enhanced genetic probability calculations,
 * advanced lineage analysis, and genetic diversity tracking systems.
 * 
 * Testing Approach: TDD with NO MOCKING - Real API validation
 * Business Rules: Complete breeding genetics workflow integration
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';
import logger from '../../utils/logger.mjs';

describe('🧬 Advanced Breeding Genetics API Integration', () => {
  let authToken;
  let testUser;
  let testStallion, testMare;
  let testPopulation = [];

  beforeAll(async () => {
    // Create test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'geneticsTestUser',
        email: 'genetics@test.com',
        password: 'TestPassword123!'
      });

    testUser = userResponse.body.user;

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'genetics@test.com',
        password: 'TestPassword123!'
      });

    authToken = loginResponse.body.token;
  });

  beforeEach(async () => {
    // Create test horses for genetic analysis
    const stallionResponse = await request(app)
      .post('/api/horses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Genetic Test Stallion',
        sex: 'Stallion',
        dateOfBirth: '2020-01-01',
        speed: 95,
        stamina: 88,
        agility: 82,
        intelligence: 78,
        epigeneticModifiers: {
          positive: ['athletic', 'fast'],
          negative: [],
          hidden: ['legendary_speed']
        }
      });

    testStallion = stallionResponse.body;

    const mareResponse = await request(app)
      .post('/api/horses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Genetic Test Mare',
        sex: 'Mare',
        dateOfBirth: '2020-02-01',
        speed: 78,
        stamina: 92,
        agility: 85,
        intelligence: 90,
        epigeneticModifiers: {
          positive: ['calm', 'intelligent'],
          negative: [],
          hidden: ['perfect_balance']
        }
      });

    testMare = mareResponse.body;

    // Create additional horses for population analysis
    const additionalHorses = await Promise.all([
      request(app)
        .post('/api/horses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Population Horse 1',
          sex: 'Stallion',
          dateOfBirth: '2019-01-01',
          speed: 85,
          stamina: 80,
          agility: 88,
          intelligence: 82
        }),
      request(app)
        .post('/api/horses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Population Horse 2',
          sex: 'Mare',
          dateOfBirth: '2019-02-01',
          speed: 80,
          stamina: 85,
          agility: 90,
          intelligence: 88
        })
    ]);

    testPopulation = [testStallion, testMare, ...additionalHorses.map(r => r.body)];
  });

  afterEach(async () => {
    // Cleanup test horses
    for (const horse of testPopulation) {
      await request(app)
        .delete(`/api/horses/${horse.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
    testPopulation = [];
  });

  afterAll(async () => {
    // Cleanup test user
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
  });

  describe('🎯 Enhanced Genetic Probability API', () => {
    test('POST /api/breeding/genetic-probability should calculate breeding probabilities', async () => {
      const response = await request(app)
        .post('/api/breeding/genetic-probability')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          stallionId: testStallion.id,
          mareId: testMare.id,
          includeLineage: true
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('statProbabilities');
      expect(response.body.data).toHaveProperty('traitProbabilities');
      expect(response.body.data).toHaveProperty('compatibilityAnalysis');
      expect(response.body.data).toHaveProperty('lineageAnalysis');

      // Verify stat probabilities structure
      expect(response.body.data.statProbabilities).toHaveProperty('speed');
      expect(response.body.data.statProbabilities.speed).toHaveProperty('expectedRange');
      expect(response.body.data.statProbabilities.speed).toHaveProperty('distribution');

      // Verify compatibility analysis
      expect(response.body.data.compatibilityAnalysis).toHaveProperty('overallScore');
      expect(response.body.data.compatibilityAnalysis.overallScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.compatibilityAnalysis.overallScore).toBeLessThanOrEqual(100);
    });

    test('POST /api/breeding/genetic-probability should handle invalid horse IDs', async () => {
      const response = await request(app)
        .post('/api/breeding/genetic-probability')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          stallionId: 99999,
          mareId: testMare.id
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('POST /api/breeding/genetic-probability should require authentication', async () => {
      const response = await request(app)
        .post('/api/breeding/genetic-probability')
        .send({
          stallionId: testStallion.id,
          mareId: testMare.id
        });

      expect(response.status).toBe(401);
    });
  });

  describe('🌳 Advanced Lineage Analysis API', () => {
    test('GET /api/breeding/lineage-analysis/:stallionId/:mareId should generate lineage tree', async () => {
      const response = await request(app)
        .get(`/api/breeding/lineage-analysis/${testStallion.id}/${testMare.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ generations: 3 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('lineageTree');
      expect(response.body.data).toHaveProperty('diversityMetrics');
      expect(response.body.data).toHaveProperty('performanceAnalysis');
      expect(response.body.data).toHaveProperty('visualizationData');

      // Verify lineage tree structure
      expect(response.body.data.lineageTree).toHaveProperty('root');
      expect(response.body.data.lineageTree).toHaveProperty('generations');
      expect(response.body.data.lineageTree).toHaveProperty('totalHorses');

      // Verify visualization data
      expect(response.body.data.visualizationData).toHaveProperty('nodes');
      expect(response.body.data.visualizationData).toHaveProperty('edges');
      expect(response.body.data.visualizationData).toHaveProperty('layout');
    });

    test('GET /api/breeding/lineage-analysis should handle missing horses gracefully', async () => {
      const response = await request(app)
        .get('/api/breeding/lineage-analysis/99999/99998')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
    });

    test('POST /api/breeding/breeding-recommendations should generate comprehensive recommendations', async () => {
      const response = await request(app)
        .post('/api/breeding/breeding-recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          stallionId: testStallion.id,
          mareId: testMare.id
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('compatibility');
      expect(response.body.data).toHaveProperty('strengths');
      expect(response.body.data).toHaveProperty('risks');
      expect(response.body.data).toHaveProperty('suggestions');
      expect(response.body.data).toHaveProperty('expectedOutcomes');

      // Verify compatibility structure
      expect(response.body.data.compatibility).toHaveProperty('score');
      expect(response.body.data.compatibility).toHaveProperty('factors');
      expect(typeof response.body.data.compatibility.score).toBe('number');

      // Verify suggestions are actionable
      expect(Array.isArray(response.body.data.suggestions)).toBe(true);
    });
  });

  describe('📊 Genetic Diversity Tracking API', () => {
    test('POST /api/genetics/population-analysis should analyze population genetics', async () => {
      const horseIds = testPopulation.map(h => h.id);
      
      const response = await request(app)
        .post('/api/genetics/population-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ horseIds });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('diversityMetrics');
      expect(response.body.data).toHaveProperty('populationHealth');
      expect(response.body.data).toHaveProperty('geneticTrends');
      expect(response.body.data).toHaveProperty('breedingRecommendations');

      // Verify diversity metrics
      expect(response.body.data.diversityMetrics).toHaveProperty('shannonIndex');
      expect(response.body.data.diversityMetrics).toHaveProperty('diversityScore');
      expect(response.body.data.diversityMetrics.diversityScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.diversityMetrics.diversityScore).toBeLessThanOrEqual(100);

      // Verify population health
      expect(response.body.data.populationHealth).toHaveProperty('overallHealth');
      expect(response.body.data.populationHealth.overallHealth).toHaveProperty('score');
      expect(response.body.data.populationHealth.overallHealth).toHaveProperty('grade');
    });

    test('POST /api/genetics/inbreeding-analysis should calculate detailed inbreeding', async () => {
      const response = await request(app)
        .post('/api/genetics/inbreeding-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          stallionId: testStallion.id,
          mareId: testMare.id
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('coefficient');
      expect(response.body.data).toHaveProperty('commonAncestors');
      expect(response.body.data).toHaveProperty('pathAnalysis');
      expect(response.body.data).toHaveProperty('riskAssessment');
      expect(response.body.data).toHaveProperty('recommendations');

      // Verify coefficient is valid
      expect(response.body.data.coefficient).toBeGreaterThanOrEqual(0);
      expect(response.body.data.coefficient).toBeLessThanOrEqual(1);

      // Verify risk assessment
      expect(response.body.data.riskAssessment).toHaveProperty('level');
      expect(['low', 'medium', 'high', 'critical']).toContain(response.body.data.riskAssessment.level);
    });

    test('GET /api/genetics/diversity-report/:userId should generate comprehensive report', async () => {
      const response = await request(app)
        .get(`/api/genetics/diversity-report/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('executiveSummary');
      expect(response.body.data).toHaveProperty('currentStatus');
      expect(response.body.data).toHaveProperty('historicalAnalysis');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data).toHaveProperty('actionPlan');

      // Verify executive summary
      expect(response.body.data.executiveSummary).toHaveProperty('overallHealth');
      expect(response.body.data.executiveSummary).toHaveProperty('keyFindings');
      expect(Array.isArray(response.body.data.executiveSummary.keyFindings)).toBe(true);

      // Verify action plan
      expect(response.body.data.actionPlan).toHaveProperty('immediate');
      expect(response.body.data.actionPlan).toHaveProperty('shortTerm');
      expect(response.body.data.actionPlan).toHaveProperty('longTerm');
    });

    test('POST /api/genetics/optimal-breeding should recommend optimal breeding pairs', async () => {
      const horseIds = testPopulation.map(h => h.id);
      
      const response = await request(app)
        .post('/api/genetics/optimal-breeding')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ horseIds });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('optimalPairs');
      expect(response.body.data).toHaveProperty('avoidPairs');
      expect(response.body.data).toHaveProperty('priorityBreedings');
      expect(response.body.data).toHaveProperty('diversityGoals');

      // Verify optimal pairs structure
      expect(Array.isArray(response.body.data.optimalPairs)).toBe(true);
      if (response.body.data.optimalPairs.length > 0) {
        const pair = response.body.data.optimalPairs[0];
        expect(pair).toHaveProperty('stallionId');
        expect(pair).toHaveProperty('mareId');
        expect(pair).toHaveProperty('compatibilityScore');
        expect(pair.compatibilityScore).toBeGreaterThanOrEqual(0);
        expect(pair.compatibilityScore).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('🔒 API Security and Validation', () => {
    test('All genetic endpoints should require authentication', async () => {
      const endpoints = [
        { method: 'post', path: '/api/breeding/genetic-probability' },
        { method: 'get', path: `/api/breeding/lineage-analysis/${testStallion.id}/${testMare.id}` },
        { method: 'post', path: '/api/breeding/breeding-recommendations' },
        { method: 'post', path: '/api/genetics/population-analysis' },
        { method: 'post', path: '/api/genetics/inbreeding-analysis' },
        { method: 'get', path: `/api/genetics/diversity-report/${testUser.id}` },
        { method: 'post', path: '/api/genetics/optimal-breeding' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });

    test('Genetic endpoints should validate input parameters', async () => {
      // Test missing required parameters
      const response1 = await request(app)
        .post('/api/breeding/genetic-probability')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response1.status).toBe(400);

      // Test invalid horse IDs
      const response2 = await request(app)
        .post('/api/genetics/inbreeding-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          stallionId: 'invalid',
          mareId: 'invalid'
        });

      expect(response2.status).toBe(400);

      // Test empty horse arrays
      const response3 = await request(app)
        .post('/api/genetics/population-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ horseIds: [] });

      expect(response3.status).toBe(400);
    });

    test('Genetic endpoints should handle ownership validation', async () => {
      // Create another user
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'otherUser',
          email: 'other@test.com',
          password: 'TestPassword123!'
        });

      const otherLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'other@test.com',
          password: 'TestPassword123!'
        });

      const otherToken = otherLoginResponse.body.token;

      // Try to access genetic analysis with horses not owned by the user
      const response = await request(app)
        .post('/api/breeding/genetic-probability')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          stallionId: testStallion.id,
          mareId: testMare.id
        });

      expect(response.status).toBe(403);

      // Cleanup other user
      await prisma.user.delete({ where: { id: otherUserResponse.body.user.id } }).catch(() => {});
    });
  });
});
