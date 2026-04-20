/**
 * simulateCompetition Unit Tests — Competition Simulation with Trait Impact
 *
 * Tests the simulateCompetition() pure function with in-memory data.
 * No database, no HTTP layer — this is a unit test of business logic.
 *
 * Reclassified from tests/integration/competitionWithTraits.test.mjs.
 * The original file was located in integration/ but does not exercise
 * any database or HTTP path — it is a pure algorithmic unit test.
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
    epigeneticModifiers: { positive: [], negative: [], hidden: [] },
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
        epigeneticModifiers: {
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

      const traitDetails = results[0].traitImpact.details;
      expect(traitDetails).toHaveLength(2);

      const boldTrait = traitDetails.find(t => t.name === 'bold');
      const athleticTrait = traitDetails.find(t => t.name === 'athletic');

      expect(boldTrait.specialized).toBe(true);
      expect(boldTrait.modifier).toBe(6);
      expect(athleticTrait.specialized).toBe(true);
    });

    it('should apply negative trait penalties', () => {
      const horseWithNegativeTraits = {
        ...baseHorse,
        epigeneticModifiers: {
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

      const traitDetails = results[0].traitImpact.details;
      const nervousTrait = traitDetails.find(t => t.name === 'nervous');
      const fragileTrait = traitDetails.find(t => t.name === 'fragile');

      expect(nervousTrait.specialized).toBe(true);
      expect(nervousTrait.modifier).toBe(-5);
      expect(fragileTrait.specialized).toBe(true);
    });

    it('should handle mixed traits correctly', () => {
      const horseWithMixedTraits = {
        ...baseHorse,
        epigeneticModifiers: {
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
          epigeneticModifiers: { positive: ['bold', 'athletic'], negative: [], hidden: [] },
        },
        {
          ...baseHorse,
          id: 2,
          name: 'Nervous Horse',
          epigeneticModifiers: { positive: [], negative: ['nervous', 'fragile'], hidden: [] },
        },
        {
          ...baseHorse,
          id: 3,
          name: 'Plain Horse',
          epigeneticModifiers: { positive: [], negative: [], hidden: [] },
        },
      ];

      const results = simulateCompetition(horses, testShow);

      expect(results).toHaveLength(3);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);

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
          epigeneticModifiers: { positive: ['legendaryBloodline'], negative: [], hidden: [] },
        },
        {
          ...baseHorse,
          id: 2,
          name: 'Regular Horse',
          epigeneticModifiers: { positive: ['bold'], negative: [], hidden: [] },
        },
      ];

      const results = simulateCompetition(horses, testShow);

      const legendaryHorse = results.find(r => r.name === 'Legendary Horse');
      const regularHorse = results.find(r => r.name === 'Regular Horse');

      expect(legendaryHorse.traitImpact.adjustment).toBeGreaterThan(regularHorse.traitImpact.adjustment);

      const legendaryTrait = legendaryHorse.traitImpact.details.find(t => t.name === 'legendaryBloodline');
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
          epigeneticModifiers: { positive: favoredTraits, negative: [], hidden: [] },
        };

        const unfavoredHorse = {
          ...baseHorse,
          id: 2,
          name: 'Unfavored Horse',
          epigeneticModifiers: { positive: [], negative: unfavoredTraits, hidden: [] },
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
        stamina: 20,
        balance: 20,
        boldness: 20,
        flexibility: 20,
        obedience: 20,
        focus: 20,
        epigeneticModifiers: {
          positive: ['legendary_bloodline', 'athletic', 'bold', 'intelligent'],
          negative: [],
          hidden: [],
        },
      };

      const goodStatsHorse = {
        ...baseHorse,
        stamina: 95,
        balance: 95,
        boldness: 95,
        flexibility: 95,
        obedience: 95,
        focus: 95,
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      };

      const results = simulateCompetition([superTraitHorse, goodStatsHorse], testShow);

      const traitHorse = results.find(r => r.horseId === superTraitHorse.id);
      const statsHorse = results.find(r => r.horseId === goodStatsHorse.id);

      const scoreDifference = Math.abs(traitHorse.score - statsHorse.score);
      expect(scoreDifference).toBeLessThan(100);
    });

    it('should apply diminishing returns for trait stacking', () => {
      const manyTraitsHorse = {
        ...baseHorse,
        id: 1,
        epigeneticModifiers: {
          positive: ['bold', 'resilient', 'intelligent', 'calm', 'athletic'],
          negative: [],
          hidden: [],
        },
      };

      const fewTraitsHorse = {
        ...baseHorse,
        id: 2,
        epigeneticModifiers: { positive: ['bold'], negative: [], hidden: [] },
      };

      const results = simulateCompetition([manyTraitsHorse, fewTraitsHorse], testShow);

      const manyTraits = results.find(r => r.horseId === 1);
      const fewTraits = results.find(r => r.horseId === 2);

      expect(manyTraits.traitImpact.adjustment).toBeGreaterThan(fewTraits.traitImpact.adjustment);
      expect(manyTraits.traitImpact.modifier).toBeLessThan(0.4);
    });
  });

  describe('Error Handling', () => {
    it('should handle horses with malformed trait data', () => {
      const malformedHorse = {
        ...baseHorse,
        epigeneticModifiers: null,
      };

      const results = simulateCompetition([malformedHorse], testShow);

      expect(results).toHaveLength(1);
      expect(results[0].traitImpact.appliedTraits).toBe(0);
      expect(results[0].traitImpact.adjustment).toBe(0);
    });

    it('should handle unknown traits gracefully', () => {
      const unknownTraitHorse = {
        ...baseHorse,
        epigeneticModifiers: {
          positive: ['unknown_trait', 'bold'],
          negative: ['another_unknown'],
          hidden: [],
        },
      };

      const results = simulateCompetition([unknownTraitHorse], testShow);

      expect(results).toHaveLength(1);
      expect(results[0].traitImpact.appliedTraits).toBe(1);

      const [appliedTrait] = results[0].traitImpact.details;
      expect(appliedTrait.name).toBe('bold');
    });
  });
});
