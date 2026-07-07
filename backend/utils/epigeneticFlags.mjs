/**
 * Epigenetic Flag System — reference data (legacy roster + groom personalities)
 *
 * This module exports the legacy EPIGENETIC_FLAGS roster and GROOM_PERSONALITIES
 * reference tables. The permanent-stub care-pattern flag evaluator and its
 * CARE_PATTERN_TRIGGERS table were deleted under Equoria-oey96.32 — the live
 * milestone path (utils/enhancedMilestoneEvaluation.mjs) now reads the horse's
 * canonical flags assigned by the weekly flagEvaluationEngine, and never
 * re-evaluates flags here.
 *
 * NOTE (Equoria-oey96.33 coordination): EPIGENETIC_FLAGS is the STALE roster
 * (includes antisocial/social/sensitive, which the live engine does not). The
 * single source of truth is backend/config/epigeneticFlagDefinitions.mjs; this
 * roster is being reconciled to it under Equoria-oey96.33.
 */

// Epigenetic flag definitions with their triggers and effects
export const EPIGENETIC_FLAGS = {
  // Confidence-related flags
  BRAVE: {
    name: 'brave',
    description: 'Horse shows exceptional courage and confidence',
    triggers: [
      'novelty_exposure_with_support',
      'consistent_desensitization',
      'positive_stress_handling',
    ],
    effects: {
      traitProbability: { Fearless: +0.3, Bold: +0.2, Confident: +0.25 },
      temperamentBonus: { bold: +0.15, calm: +0.1 },
      competitionBonus: { showJumping: +0.05, crossCountry: +0.08 },
    },
    conflictsWith: ['FEARFUL', 'INSECURE'],
  },

  FEARFUL: {
    name: 'fearful',
    description: 'Horse shows heightened fear responses and anxiety',
    triggers: ['neglected_care', 'traumatic_experiences', 'inconsistent_handling'],
    effects: {
      traitProbability: { Nervous: +0.3, Skittish: +0.25, Anxious: +0.2 },
      temperamentPenalty: { bold: -0.2, energetic: -0.15 },
      competitionPenalty: { showJumping: -0.1, crossCountry: -0.15 },
    },
    conflictsWith: ['BRAVE', 'CONFIDENT'],
  },

  CONFIDENT: {
    name: 'confident',
    description: 'Horse displays self-assurance and composure',
    triggers: [
      'consistent_positive_reinforcement',
      'successful_milestone_completion',
      'high_bond_maintenance',
    ],
    effects: {
      traitProbability: { Confident: +0.3, Composed: +0.2, 'Self-Assured': +0.25 },
      temperamentBonus: { calm: +0.1, bold: +0.1 },
      competitionBonus: { dressage: +0.05, conformation: +0.08 },
    },
    conflictsWith: ['INSECURE', 'FEARFUL'],
  },

  INSECURE: {
    name: 'insecure',
    description: 'Horse lacks confidence and seeks constant reassurance',
    triggers: ['inconsistent_care', 'low_bond_scores', 'frequent_groom_changes'],
    effects: {
      traitProbability: { Insecure: +0.3, Dependent: +0.2, Anxious: +0.15 },
      temperamentPenalty: { bold: -0.15, independent: -0.2 },
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
      traitProbability: { Affectionate: +0.35, Bonded: +0.25, Trusting: +0.2 },
      bondingBonus: +0.25, // 25% faster bonding
      temperamentBonus: { gentle: +0.15, calm: +0.1 },
    },
    conflictsWith: ['ANTISOCIAL', 'ALOOF'],
  },

  ANTISOCIAL: {
    name: 'antisocial',
    description: 'Horse prefers isolation and resists social interaction',
    triggers: [
      'minimal_human_contact',
      'negative_social_experiences',
      'isolation_during_critical_periods',
    ],
    effects: {
      traitProbability: { Antisocial: +0.3, Aloof: +0.25, Independent: +0.2 },
      bondingPenalty: -0.3, // 30% slower bonding
      temperamentPenalty: { gentle: -0.2, social: -0.25 },
    },
    conflictsWith: ['AFFECTIONATE', 'SOCIAL'],
  },

  SOCIAL: {
    name: 'social',
    description: 'Horse thrives in social environments and enjoys interaction',
    triggers: ['group_activities', 'positive_peer_interaction', 'varied_handler_exposure'],
    effects: {
      traitProbability: { Social: +0.3, Friendly: +0.25, Outgoing: +0.2 },
      temperamentBonus: { energetic: +0.1, playful: +0.15 },
      groupActivityBonus: +0.1,
    },
    conflictsWith: ['ANTISOCIAL', 'ALOOF'],
  },

  // Resilience-related flags
  RESILIENT: {
    name: 'resilient',
    description: 'Horse adapts well to stress and recovers quickly',
    triggers: [
      'gradual_stress_exposure',
      'consistent_recovery_support',
      'varied_environmental_exposure',
    ],
    effects: {
      traitProbability: { Resilient: +0.3, Hardy: +0.25, Adaptable: +0.2 },
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
      traitProbability: { Sensitive: +0.3, Reactive: +0.25, 'High-Strung': +0.2 },
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
      AFFECTIONATE: +0.2,
      CONFIDENT: +0.15,
      RESILIENT: +0.1,
    },
    traitPenalties: {
      FEARFUL: -0.15,
      INSECURE: -0.1,
    },
    temperamentSynergy: {
      nervous: +0.2,
      sensitive: +0.15,
      gentle: +0.1,
    },
  },

  ENERGETIC: {
    name: 'energetic',
    description: 'Active, enthusiastic, and motivating approach',
    traitBonuses: {
      BRAVE: +0.2,
      SOCIAL: +0.15,
      CONFIDENT: +0.1,
    },
    traitPenalties: {
      SENSITIVE: -0.1,
      FEARFUL: -0.05,
    },
    temperamentSynergy: {
      energetic: +0.2,
      playful: +0.15,
      bold: +0.1,
    },
  },

  PATIENT: {
    name: 'patient',
    description: 'Methodical, consistent, and understanding approach',
    traitBonuses: {
      RESILIENT: +0.2,
      CONFIDENT: +0.15,
      AFFECTIONATE: +0.1,
    },
    traitPenalties: {
      INSECURE: -0.2,
      FEARFUL: -0.15,
    },
    temperamentSynergy: {
      calm: +0.2,
      stubborn: +0.15,
      independent: +0.1,
    },
  },

  FIRM: {
    name: 'firm',
    description: 'Assertive, structured, and disciplined approach',
    traitBonuses: {
      BRAVE: +0.15,
      CONFIDENT: +0.2,
      RESILIENT: +0.1,
    },
    traitPenalties: {
      SENSITIVE: -0.15,
      INSECURE: -0.1,
    },
    temperamentSynergy: {
      bold: +0.2,
      stubborn: +0.1,
      independent: +0.15,
    },
  },

  BALANCED: {
    name: 'balanced',
    description: 'Adaptable approach that adjusts to horse needs',
    traitBonuses: {
      // Moderate bonuses to all positive traits
      CONFIDENT: +0.1,
      AFFECTIONATE: +0.1,
      SOCIAL: +0.1,
      RESILIENT: +0.1,
    },
    traitPenalties: {
      // Moderate penalties to negative traits
      FEARFUL: -0.1,
      INSECURE: -0.1,
      ANTISOCIAL: -0.1,
    },
    temperamentSynergy: {
      // Small bonuses to all temperaments
      calm: +0.05,
      energetic: +0.05,
      gentle: +0.05,
      bold: +0.05,
    },
  },
};
