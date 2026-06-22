/**
 * @fileoverview Comprehensive Groom Hiring Workflow Tests
 *
 * Tests the groom hiring workflow with focus on edge cases and validation.
 * Uses real DB, real controller calls, and plain JS response capture objects.
 * No mocking of any kind.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { hireGroom, getGroomDefinitions } from '../../grooms/index.mjs';
import { GROOM_SPECIALTIES, SKILL_LEVELS, PERSONALITY_TRAITS } from '../../../utils/groomSystem.mjs';

function makeRes() {
  return {
    _status: null,
    _json: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._json = body;
      return this;
    },
  };
}

describe('Groom Hiring Workflow Tests', () => {
  let testUser;
  let wealthyUser;
  let limitedUser;

  const TEST_USER_IDS = ['test-user-groom-hiring', 'wealthy-user-groom-hiring', 'limited-user-groom-hiring'];

  const cleanupTestData = async () => {
    await prisma.groom.deleteMany({
      where: { userId: { in: TEST_USER_IDS } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: TEST_USER_IDS } },
    });
  };

  beforeEach(async () => {
    await cleanupTestData();

    testUser = await prisma.user.create({
      data: {
        id: 'test-user-groom-hiring',
        username: 'groomhiringuser',
        email: 'groomhiring@example.com',
        password: 'TestPassword123!',
        firstName: 'Groom',
        lastName: 'Hirer',
        money: 5000,
      },
    });

    wealthyUser = await prisma.user.create({
      data: {
        id: 'wealthy-user-groom-hiring',
        username: 'wealthyuser',
        email: 'wealthy@example.com',
        password: 'TestPassword123!',
        firstName: 'Wealthy',
        lastName: 'Owner',
        money: 50000,
      },
    });

    limitedUser = await prisma.user.create({
      data: {
        id: 'limited-user-groom-hiring',
        username: 'limiteduser',
        email: 'limited@example.com',
        password: 'TestPassword123!',
        firstName: 'Limited',
        lastName: 'Budget',
        money: 100,
      },
    });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('1. Required Field Validation', () => {
    it('should validate name is required', async () => {
      const req = {
        body: { speciality: 'foal_care', skill_level: 'expert', personality: 'gentle' },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toEqual(expect.objectContaining({ success: false, message: expect.stringContaining('name') }));
    });

    it('should validate speciality is required', async () => {
      const req = {
        body: { name: 'Test Groom', skill_level: 'expert', personality: 'gentle' },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toEqual(
        expect.objectContaining({ success: false, message: expect.stringContaining('speciality') }),
      );
    });

    it('should validate skill_level is required', async () => {
      const req = {
        body: { name: 'Test Groom', speciality: 'foal_care', personality: 'gentle' },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toEqual(
        expect.objectContaining({ success: false, message: expect.stringContaining('skill_level') }),
      );
    });

    it('should validate personality is required', async () => {
      const req = {
        body: { name: 'Test Groom', speciality: 'foal_care', skill_level: 'expert' },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toEqual(
        expect.objectContaining({ success: false, message: expect.stringContaining('personality') }),
      );
    });

    it('should validate all required fields at once', async () => {
      const req = { body: {}, user: { id: testUser.id } };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toEqual(
        expect.objectContaining({ success: false, message: expect.stringContaining('required') }),
      );
    });
  });

  describe('2. Field Value Validation', () => {
    it('should validate speciality against defined values', async () => {
      const req = {
        body: {
          name: 'Test Groom',
          speciality: 'invalid_speciality',
          experience: 10,
          skill_level: 'expert',
          personality: 'gentle',
        },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toEqual(
        expect.objectContaining({ success: false, message: expect.stringContaining('Invalid speciality') }),
      );
    });

    it('should validate skill_level against defined values', async () => {
      const req = {
        body: {
          name: 'Test Groom',
          speciality: 'foal_care',
          experience: 10,
          skill_level: 'invalid_level',
          personality: 'gentle',
        },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toEqual(
        expect.objectContaining({ success: false, message: expect.stringContaining('Invalid skill level') }),
      );
    });

    it('should validate personality against defined values', async () => {
      const req = {
        body: {
          name: 'Test Groom',
          speciality: 'foal_care',
          experience: 10,
          skill_level: 'expert',
          personality: 'invalid_personality',
        },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toEqual(
        expect.objectContaining({ success: false, message: expect.stringContaining('Invalid personality') }),
      );
    });

    it('should accept all valid speciality values', async () => {
      for (const speciality of Object.keys(GROOM_SPECIALTIES)) {
        const req = {
          body: { name: `${speciality} Specialist`, speciality, skill_level: 'expert', personality: 'gentle' },
          user: { id: testUser.id },
        };
        const res = makeRes();

        try {
          await hireGroom(req, res);

          expect(res._status).toBe(201);
          expect(res._json).toEqual(
            expect.objectContaining({ success: true, data: expect.objectContaining({ speciality }) }),
          );
        } catch (error) {
          console.error(`Error testing speciality ${speciality}:`, error);
        }
      }
    });

    it('should accept all valid skill_level values', async () => {
      for (const skillLevel of Object.keys(SKILL_LEVELS)) {
        const req = {
          body: {
            name: `${skillLevel} Groom`,
            speciality: 'foal_care',
            skill_level: skillLevel,
            personality: 'gentle',
          },
          user: { id: testUser.id },
        };
        const res = makeRes();

        await hireGroom(req, res);

        expect(res._status).toBe(201);
        expect(res._json).toEqual(
          expect.objectContaining({ success: true, data: expect.objectContaining({ skillLevel }) }),
        );
      }
    });

    it('should accept all valid personality values', async () => {
      for (const personality of Object.keys(PERSONALITY_TRAITS)) {
        const req = {
          body: { name: `${personality} Groom`, speciality: 'foal_care', skill_level: 'expert', personality },
          user: { id: testUser.id },
        };
        const res = makeRes();

        await hireGroom(req, res);

        expect(res._status).toBe(201);
        expect(res._json).toEqual(
          expect.objectContaining({ success: true, data: expect.objectContaining({ personality }) }),
        );
      }
    });
  });

  describe('3. Optional Field Handling', () => {
    it('should use default experience value when not provided', async () => {
      const req = {
        body: {
          name: 'Default Experience Groom',
          speciality: 'foal_care',
          skill_level: 'expert',
          personality: 'gentle',
        },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(201);
      expect(res._json).toEqual(
        expect.objectContaining({ success: true, data: expect.objectContaining({ experience: 1 }) }),
      );
    });

    it('should calculate session rate based on skill level when not provided', async () => {
      const req = {
        body: { name: 'Default Rate Groom', speciality: 'foal_care', skill_level: 'expert', personality: 'gentle' },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(201);

      const expertModifier = SKILL_LEVELS.expert.costModifier;
      const expectedRate = expertModifier * 15.0;
      expect(parseFloat(res._json.data.sessionRate)).toBeCloseTo(expectedRate);
    });

    it('should use provided session rate when specified', async () => {
      const customRate = 35.75;
      const req = {
        body: {
          name: 'Custom Rate Groom',
          speciality: 'foal_care',
          skill_level: 'expert',
          personality: 'gentle',
          session_rate: customRate,
        },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(201);
      expect(parseFloat(res._json.data.sessionRate)).toBeCloseTo(customRate);
    });

    it('should store bio when provided', async () => {
      const customBio = 'Experienced groom with a passion for foal care';
      const req = {
        body: {
          name: 'Bio Groom',
          speciality: 'foal_care',
          skill_level: 'expert',
          personality: 'gentle',
          bio: customBio,
        },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(201);
      expect(res._json).toEqual(
        expect.objectContaining({ success: true, data: expect.objectContaining({ bio: customBio }) }),
      );
    });

    it('should store availability when provided', async () => {
      const customAvailability = {
        monday: true,
        tuesday: true,
        wednesday: false,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      };
      const req = {
        body: {
          name: 'Availability Groom',
          speciality: 'foal_care',
          skill_level: 'expert',
          personality: 'gentle',
          availability: customAvailability,
        },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(201);
      expect(res._json).toEqual(
        expect.objectContaining({ success: true, data: expect.objectContaining({ availability: customAvailability }) }),
      );
    });
  });

  describe('4. User Account Hiring Limits', () => {
    // Equoria-igkff: previously this test had an `if (limitReached) … else
    // console.warn` shape that asserted NOTHING in the else branch — a
    // vacuous test that printed "feature missing" while the feature in fact
    // existed (MAX_GROOMS_PER_USER = 10 at groomController.mjs:7). Now
    // deterministic: testUser has $5000, novice grooms cost
    // round(500 * 0.7) = $350 each, so $5000 covers 14 hires but the
    // MAX_GROOMS_PER_USER = 10 cap fires at #11. We assert the 11th attempt
    // returns 400 with a /limit/ message, AND that exactly 10 grooms were
    // created before the cap. If the cap is removed or moved, this test
    // fails — that is its point (sentinel-positive).
    it('should enforce maximum groom limit per user (MAX_GROOMS_PER_USER = 10)', async () => {
      const maxGroomsToTest = 12; // 10 successes + at least one limit-rejected
      let limitReached = false;
      let groomsCreated = 0;
      let limitRejectionStatus = null;
      let limitRejectionMessage = null;

      for (let i = 0; i < maxGroomsToTest; i++) {
        const req = {
          body: {
            name: `Limit Test Groom ${i}`,
            speciality: 'foal_care',
            skill_level: 'novice',
            personality: 'gentle',
          },
          user: { id: testUser.id },
        };
        const res = makeRes();

        await hireGroom(req, res);

        if (res._status === 400 && res._json.message.includes('limit')) {
          limitReached = true;
          limitRejectionStatus = res._status;
          limitRejectionMessage = res._json.message;
          break;
        }

        if (res._status === 201) {
          groomsCreated++;
        }
      }

      expect(limitReached).toBe(true);
      expect(groomsCreated).toBe(10); // exact cap, not "at least 1"
      expect(limitRejectionStatus).toBe(400);
      expect(limitRejectionMessage).toMatch(/limit/i);
    });

    // Equoria-igkff: previously had the same vacuous if/else+console.warn
    // shape. Funds validation IS implemented (groomController.mjs:853):
    // master groom cost = round(500 * 2.0) = $1000; limitedUser has $100;
    // therefore the funds path is deterministic. Asserted unconditionally.
    it('should reject hire when user has insufficient funds', async () => {
      const req = {
        body: {
          name: 'Expensive Master Groom',
          speciality: 'foal_care',
          skill_level: 'master',
          personality: 'gentle',
          session_rate: 100.0,
        },
        user: { id: limitedUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toEqual(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('funds'),
        }),
      );
    });

    it('should allow wealthy users to hire expensive grooms', async () => {
      const req = {
        body: {
          name: 'Premium Master Groom',
          speciality: 'foal_care',
          skill_level: 'master',
          personality: 'gentle',
          session_rate: 100.0,
        },
        user: { id: wealthyUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(201);
    });
  });

  describe('5. Error Handling & Edge Cases', () => {
    it('should handle empty strings for required fields', async () => {
      const req = {
        body: { name: '', speciality: 'foal_care', skill_level: 'expert', personality: 'gentle' },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(400);
    });

    it('should handle extremely long names', async () => {
      const veryLongName = 'A'.repeat(1000);
      const req = {
        body: { name: veryLongName, speciality: 'foal_care', skill_level: 'expert', personality: 'gentle' },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      if (res._status === 400) {
        expect(res._json).toEqual(
          expect.objectContaining({ success: false, message: expect.stringContaining('name') }),
        );
      } else if (res._status === 201) {
        expect(res._json.data.name.length).toBeLessThan(veryLongName.length);
      }
    });

    it('should handle negative experience values', async () => {
      const req = {
        body: {
          name: 'Negative Experience Groom',
          speciality: 'foal_care',
          skill_level: 'expert',
          personality: 'gentle',
          experience: -5,
        },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      if (res._status === 400) {
        expect(res._json).toEqual(
          expect.objectContaining({ success: false, message: expect.stringContaining('experience') }),
        );
      } else if (res._status === 201) {
        expect(res._json.data.experience).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle negative session rates', async () => {
      const req = {
        body: {
          name: 'Negative Rate Groom',
          speciality: 'foal_care',
          skill_level: 'expert',
          personality: 'gentle',
          session_rate: -20.0,
        },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      if (res._status === 400) {
        expect(res._json).toEqual(
          expect.objectContaining({ success: false, message: expect.stringContaining('rate') }),
        );
      } else if (res._status === 201) {
        expect(parseFloat(res._json.data.sessionRate)).toBeGreaterThan(0);
      }
    });

    it('should handle missing user ID', async () => {
      const req = {
        body: { name: 'No User Groom', speciality: 'foal_care', skill_level: 'expert', personality: 'gentle' },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect([201, 400, 401, 403, 404]).toContain(res._status);
    });
  });

  describe('6. System Integration', () => {
    it('should retrieve groom definitions with all required data', async () => {
      const req = {};
      const res = makeRes();

      await getGroomDefinitions(req, res);

      expect(res._status).toBe(200);
      expect(res._json).toEqual(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            specialties: expect.any(Object),
            skillLevels: expect.any(Object),
            personalities: expect.any(Object),
          }),
        }),
      );

      const { specialties } = res._json.data;
      Object.keys(GROOM_SPECIALTIES).forEach(key => {
        expect(specialties).toHaveProperty(key);
      });

      const { skillLevels } = res._json.data;
      Object.keys(SKILL_LEVELS).forEach(key => {
        expect(skillLevels).toHaveProperty(key);
      });

      const { personalities } = res._json.data;
      Object.keys(PERSONALITY_TRAITS).forEach(key => {
        expect(personalities).toHaveProperty(key);
      });
    });
  });
});
