/**
 * Genetic Compatibility Scoring — object-based pure calculations
 *
 * Extracted from enhancedGeneticProbabilityService.mjs (Equoria-urqic.4.4).
 *
 * This module owns the pure, in-memory sub-calculations that back the facade's
 * `calculateGeneticCompatibilityScore`:
 *   - trait compatibility (shared positives + positive/negative conflicts)
 *   - stat compatibility (per-stat balance + complementary-strength detection)
 *   - discipline compatibility (averaged discipline scores)
 *   - basic diversity score (unique-vs-shared trait ratio)
 *   - the composed `computeGeneticCompatibilityScore` weighted aggregate
 *
 * They operate on the in-memory stallion/mare OBJECT shape (`traits`, `stats`,
 * `disciplineScores`) — distinct from the DB-/Prisma-based
 * `breedingCompatibility.mjs` sibling in this directory, which does pair-level
 * scoring + population-wide pair search over DB rows and is NOT interchangeable
 * with these. Kept separate deliberately to avoid conflating the two data
 * shapes (mirrors the geneticDiversityImpact.mjs ↔ geneticDiversityMetrics.mjs
 * separation from urqic.4).
 *
 * `calculateStatCompatibility` is ALSO consumed by the facade's
 * `calculateOverallGeneticScore` (which stays in the facade), so it is exported
 * here and imported back by the facade — no behavior change, single source of
 * truth.
 *
 * No logging lives here — the facade owns orchestration/logging so this module
 * is log-free and trivially unit-testable.
 */

import { asFlagObject } from '../../../../utils/jsonbArrayGuard.mjs';

/**
 * Calculate trait compatibility (shared positives + positive/negative conflicts).
 */
export function calculateTraitCompatibility(stallion, mare) {
  const stallionTraits = stallion.traits || { positive: [], negative: [], hidden: [] };
  const mareTraits = mare.traits || { positive: [], negative: [], hidden: [] };

  const sharedPositiveTraits = stallionTraits.positive.filter(trait =>
    mareTraits.positive.includes(trait),
  );

  const conflicts = [];

  // Check for trait conflicts (positive vs negative)
  stallionTraits.positive.forEach(trait => {
    if (mareTraits.negative.includes(trait)) {
      conflicts.push({ trait, type: 'positive_negative_conflict' });
    }
  });

  mareTraits.positive.forEach(trait => {
    if (stallionTraits.negative.includes(trait)) {
      conflicts.push({ trait, type: 'positive_negative_conflict' });
    }
  });

  let score = 50;
  score += sharedPositiveTraits.length * 8;
  score -= conflicts.length * 15;

  return {
    score: Math.min(100, Math.max(0, score)),
    sharedPositiveTraits,
    conflicts,
    compatibilityLevel: score > 75 ? 'excellent' : score > 50 ? 'good' : 'poor',
  };
}

/**
 * Calculate stat compatibility (per-stat balance + complementary-strength detection).
 *
 * Also used by the facade's calculateOverallGeneticScore — single source of truth.
 */
export function calculateStatCompatibility(stallionStats, mareStats) {
  const stallionStatsObj = stallionStats || {};
  const mareStatsObj = mareStats || {};

  const allStats = new Set([...Object.keys(stallionStatsObj), ...Object.keys(mareStatsObj)]);
  let totalCompatibility = 0;
  let statCount = 0;

  const complementaryStats = [];

  // If no stats available, return default compatibility
  if (allStats.size === 0) {
    return {
      balanceScore: 50,
      complementaryStats: [],
    };
  }

  allStats.forEach(stat => {
    // Equoria-cdgwd: `?? 50` (not `|| 50`) so a legitimate stat value of 0
    // (undeveloped/injured) is preserved rather than silently boosted to 50,
    // which would corrupt the breeding compatibility score. The typeof guard
    // below still coerces genuinely non-numeric values to 50.
    const stallionValue = stallionStatsObj[stat] ?? 50;
    const mareValue = mareStatsObj[stat] ?? 50;

    // Ensure values are numbers
    const stallionNum = typeof stallionValue === 'number' ? stallionValue : 50;
    const mareNum = typeof mareValue === 'number' ? mareValue : 50;

    // Calculate balance (prefer complementary strengths)
    const _average = (stallionNum + mareNum) / 2;
    const difference = Math.abs(stallionNum - mareNum);

    // Moderate differences are good (complementary), extreme differences are bad
    let compatibility;
    if (difference < 10) {
      compatibility = 70; // Similar levels
    } else if (difference < 25) {
      compatibility = 85; // Complementary strengths
      complementaryStats.push({ stat, stallionValue: stallionNum, mareValue: mareNum });
    } else {
      compatibility = 40; // Too different
    }

    totalCompatibility += compatibility;
    statCount++;
  });

  const balanceScore = statCount > 0 ? totalCompatibility / statCount : 50;

  return {
    balanceScore: Math.round(balanceScore),
    complementaryStats,
  };
}

/**
 * Calculate discipline compatibility (averaged discipline scores).
 */
export function calculateDisciplineCompatibility(stallion, mare) {
  const stallionDisciplines = asFlagObject(stallion.disciplineScores);
  const mareDisciplines = asFlagObject(mare.disciplineScores);

  const allDisciplines = new Set([
    ...Object.keys(stallionDisciplines),
    ...Object.keys(mareDisciplines),
  ]);

  if (allDisciplines.size === 0) {
    return 50;
  }

  let totalScore = 0;
  let disciplineCount = 0;

  allDisciplines.forEach(discipline => {
    const stallionScore = stallionDisciplines[discipline] || 0;
    const mareScore = mareDisciplines[discipline] || 0;

    if (stallionScore > 0 || mareScore > 0) {
      const averageScore = (stallionScore + mareScore) / 2;
      totalScore += averageScore;
      disciplineCount++;
    }
  });

  return disciplineCount > 0 ? Math.round(totalScore / disciplineCount) : 50;
}

/**
 * Calculate basic diversity score (unique-vs-shared trait ratio).
 */
export function calculateBasicDiversityScore(stallion, mare) {
  // Simple diversity calculation based on different traits
  const stallionTraits = stallion.traits || { positive: [], negative: [], hidden: [] };
  const mareTraits = mare.traits || { positive: [], negative: [], hidden: [] };

  const stallionAllTraits = [
    ...stallionTraits.positive,
    ...stallionTraits.negative,
    ...stallionTraits.hidden,
  ];

  const mareAllTraits = [...mareTraits.positive, ...mareTraits.negative, ...mareTraits.hidden];

  const uniqueTraits = new Set([...stallionAllTraits, ...mareAllTraits]);
  const sharedTraits = stallionAllTraits.filter(trait => mareAllTraits.includes(trait));

  const diversityRatio =
    uniqueTraits.size > 0 ? (uniqueTraits.size - sharedTraits.length) / uniqueTraits.size : 0;

  return Math.round(diversityRatio * 100);
}

/**
 * Compose the full genetic-compatibility-score report for a breeding pair.
 *
 * This is the cohesive public entry point the facade
 * (enhancedGeneticProbabilityService.calculateGeneticCompatibilityScore)
 * delegates to. The weighted aggregate (trait 0.3 / stat 0.25 / discipline 0.25
 * / diversity 0.2) and the defensive number coercions are unchanged from the
 * pre-split facade so numeric output is identical.
 */
export function computeGeneticCompatibilityScore(stallion, mare) {
  const traitCompatibility = calculateTraitCompatibility(stallion, mare);
  const statCompatibility = calculateStatCompatibility(stallion.stats || {}, mare.stats || {});
  const disciplineCompatibility = calculateDisciplineCompatibility(stallion, mare);
  const diversityScore = calculateBasicDiversityScore(stallion, mare);

  // Ensure all scores are numbers
  const traitScore = typeof traitCompatibility.score === 'number' ? traitCompatibility.score : 50;
  const statScore =
    typeof statCompatibility.balanceScore === 'number' ? statCompatibility.balanceScore : 50;
  const disciplineScore =
    typeof disciplineCompatibility === 'number' ? disciplineCompatibility : 50;
  const diversityScoreNum = typeof diversityScore === 'number' ? diversityScore : 50;

  const overallScore = Math.round(
    traitScore * 0.3 + statScore * 0.25 + disciplineScore * 0.25 + diversityScoreNum * 0.2,
  );

  return {
    overallScore,
    traitCompatibility,
    statCompatibility: {
      balanceScore: statScore,
      complementaryStats: statCompatibility.complementaryStats || [],
    },
    disciplineCompatibility: disciplineScore,
    diversityScore: diversityScoreNum,
  };
}
