/**
 * Comprehensive Tests for Groom Personality Trait Bonus System
 *
 * Tests the complete groom personality-temperament compatibility system using
 * REAL database operations and REAL business logic. NO MOCKING approach as
 * required by user specifications.
 *
 * This test suite validates:
 * - Personality-temperament compatibility matrix
 * - Trait development bonus calculations
 * - Milestone evaluation integration
 * - API endpoints functionality
 * - Database schema integration
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.mjs';
import prisma from '../db/index.mjs';
import {
  GROOM_PERSONALITY_TYPES,
  FOAL_TEMPERAMENT_TYPES,
  calculatePersonalityCompatibility,
  getCompatibleGroomsForTemperament,
} from '../utils/groomPersonalityTraitBonus.mjs';
import { applyPersonalityEffectsToMilestone } from '../utils/personalityModifierEngine.mjs';
import { evaluateEnhancedMilestone } from '../utils/enhancedMilestoneEvaluationSystem.mjs';

describe('Groom Personality Trait Bonus System - REAL SYSTEM TESTS', () => {
  let testUser;
  let testHorse;
  let testGroom;
  let testBreed;
  let authToken;

  beforeEach(async () => {
    // Create test breed first
    testBreed = await prisma.breed.create({
      data: {
        name: `TestBreed_${Date.now()}`,
        description: 'Test breed for personality tests',
      },
    });

    // Create test user with real database operations
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

    // Create test horse with temperament
    testHorse = await prisma.horse.create({
      data: {
        name: `TestHorse_${Date.now()}`,
        user: { connect: { id: testUser.id } },
        dateOfBirth: new Date(Date.now() - 0 * 24 * 60 * 60 * 1000), // 0 days old (newborn for imprinting)
        temperament: FOAL_TEMPERAMENT_TYPES.SPIRITED,
        bondScore: 65,
        stressLevel: 20,
        healthStatus: 'Good',
        sex: 'filly',
        breed: { connect: { id: testBreed.id } },
      },
    });

    // Create test groom with personality
    testGroom = await prisma.groom.create({
      data: {
        name: `TestGroom_${Date.now()}`,
        speciality: 'foalCare',
        experience: 5,
        skillLevel: 'intermediate',
        personality: GROOM_PERSONALITY_TYPES.CALM,
        sessionRate: 20.0,
        user: { connect: { id: testUser.id } },
        isActive: true,
      },
    });

    // Create auth token for API tests
    const tokenPayload = {
      id: testUser.id,
      username: testUser.username,
      email: testUser.email,
    };
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars',
      {
        expiresIn: '1h',
      }
    );
    authToken = `Bearer ${token}`;
  });

  afterEach(async () => {
    // Clean up test data with real database operations
    if (testGroom) {
      await prisma.groomInteraction.deleteMany({ where: { groomId: testGroom.id } });
      await prisma.groomAssignment.deleteMany({ where: { groomId: testGroom.id } });
      await prisma.milestoneTraitLog.deleteMany({ where: { groomId: testGroom.id } });
      await prisma.groom.delete({ where: { id: testGroom.id } });
    }

    if (testHorse) {
      await prisma.milestoneTraitLog.deleteMany({ where: { horseId: testHorse.id } });
      await prisma.horse.delete({ where: { id: testHorse.id } });
    }

    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } });
    }

    if (testBreed) {
      await prisma.breed.delete({ where: { id: testBreed.id } });
    }
  });

  describe('Personality Compatibility Matrix', () => {
    it('should correctly identify compatible personality-temperament pairs', () => {
      // Test CALM groom with SPIRITED foal (should be compatible)
      const compatibility = calculatePersonalityCompatibility(
        GROOM_PERSONALITY_TYPES.CALM,
        FOAL_TEMPERAMENT_TYPES.SPIRITED,
        65
      );

      expect(compatibility.isMatch).toBe(true);
      expect(compatibility.isStrongMatch).toBe(true); // High bond score (>60)
      expect(compatibility.traitModifierScore).toBe(2); // Strong match bonus
      expect(compatibility.stressResistanceBonus).toBe(-0.15); // -15% stress
      expect(compatibility.bondModifier).toBe(10);
    });

    it('should correctly identify incompatible personality-temperament pairs', () => {
      // Test RESERVED groom with PLAYFUL foal (should be incompatible)
      const compatibility = calculatePersonalityCompatibility(
        GROOM_PERSONALITY_TYPES.RESERVED,
        FOAL_TEMPERAMENT_TYPES.PLAYFUL,
        40
      );

      expect(compatibility.isMatch).toBe(false);
      expect(compatibility.isStrongMatch).toBe(false);
      expect(compatibility.traitModifierScore).toBe(-1); // Mismatch penalty
      expect(compatibility.stressResistanceBonus).toBe(0.05); // +5% stress
      expect(compatibility.bondModifier).toBe(-5);
    });

    it('should handle regular matches without high bond', () => {
      // Test ENERGETIC groom with LAZY foal (compatible but low bond)
      const compatibility = calculatePersonalityCompatibility(
        GROOM_PERSONALITY_TYPES.ENERGETIC,
        FOAL_TEMPERAMENT_TYPES.LAZY,
        45 // Below 60 threshold
      );

      expect(compatibility.isMatch).toBe(true);
      expect(compatibility.isStrongMatch).toBe(false); // Bond too low
      expect(compatibility.traitModifierScore).toBe(1); // Regular match bonus
      expect(compatibility.stressResistanceBonus).toBe(-0.05); // -5% stress
      expect(compatibility.bondModifier).toBe(5);
    });
  });

  describe('Personality Modifier Engine', () => {
    it('should apply personality effects to milestone evaluation', () => {
      const effects = applyPersonalityEffectsToMilestone({
        groomPersonality: GROOM_PERSONALITY_TYPES.CALM,
        foalTemperament: FOAL_TEMPERAMENT_TYPES.SPIRITED,
        bondScore: 70,
        baseMilestoneScore: 1,
        baseStressLevel: 30,
        baseBondingRate: 5,
      });

      expect(effects.personalityEffectApplied).toBe(true);
      expect(effects.personalityMatchScore).toBe(2); // Strong match
      expect(effects.modifiedMilestoneScore).toBe(3); // 1 + 2
      expect(effects.modifiedStressLevel).toBeLessThan(30); // Stress reduced
      expect(effects.modifiedBondingRate).toBe(15); // 5 + 10
    });

    it('should handle missing personality or temperament gracefully', () => {
      const effects = applyPersonalityEffectsToMilestone({
        groomPersonality: null,
        foalTemperament: FOAL_TEMPERAMENT_TYPES.SPIRITED,
        bondScore: 70,
        baseMilestoneScore: 1,
        baseStressLevel: 30,
        baseBondingRate: 5,
      });

      expect(effects.personalityEffectApplied).toBe(false);
      expect(effects.personalityMatchScore).toBe(0);
      expect(effects.modifiedMilestoneScore).toBe(1); // Unchanged
      expect(effects.modifiedStressLevel).toBe(30); // Unchanged
      expect(effects.modifiedBondingRate).toBe(5); // Unchanged
    });
  });

  describe('Enhanced Milestone Evaluation Integration', () => {
    it('should integrate personality effects into milestone evaluation', async () => {
      // Create groom assignment for the test
      await prisma.groomAssignment.create({
        data: {
          groomId: testGroom.id,
          foalId: testHorse.id,
          userId: testUser.id,
          isActive: true,
          priority: 5, // High priority (1-5 scale)
          notes: 'Test assignment',
        },
      });

      // Evaluate milestone with personality effects
      const result = await evaluateEnhancedMilestone(testHorse.id, 'imprinting', {
        forceReevaluate: true,
      });

      expect(result.success).toBe(true);
      expect(result.milestoneLog).toBeDefined();
      expect(result.milestoneLog.personalityEffectApplied).toBe(true);
      expect(result.milestoneLog.personalityMatchScore).toBe(2); // CALM + SPIRITED strong match
      expect(result.personalityCompatibility).toBeDefined();
      expect(result.personalityCompatibility.isMatch).toBe(true);
    });

    it('should handle milestone evaluation without groom assignment', async () => {
      // Evaluate milestone without groom assignment
      const result = await evaluateEnhancedMilestone(testHorse.id, 'imprinting', {
        forceReevaluate: true,
      });

      expect(result.success).toBe(true);
      expect(result.milestoneLog).toBeDefined();
      expect(result.milestoneLog.personalityEffectApplied).toBe(false);
      expect(result.milestoneLog.personalityMatchScore).toBe(0);
      expect(result.personalityCompatibility).toBeNull();
    });
  });

  describe('Compatible Grooms Utility', () => {
    it('should return all compatible grooms for a temperament', () => {
      const compatibleGrooms = getCompatibleGroomsForTemperament(FOAL_TEMPERAMENT_TYPES.SPIRITED);

      expect(compatibleGrooms).toHaveLength(3); // CALM, SOFT_SPOKEN, RESERVED
      expect(compatibleGrooms.some((g) => g.personality === GROOM_PERSONALITY_TYPES.CALM)).toBe(
        true
      );
      expect(
        compatibleGrooms.some((g) => g.personality === GROOM_PERSONALITY_TYPES.SOFT_SPOKEN)
      ).toBe(true);
      expect(compatibleGrooms.some((g) => g.personality === GROOM_PERSONALITY_TYPES.RESERVED)).toBe(
        true
      );
    });

    it('should return empty array for unknown temperament', () => {
      const compatibleGrooms = getCompatibleGroomsForTemperament('UnknownTemperament');
      expect(compatibleGrooms).toHaveLength(0);
    });
  });

  describe('API Endpoints - REAL HTTP TESTS', () => {
    describe('GET /api/grooms/:id/profile', () => {
      it('should return groom profile with personality information', async () => {
        const response = await request(app)
          .get(`/api/grooms/${testGroom.id}/profile`)
          .set('Authorization', authToken)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.groom).toBeDefined();
        expect(response.body.groom.id).toBe(testGroom.id);
        expect(response.body.groom.personality).toBe(GROOM_PERSONALITY_TYPES.CALM);
        expect(response.body.groom.personalityCompatibility).toBeDefined();
      });

      it('should return 404 for non-existent groom', async () => {
        const response = await request(app)
          .get('/api/grooms/99999/profile')
          .set('Authorization', authToken)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Groom not found');
      });

      it('should return 400 for invalid groom ID', async () => {
        const response = await request(app)
          .get('/api/grooms/invalid/profile')
          .set('Authorization', authToken)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Invalid groom ID');
      });
    });

    describe('GET /api/horses/:id/personality-impact', () => {
      it('should return personality compatibility for horse', async () => {
        const response = await request(app)
          .get(`/api/horses/${testHorse.id}/personality-impact`)
          .set('Authorization', authToken)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.horse).toBeDefined();
        expect(response.body.horse.temperament).toBe(FOAL_TEMPERAMENT_TYPES.SPIRITED);
        expect(response.body.groomCompatibility).toBeDefined();
        expect(response.body.generalCompatibility).toBeDefined();
        expect(response.body.totalGrooms).toBeGreaterThanOrEqual(1);
      });

      it('should return 404 for non-existent horse', async () => {
        const response = await request(app)
          .get('/api/horses/99999/personality-impact')
          .set('Authorization', authToken)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Horse not found');
      });

      it('should return 400 for horse without temperament', async () => {
        // Create horse without temperament
        const horseWithoutTemperament = await prisma.horse.create({
          data: {
            name: 'NoTemperamentHorse',
            user: { connect: { id: testUser.id } },
            dateOfBirth: new Date(),
            sex: 'colt',
            breed: { connect: { id: testBreed.id } },
          },
        });

        const response = await request(app)
          .get(`/api/horses/${horseWithoutTemperament.id}/personality-impact`)
          .set('Authorization', authToken)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('temperament not set');

        // Cleanup
        await prisma.horse.delete({ where: { id: horseWithoutTemperament.id } });
      });
    });

    describe('POST /api/milestones/evaluate-milestone (with personality impact)', () => {
      it('should evaluate milestone with personality effects', async () => {
        // Create groom assignment
        await prisma.groomAssignment.create({
          data: {
            groomId: testGroom.id,
            foalId: testHorse.id,
            userId: testUser.id,
            isActive: true,
            priority: 5, // High priority (1-5 scale)
            notes: 'Test assignment for milestone',
          },
        });

        // Get CSRF token for POST request
        const csrfResponse = await request(app).get('/auth/csrf-token');
        const csrfToken = csrfResponse.body.csrfToken;
        const csrfCookie = csrfResponse.headers['set-cookie']
          .find((cookie) => cookie.startsWith('_csrf='))
          .split(';')[0];

        const response = await request(app)
          .post('/api/milestones/evaluate-milestone')
          .set('Authorization', authToken)
          .set('Cookie', csrfCookie)
          .set('X-CSRF-Token', csrfToken)
          .send({
            horseId: testHorse.id,
            milestoneType: 'imprinting',
            forceReevaluate: true,
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.milestoneLogId).toBeDefined();
        expect(response.body.data.modifiersApplied).toBeDefined();
        expect(response.body.data.modifiersApplied.personalityEffects).toBeDefined();
        expect(response.body.data.modifiersApplied.personalityEffects.personalityMatchScore).toBe(
          2
        ); // Strong match
        expect(
          response.body.data.modifiersApplied.personalityEffects.personalityEffectApplied
        ).toBe(true);
        expect(
          response.body.data.modifiersApplied.personalityEffects.personalityCompatibility.isMatch
        ).toBe(true);
      });
    });
  });
});
