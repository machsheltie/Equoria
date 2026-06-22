/**
 * Breeding Simulation — Monte-Carlo outcome simulation (pure, seeded-RNG-deterministic)
 *
 * Extracted from enhancedGeneticProbabilityService.mjs (Equoria-urqic.4.1).
 *
 * Owns the breeding-simulation cluster that backs `simulateBreedingOutcomes`:
 * a seeded RNG, per-iteration single-outcome simulation, and the
 * statistics/confidence-interval aggregation over the iteration set.
 *
 * All functions are pure: given a seeded RNG they are deterministic, they
 * touch no DB and emit no logs. The one upstream dependency —
 * `calculateEnhancedGeneticProbabilities` — is INJECTED as `computeProbabilities`
 * by the facade rather than imported here. That mirrors the urqic.4 pattern
 * (facade composes, module computes) and keeps this module free of a
 * back-reference to the facade, avoiding a circular import.
 */

/**
 * Deterministic linear-congruential RNG for reproducible simulation.
 *
 * Returns a function that yields the next pseudo-random value in [0, 1).
 * Identical seeds produce identical sequences — the basis for the
 * seed-reproducibility contract of `computeBreedingSimulation`.
 */
export function createSeededRandom(seed) {
  let currentSeed = seed;
  return function () {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };
}

/**
 * Aggregate trait frequency, average stats, and performance distribution
 * across a set of simulated outcomes.
 */
export function calculateOutcomeStatistics(outcomes) {
  const traitFrequency = {};
  const statTotals = {};
  const performanceTotals = {};

  outcomes.forEach(outcome => {
    // Count trait frequencies
    Object.entries(outcome.traits).forEach(([_category, traits]) => {
      traits.forEach(trait => {
        if (!traitFrequency[trait]) {
          traitFrequency[trait] = 0;
        }
        traitFrequency[trait]++;
      });
    });

    // Sum stats
    Object.entries(outcome.stats).forEach(([stat, value]) => {
      if (!statTotals[stat]) {
        statTotals[stat] = 0;
      }
      statTotals[stat] += value;
    });

    // Sum performance scores
    Object.entries(outcome.predictedPerformance).forEach(([discipline, score]) => {
      if (!performanceTotals[discipline]) {
        performanceTotals[discipline] = 0;
      }
      performanceTotals[discipline] += score;
    });
  });

  // Calculate averages
  const averageStats = {};
  Object.entries(statTotals).forEach(([stat, total]) => {
    averageStats[stat] = Math.round(total / outcomes.length);
  });

  const performanceDistribution = {};
  Object.entries(performanceTotals).forEach(([discipline, total]) => {
    performanceDistribution[discipline] = Math.round(total / outcomes.length);
  });

  return {
    traitFrequency,
    averageStats,
    performanceDistribution,
  };
}

/**
 * Compute 95% confidence intervals for each stat and discipline across the
 * simulated outcome set, using the 2.5th / 97.5th percentiles.
 */
export function calculateConfidenceIntervals(outcomes) {
  const stats = {};
  const performance = {};

  // Calculate stat confidence intervals
  const statNames = Object.keys(outcomes[0].stats);
  statNames.forEach(stat => {
    const values = outcomes.map(outcome => outcome.stats[stat]).sort((a, b) => a - b);
    const lowerIndex = Math.floor(values.length * 0.025);
    const upperIndex = Math.floor(values.length * 0.975);

    stats[stat] = {
      min: values[lowerIndex],
      max: values[upperIndex],
      confidence: 95,
    };
  });

  // Calculate performance confidence intervals
  const disciplineNames = Object.keys(outcomes[0].predictedPerformance);
  disciplineNames.forEach(discipline => {
    const values = outcomes
      .map(outcome => outcome.predictedPerformance[discipline])
      .sort((a, b) => a - b);
    const lowerIndex = Math.floor(values.length * 0.025);
    const upperIndex = Math.floor(values.length * 0.975);

    performance[discipline] = {
      min: values[lowerIndex],
      max: values[upperIndex],
      confidence: 95,
    };
  });

  return { stats, performance };
}

/**
 * Predict per-discipline performance from a single offspring's inherited
 * traits and stats.
 */
export function calculatePerformanceFromTraitsAndStats(traits, stats) {
  const performance = {};
  const disciplines = ['racing', 'dressage', 'showJumping', 'crossCountry', 'western', 'gaited'];

  disciplines.forEach(discipline => {
    let baseScore = 50;

    // Add stat contributions
    // Equoria-yvxkx: ?? not || — `|| 50` ACTIVELY corrupts the genetic
    // probability for a stat-0 horse (boosts to 50). Stat-0 is a legitimate
    // undeveloped/injury state on the canonical Horse stat columns; only
    // null/undefined should fall back to 50.
    switch (discipline) {
      case 'racing':
        baseScore +=
          (stats.speed ?? 50) * 0.4 + (stats.stamina ?? 50) * 0.3 + (stats.agility ?? 50) * 0.3;
        break;
      case 'dressage':
        baseScore +=
          (stats.intelligence ?? 50) * 0.4 +
          (stats.precision ?? 50) * 0.3 +
          (stats.balance ?? 50) * 0.3;
        break;
      case 'showJumping':
        baseScore +=
          (stats.agility ?? 50) * 0.4 +
          (stats.boldness ?? 50) * 0.3 +
          (stats.precision ?? 50) * 0.3;
        break;
      default:
        baseScore +=
          Object.values(stats).reduce((sum, val) => sum + val, 0) / Object.keys(stats).length;
    }

    // Add trait bonuses
    const allTraits = [...traits.positive, ...traits.negative, ...traits.hidden];
    allTraits.forEach(trait => {
      if (trait === 'athletic' && ['racing', 'showJumping'].includes(discipline)) {
        baseScore += 5;
      }
      if (trait === 'intelligent' && discipline === 'dressage') {
        baseScore += 5;
      }
      if (trait === 'calm' && discipline === 'dressage') {
        baseScore += 3;
      }
    });

    performance[discipline] = Math.min(100, Math.max(0, Math.round(baseScore)));
  });

  return performance;
}

/**
 * Compute an overall genetic score for a single simulated offspring from its
 * inherited traits and stats.
 */
export function calculateGeneticScoreFromOutcome(traits, stats) {
  let score = 50;

  // Positive trait bonus
  score += traits.positive.length * 3;

  // Negative trait penalty
  score -= traits.negative.length * 2;

  // Hidden trait bonus
  score += traits.hidden.length * 4;

  // Stat bonus for high stats
  const avgStat =
    Object.values(stats).reduce((sum, val) => sum + val, 0) / Object.keys(stats).length;
  score += (avgStat - 50) * 0.5;

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Simulate a single breeding outcome.
 *
 * `probabilities` is the result of calculateEnhancedGeneticProbabilities —
 * computed ONCE by `computeBreedingSimulation` and passed in here so the
 * facade's probabilities fn is not imported (avoids a circular import) and is
 * not recomputed per iteration.
 */
export function simulateSingleBreedingOutcome(probabilities, rng = Math.random) {
  // Simulate trait inheritance
  const inheritedTraits = {
    positive: [],
    negative: [],
    hidden: [],
  };

  Object.entries(probabilities.traitProbabilities).forEach(([category, traits]) => {
    traits.forEach(trait => {
      if (rng() * 100 < trait.probability) {
        inheritedTraits[category].push(trait.trait);
      }
    });
  });

  // Simulate stat inheritance
  const inheritedStats = {};
  Object.entries(probabilities.statProbabilities).forEach(([stat, data]) => {
    const range = data.expectedRange.max - data.expectedRange.min;
    const randomValue = data.expectedRange.min + rng() * range;
    inheritedStats[stat] = Math.round(randomValue);
  });

  // Predict performance based on inherited traits and stats
  const predictedPerformance = calculatePerformanceFromTraitsAndStats(
    inheritedTraits,
    inheritedStats,
  );

  return {
    traits: inheritedTraits,
    stats: inheritedStats,
    predictedPerformance,
    geneticScore: calculateGeneticScoreFromOutcome(inheritedTraits, inheritedStats),
  };
}

/**
 * Run the full Monte-Carlo breeding simulation for a pair.
 *
 * Cohesive public entry point the facade
 * (enhancedGeneticProbabilityService.simulateBreedingOutcomes) delegates to.
 *
 * `computeProbabilities` is the facade's calculateEnhancedGeneticProbabilities,
 * injected so this module has no back-reference to the facade (avoids a
 * circular import). It is invoked ONCE — the genetic probabilities are a pure
 * function of the (stallion, mare) pair and do not change between iterations,
 * so computing them once preserves the original per-call result while removing
 * redundant work the previous in-facade implementation performed every
 * iteration.
 */
export function computeBreedingSimulation(stallion, mare, computeProbabilities, options = {}) {
  const { iterations = 100, seed } = options;

  const outcomes = [];
  const rng = seed ? createSeededRandom(seed) : Math.random;

  // Probabilities are a pure fn of (stallion, mare) — compute once, reuse.
  const probabilities = computeProbabilities(stallion, mare);

  // Generate multiple breeding outcomes
  for (let i = 0; i < iterations; i++) {
    const outcome = simulateSingleBreedingOutcome(probabilities, rng);
    outcomes.push(outcome);
  }

  // Calculate statistics
  const statistics = calculateOutcomeStatistics(outcomes);
  const confidenceIntervals = calculateConfidenceIntervals(outcomes);

  return {
    outcomes,
    statistics,
    confidenceIntervals,
    simulationParameters: { iterations, seed },
  };
}
