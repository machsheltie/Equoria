/**
 * Offspring Performance Prediction — object-based pure calculations
 *
 * Extracted from enhancedGeneticProbabilityService.mjs (Equoria-urqic.4).
 *
 * Owns the per-discipline performance-prediction cluster that backs
 * `predictOffspringPerformance`. All functions are pure: they consume the
 * already-computed `probabilities` (from calculateEnhancedGeneticProbabilities)
 * and `traitInteractions` (from calculateTraitInteractions) objects plus the
 * raw stallion/mare objects, and return plain scoring data. No DB, no logger,
 * no side effects — trivially unit-testable.
 */

/**
 * Predict a single discipline's performance score + confidence.
 */
export function predictDisciplinePerformance(
  stallion,
  mare,
  discipline,
  probabilities,
  traitInteractions,
) {
  let baseScore = 50;
  let confidence = 70;

  // Get relevant stats for discipline
  const disciplineStats = getDisciplineRelevantStats(discipline);
  disciplineStats.forEach(stat => {
    if (probabilities.statProbabilities[stat]) {
      baseScore += (probabilities.statProbabilities[stat].expectedValue - 50) * 0.3;
    }
  });

  // Add trait bonuses
  const relevantTraits = getDisciplineRelevantTraits(discipline);
  Object.entries(probabilities.traitProbabilities).forEach(([_category, traits]) => {
    traits.forEach(trait => {
      if (relevantTraits.includes(trait.trait)) {
        baseScore += (trait.probability / 100) * 10;
        confidence += 5;
      }
    });
  });

  // Add synergy bonuses
  traitInteractions.synergisticPairs.forEach(pair => {
    if (relevantTraits.includes(pair.trait1) || relevantTraits.includes(pair.trait2)) {
      baseScore += pair.synergyBonus * 0.3;
    }
  });

  return {
    predictedScore: Math.min(100, Math.max(0, Math.round(baseScore))),
    confidence: Math.min(100, confidence),
    relevantFactors: disciplineStats.concat(relevantTraits),
  };
}

/**
 * Map a discipline to its most relevant stats.
 */
export function getDisciplineRelevantStats(discipline) {
  const statMap = {
    racing: ['speed', 'stamina', 'agility'],
    dressage: ['precision', 'focus', 'obedience'],
    showJumping: ['agility', 'boldness', 'precision'],
    crossCountry: ['stamina', 'boldness', 'agility'],
    western: ['agility', 'intelligence', 'calm'],
    gaited: ['balance', 'precision', 'intelligence'],
  };

  return statMap[discipline] || ['speed', 'stamina', 'agility'];
}

/**
 * Map a discipline to its most relevant traits.
 */
export function getDisciplineRelevantTraits(discipline) {
  const traitMap = {
    racing: ['athletic', 'fast', 'competitive'],
    dressage: ['intelligent', 'calm', 'focused', 'precise'],
    showJumping: ['athletic', 'bold', 'agile'],
    crossCountry: ['resilient', 'bold', 'athletic'],
    western: ['calm', 'intelligent', 'responsive'],
    gaited: ['balanced', 'smooth', 'natural_gait'],
  };

  return traitMap[discipline] || ['athletic', 'intelligent'];
}

/**
 * Aggregate per-discipline predictions into an overall potential score.
 */
export function calculateOverallPotential(disciplinePredictions, probabilities) {
  const scores = Object.values(disciplinePredictions).map(pred => pred.predictedScore);
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  // Add genetic score bonus
  const geneticBonus = (probabilities.overallGeneticScore - 50) * 0.3;

  return Math.min(100, Math.max(0, Math.round(averageScore + geneticBonus)));
}

/**
 * Identify strength areas from discipline predictions + trait probabilities.
 */
export function identifyStrengthAreas(disciplinePredictions, probabilities) {
  const strengths = [];

  Object.entries(disciplinePredictions).forEach(([discipline, prediction]) => {
    if (prediction.predictedScore > 75) {
      strengths.push({
        area: discipline,
        score: prediction.predictedScore,
        reasoning: `Strong genetic predisposition with ${prediction.confidence}% confidence`,
      });
    }
  });

  // Add trait-based strengths
  Object.entries(probabilities.traitProbabilities).forEach(([category, traits]) => {
    traits.forEach(trait => {
      if (trait.probability > 70 && category === 'positive') {
        strengths.push({
          area: `${trait.trait} trait expression`,
          score: trait.probability,
          reasoning: 'High probability of inheriting positive trait',
        });
      }
    });
  });

  return strengths;
}

/**
 * Identify development areas from discipline predictions + stat probabilities.
 */
export function identifyDevelopmentAreas(disciplinePredictions, probabilities) {
  const developmentAreas = [];

  Object.entries(disciplinePredictions).forEach(([discipline, prediction]) => {
    if (prediction.predictedScore < 60) {
      developmentAreas.push({
        area: discipline,
        score: prediction.predictedScore,
        reasoning: 'Lower genetic predisposition - will require focused training',
      });
    }
  });

  // Add stat-based development areas
  Object.entries(probabilities.statProbabilities).forEach(([stat, data]) => {
    if (data.expectedValue < 60) {
      developmentAreas.push({
        area: `${stat} development`,
        score: data.expectedValue,
        reasoning: 'Below-average genetic potential - focus on training and conditioning',
      });
    }
  });

  return developmentAreas;
}

/**
 * Calculate the overall prediction confidence from available trait/stat data.
 */
export function calculatePredictionConfidence(stallion, mare) {
  let confidence = 70; // Base confidence

  // Higher confidence with more trait data
  const stallionTraits = stallion.traits || { positive: [], negative: [], hidden: [] };
  const mareTraits = mare.traits || { positive: [], negative: [], hidden: [] };

  const totalTraits =
    stallionTraits.positive.length +
    stallionTraits.negative.length +
    stallionTraits.hidden.length +
    mareTraits.positive.length +
    mareTraits.negative.length +
    mareTraits.hidden.length;

  confidence += Math.min(20, totalTraits * 2);

  // Higher confidence with stat data
  const stallionStats = Object.keys(stallion.stats || {}).length;
  const mareStats = Object.keys(mare.stats || {}).length;

  confidence += Math.min(10, stallionStats + mareStats);

  return Math.min(95, confidence);
}

/**
 * Compose the full offspring-performance prediction for a breeding pair.
 *
 * Cohesive public entry point the facade
 * (enhancedGeneticProbabilityService.predictOffspringPerformance) delegates
 * to. The facade still owns the calls to calculateEnhancedGeneticProbabilities
 * + calculateTraitInteractions and passes the results in, so this module has
 * no dependency back on the facade (avoids a circular import).
 */
export function computeOffspringPerformance(stallion, mare, probabilities, traitInteractions) {
  const disciplinePredictions = {};
  const disciplines = ['racing', 'dressage', 'showJumping', 'crossCountry', 'western', 'gaited'];

  disciplines.forEach(discipline => {
    disciplinePredictions[discipline] = predictDisciplinePerformance(
      stallion,
      mare,
      discipline,
      probabilities,
      traitInteractions,
    );
  });

  const overallPotential = calculateOverallPotential(disciplinePredictions, probabilities);
  const strengthAreas = identifyStrengthAreas(disciplinePredictions, probabilities);
  const developmentAreas = identifyDevelopmentAreas(disciplinePredictions, probabilities);

  return {
    disciplinePredictions,
    overallPotential,
    strengthAreas,
    developmentAreas,
    confidenceLevel: calculatePredictionConfidence(stallion, mare),
  };
}
