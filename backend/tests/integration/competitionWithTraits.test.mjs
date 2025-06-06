/**
 * Competition with Traits Integration Tests
 * Tests the complete competition simulation with trait impact
 */

import { simulateCompetition } from '../../logic/simulateCompetition.mjs';

describe('Competition Simulation with Trait Impact', () => {
  const baseHorse = {
    id: 1,
    name: 'Base Horse',
    stamina: 80,
    balance: 75,
    boldness: 70,
    flexibility: 65,
    obedience: 85,
    focus: 90,
    health: 'Excellent',
    rider: {
      bonusPercent: 0.1, // 10% as decimal
      penaltyPercent: 0,
    },
    tack: {
      saddleBonus: 5,
      bridleBonus: 3,
    },
    trainingScore: 50,
    epigenetic_modifiers: { positive: [], negative: [], hidden: [] },
  };

  const testShow = {
    id: 1,
    name: 'Test Show',
    discipline: 'Show Jumping',
    levelMin: 1,
    levelMax: 10,
    entryFee: 100,
    prize: 1000,
  };

  describe('Single Horse Competition', () => {
    it('should simulate competition without traits', () => {
      const horses = [{ ...baseHorse }];
      const results = simulateCompetition(horses, testShow);

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('horseId', 1);
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('traitImpact');
      expect(results[0].traitImpact.appliedTraits).toBe(0);
      expect(results[0].traitImpact.adjustment).toBe(0);
    });

    it('should apply positive trait bonuses', () => {
      const horseWithTraits = {
        ...baseHorse,
        epigenetic_modifiers: {
          positive: ['bold', 'athletic'],
          negative: [],
          hidden: [],
        },
      };

      const horses = [horseWithTraits];
      const results = simulateCompetition(horses, testShow);

      expect(results[0].traitImpact.appliedTraits).toBe(2);
      expect(results[0].traitImpact.bonuses).toBe(2);
      expect(results[0].traitImpact.penalties).toBe(0);
      expect(results[0].traitImpact.adjustment).toBeGreaterThan(0);

      // Check trait details
      const traitDetails = results[0].traitImpact.details;
      expect(traitDetails).toHaveLength(2);

      const boldTrait = traitDetails.find(t => t.name === 'bold');
      const athleticTrait = traitDetails.find(t => t.name === 'athletic');

      expect(boldTrait.specialized).toBe(true); // Bold has specialized effect for Show Jumping
      expect(boldTrait.modifier).toBe(6); // 6% converted to percentage with 1 decimal
      expect(athleticTrait.specialized).toBe(true); // Athletic has specialized effect for Show Jumping
    });

    it('should apply negative trait penalties', () => {
      const horseWithNegativeTraits = {
        ...baseHorse,
        epigenetic_modifiers: {
          positive: [],
          negative: ['nervous', 'fragile'],
          hidden: [],
        },
      };

      const horses = [horseWithNegativeTraits];
      const results = simulateCompetition(horses, testShow);

      expect(results[0].traitImpact.appliedTraits).toBe(2);
      expect(results[0].traitImpact.bonuses).toBe(0);
      expect(results[0].traitImpact.penalties).toBe(2);
      expect(results[0].traitImpact.adjustment).toBeLessThan(0);

      // Check trait details
      const traitDetails = results[0].traitImpact.details;
      const nervousTrait = traitDetails.find(t => t.name === 'nervous');
      const fragileTrait = traitDetails.find(t => t.name === 'fragile');

      expect(nervousTrait.specialized).toBe(true); // Nervous has specialized penalty for Show Jumping
      expect(nervousTrait.modifier).toBe(-5); // -5% converted to percentage
      expect(fragileTrait.specialized).toBe(true); // Fragile has specialized penalty for Show Jumping
    });

    it('should handle mixed traits correctly', () => {
      const horseWithMixedTraits = {
        ...baseHorse,
        epigenetic_modifiers: {
          positive: ['bold', 'calm'],
          negative: ['nervous'],
          hidden: [],
        },
      };

      const horses = [horseWithMixedTraits];
      const results = simulateCompetition(horses, testShow);

      expect(results[0].traitImpact.appliedTraits).toBe(3);
      expect(results[0].traitImpact.bonuses).toBe(2);
      expect(results[0].traitImpact.penalties).toBe(1);

      // Net effect should depend on the specific modifiers
      const netModifier = results[0].traitImpact.modifier;
      expect(typeof netModifier).toBe('number');
    });
  });

  describe('Multi-Horse Competition', () => {
    it('should rank horses correctly with trait differences', () => {
      const horses = [
        {
          ...baseHorse,
          id: 1,
          name: 'Bold Horse',
          epigenetic_modifiers: {
            positive: ['bold', 'athletic'],
            negative: [],
            hidden: [],
          },
        },
        {
          ...baseHorse,
          id: 2,
          name: 'Nervous Horse',
          epigenetic_modifiers: {
            positive: [],
            negative: ['nervous', 'fragile'],
            hidden: [],
          },
        },
        {
          ...baseHorse,
          id: 3,
          name: 'Plain Horse',
          epigenetic_modifiers: {
            positive: [],
            negative: [],
            hidden: [],
          },
        },
      ];

      const results = simulateCompetition(horses, testShow);

      expect(results).toHaveLength(3);

      // Results should be sorted by score (highest first)
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);

      // Bold horse should generally perform better than nervous horse
      const boldHorse = results.find(r => r.name === 'Bold Horse');
      const nervousHorse = results.find(r => r.name === 'Nervous Horse');

      expect(boldHorse.traitImpact.adjustment).toBeGreaterThan(nervousHorse.traitImpact.adjustment);
    });

    it('should handle legendary traits appropriately', () => {
      const horses = [
        {
          ...baseHorse,
          id: 1,
          name: 'Legendary Horse',
          epigenetic_modifiers: {
            positive: ['legendary_bloodline'],
            negative: [],
            hidden: [],
          },
        },
        {
          ...baseHorse,
          id: 2,
          name: 'Regular Horse',
          epigenetic_modifiers: {
            positive: ['bold'],
            negative: [],
            hidden: [],
          },
        },
      ];

      const results = simulateCompetition(horses, testShow);

      const legendaryHorse = results.find(r => r.name === 'Legendary Horse');
      const regularHorse = results.find(r => r.name === 'Regular Horse');

      // Legendary bloodline should provide significant advantage
      expect(legendaryHorse.traitImpact.adjustment).toBeGreaterThan(
        regularHorse.traitImpact.adjustment,
      );

      // Check that legendary trait is properly identified
      const legendaryTrait = legendaryHorse.traitImpact.details.find(
        t => t.name === 'legendary_bloodline',
      );
      expect(legendaryTrait).toBeDefined();
      expect(legendaryTrait.type).toBe('positive');
    });
  });

  describe('Discipline-Specific Effects', () => {
    const disciplineTests = [
      {
        discipline: 'Dressage',
        favoredTraits: ['intelligent', 'calm'],
        unfavoredTraits: ['stubborn', 'aggressive'],
      },
      {
        discipline: 'Racing',
        favoredTraits: ['athletic', 'bold'],
        unfavoredTraits: ['lazy', 'fragile'],
      },
      {
        discipline: 'Cross Country',
        favoredTraits: ['resilient', 'bold'],
        unfavoredTraits: ['nervous', 'fragile'],
      },
    ];

    disciplineTests.forEach(({ discipline, favoredTraits, unfavoredTraits }) => {
      it(`should apply correct trait effects for ${discipline}`, () => {
        const favoredHorse = {
          ...baseHorse,
          id: 1,
          name: 'Favored Horse',
          epigenetic_modifiers: {
            positive: favoredTraits,
            negative: [],
            hidden: [],
          },
        };

        const unfavoredHorse = {
          ...baseHorse,
          id: 2,
          name: 'Unfavored Horse',
          epigenetic_modifiers: {
            positive: [],
            negative: unfavoredTraits,
            hidden: [],
          },
        };

        const testShowForDiscipline = { ...testShow, discipline };
        const results = simulateCompetition([favoredHorse, unfavoredHorse], testShowForDiscipline);

        const favored = results.find(r => r.name === 'Favored Horse');
        const unfavored = results.find(r => r.name === 'Unfavored Horse');

        expect(favored.traitImpact.adjustment).toBeGreaterThan(0);
        expect(unfavored.traitImpact.adjustment).toBeLessThan(0);
        expect(favored.traitImpact.adjustment).toBeGreaterThan(unfavored.traitImpact.adjustment);
      });
    });
  });

  describe('Balance and Fairness', () => {
    it('should not allow traits to completely dominate base stats', () => {
      const superTraitHorse = {
        ...baseHorse,
        stamina: 20, // Very low base stats
        balance: 20,
        boldness: 20,
        flexibility: 20,
        obedience: 20,
        focus: 20,
        epigenetic_modifiers: {
          positive: ['legendary_bloodline', 'athletic', 'bold', 'intelligent'],
          negative: [],
          hidden: [],
        },
      };

      const goodStatsHorse = {
        ...baseHorse,
        stamina: 95, // Excellent base stats
        balance: 95,
        boldness: 95,
        flexibility: 95,
        obedience: 95,
        focus: 95,
        epigenetic_modifiers: {
          positive: [],
          negative: [],
          hidden: [],
        },
      };

      const results = simulateCompetition([superTraitHorse, goodStatsHorse], testShow);

      // Horse with good base stats should still be competitive
      // Traits should enhance but not completely override base performance
      const traitHorse = results.find(r => r.horseId === superTraitHorse.id);
      const statsHorse = results.find(r => r.horseId === goodStatsHorse.id);

      // The difference shouldn't be extreme
      const scoreDifference = Math.abs(traitHorse.score - statsHorse.score);
      expect(scoreDifference).toBeLessThan(100); // Reasonable difference
    });

    it('should apply diminishing returns for trait stacking', () => {
      const manyTraitsHorse = {
        ...baseHorse,
        id: 1,
        epigenetic_modifiers: {
          positive: ['bold', 'resilient', 'intelligent', 'calm', 'athletic'],
          negative: [],
          hidden: [],
        },
      };

      const fewTraitsHorse = {
        ...baseHorse,
        id: 2,
        epigenetic_modifiers: {
          positive: ['bold'],
          negative: [],
          hidden: [],
        },
      };

      const results = simulateCompetition([manyTraitsHorse, fewTraitsHorse], testShow);

      const manyTraits = results.find(r => r.horseId === 1);
      const fewTraits = results.find(r => r.horseId === 2);

      // Many traits horse should be better, but not 5x better
      expect(manyTraits.traitImpact.adjustment).toBeGreaterThan(fewTraits.traitImpact.adjustment);

      // Check that diminishing returns were applied
      expect(manyTraits.traitImpact.modifier).toBeLessThan(0.4); // Should be less than sum of individual modifiers
    });
  });

  describe('Error Handling', () => {
    it('should handle horses with malformed trait data', () => {
      const malformedHorse = {
        ...baseHorse,
        epigenetic_modifiers: null,
      };

      const results = simulateCompetition([malformedHorse], testShow);

      expect(results).toHaveLength(1);
      expect(results[0].traitImpact.appliedTraits).toBe(0);
      expect(results[0].traitImpact.adjustment).toBe(0);
    });

    it('should handle unknown traits gracefully', () => {
      const unknownTraitHorse = {
        ...baseHorse,
        epigenetic_modifiers: {
          positive: ['unknown_trait', 'bold'],
          negative: ['another_unknown'],
          hidden: [],
        },
      };

      const results = simulateCompetition([unknownTraitHorse], testShow);

      expect(results).toHaveLength(1);
      expect(results[0].traitImpact.appliedTraits).toBe(1); // Only 'bold' should be applied

      const appliedTrait = results[0].traitImpact.details[0];
      expect(appliedTrait.name).toBe('bold');
    });
  });
});
