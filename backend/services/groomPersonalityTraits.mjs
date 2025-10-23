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
 */

import logger from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';

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
          stressReduction: 0.8,
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
          stressReduction: 0.7,
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
          stressReduction: 0.6,
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
};

/**
 * Get detailed personality traits for a specific groom
 * @param {number} groomId - ID of the groom
 * @returns {Object} Detailed personality traits and characteristics
 */
export async function getGroomPersonalityTraits(groomId) {
  try {
    const groom = await prisma.groom.findUnique({
      where: { id: groomId },
      select: {
        id: true,
        name: true,
        groomPersonality: true,
        experience: true,
        level: true,
        skillLevel: true,
      },
    });

    if (!groom) {
      throw new Error(`Groom not found: ${groomId}`);
    }

    const personalityDef = PERSONALITY_TRAIT_DEFINITIONS[groom.groomPersonality];
    if (!personalityDef) {
      throw new Error(`Unknown personality type: ${groom.groomPersonality}`);
    }

    // Calculate experience level and trait strength
    const experienceLevel = calculateExperienceLevel(groom.experience);
    const traitStrength = calculateTraitStrength(groom.experience, groom.level);

    // Apply experience modifiers to traits
    const enhancedTraits = personalityDef.traits.map(trait => ({
      ...trait,
      strength: traitStrength,
      effects: applyExperienceModifiers(trait.effects, traitStrength),
    }));

    return {
      groomId: groom.id,
      groomName: groom.name,
      primaryPersonality: groom.groomPersonality,
      experienceLevel,
      traitStrength,
      traits: enhancedTraits,
      personalityDescription: personalityDef.description,
    };

  } catch (error) {
    logger.error(`Error getting groom personality traits for groom ${groomId}:`, error);
    throw error;
  }
}

/**
 * Calculate personality-based modifiers for groom-horse interactions
 * @param {number} groomId - ID of the groom
 * @param {number} horseId - ID of the horse
 * @param {string} taskType - Type of task being performed
 * @returns {Object} Calculated modifiers for the interaction
 */
export async function calculatePersonalityModifiers(groomId, horseId, taskType) {
  try {
    const groomTraits = await getGroomPersonalityTraits(groomId);

    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: {
        id: true,
        epigeneticFlags: true,
        stressLevel: true,
        bondScore: true,
      },
    });

    if (!horse) {
      throw new Error(`Horse not found: ${horseId}`);
    }

    // Calculate base modifiers from personality traits
    let bondingModifier = 1.0;
    let stressModifier = 1.0;
    let qualityModifier = 1.0;
    let taskEffectiveness = 1.0;

    // Apply trait effects based on horse characteristics
    groomTraits.traits.forEach(trait => {
      const compatibility = calculateTraitCompatibility(trait, horse.epigeneticFlags);

      if (compatibility > 0) {
        // Apply positive effects with compatibility scaling
        if (trait.effects.bondingModifier) {
          bondingModifier *= 1.0 + ((trait.effects.bondingModifier - 1.0) * compatibility);
        }
        if (trait.effects.stressReduction) {
          stressModifier *= trait.effects.stressReduction;
        }
        if (trait.effects.qualityModifier) {
          qualityModifier *= 1.0 + ((trait.effects.qualityModifier - 1.0) * compatibility);
        }

        // Task-specific bonuses
        if (taskType === 'trust_building' && trait.effects.trustBuilding) {
          taskEffectiveness *= 1.0 + ((trait.effects.trustBuilding - 1.0) * compatibility);
        }
        if (taskType === 'desensitization' && trait.effects.stimulationBonus) {
          taskEffectiveness *= 1.0 + ((trait.effects.stimulationBonus - 1.0) * compatibility);
        }

        // Apply general task effectiveness for all compatible traits
        taskEffectiveness *= 1.0 + (0.1 * compatibility); // Base 10% bonus per compatible trait

        // Apply general bonding bonus for compatible traits that don't have specific bonding modifiers
        if (!trait.effects.bondingModifier && compatibility > 0.2) {
          bondingModifier *= 1.0 + (0.15 * compatibility); // 15% bonding bonus for compatible traits
        }
      } else if (compatibility < 0) {
        // Apply negative effects for incompatible combinations
        bondingModifier *= 0.8; // Reduce bonding effectiveness
        stressModifier *= 1.2; // Increase stress
        taskEffectiveness *= 0.9; // Reduce task effectiveness
      } else {
        // Neutral compatibility - still apply some base trait effects
        if (trait.effects.qualityModifier && trait.effects.qualityModifier > 1.0) {
          qualityModifier *= 1.0 + ((trait.effects.qualityModifier - 1.0) * 0.5); // 50% of effect for neutral
        }
        taskEffectiveness *= 1.05; // Small base bonus for any trait
      }
    });

    // Calculate overall compatibility score
    const compatibilityScore = calculateOverallCompatibility(groomTraits, horse);

    return {
      bondingModifier: Math.max(0.3, bondingModifier),
      stressModifier: Math.max(0.3, Math.min(2.0, stressModifier)),
      qualityModifier: Math.max(0.3, qualityModifier),
      taskEffectiveness: Math.max(0.3, taskEffectiveness),
      compatibilityScore,
      groomPersonality: groomTraits.primaryPersonality,
      horseFlags: horse.epigeneticFlags,
    };

  } catch (error) {
    logger.error('Error calculating personality modifiers:', error);
    throw error;
  }
}

/**
 * Analyze personality compatibility between groom and horse
 * @param {number} groomId - ID of the groom
 * @param {number} horseId - ID of the horse
 * @returns {Object} Detailed compatibility analysis
 */
export async function analyzePersonalityCompatibility(groomId, horseId) {
  try {
    const groomTraits = await getGroomPersonalityTraits(groomId);

    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: {
        id: true,
        name: true,
        epigeneticFlags: true,
        stressLevel: true,
        bondScore: true,
      },
    });

    if (!horse) {
      throw new Error(`Horse not found: ${horseId}`);
    }

    const overallScore = calculateOverallCompatibility(groomTraits, horse);
    const strengths = [];
    const challenges = [];
    const recommendations = [];

    // Analyze each trait for compatibility
    groomTraits.traits.forEach(trait => {
      const compatibility = calculateTraitCompatibility(trait, horse.epigeneticFlags);

      if (compatibility > 0.2) {
        strengths.push(`${trait.name}: ${trait.description} - works well with ${horse.epigeneticFlags.join(', ') || 'neutral temperament'}`);
      } else if (compatibility < -0.1) {
        challenges.push(`${trait.name}: May be too ${trait.name} for ${horse.epigeneticFlags.join(', ') || 'this horse'}`);
      }
    });

    // Generate recommendations based on compatibility
    if (overallScore < 0.4) {
      recommendations.push('Consider using a different groom personality type for this horse');
      recommendations.push('If using this groom, focus on gentle, low-stress interactions');

      if (horse.epigeneticFlags.includes('fearful')) {
        recommendations.push('This horse would benefit from a calm, patient groom');
      }
      if (horse.epigeneticFlags.includes('reactive')) {
        recommendations.push('Avoid energetic or stimulating approaches with this horse');
      }
    } else if (overallScore > 0.7) {
      recommendations.push('Excellent compatibility - this groom is well-suited for this horse');
      recommendations.push('Consider increasing interaction frequency to maximize benefits');
    } else {
      recommendations.push('Moderate compatibility - monitor interactions closely');
      recommendations.push('Adjust approach based on horse\'s daily mood and stress level');
    }

    return {
      groomId,
      horseId,
      groomPersonality: groomTraits.primaryPersonality,
      horseFlags: horse.epigeneticFlags,
      overallScore,
      strengths,
      challenges,
      recommendations,
      compatibilityLevel: getCompatibilityLevel(overallScore),
    };

  } catch (error) {
    logger.error('Error analyzing personality compatibility:', error);
    throw error;
  }
}

/**
 * Update personality traits based on interaction outcomes
 * @param {number} groomId - ID of the groom
 * @returns {Object} Trait update results
 */
export async function updatePersonalityTraits(groomId) {
  try {
    const groom = await prisma.groom.findUnique({
      where: { id: groomId },
      select: {
        id: true,
        experience: true,
        level: true,
        groomPersonality: true,
      },
    });

    if (!groom) {
      throw new Error(`Groom not found: ${groomId}`);
    }

    // Get recent interactions to analyze performance
    const recentInteractions = await prisma.groomInteraction.findMany({
      where: {
        groomId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentInteractions.length === 0) {
      return {
        groomId,
        traitsUpdated: [],
        experienceGained: 0,
        message: 'No recent interactions to base trait updates on',
      };
    }

    // Calculate experience gained from interactions
    const experienceGained = recentInteractions.length * 2; // 2 experience per interaction

    // Analyze interaction quality to determine trait development
    const avgQuality = calculateAverageQuality(recentInteractions);
    const avgBondChange = recentInteractions.reduce((sum, i) => sum + (i.bondingChange || 0), 0) / recentInteractions.length;

    const traitsUpdated = [];

    // Update groom experience
    await prisma.groom.update({
      where: { id: groomId },
      data: {
        experience: groom.experience + experienceGained,
      },
    });

    // Determine trait improvements based on performance
    if (avgQuality >= 3.5 && avgBondChange > 1) {
      traitsUpdated.push('Enhanced trait effectiveness due to excellent performance');
    } else if (avgQuality >= 2.5) {
      traitsUpdated.push('Steady trait development from consistent performance');
    }

    return {
      groomId,
      traitsUpdated,
      experienceGained,
      performanceMetrics: {
        avgQuality,
        avgBondChange,
        interactionCount: recentInteractions.length,
      },
    };

  } catch (error) {
    logger.error(`Error updating personality traits for groom ${groomId}:`, error);
    throw error;
  }
}

/**
 * Get personality trait definitions
 * @returns {Object} Complete personality trait definitions
 */
export async function getPersonalityTraitDefinitions() {
  try {
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

  } catch (error) {
    logger.error('Error getting personality trait definitions:', error);
    throw error;
  }
}

/**
 * Calculate experience level based on experience points
 */
function calculateExperienceLevel(experience) {
  if (experience <= 50) { return 'low'; }
  if (experience <= 100) { return 'medium'; }
  if (experience <= 200) { return 'high'; }
  return 'expert';
}

/**
 * Calculate trait strength based on experience and level
 */
function calculateTraitStrength(experience, level) {
  const experienceComponent = Math.min(experience / 150, 1.0); // Max 1.0 from experience (lowered threshold)
  const levelComponent = Math.min(level / 8, 1.0); // Max 1.0 from level (lowered threshold)
  return Math.min(1.0, (experienceComponent * 0.6 + levelComponent * 0.4) + 0.2); // Base 0.2 + weighted combination
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
        modifiedEffects[key] = 1.0 + ((value - 1.0) * traitStrength);
      } else if (value < 1.0) {
        // Reduction effects - scale with trait strength
        modifiedEffects[key] = 1.0 - ((1.0 - value) * traitStrength);
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
 * Calculate trait compatibility with horse flags
 */
function calculateTraitCompatibility(trait, horseFlags) {
  if (!horseFlags || horseFlags.length === 0) {
    return 0.1; // Neutral compatibility for horses with no flags
  }

  let compatibilityScore = 0;

  // Check compatible flags
  trait.compatibleWith.forEach(compatibleFlag => {
    if (horseFlags.includes(compatibleFlag)) {
      compatibilityScore += 0.3; // Strong positive compatibility
    }
  });

  // Check incompatible flags
  trait.incompatibleWith.forEach(incompatibleFlag => {
    if (horseFlags.includes(incompatibleFlag)) {
      compatibilityScore -= 0.4; // Strong negative compatibility
    }
  });

  return Math.max(-0.5, Math.min(1.0, compatibilityScore));
}

/**
 * Calculate overall compatibility between groom and horse
 */
function calculateOverallCompatibility(groomTraits, horse) {
  if (!horse.epigeneticFlags || horse.epigeneticFlags.length === 0) {
    return 0.6; // Neutral compatibility for horses with no flags
  }

  let totalCompatibility = 0;
  let traitCount = 0;

  groomTraits.traits.forEach(trait => {
    const compatibility = calculateTraitCompatibility(trait, horse.epigeneticFlags);
    totalCompatibility += compatibility * trait.strength; // Weight by trait strength
    traitCount += trait.strength;
  });

  const baseScore = traitCount > 0 ? totalCompatibility / traitCount : 0;

  // Apply stress level modifier (high stress horses need calmer grooms)
  let stressModifier = 1.0;
  if (horse.stressLevel > 7 && groomTraits.primaryPersonality === 'energetic') {
    stressModifier = 0.7; // Penalty for energetic grooms with high-stress horses
  } else if (horse.stressLevel > 7 && groomTraits.primaryPersonality === 'calm') {
    stressModifier = 1.2; // Bonus for calm grooms with high-stress horses
  }

  return Math.max(0, Math.min(1.0, (baseScore + 0.5) * stressModifier));
}

/**
 * Get compatibility level description
 */
function getCompatibilityLevel(score) {
  if (score >= 0.8) { return 'excellent'; }
  if (score >= 0.6) { return 'good'; }
  if (score >= 0.4) { return 'moderate'; }
  if (score >= 0.2) { return 'poor'; }
  return 'very_poor';
}

/**
 * Calculate average quality from interactions
 */
function calculateAverageQuality(interactions) {
  const qualityScores = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const totalScore = interactions.reduce((sum, interaction) => {
    return sum + (qualityScores[interaction.quality] || 2);
  }, 0);
  return totalScore / interactions.length;
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
