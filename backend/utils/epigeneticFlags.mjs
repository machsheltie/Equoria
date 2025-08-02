/**
 * Epigenetic Flag System for Advanced Trait Development
 *
 * This module defines epigenetic flags that can be applied to horses under 3 years old
 * based on groom care patterns, environmental factors, and developmental milestones.
 * These flags influence long-term temperament and future trait probability.
 */

// Epigenetic flag definitions with their triggers and effects
export const EPIGENETIC_FLAGS = {
  // Confidence-related flags
  BRAVE: {
    name: 'brave',
    description: 'Horse shows exceptional courage and confidence',
    triggers: ['novelty_exposure_with_support', 'consistent_desensitization', 'positive_stress_handling'],
    effects: {
      traitProbability: { 'Fearless': +0.3, 'Bold': +0.2, 'Confident': +0.25 },
      temperamentBonus: { 'bold': +0.15, 'calm': +0.1 },
      competitionBonus: { 'showJumping': +0.05, 'crossCountry': +0.08 },
    },
    conflictsWith: ['FEARFUL', 'INSECURE'],
  },

  FEARFUL: {
    name: 'fearful',
    description: 'Horse shows heightened fear responses and anxiety',
    triggers: ['neglected_care', 'traumatic_experiences', 'inconsistent_handling'],
    effects: {
      traitProbability: { 'Nervous': +0.3, 'Skittish': +0.25, 'Anxious': +0.2 },
      temperamentPenalty: { 'bold': -0.2, 'energetic': -0.15 },
      competitionPenalty: { 'showJumping': -0.1, 'crossCountry': -0.15 },
    },
    conflictsWith: ['BRAVE', 'CONFIDENT'],
  },

  CONFIDENT: {
    name: 'confident',
    description: 'Horse displays self-assurance and composure',
    triggers: ['consistent_positive_reinforcement', 'successful_milestone_completion', 'high_bond_maintenance'],
    effects: {
      traitProbability: { 'Confident': +0.3, 'Composed': +0.2, 'Self-Assured': +0.25 },
      temperamentBonus: { 'calm': +0.1, 'bold': +0.1 },
      competitionBonus: { 'dressage': +0.05, 'conformation': +0.08 },
    },
    conflictsWith: ['INSECURE', 'FEARFUL'],
  },

  INSECURE: {
    name: 'insecure',
    description: 'Horse lacks confidence and seeks constant reassurance',
    triggers: ['inconsistent_care', 'low_bond_scores', 'frequent_groom_changes'],
    effects: {
      traitProbability: { 'Insecure': +0.3, 'Dependent': +0.2, 'Anxious': +0.15 },
      temperamentPenalty: { 'bold': -0.15, 'independent': -0.2 },
      bondingRequirement: +0.2, // Needs 20% more bonding for same effects
    },
    conflictsWith: ['CONFIDENT', 'BRAVE'],
  },

  // Social-related flags
  AFFECTIONATE: {
    name: 'affectionate',
    description: 'Horse forms strong emotional bonds with handlers',
    triggers: ['daily_grooming_routine', 'consistent_gentle_handling', 'high_quality_interactions'],
    effects: {
      traitProbability: { 'Affectionate': +0.35, 'Bonded': +0.25, 'Trusting': +0.2 },
      bondingBonus: +0.25, // 25% faster bonding
      temperamentBonus: { 'gentle': +0.15, 'calm': +0.1 },
    },
    conflictsWith: ['ANTISOCIAL', 'ALOOF'],
  },

  ANTISOCIAL: {
    name: 'antisocial',
    description: 'Horse prefers isolation and resists social interaction',
    triggers: ['minimal_human_contact', 'negative_social_experiences', 'isolation_during_critical_periods'],
    effects: {
      traitProbability: { 'Antisocial': +0.3, 'Aloof': +0.25, 'Independent': +0.2 },
      bondingPenalty: -0.3, // 30% slower bonding
      temperamentPenalty: { 'gentle': -0.2, 'social': -0.25 },
    },
    conflictsWith: ['AFFECTIONATE', 'SOCIAL'],
  },

  SOCIAL: {
    name: 'social',
    description: 'Horse thrives in social environments and enjoys interaction',
    triggers: ['group_activities', 'positive_peer_interaction', 'varied_handler_exposure'],
    effects: {
      traitProbability: { 'Social': +0.3, 'Friendly': +0.25, 'Outgoing': +0.2 },
      temperamentBonus: { 'energetic': +0.1, 'playful': +0.15 },
      groupActivityBonus: +0.1,
    },
    conflictsWith: ['ANTISOCIAL', 'ALOOF'],
  },

  // Resilience-related flags
  RESILIENT: {
    name: 'resilient',
    description: 'Horse adapts well to stress and recovers quickly',
    triggers: ['gradual_stress_exposure', 'consistent_recovery_support', 'varied_environmental_exposure'],
    effects: {
      traitProbability: { 'Resilient': +0.3, 'Hardy': +0.25, 'Adaptable': +0.2 },
      stressRecovery: +0.3, // 30% faster stress recovery
      healthBonus: +0.1,
    },
    conflictsWith: ['FRAGILE', 'SENSITIVE'],
  },

  SENSITIVE: {
    name: 'sensitive',
    description: 'Horse is highly responsive to environmental changes',
    triggers: ['overstimulation', 'inconsistent_environment', 'high_stress_exposure'],
    effects: {
      traitProbability: { 'Sensitive': +0.3, 'Reactive': +0.25, 'High-Strung': +0.2 },
      stressAccumulation: +0.2, // 20% faster stress accumulation
      environmentalSensitivity: +0.25,
    },
    conflictsWith: ['RESILIENT', 'HARDY'],
  },
};

// Groom personality types and their trait development bonuses
export const GROOM_PERSONALITIES = {
  GENTLE: {
    name: 'gentle',
    description: 'Calm, patient, and nurturing approach',
    traitBonuses: {
      'AFFECTIONATE': +0.2,
      'CONFIDENT': +0.15,
      'RESILIENT': +0.1,
    },
    traitPenalties: {
      'FEARFUL': -0.15,
      'INSECURE': -0.1,
    },
    temperamentSynergy: {
      'nervous': +0.2,
      'sensitive': +0.15,
      'gentle': +0.1,
    },
  },

  ENERGETIC: {
    name: 'energetic',
    description: 'Active, enthusiastic, and motivating approach',
    traitBonuses: {
      'BRAVE': +0.2,
      'SOCIAL': +0.15,
      'CONFIDENT': +0.1,
    },
    traitPenalties: {
      'SENSITIVE': -0.1,
      'FEARFUL': -0.05,
    },
    temperamentSynergy: {
      'energetic': +0.2,
      'playful': +0.15,
      'bold': +0.1,
    },
  },

  PATIENT: {
    name: 'patient',
    description: 'Methodical, consistent, and understanding approach',
    traitBonuses: {
      'RESILIENT': +0.2,
      'CONFIDENT': +0.15,
      'AFFECTIONATE': +0.1,
    },
    traitPenalties: {
      'INSECURE': -0.2,
      'FEARFUL': -0.15,
    },
    temperamentSynergy: {
      'calm': +0.2,
      'stubborn': +0.15,
      'independent': +0.1,
    },
  },

  FIRM: {
    name: 'firm',
    description: 'Assertive, structured, and disciplined approach',
    traitBonuses: {
      'BRAVE': +0.15,
      'CONFIDENT': +0.2,
      'RESILIENT': +0.1,
    },
    traitPenalties: {
      'SENSITIVE': -0.15,
      'INSECURE': -0.1,
    },
    temperamentSynergy: {
      'bold': +0.2,
      'stubborn': +0.1,
      'independent': +0.15,
    },
  },

  BALANCED: {
    name: 'balanced',
    description: 'Adaptable approach that adjusts to horse needs',
    traitBonuses: {
      // Moderate bonuses to all positive traits
      'CONFIDENT': +0.1,
      'AFFECTIONATE': +0.1,
      'SOCIAL': +0.1,
      'RESILIENT': +0.1,
    },
    traitPenalties: {
      // Moderate penalties to negative traits
      'FEARFUL': -0.1,
      'INSECURE': -0.1,
      'ANTISOCIAL': -0.1,
    },
    temperamentSynergy: {
      // Small bonuses to all temperaments
      'calm': +0.05,
      'energetic': +0.05,
      'gentle': +0.05,
      'bold': +0.05,
    },
  },
};

// Care pattern triggers that lead to epigenetic flags
export const CARE_PATTERN_TRIGGERS = {
  // Positive patterns
  CONSISTENT_DAILY_CARE: {
    pattern: 'daily_grooming_for_7_days',
    flags: ['AFFECTIONATE', 'CONFIDENT'],
    minimumBondScore: 15,
  },

  NOVELTY_WITH_SUPPORT: {
    pattern: 'new_experiences_with_high_bond',
    flags: ['BRAVE', 'CONFIDENT'],
    minimumBondScore: 20,
    requiredInteractions: ['desensitization', 'exploration', 'positive_reinforcement'],
  },

  SOCIAL_ENRICHMENT: {
    pattern: 'group_activities_and_varied_handlers',
    flags: ['SOCIAL', 'CONFIDENT'],
    minimumInteractions: 5,
    requiredVariety: 3, // Different types of interactions
  },

  // Negative patterns
  NEGLECT_PATTERN: {
    pattern: 'missed_care_sessions',
    flags: ['FEARFUL', 'INSECURE'],
    missedSessionThreshold: 3,
    bondScoreThreshold: 10, // Below this triggers negative flags
  },

  INCONSISTENT_HANDLING: {
    pattern: 'frequent_groom_changes',
    flags: ['INSECURE', 'ANTISOCIAL'],
    groomChangeThreshold: 3,
    timeWindow: 14, // Days
  },

  OVERSTIMULATION: {
    pattern: 'excessive_stress_without_recovery',
    flags: ['SENSITIVE', 'FEARFUL'],
    stressThreshold: 8,
    recoveryTimeRequired: 2, // Days
  },
};

/**
 * Evaluates care patterns and determines which epigenetic flags should be applied
 * @param {Object} careHistory - Historical care data for the horse
 * @param {Object} groomData - Information about the assigned groom
 * @param {Object} horseData - Current horse data including age, bond scores, etc.
 * @returns {Array} Array of epigenetic flags to apply
 */
export function evaluateEpigeneticFlags(careHistory, groomData, horseData) {
  const flagsToApply = [];
  const ageInDays = Math.floor((Date.now() - new Date(horseData.dateOfBirth)) / (1000 * 60 * 60 * 24));

  // Only apply epigenetic flags to horses under 3 years (1095 days)
  if (ageInDays >= 1095) {
    return flagsToApply;
  }

  // Evaluate each care pattern trigger
  for (const [triggerName, trigger] of Object.entries(CARE_PATTERN_TRIGGERS)) {
    if (evaluateTriggerPattern(trigger, careHistory, groomData, horseData)) {
      flagsToApply.push(...trigger.flags);
    }
  }

  // Remove conflicting flags (keep the first one encountered)
  const resolvedFlags = resolveConflictingFlags(flagsToApply);

  return resolvedFlags;
}

/**
 * Resolves conflicting epigenetic flags by keeping the first encountered
 * @param {Array} flags - Array of flag names to resolve
 * @returns {Array} Array of resolved flag names
 */
function resolveConflictingFlags(flags) {
  const resolved = [];
  const conflicts = new Set();

  for (const flagName of flags) {
    const flag = EPIGENETIC_FLAGS[flagName];
    if (!flag) { continue; }

    // Check if this flag conflicts with any already resolved flags
    const hasConflict = flag.conflictsWith?.some(conflict =>
      resolved.some(resolvedFlag => resolvedFlag === conflict),
    );

    if (!hasConflict && !conflicts.has(flagName)) {
      resolved.push(flagName);
      // Add this flag's conflicts to the conflicts set
      flag.conflictsWith?.forEach(conflict => conflicts.add(conflict));
    }
  }

  return resolved;
}

/**
 * Evaluates if a specific trigger pattern is met
 * @param {Object} trigger - The trigger pattern to evaluate
 * @param {Object} careHistory - Historical care data
 * @param {Object} groomData - Groom information
 * @param {Object} horseData - Horse information
 * @returns {boolean} Whether the trigger pattern is met
 */
function evaluateTriggerPattern(trigger, careHistory, groomData, horseData) {
  // Implementation would depend on the specific trigger pattern
  // This is a simplified version - full implementation would analyze:
  // - Interaction frequency and consistency
  // - Bond score trends
  // - Groom changes and timing
  // - Stress levels and recovery patterns

  switch (trigger.pattern) {
    case 'daily_grooming_for_7_days':
      return evaluateDailyGroomingPattern(careHistory, trigger.minimumBondScore);

    case 'new_experiences_with_high_bond':
      return evaluateNoveltyPattern(careHistory, trigger.minimumBondScore, trigger.requiredInteractions);

    case 'missed_care_sessions':
      return evaluateNeglectPattern(careHistory, trigger.missedSessionThreshold, trigger.bondScoreThreshold);

    default:
      return false;
  }
}

/**
 * Evaluates daily grooming pattern
 */
function evaluateDailyGroomingPattern(careHistory, minimumBondScore) {
  // Check for 7 consecutive days of grooming with adequate bond scores
  // Implementation would analyze recent interaction history
  return false; // Placeholder
}

/**
 * Evaluates novelty exposure pattern
 */
function evaluateNoveltyPattern(careHistory, minimumBondScore, requiredInteractions) {
  // Check for new experiences combined with high bond scores
  // Implementation would analyze interaction types and bond trends
  return false; // Placeholder
}

/**
 * Evaluates neglect pattern
 */
function evaluateNeglectPattern(careHistory, missedThreshold, bondThreshold) {
  // Check for missed sessions and low bond scores
  // Implementation would analyze gaps in care and bond score trends
  return false; // Placeholder
}
