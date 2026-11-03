/**
 * UNIT TEST: groom system constants (no database).
 *
 * Validates groomSpecialties, skillLevels, personalityTraits and defaultGrooms.
 * The interaction-effects calculator that used to live beside them was removed
 * (Equoria-c39bq): "groom horse" (groomCareService) is the only grooming door.
 */

import { describe, it, expect } from '@jest/globals';
import { groomSpecialties, skillLevels, personalityTraits, defaultGrooms } from '../../../utils/groomSystem.mjs';

describe('🧮 UNIT: Groom System Logic - Pure Business Logic Validation', () => {
  describe('System Constants', () => {
    it('should have all required groom specialties', () => {
      expect(groomSpecialties).toHaveProperty('foalCare');
      expect(groomSpecialties).toHaveProperty('general');
      expect(groomSpecialties).toHaveProperty('training');
      expect(groomSpecialties).toHaveProperty('medical');

      // Check foalCare specialty details
      const { foalCare } = groomSpecialties;
      expect(foalCare.name).toBe('Foal Care Specialist');
      expect(foalCare.bondingModifier).toBe(1.5);
      expect(foalCare.preferredActivities).toContain('dailyCare');
      expect(foalCare.preferredActivities).toContain('feeding');
      expect(foalCare.preferredActivities).toContain('grooming');

      // Check all specialties have required properties
      Object.values(groomSpecialties).forEach(specialty => {
        expect(specialty).toHaveProperty('name');
        expect(specialty).toHaveProperty('description');
        expect(specialty).toHaveProperty('bondingModifier');
        expect(specialty).toHaveProperty('preferredActivities');
        expect(Array.isArray(specialty.preferredActivities)).toBe(true);
      });
    });

    it('should have all required skill levels', () => {
      expect(skillLevels).toHaveProperty('novice');
      expect(skillLevels).toHaveProperty('intermediate');
      expect(skillLevels).toHaveProperty('expert');
      expect(skillLevels).toHaveProperty('master');

      // Check skill level progression
      expect(skillLevels.novice.bondingModifier).toBe(0.8);
      expect(skillLevels.intermediate.bondingModifier).toBe(1.0);
      expect(skillLevels.expert.bondingModifier).toBe(1.3);
      expect(skillLevels.master.bondingModifier).toBe(1.6);

      // Check cost progression
      expect(skillLevels.novice.costModifier).toBe(0.7);
      expect(skillLevels.intermediate.costModifier).toBe(1.0);
      expect(skillLevels.expert.costModifier).toBe(1.5);
      expect(skillLevels.master.costModifier).toBe(2.0);

      // Check error chance decreases with skill
      expect(skillLevels.novice.errorChance).toBe(0.15);
      expect(skillLevels.intermediate.errorChance).toBe(0.08);
      expect(skillLevels.expert.errorChance).toBe(0.03);
      expect(skillLevels.master.errorChance).toBe(0.01);

      // Check all skill levels have required properties
      Object.values(skillLevels).forEach(level => {
        expect(level).toHaveProperty('name');
        expect(level).toHaveProperty('bondingModifier');
        expect(level).toHaveProperty('costModifier');
        expect(level).toHaveProperty('errorChance');
        expect(level).toHaveProperty('description');
      });
    });

    it('should have all required personality traits', () => {
      expect(personalityTraits).toHaveProperty('gentle');
      expect(personalityTraits).toHaveProperty('energetic');
      expect(personalityTraits).toHaveProperty('patient');
      expect(personalityTraits).toHaveProperty('strict');

      // Check gentle personality
      const { gentle } = personalityTraits;
      expect(gentle.name).toBe('Gentle');
      expect(gentle.bondingModifier).toBe(1.2);
      expect(gentle.description).toBe('Calm and patient approach');

      // Check all personalities have required properties
      Object.values(personalityTraits).forEach(trait => {
        expect(trait).toHaveProperty('name');
        expect(trait).toHaveProperty('bondingModifier');
        expect(trait).toHaveProperty('description');
      });
    });

    it('should have valid default groom profiles', () => {
      expect(Array.isArray(defaultGrooms)).toBe(true);
      expect(defaultGrooms.length).toBe(3);

      // Check Sarah Johnson (foal care specialist)
      const [sarah] = defaultGrooms;
      expect(sarah.name).toBe('Sarah Johnson');
      expect(sarah.speciality).toBe('foalCare');
      expect(sarah.skillLevel).toBe('intermediate');
      expect(sarah.personality).toBe('gentle');
      expect(sarah.sessionRate).toBe(18.0);
      expect(sarah.experience).toBe(5);

      // Check all default grooms have required properties
      defaultGrooms.forEach(groom => {
        expect(groom).toHaveProperty('name');
        expect(groom).toHaveProperty('speciality');
        expect(groom).toHaveProperty('experience');
        expect(groom).toHaveProperty('skillLevel');
        expect(groom).toHaveProperty('personality');
        expect(groom).toHaveProperty('sessionRate');
        expect(groom).toHaveProperty('bio');
        expect(groom).toHaveProperty('availability');

        // Validate speciality
        expect(Object.keys(groomSpecialties)).toContain(groom.speciality);

        // Validate skill level
        expect(Object.keys(skillLevels)).toContain(groom.skillLevel);

        // Validate personality
        expect(Object.keys(personalityTraits)).toContain(groom.personality);

        // Validate numeric values
        expect(groom.experience).toBeGreaterThan(0);
        expect(groom.sessionRate).toBeGreaterThan(0);
      });
    });
  });
});
