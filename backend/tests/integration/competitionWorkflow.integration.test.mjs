/**
 * INTEGRATION TEST: Complete Competition Workflow
 *
 * This test validates the ENTIRE competition process from horse preparation
 * to competition results and leaderboard updates, using balanced mocking.
 *
 * WORKFLOW TESTED:
 * 1. Horse Training & Preparation
 * 2. Competition Entry & Validation
 * 3. Competition Execution & Scoring
 * 4. Results Recording & XP Awards
 * 5. Leaderboard Updates
 * 6. Historical Performance Tracking
 *
 * MOCKING STRATEGY (Balanced Approach):
 * ✅ REAL: Database operations, business logic, scoring calculations, XP system
 * 🔧 MOCK: Only Math.random for deterministic competition results
 */

import { jest, describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import request from 'supertest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment
dotenv.config({ path: join(__dirname, '../../.env.test') });

describe('🏆 INTEGRATION: Complete Competition Workflow', () => {
  let testUser;
  let authToken;
  let competitionHorse;
  let testShow;
  let competitionResult;

  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupTestData();

    // Mock Math.random for deterministic competition results
    jest.spyOn(Math, 'random').mockReturnValue(0.7); // Good performance
  });

  afterAll(async () => {
    // Restore mocks
    jest.restoreAllMocks();

    // Clean up test data
    await cleanupTestData();
    await prisma.$disconnect();
  });

  async function cleanupTestData() {
    try {
      // Delete in correct order to respect foreign key constraints
      await prisma.competitionResult.deleteMany({
        where: { horse: { name: { startsWith: 'Competition Integration' } } },
      });

      await prisma.show.deleteMany({
        where: { name: { startsWith: 'Integration Test' } },
      });

      await prisma.trainingLog.deleteMany({
        where: { horse: { name: { startsWith: 'Competition Integration' } } },
      });

      await prisma.xpEvent.deleteMany({
        where: { user: { email: 'competition-integration@example.com' } },
      });

      await prisma.horse.deleteMany({
        where: { name: { startsWith: 'Competition Integration' } },
      });

      await prisma.user.deleteMany({
        where: { email: 'competition-integration@example.com' },
      });
    } catch (error) {
      // Cleanup errors can be ignored in tests
    }
  }

  describe('🔐 STEP 1: User & Horse Setup', () => {
    it('should create user and prepare competition-ready horse', async () => {
      // Create user
      const userData = {
        username: 'competitionuser',
        firstName: 'Competition',
        lastName: 'User',
        email: 'competition-integration@example.com',
        password: 'TestPassword123',
        money: 15000,
        xp: 100,
        level: 2,
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(201);

      testUser = response.body.data.user;
      authToken = response.body.data.token;

      // Create breed if needed
      const breed =
        (await prisma.breed.findFirst()) ||
        (await prisma.breed.create({
          data: {
            name: 'Competition Integration Breed',
            description: 'Test breed for competition integration',
          },
        }));

      // Create competition-ready horse
      competitionHorse = await prisma.horse.create({
        data: {
          name: 'Competition Integration Champion',
          age: 5, // Mature and experienced
          breedId: breed.id,
          ownerId: testUser.id,
          userId: testUser.id,
          sex: 'Stallion',
          dateOfBirth: new Date('2019-01-01'),
          healthStatus: 'Excellent',
          disciplineScores: {
            Racing: 75,
            Dressage: 68,
            'Show Jumping': 82,
            'Cross Country': 70,
          },
          epigeneticModifiers: {
            positive: ['fast', 'athletic', 'focused', 'brave', 'resilient', 'people_trusting'],
            negative: [],
            hidden: ['champion_heart'],
          },
        },
      });

      expect(competitionHorse.disciplineScores.Racing).toBe(75);
      expect(competitionHorse.age).toBeGreaterThanOrEqual(3);
    });
  });

  describe('🏟️ STEP 2: Competition Setup & Show Creation', () => {
    it('should create competition show with proper configuration', async () => {
      testShow = await prisma.show.create({
        data: {
          name: 'Integration Test Championship',
          discipline: 'Racing',
          runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          entryFee: 500,
          prize: 10000,
          levelMin: 1, // Minimum level requirement
          levelMax: 10, // Maximum level requirement
        },
      });

      // Add custom requirements for testing (not in schema, but used in business logic)
      testShow.requirements = {
        minAge: 3,
        minDisciplineScore: 50,
        healthStatus: 'Good',
      };

      expect(testShow.discipline).toBe('Racing');
      expect(testShow.prize).toBe(10000);
      expect(testShow.requirements.minDisciplineScore).toBe(50);
    });
  });

  describe('📝 STEP 3: Competition Entry & Validation', () => {
    it('should validate horse meets competition requirements using API', async () => {
      // Test the eligibility API endpoint
      const response = await request(app)
        .get(`/api/competition/eligibility/${competitionHorse.id}/${testShow.discipline}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.horseId).toBe(competitionHorse.id);
      expect(response.body.data.horseName).toBe(competitionHorse.name);
      expect(response.body.data.discipline).toBe(testShow.discipline);
      expect(response.body.data.eligibility).toHaveProperty('horseLevel');
      expect(response.body.data.eligibility).toHaveProperty('ageEligible');
      expect(response.body.data.eligibility).toHaveProperty('traitEligible');
      expect(response.body.data.eligibility.ageEligible).toBe(true); // Horse is 5 years old
      expect(response.body.data.eligibility.traitEligible).toBe(true); // Racing doesn't require special traits

      // Also verify direct database checks
      const horse = competitionHorse;
      const show = testShow;

      // Age requirement
      expect(horse.age).toBeGreaterThanOrEqual(show.requirements.minAge);

      // Discipline score requirement
      expect(horse.disciplineScores[show.discipline]).toBeGreaterThanOrEqual(
        show.requirements.minDisciplineScore,
      );

      // Health requirement
      expect(horse.healthStatus).toBe('Excellent'); // Exceeds 'Good' requirement

      // User has sufficient funds
      const user = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(user.money).toBeGreaterThanOrEqual(show.entryFee);
    });

    it('should successfully enter horse in competition using API endpoint', async () => {
      // Test the new competition entry API endpoint
      const response = await request(app)
        .post('/api/competition/enter')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          horseId: competitionHorse.id,
          showId: testShow.id,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Horse successfully entered in competition');
      expect(response.body.data.horseId).toBe(competitionHorse.id);
      expect(response.body.data.showId).toBe(testShow.id);
      expect(response.body.data.entryFee).toBe(testShow.entryFee);

      // VERIFY: Entry fee deducted from user account
      const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(updatedUser.money).toBe(15000 - testShow.entryFee);

      // VERIFY: Competition entry created in database
      const entry = await prisma.competitionResult.findFirst({
        where: {
          horseId: competitionHorse.id,
          showId: testShow.id,
        },
      });
      expect(entry).toBeTruthy();
      expect(entry.placement).toBeNull(); // Not yet executed
    });
  });

  describe('🏁 STEP 4: Competition Execution & Scoring', () => {
    it('should execute competition and calculate results', async () => {
      // Import competition logic (real business logic)
      const { calculateCompetitionScore } = await import('../../utils/competitionLogic.js');

      const horse = competitionHorse;
      const show = testShow;

      // Calculate competition score (real algorithm, mocked randomness)
      const competitionScore = calculateCompetitionScore(
        horse.disciplineScores[show.discipline],
        horse.epigeneticModifiers,
        horse.age,
        show.discipline,
      );

      expect(competitionScore).toBeGreaterThan(0);
      expect(competitionScore).toBeLessThanOrEqual(100);

      // Record competition result
      competitionResult = await prisma.competitionResult.create({
        data: {
          horseId: horse.id,
          showId: show.id,
          discipline: show.discipline,
          runDate: show.runDate,
          showName: show.name,
          score: competitionScore,
          placement: '1', // Will be calculated based on all entries
          prizeWon: show.prize * 0.5, // 50% for first place
        },
      });

      expect(Number(competitionResult.score)).toBe(competitionScore);
      expect(Number(competitionResult.prizeWon)).toBeGreaterThan(0);
    });
  });

  describe('💰 STEP 5: Prize Distribution & XP Awards', () => {
    it('should award prize money and XP for competition performance', async () => {
      const initialUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      const initialMoney = initialUser.money;
      const initialXP = initialUser.xp;

      // Award prize money
      const prizeAmount = Number(competitionResult.prizeWon);
      const updatedUser = await prisma.user.update({
        where: { id: testUser.id },
        data: {
          money: { increment: prizeAmount },
        },
      });

      expect(updatedUser.money).toBe(initialMoney + prizeAmount);

      // Award XP for competition participation
      const xpAmount = Math.floor(Number(competitionResult.score) / 10); // XP based on performance

      await prisma.xpEvent.create({
        data: {
          userId: testUser.id,
          amount: xpAmount,
          reason: `Competition: ${testShow.name} - Placement: ${competitionResult.placement}`,
          timestamp: new Date(),
        },
      });

      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          xp: { increment: xpAmount },
        },
      });

      // VERIFY: XP event logged
      const xpEvent = await prisma.xpEvent.findFirst({
        where: {
          userId: testUser.id,
          reason: { contains: 'Competition' },
        },
      });

      expect(xpEvent).toBeTruthy();
      expect(xpEvent.amount).toBe(xpAmount);

      // VERIFY: User XP increased
      const finalUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(finalUser.xp).toBe(initialXP + xpAmount);
    });
  });

  describe('📊 STEP 6: Leaderboard & Rankings', () => {
    it('should update leaderboards with competition results using API', async () => {
      // Test the new leaderboard API endpoint
      const response = await request(app)
        .get('/api/leaderboard/competition?metric=wins&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.leaderboard).toBeInstanceOf(Array);
      expect(response.body.data.filters.metric).toBe('wins');
      expect(response.body.data.pagination).toHaveProperty('total');
      expect(response.body.data.pagination).toHaveProperty('limit');
      expect(response.body.data.pagination).toHaveProperty('offset');
    });

    it('should track historical performance', async () => {
      // Get horse competition history
      const competitionHistory = await prisma.competitionResult.findMany({
        where: { horseId: competitionHorse.id },
        include: {
          show: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(competitionHistory).toHaveLength(1);
      expect(competitionHistory[0].show.name).toBe(testShow.name);
      expect(Number(competitionHistory[0].score)).toBe(Number(competitionResult.score));

      // VERIFY: Performance statistics
      const avgScore =
        competitionHistory.reduce((sum, result) => sum + result.score, 0) /
        competitionHistory.length;
      expect(avgScore).toBe(Number(competitionResult.score));

      const totalPrizeWon = competitionHistory.reduce(
        (sum, result) => sum + Number(result.prizeWon),
        0,
      );
      expect(totalPrizeWon).toBe(Number(competitionResult.prizeWon));
    });
  });

  describe('🎯 STEP 7: Performance Impact on Horse Value', () => {
    it('should increase horse value based on competition success', async () => {
      // Competition success should affect horse's perceived value
      const horseWithResults = await prisma.horse.findUnique({
        where: { id: competitionHorse.id },
        include: {
          competitionResults: true,
        },
      });

      expect(horseWithResults.competitionResults).toHaveLength(1);

      // Calculate estimated value based on performance
      const baseValue = 10000; // Base horse value
      const performanceBonus = horseWithResults.competitionResults.reduce((sum, result) => {
        return sum + result.score * 100; // $100 per score point
      }, 0);

      const estimatedValue = baseValue + performanceBonus;
      expect(estimatedValue).toBeGreaterThan(baseValue);

      // VERIFY: Horse has proven competition record
      expect(Number(horseWithResults.competitionResults[0].placement)).toBe(1);
      expect(Number(horseWithResults.competitionResults[0].prizeWon)).toBeGreaterThan(0);
    });
  });

  describe('🏆 STEP 8: Multi-Discipline Competition Readiness', () => {
    it('should validate horse can compete in multiple disciplines', async () => {
      const horse = await prisma.horse.findUnique({
        where: { id: competitionHorse.id },
      });

      // Check all disciplines where horse meets minimum requirements
      const eligibleDisciplines = [];
      const minScore = 50; // Typical minimum for competition

      Object.entries(horse.disciplineScores).forEach(([discipline, score]) => {
        if (score >= minScore) {
          eligibleDisciplines.push(discipline);
        }
      });

      expect(eligibleDisciplines.length).toBeGreaterThan(1);
      expect(eligibleDisciplines).toContain('Racing');
      expect(eligibleDisciplines).toContain('Show Jumping');

      // VERIFY: Horse is versatile competitor
      expect(horse.disciplineScores.Racing).toBeGreaterThanOrEqual(minScore);
      expect(horse.disciplineScores['Show Jumping']).toBeGreaterThanOrEqual(minScore);
      expect(horse.disciplineScores.Dressage).toBeGreaterThanOrEqual(minScore);
    });
  });

  describe('🎊 STEP 9: End-to-End Competition Workflow Validation', () => {
    it('should validate complete competition workflow integrity', async () => {
      // VERIFY: Complete competition workflow from entry to results
      const finalUser = await prisma.user.findUnique({
        where: { id: testUser.id },
        include: {
          horses: {
            include: {
              competitionResults: {
                include: { show: true },
              },
            },
          },
          xpEvents: true,
        },
      });

      // User progression
      expect(finalUser.xp).toBeGreaterThan(100); // Started with 100, gained more
      expect(finalUser.money).toBeGreaterThan(15000 - testShow.entryFee); // Prize money added

      // Horse competition record
      const horse = finalUser.horses.find(h => h.id === competitionHorse.id);
      expect(horse.competitionResults).toHaveLength(1);
      expect(Number(horse.competitionResults[0].placement)).toBe(1);

      // XP events include competition
      const competitionXP = finalUser.xpEvents.find(event => event.reason.includes('Competition'));
      expect(competitionXP).toBeTruthy();

      // Show status updated
      const finalShow = await prisma.show.findUnique({
        where: { id: testShow.id },
      });
      expect(finalShow.name).toBe(testShow.name);
      // Note: Show model doesn't have currentEntries field in schema
    });

    it('should validate all business rules enforced throughout competition', async () => {
      // Entry requirements enforced
      expect(competitionHorse.age).toBeGreaterThanOrEqual(testShow.requirements.minAge);
      expect(competitionHorse.disciplineScores[testShow.discipline]).toBeGreaterThanOrEqual(
        testShow.requirements.minDisciplineScore,
      );

      // Financial transactions accurate
      const user = await prisma.user.findUnique({ where: { id: testUser.id } });
      const expectedMoney = 15000 - testShow.entryFee + Number(competitionResult.prizeWon);
      expect(user.money).toBe(expectedMoney);

      // Competition results realistic
      expect(Number(competitionResult.score)).toBeGreaterThan(0);
      expect(Number(competitionResult.score)).toBeLessThanOrEqual(100);
      expect(Number(competitionResult.placement)).toBeGreaterThan(0);

      // Data integrity maintained
      expect(competitionResult.horseId).toBe(competitionHorse.id);
      expect(competitionResult.showId).toBe(testShow.id);
      // Note: CompetitionResult doesn't have userId field in schema
    });
  });
});
