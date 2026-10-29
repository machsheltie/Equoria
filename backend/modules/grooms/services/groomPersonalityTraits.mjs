/**
 * Groom Personality Traits Service
 *
 * Implements detailed personality traits for grooms with specific interaction modifiers.
 * Handles personality-based compatibility analysis and trait development over time.
 *
 * Business Rules:
 * - Each personality type has specific traits with defined effects
 * - Experience level influences trait strength and expression
 * - Personality traits affect interaction outcomes with different horse types
 * - Traits can develop and strengthen over time based on experience
 * - Compatibility scoring between groom personalities and horse temperaments
 *
 * Owner ruling 2026-10-29 (q300, Equoria-efs4j): the old epigeneticFlags store is
 * gone. Compatibility used to compare each trait's compatibleWith/incompatibleWith
 * lists with the horse's flags; every real horse had none, so every trait scored
 * the no-flag neutral value and every groom the no-flag overall value. Those two
 * values are now the constants below, so real horses score exactly as before.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { staffCareerLevel } from '../../../constants/staffLevels.mjs';

// The values a horse with no flags always received (Equoria-efs4j).
const neutralTraitCompatibility = 0.1;
const neutralOverallCompatibility = 0.6;

// Personality trait definitions
const PERSONALITY_TRAIT_DEFINITIONS = {
  calm: {
    name: 'Calm',
    description: 'Steady, patient, and reassuring approach to horse care',
    traits: [
      {
        name: 'patient',
        description: 'Maintains composure and takes time with difficult horses',
        effects: {
          bondingModifier: 1.3,
          qualityBonus: 1.2,
        },
        compatibleWith: ['fearful', 'insecure', 'reactive'],
        incompatibleWith: [],
      },
      {
        name: 'gentle',
        description: 'Uses soft, non-threatening movements and voice',
        effects: {
          bondingModifier: 1.2,
          trustBuilding: 1.4,
        },
        compatibleWith: ['fearful', 'fragile', 'insecure'],
        incompatibleWith: [],
      },
      {
        name: 'consistent',
        description: 'Provides predictable, reliable care routines',
        effects: {
          qualityModifier: 1.3,
          routineBonus: 1.5,
          trustBuilding: 1.2,
        },
        compatibleWith: ['insecure', 'anxious'],
        incompatibleWith: [],
      },
      {
        name: 'reassuring',
        description: 'Provides comfort and confidence to nervous horses',
        effects: {
          confidenceBuilding: 1.4,
          bondingModifier: 1.1,
        },
        compatibleWith: ['fearful', 'insecure', 'nervous'],
        incompatibleWith: [],
      },
    ],
  },
  energetic: {
    name: 'Energetic',
    description: 'Dynamic, enthusiastic, and stimulating approach to horse care',
    traits: [
      {
        name: 'enthusiastic',
        description: 'Brings high energy and excitement to interactions',
        effects: {
          stimulationBonus: 1.4,
          engagementModifier: 1.3,
          curiosityBonus: 1.2,
        },
        compatibleWith: ['brave', 'confident', 'curious'],
        incompatibleWith: ['fearful', 'fragile'],
      },
      {
        name: 'dynamic',
        description: 'Adapts quickly and uses varied approaches',
        effects: {
          adaptabilityBonus: 1.3,
          varietyBonus: 1.2,
          learningModifier: 1.1,
        },
        compatibleWith: ['curious', 'intelligent', 'brave'],
        incompatibleWith: ['routine-dependent'],
      },
      {
        name: 'stimulating',
        description: 'Provides mental and physical challenges',
        effects: {
          developmentBonus: 1.3,
          challengeModifier: 1.4,
          growthAcceleration: 1.2,
        },
        compatibleWith: ['confident', 'brave', 'curious'],
        incompatibleWith: ['fearful', 'insecure', 'fragile'],
      },
      {
        name: 'motivating',
        description: 'Encourages horses to try new things and overcome fears',
        effects: {
          confidenceBuilding: 1.2,
          courageBonus: 1.3,
          progressModifier: 1.1,
        },
        compatibleWith: ['developing', 'potential'],
        incompatibleWith: ['severely-traumatized'],
      },
    ],
  },
  methodical: {
    name: 'Methodical',
    description: 'Systematic, thorough, and precise approach to horse care',
    traits: [
      {
        name: 'systematic',
        description: 'Follows structured, logical approaches to training',
        effects: {
          qualityModifier: 1.4,
          consistencyBonus: 1.3,
          progressTracking: 1.5,
        },
        compatibleWith: ['learning', 'developing', 'structured'],
        incompatibleWith: [],
      },
      {
        name: 'thorough',
        description: 'Pays attention to details and completes tasks fully',
        effects: {
          qualityModifier: 1.3,
          completionBonus: 1.4,
          skillDevelopment: 1.2,
        },
        compatibleWith: ['perfectionist', 'detail-oriented'],
        incompatibleWith: ['impatient'],
      },
      {
        name: 'precise',
        description: 'Executes tasks with accuracy and attention to detail',
        effects: {
          technicalSkillBonus: 1.4,
          qualityModifier: 1.2,
          errorReduction: 0.7,
        },
        compatibleWith: ['technical-tasks', 'skill-building'],
        incompatibleWith: ['rushed-situations'],
      },
      {
        name: 'analytical',
        description: 'Observes and analyzes horse behavior patterns',
        effects: {
          assessmentAccuracy: 1.3,
          problemSolving: 1.4,
          adaptationSpeed: 1.2,
        },
        compatibleWith: ['complex-cases', 'behavioral-issues'],
        incompatibleWith: ['simple-routine-tasks'],
      },
    ],
  },
  balanced: {
    name: 'Balanced',
    description: 'Well-rounded, adaptable approach combining multiple care styles',
    traits: [
      {
        name: 'adaptable',
        description: 'Adjusts approach based on horse needs and situations',
        effects: {
          bondingModifier: 1.15,
          qualityModifier: 1.15,
          adaptabilityBonus: 1.2,
        },
        compatibleWith: ['all-types'],
        incompatibleWith: [],
      },
      {
        name: 'versatile',
        description: 'Competent across various care activities and horse types',
        effects: {
          skillRange: 1.2,
          consistencyBonus: 1.1,
          learningModifier: 1.1,
        },
        compatibleWith: ['mixed-temperaments'],
        incompatibleWith: [],
      },
      {
        name: 'moderate',
        description: 'Provides steady, reliable care without extremes',
        effects: {
          trustBuilding: 1.1,
          reliabilityBonus: 1.2,
        },
        compatibleWith: ['stable', 'developing'],
        incompatibleWith: ['crisis-situations'],
      },
      {
        name: 'composed',
        description: 'Maintains calm professionalism in varied situations',
        effects: {
          emotionalStability: 1.2,
          confidenceBuilding: 1.1,
        },
        compatibleWith: ['all-ages', 'varied-temperaments'],
        incompatibleWith: [],
      },
    ],
  },
};

/** Read a groom and return its personality traits (personalityTraitsFor). */
export async function getGroomPersonalityTraits(groomId) {
  const groom = await prisma.groom.findUnique({
    where: { id: groomId },
    select: {
      id: true,
      name: true,
      epigeneticInfluenceType: true,
      experience: true,
    },
  });

  if (!groom) {
    throw new Error(`Groom not found: ${groomId}`);
  }

  return personalityTraitsFor(groom);
}

/** A groom row's personality traits, scaled by experience; throws for an unknown type. Pure. */
export function personalityTraitsFor(groom) {
  const personalityDef = PERSONALITY_TRAIT_DEFINITIONS[groom.epigeneticInfluenceType];
  if (!personalityDef) {
    throw new Error(`Unknown personality type: ${groom.epigeneticInfluenceType}`);
  }

  const experienceLevel = calculateExperienceLevel(groom.experience);
  // Owner rulings 2026-10-28: the old 1-10 level is gone (q229) and stars give no bonus
  // for now (q244), so the level term is staffCareerLevel (old level 1) for every groom.
  const traitStrength = calculateTraitStrength(groom.experience, staffCareerLevel);

  const enhancedTraits = personalityDef.traits.map(trait => ({
    ...trait,
    strength: traitStrength,
    effects: applyExperienceModifiers(trait.effects, traitStrength),
  }));

  return {
    groomId: groom.id,
    groomName: groom.name,
    primaryPersonality: groom.epigeneticInfluenceType,
    experienceLevel,
    traitStrength,
    traits: enhancedTraits,
    personalityDescription: personalityDef.description,
  };
}

/**
 * Calculate personality-based modifiers for groom-horse interactions
 * @param {number} groomId - ID of the groom
 * @param {number} horseId - ID of the horse
 * @param {string} taskType - Type of task being performed
 * @returns {Object} Calculated modifiers for the interaction
 */
export async function calculatePersonalityModifiers(groomId, horseId, taskType) {
  const groomTraits = await getGroomPersonalityTraits(groomId);

  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: { id: true },
  });

  if (!horse) {
    throw new Error(`Horse not found: ${horseId}`);
  }

  // Calculate base modifiers from personality traits
  let bondingModifier = 1.0;
  let qualityModifier = 1.0;
  let taskEffectiveness = 1.0;

  // Every trait has the neutral compatibility (no flag store, Equoria-efs4j). It is
  // positive and below the 0.2 general-bonding threshold, so only these effects apply.
  const compatibility = neutralTraitCompatibility;
  groomTraits.traits.forEach(trait => {
    if (trait.effects.bondingModifier) {
      bondingModifier *= 1.0 + (trait.effects.bondingModifier - 1.0) * compatibility;
    }
    if (trait.effects.qualityModifier) {
      qualityModifier *= 1.0 + (trait.effects.qualityModifier - 1.0) * compatibility;
    }

    // Task-specific bonuses
    if (taskType === 'trustBuilding' && trait.effects.trustBuilding) {
      taskEffectiveness *= 1.0 + (trait.effects.trustBuilding - 1.0) * compatibility;
    }
    if (taskType === 'desensitization' && trait.effects.stimulationBonus) {
      taskEffectiveness *= 1.0 + (trait.effects.stimulationBonus - 1.0) * compatibility;
    }

    // General task effectiveness for every trait
    taskEffectiveness *= 1.0 + 0.1 * compatibility; // Base 10% bonus per trait
  });

  // Calculate overall compatibility score
  const compatibilityScore = calculateOverallCompatibility(groomTraits, horse);

  return {
    bondingModifier: Math.max(0.3, bondingModifier),
    qualityModifier: Math.max(0.3, qualityModifier),
    taskEffectiveness: Math.max(0.3, taskEffectiveness),
    compatibilityScore,
    epigeneticInfluenceType: groomTraits.primaryPersonality,
  };
}

/**
 * Analyze personality compatibility between groom and horse
 * @param {number} groomId - ID of the groom
 * @param {number} horseId - ID of the horse
 * @returns {Object} Detailed compatibility analysis
 */
export async function analyzePersonalityCompatibility(groomId, horseId) {
  const groomTraits = await getGroomPersonalityTraits(groomId);

  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: { id: true },
  });

  if (!horse) {
    throw new Error(`Horse not found: ${horseId}`);
  }

  const overallScore = calculateOverallCompatibility(groomTraits, horse);
  // Strengths and challenges named the horse's flags; with the neutral trait
  // compatibility (Equoria-efs4j) no trait ever reached either list.
  const strengths = [];
  const challenges = [];
  const recommendations = [];

  // Generate recommendations based on compatibility
  if (overallScore < 0.4) {
    recommendations.push('Consider using a different groom personality type for this horse');
    recommendations.push('If using this groom, focus on gentle interactions');
  } else if (overallScore > 0.7) {
    recommendations.push('Excellent compatibility - this groom is well-suited for this horse');
    recommendations.push('Consider increasing interaction frequency to maximize benefits');
  } else {
    recommendations.push('Moderate compatibility - monitor interactions closely');
    recommendations.push("Adjust approach based on horse's daily mood");
  }

  return {
    groomId,
    horseId,
    epigeneticInfluenceType: groomTraits.primaryPersonality,
    overallScore,
    strengths,
    challenges,
    recommendations,
    compatibilityLevel: getCompatibilityLevel(overallScore),
  };
}

/**
 * Get personality trait definitions
 * @returns {Object} Complete personality trait definitions
 */
export async function getPersonalityTraitDefinitions() {
  return {
    personalities: PERSONALITY_TRAIT_DEFINITIONS,
    compatibilityMatrix: generateCompatibilityMatrix(),
    experienceLevels: {
      low: { min: 0, max: 50, description: 'Developing traits, basic effectiveness' },
      medium: { min: 51, max: 100, description: 'Established traits, good effectiveness' },
      high: { min: 101, max: 200, description: 'Strong traits, excellent effectiveness' },
      expert: { min: 201, max: 999, description: 'Mastered traits, exceptional effectiveness' },
    },
  };
}

/**
 * Calculate experience level based on experience points
 */
function calculateExperienceLevel(experience) {
  if (experience <= 50) {
    return 'low';
  }
  if (experience <= 100) {
    return 'medium';
  }
  if (experience <= 200) {
    return 'high';
  }
  return 'expert';
}

/**
 * Calculate trait strength based on experience and level
 */
function calculateTraitStrength(experience, level) {
  const experienceComponent = Math.min(experience / 150, 1.0); // Max 1.0 from experience (lowered threshold)
  const levelComponent = Math.min(level / 8, 1.0); // Max 1.0 from level (lowered threshold)
  return Math.min(1.0, experienceComponent * 0.6 + levelComponent * 0.4 + 0.2); // Base 0.2 + weighted combination
}

/**
 * Apply experience modifiers to trait effects
 */
function applyExperienceModifiers(effects, traitStrength) {
  const modifiedEffects = {};

  Object.entries(effects).forEach(([key, value]) => {
    if (typeof value === 'number') {
      // Apply trait strength to numeric effects
      if (value > 1.0) {
        // Bonus effects - scale with trait strength
        modifiedEffects[key] = 1.0 + (value - 1.0) * traitStrength;
      } else if (value < 1.0) {
        // Reduction effects - scale with trait strength
        modifiedEffects[key] = 1.0 - (1.0 - value) * traitStrength;
      } else {
        modifiedEffects[key] = value;
      }
    } else {
      modifiedEffects[key] = value;
    }
  });

  return modifiedEffects;
}

/**
 * Overall compatibility between a groom and a horse: the no-flag neutral value
 * for every pair since the flag store was removed (Equoria-efs4j).
 * @param {Object} _groomTraits - personalityTraitsFor(groom)
 * @param {Object} _horse - the horse row
 * @returns {number}
 */
export function calculateOverallCompatibility(_groomTraits, _horse) {
  return neutralOverallCompatibility;
}

/**
 * Get compatibility level description
 */
function getCompatibilityLevel(score) {
  if (score >= 0.8) {
    return 'excellent';
  }
  if (score >= 0.6) {
    return 'good';
  }
  if (score >= 0.4) {
    return 'moderate';
  }
  if (score >= 0.2) {
    return 'poor';
  }
  return 'very_poor';
}

/**
 * Generate compatibility matrix for all personality combinations
 */
function generateCompatibilityMatrix() {
  return {
    calm: {
      strengths: ['fearful', 'insecure', 'reactive', 'fragile'],
      neutral: ['confident', 'brave', 'social'],
      challenges: [],
    },
    energetic: {
      strengths: ['brave', 'confident', 'curious', 'social'],
      neutral: [],
      challenges: ['fearful', 'insecure', 'fragile', 'reactive'],
    },
    methodical: {
      strengths: ['developing', 'learning', 'structured'],
      neutral: ['confident', 'brave', 'social', 'calm'],
      challenges: ['impatient', 'chaotic'],
    },
  };
}
