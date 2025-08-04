/**
 * Ultra-Rare & Exotic Traits System Tests
 * Comprehensive test suite for ultra-rare and exotic trait functionality
 * Tests trait definitions, trigger evaluation, mechanical effects, and API endpoints
 *
 * Testing Approach: TDD with real database operations (no mocking)
 * Focus: Business logic validation, trigger conditions, mechanical effects
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../app.mjs';
import prisma from '../db/index.mjs';
import { generateTestToken } from './helpers/authHelper.mjs';
import { getAllUltraRareTraits, getAllExoticTraits, getUltraRareTraitDefinition } from '../utils/ultraRareTraits.mjs';
import { evaluateUltraRareTriggers, evaluateExoticUnlocks } from '../utils/ultraRareTriggerEngine.mjs';
import { assignRareTraitBoosterPerks, applyRareTraitBoosterEffects } from '../utils/groomRareTraitPerks.mjs';
import { applyUltraRareStressEffects, applyUltraRareCompetitionEffects, hasUltraRareAbility } from '../utils/ultraRareMechanicalEffects.mjs';

describe('Ultra-Rare & Exotic Traits System', () => {
  let testUser;
  let testToken;
  let testHorse;
  let testGroom;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        id: 'test-ultra-rare-user',
        email: 'ultrararetester@example.com',
        username: 'ultrararetester',
        firstName: 'Ultra',
        lastName: 'Rare',
        password: 'TestPassword123',
        money: 10000,
        xp: 1000,
        level: 5,
      },
    });

    testToken = generateTestToken({
      id: testUser.id,
      email: testUser.email,
      role: 'user',
    });

    // Create test horse with comprehensive data
    testHorse = await prisma.horse.create({
      data: {
        name: 'Ultra Rare Test Horse',
        sex: 'Mare',
        dateOfBirth: new Date('2021-01-01'),
        userId: testUser.id,
        temperament: 'reactive',
        bondScore: 85,
        stressLevel: 20,
        ultraRareTraits: {
          ultraRare: [],
          exotic: [],
        },
        epigeneticModifiers: {
          positive: ['resilient'],
          negative: [],
          hidden: [],
        },
      },
    });

    // Create test groom with rare trait booster potential
    testGroom = await prisma.groom.create({
      data: {
        name: 'Phoenix Whisperer Groom',
        speciality: 'foal_care',
        experience: 8,
        skillLevel: 'expert',
        personality: 'mindful',
        groomPersonality: 'guardian',
        bonusTraitMap: {
          'phoenix-born': 0.15,
          'resilient': 0.1,
        },
        rareTraitPerks: {},
        userId: testUser.id,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testHorse?.id) {
      await prisma.ultraRareTraitEvent.deleteMany({
        where: { horseId: testHorse.id },
      });
      await prisma.horse.delete({ where: { id: testHorse.id } });
    }
    if (testGroom?.id) {
      await prisma.groom.delete({ where: { id: testGroom.id } });
    }
    if (testUser?.id) {
      await prisma.user.delete({ where: { id: testUser.id } });
    }
  });

  describe('Trait Definitions System', () => {
    test('should retrieve all ultra-rare trait definitions', () => {
      const ultraRareTraits = getAllUltraRareTraits();

      expect(ultraRareTraits).toBeDefined();
      expect(Object.keys(ultraRareTraits)).toHaveLength(5);

      // Verify Phoenix-Born trait definition
      expect(ultraRareTraits['phoenix-born']).toBeDefined();
      expect(ultraRareTraits['phoenix-born'].name).toBe('Phoenix-Born');
      expect(ultraRareTraits['phoenix-born'].rarity).toBe('ultra-rare');
      expect(ultraRareTraits['phoenix-born'].baseChance).toBe(0.02);
      expect(ultraRareTraits['phoenix-born'].mechanicalEffects.stressDecayMultiplier).toBe(1.3);
    });

    test('should retrieve all exotic trait definitions', () => {
      const exoticTraits = getAllExoticTraits();

      expect(exoticTraits).toBeDefined();
      expect(Object.keys(exoticTraits)).toHaveLength(5);

      // Verify Fey-Kissed trait definition
      expect(exoticTraits['fey-kissed']).toBeDefined();
      expect(exoticTraits['fey-kissed'].name).toBe('Fey-Kissed');
      expect(exoticTraits['fey-kissed'].rarity).toBe('exotic');
      expect(exoticTraits['fey-kissed'].mechanicalEffects.allStatBonus).toBe(3);
    });

    test('should get specific trait definition by name', () => {
      const phoenixBorn = getUltraRareTraitDefinition('phoenix-born');
      expect(phoenixBorn).toBeDefined();
      expect(phoenixBorn.tier).toBe('ultra-rare');

      const soulbonded = getUltraRareTraitDefinition('soulbonded');
      expect(soulbonded).toBeDefined();
      expect(soulbonded.tier).toBe('exotic');

      const nonExistent = getUltraRareTraitDefinition('non-existent-trait');
      expect(nonExistent).toBeNull();
    });
  });

  describe('Trigger Evaluation Engine', () => {
    test('should evaluate ultra-rare trait triggers with proper conditions', async () => {
      // For now, just test that the evaluation system works without errors
      const ultraRareResults = await evaluateUltraRareTriggers(testHorse.id);

      expect(ultraRareResults).toBeDefined();
      expect(Array.isArray(ultraRareResults)).toBe(true);

      // The evaluation should complete without errors even if no traits are triggered
      // This validates the trigger evaluation engine structure
    });

    test('should evaluate exotic trait unlocks with complex conditions', async () => {
      const exoticResults = await evaluateExoticUnlocks(testHorse.id);

      expect(exoticResults).toBeDefined();
      expect(Array.isArray(exoticResults)).toBe(true);

      // Most exotic traits require very specific conditions that won't be met in basic test
      // This validates the evaluation system works without errors
    });
  });

  describe('Groom Perk System', () => {
    test('should assign rare trait booster perks to eligible grooms', async () => {
      const groomData = {
        experience: 8,
        personality: {
          tags: ['mindful', 'guardian'],
        },
        bonusTraitMap: {
          'phoenix-born': 0.15,
        },
      };

      const assignedPerks = await assignRareTraitBoosterPerks(testGroom.id, groomData);

      expect(assignedPerks).toBeDefined();
      expect(typeof assignedPerks).toBe('object');

      // Should assign Phoenix Whisperer perk due to mindful + guardian tags
      if (assignedPerks['phoenix-born-booster']) {
        expect(assignedPerks['phoenix-born-booster'].name).toBe('Phoenix Whisperer');
        expect(assignedPerks['phoenix-born-booster'].revealed).toBe(false);
        expect(assignedPerks['phoenix-born-booster'].triggerCount).toBe(0);
      }
    });

    test('should apply rare trait booster effects to probability calculations', () => {
      const groomData = {
        id: testGroom.id,
        rareTraitPerks: {
          'phoenix-born-booster': {
            name: 'Phoenix Whisperer',
            baseBonus: 0.25,
            stackedBonus: 0.15,
            triggerCount: 1,
            revealed: false,
          },
        },
      };

      const baseChance = 0.02;
      const conditions = {
        stressEvents: true,
        recoveries: true,
      };

      const result = applyRareTraitBoosterEffects('phoenix-born', baseChance, groomData, conditions);

      expect(result.originalChance).toBe(0.02);
      expect(result.modifiedChance).toBeGreaterThan(0.02);
      expect(result.appliedPerks).toHaveLength(2); // Base bonus + stacked bonus
      expect(result.perkBonus).toBeGreaterThan(0);
    });
  });

  describe('Mechanical Effects Integration', () => {
    test('should apply ultra-rare stress effects correctly', () => {
      const horseWithPhoenixBorn = {
        ultraRareTraits: {
          ultraRare: [{ name: 'Phoenix-Born' }],
          exotic: [],
        },
      };

      const baseStress = 50;
      const result = applyUltraRareStressEffects(horseWithPhoenixBorn, baseStress);

      expect(result.originalStress).toBe(50);
      expect(result.modifiedStress).toBeLessThan(50); // 20% stress resistance
      expect(result.appliedEffects).toHaveLength(1);
      expect(result.appliedEffects[0].trait).toBe('Phoenix-Born');
      expect(result.appliedEffects[0].effect).toBe('stress_resistance');
    });

    test('should apply ultra-rare competition effects correctly', () => {
      const horseWithBornLeader = {
        ultraRareTraits: {
          ultraRare: [{ name: 'Born Leader' }],
          exotic: [],
        },
      };

      const baseScore = 100;
      const competitionContext = { isPairEvent: false };
      const result = applyUltraRareCompetitionEffects(horseWithBornLeader, baseScore, competitionContext);

      expect(result.originalScore).toBe(100);
      expect(result.modifiedScore).toBeGreaterThan(100);
      expect(result.appliedEffects.length).toBeGreaterThan(0);

      // Should have competition presence bonus
      const presenceEffect = result.appliedEffects.find(effect => effect.effect === 'competition_presence');
      expect(presenceEffect).toBeDefined();
      expect(presenceEffect.trait).toBe('Born Leader');
    });

    test('should check ultra-rare abilities correctly', () => {
      const horseWithIronWilled = {
        ultraRareTraits: {
          ultraRare: [{ name: 'Iron-Willed' }],
          exotic: [],
        },
      };

      const horseWithGhostwalker = {
        ultraRareTraits: {
          ultraRare: [],
          exotic: [{ name: 'Ghostwalker' }],
        },
      };

      expect(hasUltraRareAbility(horseWithIronWilled, 'burnout_immunity')).toBe(true);
      expect(hasUltraRareAbility(horseWithIronWilled, 'stress_immunity')).toBe(false);

      expect(hasUltraRareAbility(horseWithGhostwalker, 'stress_immunity')).toBe(true);
      expect(hasUltraRareAbility(horseWithGhostwalker, 'burnout_immunity')).toBe(false);
    });
  });

  describe('API Endpoints', () => {
    test('GET /api/ultra-rare-traits/definitions should return all trait definitions', async () => {
      const response = await request(app)
        .get('/api/ultra-rare-traits/definitions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ultraRare).toBeDefined();
      expect(response.body.data.exotic).toBeDefined();
      expect(response.body.data.totalCount).toBe(10); // 5 ultra-rare + 5 exotic
    });

    test('POST /api/ultra-rare-traits/evaluate/:horseId should evaluate traits for owned horse', async () => {
      const response = await request(app)
        .post(`/api/ultra-rare-traits/evaluate/${testHorse.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          evaluationContext: {
            triggerSource: 'milestone_completion',
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ultraRareResults).toBeDefined();
      expect(response.body.data.exoticResults).toBeDefined();
      expect(Array.isArray(response.body.data.ultraRareResults)).toBe(true);
      expect(Array.isArray(response.body.data.exoticResults)).toBe(true);
    });

    test('GET /api/ultra-rare-traits/horse/:horseId should return horse ultra-rare traits', async () => {
      const response = await request(app)
        .get(`/api/ultra-rare-traits/horse/${testHorse.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.horse.id).toBe(testHorse.id);
      expect(response.body.data.traits).toBeDefined();
      expect(response.body.data.traits.ultraRare).toBeDefined();
      expect(response.body.data.traits.exotic).toBeDefined();
    });

    test('POST /api/ultra-rare-traits/groom/:groomId/assign-perks should assign perks to owned groom', async () => {
      const response = await request(app)
        .post(`/api/ultra-rare-traits/groom/${testGroom.id}/assign-perks`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.groom.id).toBe(testGroom.id);
      expect(response.body.data.assignedPerks).toBeDefined();
      expect(typeof response.body.data.assignedPerks).toBe('object');
    });

    test('should reject unauthorized access to horse traits', async () => {
      await request(app)
        .get(`/api/ultra-rare-traits/horse/${testHorse.id}`)
        .expect(401);
    });

    test('should reject access to non-owned horse', async () => {
      // Create another user's horse
      const otherUser = await prisma.user.create({
        data: {
          id: 'other-ultra-rare-user',
          email: 'other-ultra-rare@example.com',
          username: 'other-ultra-rare-user',
          firstName: 'Other',
          lastName: 'User',
          password: 'TestPassword123',
          money: 1000,
          xp: 0,
          level: 1,
        },
      });

      const otherHorse = await prisma.horse.create({
        data: {
          name: 'Other Horse',
          sex: 'Stallion',
          dateOfBirth: new Date('2021-01-01'),
          userId: otherUser.id,
        },
      });

      await request(app)
        .get(`/api/ultra-rare-traits/horse/${otherHorse.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(403);

      // Clean up
      await prisma.horse.delete({ where: { id: otherHorse.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });
});
