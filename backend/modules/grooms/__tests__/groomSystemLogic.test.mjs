/**
 * UNIT TEST: groom system constants (no database).
 *
 * Validates GROOM_SPECIALTIES, SKILL_LEVELS, PERSONALITY_TRAITS and DEFAULT_GROOMS.
 * The interaction-effects calculator that used to live beside them was removed
 * (Equoria-c39bq): "groom horse" (groomCareService) is the only grooming door.
 */

import { describe, it, expect } from '@jest/globals';
import { GROOM_SPECIALTIES, SKILL_LEVELS, PERSONALITY_TRAITS, DEFAULT_GROOMS } from '../../../utils/groomSystem.mjs';

describe('🧮 UNIT: Groom System Logic - Pure Business Logic Validation', () => {
  describe('System Constants', () => {
    it('should have all required groom specialties', () => {
      expect(GROOM_SPECIALTIES).toHaveProperty('foalCare');
      expect(GROOM_SPECIALTIES).toHaveProperty('general');
      expect(GROOM_SPECIALTIES).toHaveProperty('training');
      expect(GROOM_SPECIALTIES).toHaveProperty('medical');

      // Check foalCare specialty details
      const { foalCare } = GROOM_SPECIALTIES;
      expect(foalCare.name).toBe('Foal Care Specialist');
      expect(foalCare.bondingModifier).toBe(1.5);
      expect(foalCare.preferredActivities).toContain('dailyCare');
      expect(foalCare.preferredActivities).toContain('feeding');
      expect(foalCare.preferredActivities).toContain('grooming');

      // Check all specialties have required properties
      Object.values(GROOM_SPECIALTIES).forEach(specialty => {
        expect(specialty).toHaveProperty('name');
        expect(specialty).toHaveProperty('description');
        expect(specialty).toHaveProperty('bondingModifier');
        expect(specialty).toHaveProperty('preferredActivities');
        expect(Array.isArray(specialty.preferredActivities)).toBe(true);
      });
    });

    it('should have all required skill levels', () => {
      expect(SKILL_LEVELS).toHaveProperty('novice');
      expect(SKILL_LEVELS).toHaveProperty('intermediate');
      expect(SKILL_LEVELS).toHaveProperty('expert');
      expect(SKILL_LEVELS).toHaveProperty('master');

      // Check skill level progression
      expect(SKILL_LEVELS.novice.bondingModifier).toBe(0.8);
      expect(SKILL_LEVELS.intermediate.bondingModifier).toBe(1.0);
      expect(SKILL_LEVELS.expert.bondingModifier).toBe(1.3);
      expect(SKILL_LEVELS.master.bondingModifier).toBe(1.6);

      // Check cost progression
      expect(SKILL_LEVELS.novice.costModifier).toBe(0.7);
      expect(SKILL_LEVELS.intermediate.costModifier).toBe(1.0);
      expect(SKILL_LEVELS.expert.costModifier).toBe(1.5);
      expect(SKILL_LEVELS.master.costModifier).toBe(2.0);

      // Check error chance decreases with skill
      expect(SKILL_LEVELS.novice.errorChance).toBe(0.15);
      expect(SKILL_LEVELS.intermediate.errorChance).toBe(0.08);
      expect(SKILL_LEVELS.expert.errorChance).toBe(0.03);
      expect(SKILL_LEVELS.master.errorChance).toBe(0.01);

      // Check all skill levels have required properties
      Object.values(SKILL_LEVELS).forEach(level => {
        expect(level).toHaveProperty('name');
        expect(level).toHaveProperty('bondingModifier');
        expect(level).toHaveProperty('costModifier');
        expect(level).toHaveProperty('errorChance');
        expect(level).toHaveProperty('description');
      });
    });

    it('should have all required personality traits', () => {
      expect(PERSONALITY_TRAITS).toHaveProperty('gentle');
      expect(PERSONALITY_TRAITS).toHaveProperty('energetic');
      expect(PERSONALITY_TRAITS).toHaveProperty('patient');
      expect(PERSONALITY_TRAITS).toHaveProperty('strict');

      // Check gentle personality
      const { gentle } = PERSONALITY_TRAITS;
      expect(gentle.name).toBe('Gentle');
      expect(gentle.bondingModifier).toBe(1.2);
      expect(gentle.description).toBe('Calm and patient approach');

      // Check all personalities have required properties
      Object.values(PERSONALITY_TRAITS).forEach(trait => {
        expect(trait).toHaveProperty('name');
        expect(trait).toHaveProperty('bondingModifier');
        expect(trait).toHaveProperty('description');
      });
    });

    it('should have valid default groom profiles', () => {
      expect(Array.isArray(DEFAULT_GROOMS)).toBe(true);
      expect(DEFAULT_GROOMS.length).toBe(3);

      // Check Sarah Johnson (foal care specialist)
      const [sarah] = DEFAULT_GROOMS;
      expect(sarah.name).toBe('Sarah Johnson');
      expect(sarah.speciality).toBe('foalCare');
      expect(sarah.skillLevel).toBe('intermediate');
      expect(sarah.personality).toBe('gentle');
      expect(sarah.sessionRate).toBe(18.0);
      expect(sarah.experience).toBe(5);

      // Check all default grooms have required properties
      DEFAULT_GROOMS.forEach(groom => {
        expect(groom).toHaveProperty('name');
        expect(groom).toHaveProperty('speciality');
        expect(groom).toHaveProperty('experience');
        expect(groom).toHaveProperty('skillLevel');
        expect(groom).toHaveProperty('personality');
        expect(groom).toHaveProperty('sessionRate');
        expect(groom).toHaveProperty('bio');
        expect(groom).toHaveProperty('availability');

        // Validate speciality
        expect(Object.keys(GROOM_SPECIALTIES)).toContain(groom.speciality);

        // Validate skill level
        expect(Object.keys(SKILL_LEVELS)).toContain(groom.skillLevel);

        // Validate personality
        expect(Object.keys(PERSONALITY_TRAITS)).toContain(groom.personality);

        // Validate numeric values
        expect(groom.experience).toBeGreaterThan(0);
        expect(groom.sessionRate).toBeGreaterThan(0);
      });
    });
  });
});
