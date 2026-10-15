/**
 * Developmental Window Definitions
 *
 * Shared constant data for the developmental window system: the critical
 * developmental windows (in days from birth) and the developmental
 * milestones keyed to those windows.
 *
 * Extracted (Equoria-urqic.5) from developmentalWindowSystem.mjs so the
 * window-identification, milestone-tracking, and forecast modules can all
 * depend on a single source of truth without circular imports.
 */

// Critical developmental windows (in days from birth)
export const DEVELOPMENTAL_WINDOWS = {
  imprinting: {
    name: 'imprinting',
    startDay: 0,
    endDay: 3,
    peakDay: 1,
    sensitivity: 1.0,
    description: 'Critical bonding and trust formation period',
    targetTraits: ['trusting', 'bonded', 'secure'],
    riskTraits: ['fearful', 'insecure', 'withdrawn'],
    interventions: ['gentle_handling', 'consistent_presence', 'positive_associations'],
  },
  early_socialization: {
    name: 'early_socialization',
    startDay: 1,
    endDay: 21,
    peakDay: 10,
    sensitivity: 0.9,
    description: 'Primary socialization and environmental adaptation',
    targetTraits: ['social', 'adaptable', 'confident'],
    riskTraits: ['antisocial', 'fearful', 'reactive'],
    interventions: ['varied_experiences', 'multiple_handlers', 'environmental_exposure'],
  },
  fear_period_1: {
    name: 'fear_period_1',
    startDay: 6,
    endDay: 12,
    peakDay: 9,
    sensitivity: 0.8,
    description: 'First fear imprint period - high sensitivity to trauma',
    targetTraits: ['brave', 'resilient', 'calm'],
    riskTraits: ['fearful', 'phobic', 'traumatized'],
    interventions: ['gentle_exposure', 'stress_reduction', 'positive_conditioning'],
  },
  curiosity_development: {
    name: 'curiosity_development',
    startDay: 14,
    endDay: 28,
    peakDay: 21,
    sensitivity: 0.7,
    description: 'Exploration behavior and learning motivation development',
    targetTraits: ['curious', 'intelligent', 'exploratory'],
    riskTraits: ['apathetic', 'withdrawn', 'fearful'],
    interventions: ['enrichment_activities', 'safe_exploration', 'learning_opportunities'],
  },
  fear_period_2: {
    name: 'fear_period_2',
    startDay: 21,
    endDay: 28,
    peakDay: 24,
    sensitivity: 0.8,
    description: 'Second fear imprint period - continued sensitivity',
    targetTraits: ['brave', 'confident', 'stable'],
    riskTraits: ['fearful', 'reactive', 'insecure'],
    interventions: ['gradual_desensitization', 'confidence_building', 'stress_management'],
  },
  social_hierarchy: {
    name: 'social_hierarchy',
    startDay: 30,
    endDay: 60,
    peakDay: 45,
    sensitivity: 0.6,
    description: 'Social structure learning and relationship formation',
    targetTraits: ['social', 'cooperative', 'balanced'],
    riskTraits: ['dominant', 'submissive', 'antisocial'],
    interventions: ['group_interactions', 'boundary_setting', 'social_modeling'],
  },
  independence_development: {
    name: 'independence_development',
    startDay: 60,
    endDay: 120,
    peakDay: 90,
    sensitivity: 0.5,
    description: 'Independence and self-confidence building',
    targetTraits: ['independent', 'confident', 'self_reliant'],
    riskTraits: ['dependent', 'insecure', 'clingy'],
    interventions: ['gradual_independence', 'confidence_challenges', 'self_directed_activities'],
  },
};

// Developmental milestones
export const DEVELOPMENTAL_MILESTONES = {
  basic_trust: { window: 'imprinting', requirement: 'positive_bonding_interactions', score: 10 },
  environmental_comfort: {
    window: 'early_socialization',
    requirement: 'varied_exposure',
    score: 15,
  },
  fear_resilience: { window: 'fear_period_1', requirement: 'stress_management', score: 20 },
  learning_motivation: {
    window: 'curiosity_development',
    requirement: 'exploration_activities',
    score: 25,
  },
  emotional_stability: { window: 'fear_period_2', requirement: 'consistent_care', score: 30 },
  social_competence: { window: 'social_hierarchy', requirement: 'social_interactions', score: 35 },
  self_confidence: {
    window: 'independence_development',
    requirement: 'independence_training',
    score: 40,
  },
};
