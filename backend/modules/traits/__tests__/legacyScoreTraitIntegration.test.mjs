/**
 * Legacy Score Trait Integration Test Suite
 *
 * Tests the integration of trait scoring into the legacy score calculation system.
 * This system incorporates the depth and quality of a horse's trait development
 * into its final Legacy Score, influencing its value as a breeder and prestige record.
 *
 * Features tested:
 * - Trait score calculation based on count, diversity, rarity, and groom care consistency
 * - Integration with existing trait history and milestone evaluation data
 * - Legacy score calculation with trait scoring component
 * - Business rules enforcement (traits before age 4, negative trait penalties)
 *
 * Testing approach: Real database operations with zero mocking to validate actual business logic
 *
 * Old contract: an "API Endpoints" block also called GET /api/v1/horses/:id/legacy-score
 * (200 with the trait breakdown, 401 without a token, 404 for a missing horse). Owner
 * ruling q242 (2026-10-28, Equoria-qw4kp, b2fed58c4) removed that route — its breakdown
 * let a player subtract to find a hidden rare trait's points — so the block is gone; the
 * removal is pinned by modules/horses/__tests__/legacyScoreRouteRemoved.integration.test.mjs.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';

// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

describe('Legacy Score Trait Integration System', () => {
  let testUser;
  let testHorse;
  let testBreed;
  let testGroom;

  beforeEach(async () => {
    // Fixture names use the `LegacyTraitTest_` / `legacytrait_` prefix to avoid
    // collision with shared cleanup helpers that wipe `TestHorse_*`, `TestBreed_*`,
    // and `testuser_*` globally (e.g. `cleanupTestData()` in helpers/testAuth.mjs,
    // and prefix wipers in horseOverview / leaderboardRoutes integration tests).
    // On the real shared DB those wipers ran in parallel workers and deleted this
    // suite's horse mid-test, causing FK violations on traitHistoryLog.create.
    testBreed = await prisma.breed.create({
      data: {
        name: `LegacyTraitTest_Breed_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        description: 'Test breed for legacy score tests',
      },
    });

    // Create test user
    testUser = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `legacytrait_user_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        firstName: 'Test',
        lastName: 'User',
        email: `legacytrait_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@example.com`,
        password: 'hashedpassword',
        money: 10000,
        xp: 100,
        level: 2,
      },
    });

    // Create test groom
    testGroom = await prisma.groom.create({
      data: {
        name: `LegacyTraitTest_Groom_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        speciality: 'foalCare',
        experience: 10,
        skillLevel: 'expert',
        personality: 'calm',
        epigeneticInfluenceType: 'calm',
        sessionRate: 25.0,
        userId: testUser.id,
      },
    });

    // Create test horse (4 years old to test legacy score calculation)
    testHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `LegacyTraitTest_Horse_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        sex: 'stallion',
        dateOfBirth: gameCalendarDate(new Date(), -4 * 365), // 4 years old
        temperament: 'spirited',
        userId: testUser.id,
        breedId: testBreed.id,
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
        // Add some base stats for legacy score calculation
        speed: 75,
        stamina: 80,
        agility: 70,
        balance: 85,
        precision: 90,
        intelligence: 88,
        boldness: 65,
        flexibility: 72,
        obedience: 95,
        focus: 82,
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    if (testHorse) {
      await prisma.horse.deleteMany({ where: { id: testHorse.id } });
    }
    if (testGroom) {
      await prisma.groom.deleteMany({ where: { id: testGroom.id } });
    }
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
    if (testBreed) {
      await prisma.breed.deleteMany({ where: { id: testBreed.id } });
    }
  });

  describe('Trait Score Calculation', () => {
    it('should calculate trait score based on count, diversity, and rarity', async () => {
      // Create diverse trait history for the horse (before age 4). The rare
      // traits are roster traits ruled Rare / Legendary (q134; Equoria-qw4kp);
      // the old fixture used off-roster sensitive and noble.
      const traitHistory = [
        { traitName: 'focused', sourceType: 'milestone', isEpigenetic: true, ageInDays: 30 },
        { traitName: 'heart', sourceType: 'groom', isEpigenetic: true, ageInDays: 60 },
        { traitName: 'quick_learner', sourceType: 'milestone', isEpigenetic: true, ageInDays: 365 },
        { traitName: 'athletic', sourceType: 'environmental', isEpigenetic: false, ageInDays: 730 },
        { traitName: 'confident', sourceType: 'groom', isEpigenetic: true, ageInDays: 1095 }, // 3 years
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
            influenceScore: 5,
          },
        });
      }

      const { calculateTraitScore } = await import('../services/legacyScoreTraitCalculator.mjs');

      const traitScore = await calculateTraitScore(testHorse.id);

      // Expected scoring:
      // - Trait count: 5 traits = 5 points (max 10)
      // - Diversity: 3 different source types = 3 points (max 5)
      // - Rare traits: 2 rare traits (focused, heart) = 6 points (max 10)
      // - Groom care consistency: No milestone data = 0 points (max 5)
      // Total expected: ~14 points (max 25)

      expect(traitScore.totalScore).toBeGreaterThanOrEqual(14);
      expect(traitScore.totalScore).toBeLessThanOrEqual(25);
      expect(traitScore.breakdown.traitCount).toBe(5);
      expect(traitScore.breakdown.diversity).toBeGreaterThanOrEqual(3);
      // Old contract: breakdown.rareTraits was 6. Owner ruling 2026-10-28
      // (q150): the rare-trait points are not shown; they still count in the total.
      expect(traitScore.breakdown).not.toHaveProperty('rareTraits');
      const b = traitScore.breakdown;
      expect(traitScore.totalScore).toBe(
        Math.max(0, b.traitCount + b.diversity + 6 + b.groomCareConsistency + b.negativeTraitPenalty),
      );
      expect(traitScore.breakdown.groomCareConsistency).toBeGreaterThanOrEqual(0);
    });

    it('should apply negative trait penalties', async () => {
      // Create trait history with negative traits: roster traits ruled negative
      // (q135; Equoria-qw4kp); the old fixture used off-roster stubborn and anxious.
      const traitHistory = [
        { traitName: 'resilient', sourceType: 'milestone', isEpigenetic: true, ageInDays: 30 },
        { traitName: 'fearful', sourceType: 'milestone', isEpigenetic: true, ageInDays: 60 }, // negative trait, -2
        { traitName: 'skittish', sourceType: 'environmental', isEpigenetic: false, ageInDays: 365 }, // negative trait, -1
      ];

      for (const trait of traitHistory) {
        await prisma.traitHistoryLog.create({
          data: {
            horseId: testHorse.id,
            traitName: trait.traitName,
            sourceType: trait.sourceType,
            isEpigenetic: trait.isEpigenetic,
            ageInDays: trait.ageInDays,
            groomId: null,
            bondScore: 50,
            influenceScore: trait.traitName === 'resilient' ? 5 : -3,
          },
        });
      }

      const { calculateTraitScore } = await import('../services/legacyScoreTraitCalculator.mjs');

      const traitScore = await calculateTraitScore(testHorse.id);

      // Should have penalties for negative traits
      expect(traitScore.breakdown.negativeTraitPenalty).toBe(-3);
      expect(traitScore.totalScore).toBeLessThan(10); // Lower due to negative traits
    });

    it('should only count traits gained before age 4', async () => {
      // Create trait history with traits after age 4
      const traitHistory = [
        { traitName: 'sensitive', sourceType: 'milestone', isEpigenetic: true, ageInDays: 30 }, // Before age 4
        { traitName: 'noble', sourceType: 'groom', isEpigenetic: true, ageInDays: 365 }, // Before age 4
        { traitName: 'lateTrait', sourceType: 'environmental', isEpigenetic: false, ageInDays: 1500 }, // After age 4 (4+ years)
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
            influenceScore: 5,
          },
        });
      }

      const { calculateTraitScore } = await import('../services/legacyScoreTraitCalculator.mjs');

      const traitScore = await calculateTraitScore(testHorse.id);

      // Should only count 2 traits (before age 4), not 3
      expect(traitScore.breakdown.traitCount).toBe(2);
      expect(traitScore.breakdown.traitsConsidered).toHaveLength(2);
      expect(traitScore.breakdown.traitsExcluded).toHaveLength(1);
    });

    it('should calculate groom care consistency from milestone logs', async () => {
      // Create milestone trait logs with varying groom care quality
      const milestoneData = [
        { milestoneType: 'imprinting', taskConsistency: 8, taskDiversity: 6, bondScore: 80 },
        { milestoneType: 'socialization', taskConsistency: 9, taskDiversity: 7, bondScore: 85 },
        { milestoneType: 'curiosity_play', taskConsistency: 7, taskDiversity: 5, bondScore: 75 },
      ];

      for (const milestone of milestoneData) {
        await prisma.milestoneTraitLog.create({
          data: {
            horseId: testHorse.id,
            milestoneType: milestone.milestoneType,
            score: 5,
            finalTrait: 'testTrait',
            groomId: testGroom.id,
            bondScore: milestone.bondScore,
            taskConsistency: milestone.taskConsistency,
            taskDiversity: milestone.taskDiversity,
            ageInDays: 100,
          },
        });
      }

      // Add corresponding trait history
      await prisma.traitHistoryLog.create({
        data: {
          horseId: testHorse.id,
          traitName: 'wellCaredFor',
          sourceType: 'milestone',
          isEpigenetic: true,
          ageInDays: 100,
          groomId: testGroom.id,
          bondScore: 80,
          influenceScore: 5,
        },
      });

      const { calculateTraitScore } = await import('../services/legacyScoreTraitCalculator.mjs');

      const traitScore = await calculateTraitScore(testHorse.id);

      // Should have good groom care consistency score
      expect(traitScore.breakdown.groomCareConsistency).toBeGreaterThan(2);
      expect(traitScore.breakdown.milestoneData).toHaveLength(3);
    });
  });

  describe('Legacy Score Integration', () => {
    it('should integrate trait score into overall legacy score', async () => {
      // Create trait history
      await prisma.traitHistoryLog.create({
        data: {
          horseId: testHorse.id,
          traitName: 'exceptional',
          sourceType: 'milestone',
          isEpigenetic: true,
          ageInDays: 365,
          groomId: testGroom.id,
          bondScore: 90,
          influenceScore: 8,
        },
      });

      const { calculateLegacyScore } = await import('../../horses/services/legacyScoreCalculator.mjs');

      const legacyScore = await calculateLegacyScore(testHorse.id);

      expect(legacyScore.totalScore).toBeGreaterThan(0);
      expect(legacyScore.components.traitScore).toBeDefined();
      expect(legacyScore.components.traitScore.score).toBeGreaterThan(0);
      expect(legacyScore.components.traitScore.maxScore).toBe(25);
      expect(legacyScore.breakdown.traitScoring).toBeDefined();
    });

    it('should calculate legacy score without traits', async () => {
      // Test horse with no trait history
      const { calculateLegacyScore } = await import('../../horses/services/legacyScoreCalculator.mjs');

      const legacyScore = await calculateLegacyScore(testHorse.id);

      expect(legacyScore.totalScore).toBeGreaterThan(0);
      expect(legacyScore.components.traitScore.score).toBe(0);
      expect(legacyScore.components.baseStats).toBeDefined();
      expect(legacyScore.components.achievements).toBeDefined();
    });
  });
});
