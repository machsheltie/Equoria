/**
 * 🧪 UNIT TEST: Trait Competition Impact System - Scoring Modifier Calculations
 *
 * This test validates the trait competition impact system's functionality for
 * calculating trait-based score modifiers and discipline-specific bonuses.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Trait score modifiers: Positive traits provide bonuses, negative traits penalties
 * - Discipline specialization: Specific trait-discipline combinations provide enhanced effects
 * - Diminishing returns: Multiple traits reduce per-trait effectiveness (5+ traits = 80%)
 * - Balance constraints: Maximum 50% total bonus to prevent overpowered combinations
 * - Legendary trait effects: Rare traits provide significant but balanced bonuses
 * - Unknown trait handling: Graceful fallback for unrecognized traits
 * - Mixed trait calculations: Proper combination of positive and negative effects
 * - Score adjustment accuracy: Correct final score calculations from modifiers
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. calculateTraitCompetitionImpact() - Complete trait impact calculation with all modifiers
 * 2. getTraitCompetitionEffect() - Individual trait effect retrieval and validation
 * 3. hasSpecializedEffect() - Discipline-specific trait bonus detection
 * 4. getAllTraitCompetitionEffects() - Complete trait catalog validation
 * 5. Discipline specializations: Racing, Dressage, Show Jumping, Cross Country, Endurance
 * 6. Trait categories: Positive (bold, intelligent, athletic), Negative (nervous, stubborn)
 * 7. Legendary traits: legendary_bloodline with enhanced bonuses
 * 8. Balance validation: Reasonable modifier limits and stacking prevention
 * 9. Error handling: Missing traits, null modifiers, unknown disciplines
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Complete trait calculation algorithms, modifier math, specialization logic
 * ✅ REAL: Balance validation, diminishing returns, score adjustment calculations
 * 🔧 MOCK: None - pure algorithmic testing with no external dependencies
 *
 * 💡 TEST STRATEGY: Pure unit testing to validate trait impact calculations and
 *    ensure balanced, fair competition scoring without external dependencies
 */

// Import the module under test
import {
  calculateTraitCompetitionImpact,
  getTraitCompetitionEffect,
  getAllTraitCompetitionEffects,
  hasSpecializedEffect,
} from '../utils/traitCompetitionImpact.mjs';

describe('🏆 UNIT: Trait Competition Impact System - Scoring Modifier Calculations', () => {
  describe('calculateTraitCompetitionImpact', () => {
    const baseScore = 100;

    it('should handle horse with no traits', () => {
      const horse = {
        id: 1,
        name: 'Plain Horse',
        epigenetic_modifiers: { positive: [], negative: [], hidden: [] },
      };

      const result = calculateTraitCompetitionImpact(horse, 'Dressage', baseScore);

      expect(result.totalScoreModifier).toBe(0);
      expect(result.appliedTraits).toHaveLength(0);
      expect(result.traitBonuses).toHaveLength(0);
      expect(result.traitPenalties).toHaveLength(0);
      expect(result.finalScoreAdjustment).toBe(0);
    });

    it('should apply positive trait bonuses correctly', () => {
      const horse = {
        id: 1,
        name: 'Bold Horse',
        epigenetic_modifiers: {
          positive: ['bold', 'resilient'],
          negative: [],
          hidden: [],
        },
      };

      const result = calculateTraitCompetitionImpact(horse, 'Show Jumping', baseScore);

      expect(result.appliedTraits).toHaveLength(2);
      expect(result.traitBonuses).toHaveLength(2);
      expect(result.traitPenalties).toHaveLength(0);
      expect(result.totalScoreModifier).toBeGreaterThan(0);
      expect(result.finalScoreAdjustment).toBeGreaterThan(0);

      // Bold should have specialized effect for Show Jumping
      const boldTrait = result.appliedTraits.find(t => t.name === 'bold');
      expect(boldTrait.isSpecialized).toBe(true);
      expect(boldTrait.modifier).toBe(0.06); // 6% for Show Jumping
    });

    it('should apply negative trait penalties correctly', () => {
      const horse = {
        id: 1,
        name: 'Nervous Horse',
        epigenetic_modifiers: {
          positive: [],
          negative: ['nervous', 'fragile'],
          hidden: [],
        },
      };

      const result = calculateTraitCompetitionImpact(horse, 'Show Jumping', baseScore);

      expect(result.appliedTraits).toHaveLength(2);
      expect(result.traitBonuses).toHaveLength(0);
      expect(result.traitPenalties).toHaveLength(2);
      expect(result.totalScoreModifier).toBeLessThan(0);
      expect(result.finalScoreAdjustment).toBeLessThan(0);

      // Nervous should have specialized penalty for Show Jumping
      const nervousTrait = result.appliedTraits.find(t => t.name === 'nervous');
      expect(nervousTrait.isSpecialized).toBe(true);
      expect(nervousTrait.modifier).toBe(-0.05); // -5% for Show Jumping
    });

    it('should apply mixed traits correctly', () => {
      const horse = {
        id: 1,
        name: 'Mixed Horse',
        epigenetic_modifiers: {
          positive: ['intelligent', 'calm'],
          negative: ['stubborn'],
          hidden: [],
        },
      };

      const result = calculateTraitCompetitionImpact(horse, 'Dressage', baseScore);

      expect(result.appliedTraits).toHaveLength(3);
      expect(result.traitBonuses).toHaveLength(2);
      expect(result.traitPenalties).toHaveLength(1);

      // Net effect should be positive (intelligent + calm > stubborn for Dressage)
      expect(result.totalScoreModifier).toBeGreaterThan(0);

      // Check specialized effects for Dressage
      const intelligentTrait = result.appliedTraits.find(t => t.name === 'intelligent');
      const calmTrait = result.appliedTraits.find(t => t.name === 'calm');
      const stubbornTrait = result.appliedTraits.find(t => t.name === 'stubborn');

      expect(intelligentTrait.isSpecialized).toBe(true);
      expect(intelligentTrait.modifier).toBe(0.06); // 6% for Dressage
      expect(calmTrait.isSpecialized).toBe(true);
      expect(calmTrait.modifier).toBe(0.05); // 5% for Dressage
      expect(stubbornTrait.isSpecialized).toBe(true);
      expect(stubbornTrait.modifier).toBe(-0.06); // -6% for Dressage
    });

    it('should apply diminishing returns for multiple traits', () => {
      const horseFewTraits = {
        id: 1,
        name: 'Few Traits Horse',
        epigenetic_modifiers: {
          positive: ['bold'],
          negative: [],
          hidden: [],
        },
      };

      const horseManyTraits = {
        id: 2,
        name: 'Many Traits Horse',
        epigenetic_modifiers: {
          positive: ['bold', 'resilient', 'intelligent', 'calm', 'athletic'],
          negative: [],
          hidden: [],
        },
      };

      const resultFew = calculateTraitCompetitionImpact(horseFewTraits, 'Show Jumping', baseScore);
      const resultMany = calculateTraitCompetitionImpact(
        horseManyTraits,
        'Show Jumping',
        baseScore,
      );

      // Many traits should have diminishing returns applied
      expect(resultMany.appliedTraits).toHaveLength(5);
      expect(resultFew.appliedTraits).toHaveLength(1);

      // The per-trait effect should be reduced for the horse with many traits
      const manyTraitsRawModifier = resultMany.appliedTraits.reduce(
        (sum, trait) => sum + trait.modifier,
        0,
      );
      expect(resultMany.totalScoreModifier).toBeLessThan(manyTraitsRawModifier);
      expect(resultMany.totalScoreModifier).toBeCloseTo(manyTraitsRawModifier * 0.8, 2); // 5+ traits = 80% effectiveness
    });

    it('should handle legendary traits correctly', () => {
      const horse = {
        id: 1,
        name: 'Legendary Horse',
        epigenetic_modifiers: {
          positive: ['legendary_bloodline'],
          negative: [],
          hidden: [],
        },
      };

      const result = calculateTraitCompetitionImpact(horse, 'Racing', baseScore);

      expect(result.appliedTraits).toHaveLength(1);
      expect(result.traitBonuses).toHaveLength(1);

      const legendaryTrait = result.appliedTraits[0];
      expect(legendaryTrait.name).toBe('legendary_bloodline');
      expect(legendaryTrait.isSpecialized).toBe(true);
      expect(legendaryTrait.modifier).toBe(0.1); // 10% for Racing
      expect(result.finalScoreAdjustment).toBe(10); // 100 * 0.10
    });

    it('should handle rare environmental traits', () => {
      const horse = {
        id: 1,
        name: 'Athletic Horse',
        epigenetic_modifiers: {
          positive: ['athletic'],
          negative: [],
          hidden: [],
        },
      };

      const resultSpecialized = calculateTraitCompetitionImpact(horse, 'Cross Country', baseScore);
      const resultGeneral = calculateTraitCompetitionImpact(horse, 'Dressage', baseScore);

      // Should have specialized effect for Cross Country
      expect(resultSpecialized.appliedTraits[0].isSpecialized).toBe(true);
      expect(resultSpecialized.appliedTraits[0].modifier).toBe(0.06); // 6% for Cross Country

      // Should use general effect for Dressage
      expect(resultGeneral.appliedTraits[0].isSpecialized).toBe(false);
      expect(resultGeneral.appliedTraits[0].modifier).toBe(0.05); // 5% general
    });

    it('should handle missing epigenetic_modifiers gracefully', () => {
      const horse = {
        id: 1,
        name: 'Horse Without Traits',
        epigenetic_modifiers: null,
      };

      const result = calculateTraitCompetitionImpact(horse, 'Dressage', baseScore);

      expect(result.totalScoreModifier).toBe(0);
      expect(result.appliedTraits).toHaveLength(0);
      expect(result.finalScoreAdjustment).toBe(0);
    });

    it('should handle unknown traits gracefully', () => {
      const horse = {
        id: 1,
        name: 'Horse With Unknown Trait',
        epigenetic_modifiers: {
          positive: ['unknown_trait', 'bold'],
          negative: [],
          hidden: [],
        },
      };

      const result = calculateTraitCompetitionImpact(horse, 'Show Jumping', baseScore);

      // Should only apply known traits
      expect(result.appliedTraits).toHaveLength(1);
      expect(result.appliedTraits[0].name).toBe('bold');
    });
  });

  describe('getTraitCompetitionEffect', () => {
    it('should return correct trait effect', () => {
      const boldEffect = getTraitCompetitionEffect('bold');

      expect(boldEffect).toBeDefined();
      expect(boldEffect.name).toBe('Bold');
      expect(boldEffect.type).toBe('positive');
      expect(boldEffect.general.scoreModifier).toBe(0.04);
      expect(boldEffect.disciplines['Show Jumping'].scoreModifier).toBe(0.06);
    });

    it('should return null for unknown trait', () => {
      const unknownEffect = getTraitCompetitionEffect('unknown_trait');
      expect(unknownEffect).toBeNull();
    });
  });

  describe('hasSpecializedEffect', () => {
    it('should return true for specialized combinations', () => {
      expect(hasSpecializedEffect('bold', 'Show Jumping')).toBe(true);
      expect(hasSpecializedEffect('intelligent', 'Dressage')).toBe(true);
      expect(hasSpecializedEffect('resilient', 'Endurance')).toBe(true);
    });

    it('should return false for non-specialized combinations', () => {
      expect(hasSpecializedEffect('bold', 'Dressage')).toBe(false);
      expect(hasSpecializedEffect('calm', 'Racing')).toBe(false);
      expect(hasSpecializedEffect('unknown_trait', 'Show Jumping')).toBe(false);
    });
  });

  describe('getAllTraitCompetitionEffects', () => {
    it('should return all trait effects', () => {
      const allEffects = getAllTraitCompetitionEffects();

      expect(allEffects).toBeDefined();
      expect(typeof allEffects).toBe('object');

      // Check that we have both positive and negative traits
      const traitNames = Object.keys(allEffects);
      expect(traitNames).toContain('bold');
      expect(traitNames).toContain('resilient');
      expect(traitNames).toContain('nervous');
      expect(traitNames).toContain('stubborn');

      // Check structure of a trait effect
      const boldEffect = allEffects.bold;
      expect(boldEffect).toHaveProperty('name');
      expect(boldEffect).toHaveProperty('type');
      expect(boldEffect).toHaveProperty('general');
      expect(boldEffect).toHaveProperty('disciplines');
    });
  });

  describe('Discipline-Specific Effects', () => {
    const testCases = [
      {
        trait: 'bold',
        discipline: 'Show Jumping',
        expectedModifier: 0.06,
        description: 'Bold should excel at Show Jumping',
      },
      {
        trait: 'intelligent',
        discipline: 'Dressage',
        expectedModifier: 0.06,
        description: 'Intelligent should excel at Dressage',
      },
      {
        trait: 'athletic',
        discipline: 'Racing',
        expectedModifier: 0.07,
        description: 'Athletic should excel at Racing',
      },
      {
        trait: 'nervous',
        discipline: 'Show Jumping',
        expectedModifier: -0.05,
        description: 'Nervous should struggle with Show Jumping',
      },
      {
        trait: 'stubborn',
        discipline: 'Dressage',
        expectedModifier: -0.06,
        description: 'Stubborn should struggle with Dressage',
      },
    ];

    testCases.forEach(({ trait, discipline, expectedModifier, description }) => {
      it(description, () => {
        const horse = {
          id: 1,
          name: 'Test Horse',
          epigenetic_modifiers: {
            positive: expectedModifier > 0 ? [trait] : [],
            negative: expectedModifier < 0 ? [trait] : [],
            hidden: [],
          },
        };

        const result = calculateTraitCompetitionImpact(horse, discipline, 100);

        expect(result.appliedTraits).toHaveLength(1);
        expect(result.appliedTraits[0].modifier).toBe(expectedModifier);
        expect(result.appliedTraits[0].isSpecialized).toBe(true);
      });
    });
  });

  describe('Balance and Fairness', () => {
    it('should ensure trait effects are balanced', () => {
      const allEffects = getAllTraitCompetitionEffects();

      Object.entries(allEffects).forEach(([_traitName, effect]) => {
        // General effects should be reasonable
        expect(Math.abs(effect.general.scoreModifier)).toBeLessThanOrEqual(0.08);

        // Discipline-specific effects should be reasonable
        if (effect.disciplines) {
          Object.values(effect.disciplines).forEach(disciplineEffect => {
            expect(Math.abs(disciplineEffect.scoreModifier)).toBeLessThanOrEqual(0.12);
          });
        }

        // Positive traits should have positive modifiers
        if (effect.type === 'positive') {
          expect(effect.general.scoreModifier).toBeGreaterThan(0);
        }

        // Negative traits should have negative modifiers
        if (effect.type === 'negative') {
          expect(effect.general.scoreModifier).toBeLessThan(0);
        }
      });
    });

    it('should not allow trait stacking to become overpowered', () => {
      const horse = {
        id: 1,
        name: 'Overpowered Horse',
        epigenetic_modifiers: {
          positive: [
            'bold',
            'resilient',
            'intelligent',
            'calm',
            'athletic',
            'trainability_boost',
            'legendary_bloodline',
          ],
          negative: [],
          hidden: [],
        },
      };

      const result = calculateTraitCompetitionImpact(horse, 'Show Jumping', 100);

      // Even with many powerful traits, the total modifier should be reasonable
      expect(result.totalScoreModifier).toBeLessThanOrEqual(0.5); // Max 50% bonus
      expect(result.finalScoreAdjustment).toBeLessThanOrEqual(50); // Max 50 point bonus
    });
  });
});
