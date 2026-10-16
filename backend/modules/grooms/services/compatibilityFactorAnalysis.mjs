/**
 * Compatibility factor breakdown (Equoria-q4uem.7 S6): the per-factor analysis
 * of one groom with one horse, pure over the groom's personality traits, the
 * horse's temperament analysis and the horse row. analyzeCompatibilityFactors
 * (dynamicCompatibilityScoring.mjs) loads those and calls it.
 */

import {
  PERSONALITY_MATCH_DEFAULT,
  PERSONALITY_MATCH_MATRIX,
  RISK_FACTOR_RULES,
  STRENGTH_FACTOR_RULES,
  TASK_EFFECTIVENESS_DEFAULT,
  TASK_EFFECTIVENESS_MATRIX,
  ruleTexts,
} from './dynamicCompatibilityRules.mjs';

/**
 * The factor breakdown of one groom with one horse. Pure.
 * @param {object} groomTraits - personalityTraitsFor(groom)
 * @param {object} horseTemperament - the horses module's analyzeHorseTemperament result
 * @param {object} horse - { stressLevel, bondScore, ... }
 * @returns {Object} Detailed compatibility factor analysis
 */
export function factorBreakdown(groomTraits, horseTemperament, horse) {
  const personalityMatch = analyzePersonalityMatch(groomTraits, horseTemperament);
  const experienceLevel = analyzeExperienceLevel(groomTraits);
  const stressCompatibility = analyzeStressCompatibility(groomTraits, horse);
  const bondingPotential = analyzeBondingPotential(groomTraits, horse);
  const taskEffectiveness = analyzeTaskEffectiveness(groomTraits, horseTemperament);
  const riskFactors = identifyRiskFactors(groomTraits, horseTemperament, horse);
  const strengthFactors = identifyStrengthFactors(groomTraits, horseTemperament, horse);

  return {
    personalityMatch,
    experienceLevel,
    stressCompatibility,
    bondingPotential,
    taskEffectiveness,
    riskFactors,
    strengthFactors,
    overallAssessment: calculateOverallAssessment(
      personalityMatch,
      experienceLevel,
      stressCompatibility,
    ),
  };
}

function analyzePersonalityMatch(groomTraits, horseTemperament) {
  const personality = groomTraits.primaryPersonality;
  const temperament = horseTemperament.primaryTemperament;
  const score = PERSONALITY_MATCH_MATRIX[personality]?.[temperament] || PERSONALITY_MATCH_DEFAULT;

  return {
    score,
    epigeneticInfluenceType: personality,
    horseTemperament: temperament,
    matchQuality: score > 0.7 ? 'excellent' : score > 0.5 ? 'good' : score > 0.3 ? 'fair' : 'poor',
  };
}

function analyzeExperienceLevel(groomTraits) {
  const { experienceLevel } = groomTraits;
  const { traitStrength } = groomTraits;

  return {
    level: experienceLevel,
    traitStrength,
    effectivenessMultiplier: traitStrength,
    description: `${experienceLevel} experience level with ${Math.round(traitStrength * 100)}% trait strength`,
  };
}

function analyzeStressCompatibility(groomTraits, horse) {
  const personality = groomTraits.primaryPersonality;
  const { stressLevel } = horse;

  let score = 0.5;
  if (personality === 'calm' && stressLevel > 6) {
    score = 0.9;
  } else if (personality === 'energetic' && stressLevel > 7) {
    score = 0.2;
  } else if (personality === 'methodical') {
    score = 0.7;
  }

  return {
    score,
    horseStressLevel: stressLevel,
    epigeneticInfluenceType: personality,
    recommendation: score > 0.7 ? 'excellent_match' : score > 0.5 ? 'good_match' : 'poor_match',
  };
}

function analyzeBondingPotential(groomTraits, horse) {
  const currentBond = horse.bondScore;
  const personality = groomTraits.primaryPersonality;

  let potential = 0.5;
  if (personality === 'calm' && currentBond < 20) {
    potential = 0.8;
  } else if (personality === 'energetic' && currentBond > 25) {
    potential = 0.7;
  } else if (personality === 'methodical') {
    potential = 0.6;
  }

  return {
    potential,
    currentBondScore: currentBond,
    projectedImprovement: potential > 0.7 ? 'high' : potential > 0.5 ? 'moderate' : 'low',
  };
}

function analyzeTaskEffectiveness(groomTraits, horseTemperament) {
  const personality = groomTraits.primaryPersonality;
  const temperament = horseTemperament.primaryTemperament;
  const score =
    TASK_EFFECTIVENESS_MATRIX[personality]?.[temperament] ||
    TASK_EFFECTIVENESS_MATRIX[personality]?.all ||
    TASK_EFFECTIVENESS_DEFAULT;

  return {
    score,
    effectiveness: score > 0.8 ? 'high' : score > 0.6 ? 'moderate' : 'low',
    specializations: groomTraits.traits.map(t => t.name),
  };
}

function factorFacts(groomTraits, horseTemperament, horse) {
  return {
    personality: groomTraits.primaryPersonality,
    temperament: horseTemperament.primaryTemperament,
    stressLevel: horse.stressLevel,
    bondScore: horse.bondScore,
    experienceLevel: groomTraits.experienceLevel,
  };
}

function identifyRiskFactors(groomTraits, horseTemperament, horse) {
  return ruleTexts(RISK_FACTOR_RULES, factorFacts(groomTraits, horseTemperament, horse));
}

function identifyStrengthFactors(groomTraits, horseTemperament, horse) {
  return ruleTexts(STRENGTH_FACTOR_RULES, factorFacts(groomTraits, horseTemperament, horse));
}

function calculateOverallAssessment(personalityMatch, experienceLevel, stressCompatibility) {
  const avgScore =
    (personalityMatch.score + experienceLevel.traitStrength + stressCompatibility.score) / 3;

  return {
    score: avgScore,
    rating:
      avgScore > 0.8 ? 'excellent' : avgScore > 0.6 ? 'good' : avgScore > 0.4 ? 'fair' : 'poor',
    confidence: avgScore > 0.7 ? 'high' : avgScore > 0.5 ? 'moderate' : 'low',
  };
}
