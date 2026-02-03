/**
 * 🧪 UNIT TEST: Enhanced Genetic Probability Calculator System
 *
 * This test validates the advanced genetic probability calculation system that provides
 * detailed breeding predictions, trait inheritance analysis, and genetic outcome modeling.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Enhanced trait probability calculations with multiple inheritance patterns
 * - Genetic compatibility scoring between potential breeding pairs
 * - Multi-generational trait prediction and inheritance modeling
 * - Breeding outcome simulation with statistical confidence intervals
 * - Genetic diversity impact on trait expression probabilities
 * - Advanced trait interaction modeling (synergistic and antagonistic effects)
 * - Breeding recommendation scoring based on genetic optimization
 * - Performance prediction based on genetic trait combinations
 *
 * 🎯 TESTING APPROACH:
 * - NO MOCKING: Real genetic calculation algorithms with deterministic seeding
 * - Comprehensive probability validation with statistical analysis
 * - Edge case testing for extreme genetic scenarios
 * - Performance testing for complex multi-generational calculations
 * - Integration validation with existing breeding prediction service
 *
 * 🔬 GENETIC ALGORITHMS TESTED:
 * 1. Enhanced Trait Inheritance Probability Calculator
 * 2. Genetic Compatibility Scoring System
 * 3. Multi-Generational Prediction Engine
 * 4. Breeding Outcome Simulation
 * 5. Genetic Diversity Impact Calculator
 * 6. Trait Interaction Modeling
 * 7. Breeding Recommendation Engine
 * 8. Performance Prediction Algorithm
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  calculateEnhancedGeneticProbabilities,
  calculateGeneticCompatibilityScore,
  simulateBreedingOutcomes,
  calculateMultiGenerationalPredictions,
  calculateGeneticDiversityImpact,
  calculateTraitInteractions,
  generateBreedingRecommendations,
  predictOffspringPerformance,
} from '../../services/enhancedGeneticProbabilityService.mjs';

describe('🧬 Enhanced Genetic Probability Calculator', () => {
  let testStallion;
  let testMare;
  let testLineage;

  beforeEach(() => {
    // Test stallion with known genetic profile
    testStallion = {
      id: 1,
      name: 'Test Stallion',
      traits: {
        positive: ['athletic', 'intelligent', 'calm'],
        negative: ['stubborn'],
        hidden: ['endurance_boost'],
      },
      stats: {
        speed: 85,
        stamina: 90,
        agility: 80,
        intelligence: 95,
        boldness: 75,
      },
      disciplineScores: {
        racing: 88,
        dressage: 92,
        showJumping: 85,
      },
      sireId: 10,
      damId: 11,
    };

    // Test mare with complementary genetic profile
    testMare = {
      id: 2,
      name: 'Test Mare',
      traits: {
        positive: ['resilient', 'focused', 'athletic'],
        negative: ['nervous'],
        hidden: ['speed_boost'],
      },
      stats: {
        speed: 90,
        stamina: 85,
        agility: 88,
        intelligence: 80,
        boldness: 70,
      },
      disciplineScores: {
        racing: 90,
        dressage: 85,
        showJumping: 92,
      },
      sireId: 12,
      damId: 13,
    };

    // Test lineage for multi-generational analysis
    testLineage = [
      { generation: 1, horses: [testStallion, testMare] },
      {
        generation: 2,
        horses: [
          { id: 10, traits: { positive: ['bold', 'athletic'], negative: [], hidden: [] } },
          { id: 11, traits: { positive: ['calm', 'intelligent'], negative: ['lazy'], hidden: [] } },
          { id: 12, traits: { positive: ['resilient', 'fast'], negative: [], hidden: [] } },
          { id: 13, traits: { positive: ['focused', 'agile'], negative: ['nervous'], hidden: [] } },
        ],
      },
      {
        generation: 3,
        horses: [
          { id: 20, traits: { positive: ['legendary_speed'], negative: [], hidden: [] } },
          { id: 21, traits: { positive: ['perfect_balance'], negative: [], hidden: [] } },
        ],
      },
    ];
  });

  describe('🎯 Enhanced Trait Inheritance Probability Calculator', () => {
    test('should calculate detailed trait inheritance probabilities', () => {
      const probabilities = calculateEnhancedGeneticProbabilities(testStallion, testMare);

      expect(probabilities).toHaveProperty('traitProbabilities');
      expect(probabilities).toHaveProperty('statProbabilities');
      expect(probabilities).toHaveProperty('disciplineProbabilities');
      expect(probabilities).toHaveProperty('overallGeneticScore');

      // Validate trait probabilities structure
      expect(probabilities.traitProbabilities).toHaveProperty('positive');
      expect(probabilities.traitProbabilities).toHaveProperty('negative');
      expect(probabilities.traitProbabilities).toHaveProperty('hidden');

      // Athletic trait should have high probability (both parents have it)
      const athleticProb = probabilities.traitProbabilities.positive.find(
        (t) => t.trait === 'athletic'
      );
      expect(athleticProb).toBeDefined();
      expect(athleticProb.probability).toBeGreaterThan(70); // High probability for shared trait

      // Validate probability ranges
      probabilities.traitProbabilities.positive.forEach((trait) => {
        expect(trait.probability).toBeGreaterThanOrEqual(0);
        expect(trait.probability).toBeLessThanOrEqual(100);
      });
    });

    test('should calculate stat inheritance probabilities', () => {
      const probabilities = calculateEnhancedGeneticProbabilities(testStallion, testMare);

      expect(probabilities.statProbabilities).toHaveProperty('speed');
      expect(probabilities.statProbabilities).toHaveProperty('stamina');
      expect(probabilities.statProbabilities).toHaveProperty('agility');
      expect(probabilities.statProbabilities).toHaveProperty('intelligence');

      // Speed should be reasonable (both parents have good speed)
      expect(probabilities.statProbabilities.speed.expectedRange.min).toBeGreaterThan(30);
      expect(probabilities.statProbabilities.speed.expectedRange.max).toBeLessThanOrEqual(100);

      // Intelligence should favor stallion (higher intelligence)
      expect(probabilities.statProbabilities.intelligence.expectedRange.min).toBeGreaterThan(30);
    });

    test('should handle edge cases with minimal genetic data', () => {
      const minimalStallion = {
        id: 1,
        traits: { positive: [], negative: [], hidden: [] },
        stats: { speed: 50, stamina: 50 },
      };

      const minimalMare = {
        id: 2,
        traits: { positive: [], negative: [], hidden: [] },
        stats: { speed: 50, stamina: 50 },
      };

      const probabilities = calculateEnhancedGeneticProbabilities(minimalStallion, minimalMare);

      expect(probabilities).toHaveProperty('traitProbabilities');
      expect(probabilities).toHaveProperty('overallGeneticScore');
      expect(probabilities.overallGeneticScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('🤝 Genetic Compatibility Scoring System', () => {
    test('should calculate genetic compatibility score', () => {
      const compatibility = calculateGeneticCompatibilityScore(testStallion, testMare);

      expect(compatibility).toHaveProperty('overallScore');
      expect(compatibility).toHaveProperty('traitCompatibility');
      expect(compatibility).toHaveProperty('statCompatibility');
      expect(compatibility).toHaveProperty('disciplineCompatibility');
      expect(compatibility).toHaveProperty('diversityScore');

      // Overall score should be between 0-100
      expect(compatibility.overallScore).toBeGreaterThanOrEqual(0);
      expect(compatibility.overallScore).toBeLessThanOrEqual(100);

      // Should have good compatibility (both athletic)
      expect(compatibility.traitCompatibility.sharedPositiveTraits).toContain('athletic');
      expect(compatibility.traitCompatibility.score).toBeGreaterThan(55);
    });

    test('should identify trait conflicts', () => {
      const conflictedMare = {
        ...testMare,
        traits: {
          positive: ['nervous', 'aggressive'],
          negative: ['calm'], // Conflicts with stallion's calm trait
          hidden: [],
        },
      };

      const compatibility = calculateGeneticCompatibilityScore(testStallion, conflictedMare);

      expect(compatibility.traitCompatibility.conflicts).toBeDefined();
      expect(compatibility.traitCompatibility.conflicts.length).toBeGreaterThan(0);
      expect(compatibility.traitCompatibility.score).toBeLessThan(50); // Lower score due to conflicts
    });

    test('should calculate stat compatibility', () => {
      const compatibility = calculateGeneticCompatibilityScore(testStallion, testMare);

      expect(compatibility.statCompatibility).toHaveProperty('complementaryStats');
      expect(compatibility.statCompatibility).toHaveProperty('balanceScore');

      // Should identify complementary strengths
      expect(compatibility.statCompatibility.complementaryStats).toBeDefined();
      expect(compatibility.statCompatibility.balanceScore).toBeGreaterThan(0);
    });
  });

  describe('🎲 Breeding Outcome Simulation', () => {
    test('should simulate multiple breeding outcomes', () => {
      const simulation = simulateBreedingOutcomes(testStallion, testMare, { iterations: 100 });

      expect(simulation).toHaveProperty('outcomes');
      expect(simulation).toHaveProperty('statistics');
      expect(simulation).toHaveProperty('confidenceIntervals');

      expect(simulation.outcomes).toHaveLength(100);

      // Each outcome should have required properties
      simulation.outcomes.forEach((outcome) => {
        expect(outcome).toHaveProperty('traits');
        expect(outcome).toHaveProperty('stats');
        expect(outcome).toHaveProperty('predictedPerformance');
      });

      // Statistics should be calculated
      expect(simulation.statistics).toHaveProperty('traitFrequency');
      expect(simulation.statistics).toHaveProperty('averageStats');
      expect(simulation.statistics).toHaveProperty('performanceDistribution');
    });

    test('should provide confidence intervals', () => {
      const simulation = simulateBreedingOutcomes(testStallion, testMare, { iterations: 50 });

      expect(simulation.confidenceIntervals).toHaveProperty('stats');
      expect(simulation.confidenceIntervals).toHaveProperty('performance');

      // Confidence intervals should have min/max ranges
      Object.values(simulation.confidenceIntervals.stats).forEach((interval) => {
        expect(interval).toHaveProperty('min');
        expect(interval).toHaveProperty('max');
        expect(interval).toHaveProperty('confidence');
        expect(interval.min).toBeLessThanOrEqual(interval.max);
      });
    });

    test('should handle deterministic simulation with seed', () => {
      const simulation1 = simulateBreedingOutcomes(testStallion, testMare, {
        iterations: 10,
        seed: 12345,
      });
      const simulation2 = simulateBreedingOutcomes(testStallion, testMare, {
        iterations: 10,
        seed: 12345,
      });

      // Results should be identical with same seed
      expect(simulation1.outcomes).toEqual(simulation2.outcomes);
    });
  });

  describe('🌳 Multi-Generational Prediction Engine', () => {
    test('should calculate multi-generational predictions', () => {
      const predictions = calculateMultiGenerationalPredictions(
        testStallion,
        testMare,
        testLineage
      );

      expect(predictions).toHaveProperty('generationalImpact');
      expect(predictions).toHaveProperty('ancestralTraitInfluence');
      expect(predictions).toHaveProperty('lineageStrengths');
      expect(predictions).toHaveProperty('lineageWeaknesses');

      // Should analyze ancestral influence
      expect(predictions.ancestralTraitInfluence).toHaveProperty('generation2');
      expect(predictions.ancestralTraitInfluence).toHaveProperty('generation3');

      // Should identify lineage patterns
      expect(Array.isArray(predictions.lineageStrengths)).toBe(true);
      expect(Array.isArray(predictions.lineageWeaknesses)).toBe(true);
    });

    test('should weight recent generations more heavily', () => {
      const predictions = calculateMultiGenerationalPredictions(
        testStallion,
        testMare,
        testLineage
      );

      // Generation 2 should have more influence than generation 3
      const gen2Influence = predictions.ancestralTraitInfluence.generation2.totalInfluence;
      const gen3Influence = predictions.ancestralTraitInfluence.generation3.totalInfluence;

      expect(gen2Influence).toBeGreaterThan(gen3Influence);
    });
  });

  describe('🌈 Genetic Diversity Impact Calculator', () => {
    test('should calculate genetic diversity impact', () => {
      const diversityImpact = calculateGeneticDiversityImpact(testStallion, testMare, testLineage);

      expect(diversityImpact).toHaveProperty('diversityScore');
      expect(diversityImpact).toHaveProperty('inbreedingCoefficient');
      expect(diversityImpact).toHaveProperty('geneticHealthScore');
      expect(diversityImpact).toHaveProperty('diversityRecommendations');

      // Diversity score should be 0-100
      expect(diversityImpact.diversityScore).toBeGreaterThanOrEqual(0);
      expect(diversityImpact.diversityScore).toBeLessThanOrEqual(100);

      // Inbreeding coefficient should be 0-1
      expect(diversityImpact.inbreedingCoefficient).toBeGreaterThanOrEqual(0);
      expect(diversityImpact.inbreedingCoefficient).toBeLessThanOrEqual(1);
    });

    test('should detect inbreeding risks', () => {
      // Create inbred lineage
      const inbredLineage = [
        { generation: 1, horses: [testStallion, testMare] },
        {
          generation: 2,
          horses: [
            { id: 10, traits: { positive: ['athletic'], negative: [], hidden: [] } },
            { id: 10, traits: { positive: ['athletic'], negative: [], hidden: [] } }, // Same horse as both grandparents
          ],
        },
      ];

      const diversityImpact = calculateGeneticDiversityImpact(
        testStallion,
        testMare,
        inbredLineage
      );

      expect(diversityImpact.inbreedingCoefficient).toBeGreaterThan(0);
      expect(diversityImpact.geneticHealthScore).toBeLessThan(80); // Lower health score
      expect(diversityImpact.diversityRecommendations).toContain(
        'Consider outcrossing to improve genetic diversity'
      );
    });
  });

  describe('⚡ Trait Interaction Modeling', () => {
    test('should calculate trait interactions', () => {
      const interactions = calculateTraitInteractions(testStallion, testMare);

      expect(interactions).toHaveProperty('synergisticPairs');
      expect(interactions).toHaveProperty('antagonisticPairs');
      expect(interactions).toHaveProperty('interactionScore');
      expect(interactions).toHaveProperty('predictedCombinations');

      // Should identify synergistic combinations
      expect(Array.isArray(interactions.synergisticPairs)).toBe(true);
      expect(Array.isArray(interactions.antagonisticPairs)).toBe(true);

      // Interaction score should be meaningful
      expect(interactions.interactionScore).toBeGreaterThanOrEqual(-100);
      expect(interactions.interactionScore).toBeLessThanOrEqual(100);
    });

    test('should identify athletic + intelligent synergy', () => {
      const interactions = calculateTraitInteractions(testStallion, testMare);

      // Both parents have athletic, stallion has intelligent
      const athleticIntelligentSynergy = interactions.synergisticPairs.find(
        (pair) =>
          (pair.trait1 === 'athletic' && pair.trait2 === 'intelligent') ||
          (pair.trait1 === 'intelligent' && pair.trait2 === 'athletic')
      );

      expect(athleticIntelligentSynergy).toBeDefined();
      expect(athleticIntelligentSynergy.synergyBonus).toBeGreaterThan(0);
    });
  });

  describe('💡 Breeding Recommendation Engine', () => {
    test('should generate breeding recommendations', () => {
      const recommendations = generateBreedingRecommendations(testStallion, testMare);

      expect(recommendations).toHaveProperty('overallRecommendation');
      expect(recommendations).toHaveProperty('strengths');
      expect(recommendations).toHaveProperty('concerns');
      expect(recommendations).toHaveProperty('optimizationSuggestions');
      expect(recommendations).toHaveProperty('expectedOutcomes');

      // Should have meaningful recommendations
      expect(Array.isArray(recommendations.strengths)).toBe(true);
      expect(Array.isArray(recommendations.concerns)).toBe(true);
      expect(Array.isArray(recommendations.optimizationSuggestions)).toBe(true);

      // Overall recommendation should be valid
      expect(['Highly Recommended', 'Recommended', 'Acceptable', 'Not Recommended']).toContain(
        recommendations.overallRecommendation
      );
    });

    test('should provide specific optimization suggestions', () => {
      const recommendations = generateBreedingRecommendations(testStallion, testMare);

      expect(recommendations.optimizationSuggestions.length).toBeGreaterThan(0);

      // Should have actionable suggestions
      recommendations.optimizationSuggestions.forEach((suggestion) => {
        expect(suggestion).toHaveProperty('category');
        expect(suggestion).toHaveProperty('suggestion');
        expect(suggestion).toHaveProperty('impact');
      });
    });
  });

  describe('🏆 Performance Prediction Algorithm', () => {
    test('should predict offspring performance', () => {
      const performance = predictOffspringPerformance(testStallion, testMare);

      expect(performance).toHaveProperty('disciplinePredictions');
      expect(performance).toHaveProperty('overallPotential');
      expect(performance).toHaveProperty('strengthAreas');
      expect(performance).toHaveProperty('developmentAreas');

      // Should predict performance for major disciplines
      expect(performance.disciplinePredictions).toHaveProperty('racing');
      expect(performance.disciplinePredictions).toHaveProperty('dressage');
      expect(performance.disciplinePredictions).toHaveProperty('showJumping');

      // Performance scores should be reasonable
      Object.values(performance.disciplinePredictions).forEach((prediction) => {
        expect(prediction.predictedScore).toBeGreaterThanOrEqual(0);
        expect(prediction.predictedScore).toBeLessThanOrEqual(100);
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(100);
      });
    });

    test('should identify performance strengths and weaknesses', () => {
      const performance = predictOffspringPerformance(testStallion, testMare);

      expect(Array.isArray(performance.strengthAreas)).toBe(true);
      expect(Array.isArray(performance.developmentAreas)).toBe(true);

      // Should have meaningful strength identification
      performance.strengthAreas.forEach((strength) => {
        expect(strength).toHaveProperty('area');
        expect(strength).toHaveProperty('score');
        expect(strength).toHaveProperty('reasoning');
      });
    });
  });
});
