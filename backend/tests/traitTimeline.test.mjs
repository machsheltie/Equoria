/**
 * Trait Timeline Test Suite
 *
 * Tests the trait timeline system that creates visual trait development cards showing
 * trait and flag acquisition by age, milestone evaluation results, and groom involvement.
 * This system provides a comprehensive growth summary for horse development analysis.
 *
 * Features tested:
 * - Trait timeline data aggregation from trait history and milestone logs
 * - Timeline formatting with age-based organization
 * - Trait source event tracking (milestone, groom, breeding, environmental)
 * - Bond/stress context inclusion with care pattern analysis
 * - Age-based filtering (only traits before age 4)
 * - Trait type distinctions (epigenetic, inherited, rare, negative)
 * - API endpoint for trait timeline card retrieval
 *
 * Testing approach: Real database operations with zero mocking to validate actual business logic
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.mjs';
import prisma from '../db/index.mjs';

describe('Trait Timeline System', () => {
  let testUser;
  let testHorse;
  let testBreed;
  let testGroom;
  let authToken;

  beforeEach(async () => {
    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: `TestBreed_${Date.now()}`,
        description: 'Test breed for trait timeline tests',
      },
    });

    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `testuser_${Date.now()}`,
        firstName: 'Test',
        lastName: 'User',
        email: `test_${Date.now()}@example.com`,
        password: 'hashedpassword',
        money: 10000,
        xp: 100,
        level: 2,
      },
    });

    // Create test groom
    testGroom = await prisma.groom.create({
      data: {
        name: `TestGroom_${Date.now()}`,
        speciality: 'foal_care',
        experience: 10,
        skillLevel: 'expert',
        personality: 'calm',
        groomPersonality: 'calm',
        sessionRate: 25.0,
        userId: testUser.id,
      },
    });

    // Create test horse (3 years old)
    testHorse = await prisma.horse.create({
      data: {
        name: `TestHorse_${Date.now()}`,
        sex: 'stallion',
        dateOfBirth: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000), // 3 years old
        temperament: 'spirited',
        userId: testUser.id,
        breedId: testBreed.id,
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
    });

    // Create auth token
    const tokenPayload = {
      id: testUser.id,
      username: testUser.username,
      email: testUser.email,
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars', {
      expiresIn: '1h',
    });
    authToken = `Bearer ${token}`;
  });

  afterEach(async () => {
    // Clean up test data
    if (testHorse) {
      await prisma.horse.delete({ where: { id: testHorse.id } });
    }
    if (testGroom) {
      await prisma.groom.delete({ where: { id: testGroom.id } });
    }
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } });
    }
    if (testBreed) {
      await prisma.breed.delete({ where: { id: testBreed.id } });
    }
  });

  describe('Trait Timeline Data Aggregation', () => {
    it('should aggregate trait timeline with milestone and groom data', async () => {
      // Create comprehensive trait history spanning different ages
      const traitHistory = [
        { traitName: 'sensitive', sourceType: 'milestone', ageInDays: 7, isEpigenetic: true },
        { traitName: 'noble', sourceType: 'groom', ageInDays: 30, isEpigenetic: true },
        { traitName: 'quick_learner', sourceType: 'milestone', ageInDays: 180, isEpigenetic: true },
        { traitName: 'athletic', sourceType: 'environmental', ageInDays: 365, isEpigenetic: false },
        { traitName: 'confident', sourceType: 'breeding', ageInDays: 730, isEpigenetic: false },
      ];

      for (const trait of traitHistory) {
        await prisma.traitHistoryLog.create({
          data: {
            horseId: testHorse.id,
            traitName: trait.traitName,
            sourceType: trait.sourceType,
            isEpigenetic: trait.isEpigenetic,
            ageInDays: trait.ageInDays,
            groomId: trait.sourceType === 'groom' ? testGroom.id : null,
            bondScore: 75,
            stressLevel: 20,
            influenceScore: 5,
          },
        });
      }

      // Create milestone evaluation data
      await prisma.milestoneTraitLog.create({
        data: {
          horseId: testHorse.id,
          milestoneType: 'imprinting',
          score: 6,
          finalTrait: 'sensitive',
          groomId: testGroom.id,
          bondScore: 80,
          taskConsistency: 8,
          taskDiversity: 6,
          ageInDays: 7,
        },
      });

      // Test will fail initially - need to implement traitTimelineService
      const { generateTraitTimeline } = await import('../services/traitTimelineService.mjs');

      const timeline = await generateTraitTimeline(testHorse.id);

      expect(timeline.horseId).toBe(testHorse.id);
      expect(timeline.timelineEvents).toHaveLength(5);
      expect(timeline.ageRanges).toBeDefined();
      expect(timeline.summary.totalTraits).toBe(5);
      expect(timeline.summary.epigeneticTraits).toBe(3);
      expect(timeline.summary.sourceTypes).toHaveLength(4);

      // Check timeline organization by age
      const firstWeekEvents = timeline.ageRanges.firstWeek;
      expect(firstWeekEvents).toHaveLength(1);
      expect(firstWeekEvents[0].traitName).toBe('sensitive');

      const firstMonthEvents = timeline.ageRanges.firstMonth;
      expect(firstMonthEvents).toHaveLength(1);
      expect(firstMonthEvents[0].traitName).toBe('noble');
    });

    it('should include detailed trait context and groom involvement', async () => {
      // Create trait with detailed groom context
      await prisma.traitHistoryLog.create({
        data: {
          horseId: testHorse.id,
          traitName: 'empathic',
          sourceType: 'groom',
          isEpigenetic: true,
          ageInDays: 45,
          groomId: testGroom.id,
          bondScore: 85,
          stressLevel: 15,
          influenceScore: 7,
        },
      });

      // Create corresponding milestone data
      await prisma.milestoneTraitLog.create({
        data: {
          horseId: testHorse.id,
          milestoneType: 'socialization',
          score: 8,
          finalTrait: 'empathic',
          groomId: testGroom.id,
          bondScore: 85,
          taskConsistency: 9,
          taskDiversity: 7,
          ageInDays: 45,
        },
      });

      const { generateTraitTimeline } = await import('../services/traitTimelineService.mjs');

      const timeline = await generateTraitTimeline(testHorse.id);

      const traitEvent = timeline.timelineEvents[0];
      expect(traitEvent.traitName).toBe('empathic');
      expect(traitEvent.groomContext).toBeDefined();
      expect(traitEvent.groomContext.groomName).toBe(testGroom.name);
      expect(traitEvent.groomContext.bondScore).toBe(85);
      expect(traitEvent.groomContext.stressLevel).toBe(15);
      expect(traitEvent.milestoneContext).toBeDefined();
      expect(traitEvent.milestoneContext.milestoneType).toBe('socialization');
      expect(traitEvent.milestoneContext.taskConsistency).toBe(9);
    });

    it('should filter traits by age cutoff (before age 4)', async () => {
      // Create traits both before and after age 4
      const traitHistory = [
        { traitName: 'early_trait', ageInDays: 365 }, // 1 year - should be included
        { traitName: 'late_trait', ageInDays: 1500 }, // 4+ years - should be excluded
        { traitName: 'cutoff_trait', ageInDays: 1460 }, // Exactly 4 years - should be excluded
      ];

      for (const trait of traitHistory) {
        await prisma.traitHistoryLog.create({
          data: {
            horseId: testHorse.id,
            traitName: trait.traitName,
            sourceType: 'milestone',
            isEpigenetic: true,
            ageInDays: trait.ageInDays,
            groomId: null,
            bondScore: 70,
            stressLevel: 25,
            influenceScore: 4,
          },
        });
      }

      const { generateTraitTimeline } = await import('../services/traitTimelineService.mjs');

      const timeline = await generateTraitTimeline(testHorse.id);

      expect(timeline.timelineEvents).toHaveLength(1);
      expect(timeline.timelineEvents[0].traitName).toBe('early_trait');
      expect(timeline.summary.totalTraits).toBe(1);
      expect(timeline.summary.traitsExcluded).toBe(2);
      expect(timeline.excludedTraits).toHaveLength(2);
    });

    it('should categorize traits by type and rarity', async () => {
      // Create diverse trait types
      const traitHistory = [
        { traitName: 'sensitive', sourceType: 'milestone', isRare: true, isNegative: false },
        { traitName: 'stubborn', sourceType: 'environmental', isRare: false, isNegative: true },
        { traitName: 'athletic', sourceType: 'breeding', isRare: false, isNegative: false },
        { traitName: 'legendary', sourceType: 'groom', isRare: true, isNegative: false },
      ];

      for (const trait of traitHistory) {
        await prisma.traitHistoryLog.create({
          data: {
            horseId: testHorse.id,
            traitName: trait.traitName,
            sourceType: trait.sourceType,
            isEpigenetic: true,
            ageInDays: 100,
            groomId: trait.sourceType === 'groom' ? testGroom.id : null,
            bondScore: 70,
            stressLevel: 25,
            influenceScore: trait.isNegative ? -2 : 5,
          },
        });
      }

      const { generateTraitTimeline } = await import('../services/traitTimelineService.mjs');

      const timeline = await generateTraitTimeline(testHorse.id);

      expect(timeline.summary.rareTraits).toBe(2);
      expect(timeline.summary.negativeTraits).toBe(1);
      expect(timeline.categorization.rare).toHaveLength(2);
      expect(timeline.categorization.negative).toHaveLength(1);
      expect(timeline.categorization.positive).toHaveLength(3); // 4 total - 1 negative = 3 positive
    });

    it('should handle horses with no trait history', async () => {
      // Test horse with no traits
      const { generateTraitTimeline } = await import('../services/traitTimelineService.mjs');

      const timeline = await generateTraitTimeline(testHorse.id);

      expect(timeline.horseId).toBe(testHorse.id);
      expect(timeline.timelineEvents).toHaveLength(0);
      expect(timeline.summary.totalTraits).toBe(0);
      expect(timeline.ageRanges.firstWeek).toHaveLength(0);
      expect(timeline.isEmpty).toBe(true);
    });
  });

  describe('Timeline Formatting and Organization', () => {
    it('should organize events by age ranges', async () => {
      // Create traits at specific age milestones
      const ageRangeTraits = [
        { name: 'week1_trait', ageInDays: 5 },
        { name: 'month1_trait', ageInDays: 25 },
        { name: 'month3_trait', ageInDays: 85 },
        { name: 'year1_trait', ageInDays: 300 },
        { name: 'year2_trait', ageInDays: 600 },
        { name: 'year3_trait', ageInDays: 900 },
      ];

      for (const trait of ageRangeTraits) {
        await prisma.traitHistoryLog.create({
          data: {
            horseId: testHorse.id,
            traitName: trait.name,
            sourceType: 'milestone',
            isEpigenetic: true,
            ageInDays: trait.ageInDays,
            groomId: null,
            bondScore: 70,
            stressLevel: 25,
            influenceScore: 4,
          },
        });
      }

      const { generateTraitTimeline } = await import('../services/traitTimelineService.mjs');

      const timeline = await generateTraitTimeline(testHorse.id);

      expect(timeline.ageRanges.firstWeek).toHaveLength(1);
      expect(timeline.ageRanges.firstMonth).toHaveLength(1);
      expect(timeline.ageRanges.firstThreeMonths).toHaveLength(1);
      expect(timeline.ageRanges.firstYear).toHaveLength(1);
      expect(timeline.ageRanges.secondYear).toHaveLength(1);
      expect(timeline.ageRanges.thirdYear).toHaveLength(1);
    });

    it('should include bond and stress trend analysis', async () => {
      // Create traits with varying bond/stress patterns
      const bondStressData = [
        { ageInDays: 30, bondScore: 60, stressLevel: 40 },
        { ageInDays: 60, bondScore: 70, stressLevel: 30 },
        { ageInDays: 90, bondScore: 80, stressLevel: 20 },
        { ageInDays: 120, bondScore: 85, stressLevel: 15 },
      ];

      for (let i = 0; i < bondStressData.length; i++) {
        const data = bondStressData[i];
        await prisma.traitHistoryLog.create({
          data: {
            horseId: testHorse.id,
            traitName: `trait_${i + 1}`,
            sourceType: 'groom',
            isEpigenetic: true,
            ageInDays: data.ageInDays,
            groomId: testGroom.id,
            bondScore: data.bondScore,
            stressLevel: data.stressLevel,
            influenceScore: 5,
          },
        });
      }

      const { generateTraitTimeline } = await import('../services/traitTimelineService.mjs');

      const timeline = await generateTraitTimeline(testHorse.id);

      expect(timeline.bondStressTrend).toBeDefined();
      expect(timeline.bondStressTrend.bondTrend).toBe('improving'); // 60 -> 85
      expect(timeline.bondStressTrend.stressTrend).toBe('decreasing'); // 40 -> 15
      expect(timeline.bondStressTrend.dataPoints).toHaveLength(4);
    });
  });

  describe('API Endpoints', () => {
    it('should get trait timeline card via API', async () => {
      // Create some trait history
      await prisma.traitHistoryLog.create({
        data: {
          horseId: testHorse.id,
          traitName: 'noble',
          sourceType: 'milestone',
          isEpigenetic: true,
          ageInDays: 45,
          groomId: testGroom.id,
          bondScore: 80,
          stressLevel: 20,
          influenceScore: 6,
        },
      });

      const response = await request(app).get(`/api/horses/${testHorse.id}/trait-card`).set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.timeline).toBeDefined();
      expect(response.body.data.timeline.horseId).toBe(testHorse.id);
      expect(response.body.data.timeline.timelineEvents).toHaveLength(1);
    });

    it('should require authentication for trait card endpoint', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorse.id}/trait-card`)
        .set('x-test-require-auth', 'true');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent horse', async () => {
      const response = await request(app)
        .get('/api/horses/99999/trait-card')
        .set('Authorization', authToken)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should handle horses with empty trait timeline', async () => {
      const response = await request(app).get(`/api/horses/${testHorse.id}/trait-card`).set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.timeline.isEmpty).toBe(true);
      expect(response.body.data.timeline.timelineEvents).toHaveLength(0);
    });
  });
});
