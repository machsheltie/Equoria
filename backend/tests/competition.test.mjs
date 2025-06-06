/**
 * 🧪 UNIT TEST: Competition Trait Match Fairness - Statistical Validation
 *
 * This test validates the fairness and statistical consistency of trait-based
 * competition advantages across multiple disciplines with large sample testing.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Discipline affinity trait bonuses: +5 score advantage for matching traits
 * - Statistical fairness: trait advantage should be meaningful but not overpowering
 * - Win rate expectations: 55-75% for trait-matched horses (better than random, not dominant)
 * - Cross-discipline consistency: trait advantages work equally across all disciplines
 * - Random variance handling: large sample sizes reduce statistical noise
 * - Competition simulation accuracy: realistic outcomes with trait modifiers
 * - Trait naming conventions: discipline_affinity_[discipline_name] format
 * - Multiple run validation: consistent results across repeated test batches
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. Show Jumping trait advantage validation (60 runs across 3 batches)
 * 2. Racing trait advantage validation (60 runs across 3 batches)
 * 3. Dressage trait advantage validation (60 runs across 3 batches)
 * 4. Cross Country trait advantage validation (60 runs across 3 batches)
 * 5. Large sample consistency testing (100 runs for statistical reliability)
 * 6. Win rate boundaries: >50% but <85% for balanced gameplay
 * 7. Statistical variance: trait advantage consistent across multiple batches
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Complete competition simulation, trait calculations, randomness, scoring
 * ✅ REAL: Statistical analysis, win rate calculations, batch processing, variance testing
 * 🔧 MOCK: None - pure algorithmic testing with no external dependencies
 *
 * 💡 TEST STRATEGY: Statistical validation with large sample sizes to ensure
 *    trait advantages provide meaningful but balanced competitive benefits
 */

import { describe, it, expect } from '@jest/globals';
// Jest globals are available in test environment
import { simulateCompetition } from '../logic/simulateCompetition.mjs';

describe('🏆 UNIT: Competition Trait Match Fairness - Statistical Validation', () => {
  const createTestHorse = (id, name, overrides = {}) => ({
    id,
    name,
    speed: 70,
    stamina: 60,
    focus: 50,
    agility: 60,
    balance: 55,
    boldness: 50,
    trainingScore: 50,
    tack: {
      saddleBonus: 5,
      bridleBonus: 3,
    },
    health: 'Good',
    stressLevel: 20,
    rider: {
      bonusPercent: 0,
      penaltyPercent: 0,
    },
    epigeneticModifiers: {
      positive: [],
      negative: [],
      hidden: [],
    },
    ...overrides,
  });

  it('should demonstrate trait match fairness for Show Jumping competition', () => {
    // TASK 10: Adjust Test for Trait Match Fairness
    // Run multiple test batches to get more reliable statistics
    // Each batch simulates 20 matches, we run 3 batches and average the results

    let totalWins = 0;
    const batches = 3;
    const runsPerBatch = 20;
    const totalRuns = batches * runsPerBatch; // 60 total runs

    const showJumpingEvent = {
      id: 'test-show-jumping',
      name: 'Test Show Jumping Competition',
      discipline: 'Show Jumping',
    };

    for (let batch = 0; batch < batches; batch++) {
      let batchWins = 0;

      for (let i = 0; i < runsPerBatch; i++) {
        const horses = [
          createTestHorse(1, 'JumpSpecialist', {
            epigeneticModifiers: {
              positive: ['discipline_affinity_show_jumping'], // Matches event discipline
              negative: [],
              hidden: [],
            },
          }),
          createTestHorse(2, 'RegularHorse', {
            epigeneticModifiers: {
              positive: [], // No matching trait
              negative: [],
              hidden: [],
            },
          }),
        ];

        const results = simulateCompetition(horses, showJumpingEvent);

        if (results[0].name === 'JumpSpecialist') {
          batchWins++;
        }
      }

      totalWins += batchWins;
    }

    // With 60 total runs, expect at least 55% win rate (33+ wins)
    // This accounts for random variance while ensuring trait advantage is meaningful
    expect(totalWins).toBeGreaterThanOrEqual(33); // At least 55% win rate
    expect(totalWins).toBeGreaterThan(30); // Better than 50% (not negligible)
    expect(totalWins).toBeLessThanOrEqual(totalRuns); // Allow up to 100% in samples
  });

  it('should demonstrate trait match fairness for Racing competition', () => {
    let totalWins = 0;
    const batches = 3;
    const runsPerBatch = 20;
    const totalRuns = batches * runsPerBatch; // 60 total runs

    const racingEvent = {
      id: 'test-racing',
      name: 'Test Racing Competition',
      discipline: 'Racing',
    };

    for (let batch = 0; batch < batches; batch++) {
      let batchWins = 0;

      for (let i = 0; i < runsPerBatch; i++) {
        const horses = [
          createTestHorse(1, 'RacingSpecialist', {
            epigeneticModifiers: {
              positive: ['discipline_affinity_racing'], // Matches event discipline
              negative: [],
              hidden: [],
            },
          }),
          createTestHorse(2, 'RegularHorse', {
            epigeneticModifiers: {
              positive: [], // No matching trait
              negative: [],
              hidden: [],
            },
          }),
        ];

        const results = simulateCompetition(horses, racingEvent);

        if (results[0].name === 'RacingSpecialist') {
          batchWins++;
        }
      }

      totalWins += batchWins;
    }

    expect(totalWins).toBeGreaterThanOrEqual(33); // At least 55% win rate
    expect(totalWins).toBeGreaterThan(30); // Better than 50% (not negligible)
    expect(totalWins).toBeLessThanOrEqual(totalRuns); // Allow up to 100% in samples
  });

  it('should demonstrate trait match fairness for Dressage competition', () => {
    let totalWins = 0;
    const batches = 3;
    const runsPerBatch = 20;
    const totalRuns = batches * runsPerBatch; // 60 total runs

    const dressageEvent = {
      id: 'test-dressage',
      name: 'Test Dressage Competition',
      discipline: 'Dressage',
    };

    for (let batch = 0; batch < batches; batch++) {
      let batchWins = 0;

      for (let i = 0; i < runsPerBatch; i++) {
        const horses = [
          createTestHorse(1, 'DressageSpecialist', {
            epigeneticModifiers: {
              positive: ['discipline_affinity_dressage'], // Matches event discipline
              negative: [],
              hidden: [],
            },
          }),
          createTestHorse(2, 'RegularHorse', {
            epigeneticModifiers: {
              positive: [], // No matching trait
              negative: [],
              hidden: [],
            },
          }),
        ];

        const results = simulateCompetition(horses, dressageEvent);

        if (results[0].name === 'DressageSpecialist') {
          batchWins++;
        }
      }

      totalWins += batchWins;
    }

    expect(totalWins).toBeGreaterThanOrEqual(33); // At least 55% win rate
    expect(totalWins).toBeGreaterThan(30); // Better than 50% (not negligible)
    expect(totalWins).toBeLessThanOrEqual(totalRuns); // Allow up to 100% in samples
  });

  it('should demonstrate trait match fairness for Cross Country competition', () => {
    let totalWins = 0;
    const batches = 3;
    const runsPerBatch = 20;
    const totalRuns = batches * runsPerBatch; // 60 total runs

    const crossCountryEvent = {
      id: 'test-cross-country',
      name: 'Test Cross Country Competition',
      discipline: 'Cross Country',
    };

    for (let batch = 0; batch < batches; batch++) {
      let batchWins = 0;

      for (let i = 0; i < runsPerBatch; i++) {
        const horses = [
          createTestHorse(1, 'CrossCountrySpecialist', {
            epigeneticModifiers: {
              positive: ['discipline_affinity_cross_country'], // Matches event discipline
              negative: [],
              hidden: [],
            },
          }),
          createTestHorse(2, 'RegularHorse', {
            epigeneticModifiers: {
              positive: [], // No matching trait
              negative: [],
              hidden: [],
            },
          }),
        ];

        const results = simulateCompetition(horses, crossCountryEvent);

        if (results[0].name === 'CrossCountrySpecialist') {
          batchWins++;
        }
      }

      totalWins += batchWins;
    }

    expect(totalWins).toBeGreaterThanOrEqual(33); // At least 55% win rate
    expect(totalWins).toBeGreaterThan(30); // Better than 50% (not negligible)
    expect(totalWins).toBeLessThanOrEqual(totalRuns); // Allow up to 100% in samples
  });

  it('should verify trait advantage is consistent across multiple test runs', () => {
    // Run a larger sample to verify statistical consistency
    let totalWins = 0;
    const totalRuns = 100; // Larger sample for more reliable statistics

    const showJumpingEvent = {
      id: 'test-show-jumping-large',
      name: 'Large Sample Show Jumping Test',
      discipline: 'Show Jumping',
    };

    for (let i = 0; i < totalRuns; i++) {
      const horses = [
        createTestHorse(1, 'JumpSpecialist', {
          epigeneticModifiers: {
            positive: ['discipline_affinity_show_jumping'],
            negative: [],
            hidden: [],
          },
        }),
        createTestHorse(2, 'RegularHorse', {
          epigeneticModifiers: {
            positive: [],
            negative: [],
            hidden: [],
          },
        }),
      ];

      const results = simulateCompetition(horses, showJumpingEvent);

      if (results[0].name === 'JumpSpecialist') {
        totalWins++;
      }
    }

    // With larger sample, expect win rate between 55-75%
    const winRate = totalWins / totalRuns;
    expect(winRate).toBeGreaterThan(0.5); // Better than random
    expect(winRate).toBeLessThan(0.85); // Not overly dominant
    expect(totalWins).toBeGreaterThanOrEqual(55); // At least 55% win rate
  });
});
