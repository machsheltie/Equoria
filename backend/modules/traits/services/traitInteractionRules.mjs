/**
 * Trait interaction rules (Equoria-q4uem.5).
 *
 * The game data behind trait interaction analysis: which traits reinforce or
 * oppose each other, how dominant each trait is, which combinations produce
 * emergent properties, and when interactions mature. Pure data, read only by
 * traitInteractionMatrix.mjs. Changing a value here changes game mechanics.
 */

// Equoria-rjs2n: trait interactions reach full expression at this many
// game-days; the analysis declares 'mature_expression' from this age. The
// temporal maturityFactor ramp normalizes over the same period so it reaches
// 1.0 exactly when the horse is declared mature. (The old calendar /365
// denominator meant no horse ever approached 1.0 before retirement.)
export const MATURITY_PERIOD_DAYS = 90;

// Trait synergy clusters - traits that enhance each other
export const TRAIT_SYNERGIES = {
  confidence_cluster: {
    traits: ['brave', 'confident', 'social'],
    synergy_strength: 0.8,
    amplification_factor: 1.3,
    description: 'Confidence and social traits reinforce each other',
    color: '#4CAF50',
  },
  intelligence_cluster: {
    traits: ['curious', 'intelligent', 'adaptable'],
    synergy_strength: 0.7,
    amplification_factor: 1.25,
    description: 'Intelligence traits create learning synergies',
    color: '#2196F3',
  },
  stability_cluster: {
    traits: ['calm', 'patient', 'stable'],
    synergy_strength: 0.9,
    amplification_factor: 1.4,
    description: 'Stability traits create emotional balance',
    color: '#9C27B0',
  },
  social_cluster: {
    traits: ['social', 'affectionate', 'outgoing'],
    synergy_strength: 0.75,
    amplification_factor: 1.2,
    description: 'Social traits enhance interpersonal connections',
    color: '#FF9800',
  },
  sensitivity_cluster: {
    traits: ['sensitive', 'empathetic', 'intuitive'],
    synergy_strength: 0.6,
    amplification_factor: 1.15,
    description: 'Sensitivity traits create emotional awareness',
    color: '#607D8B',
  },
};

// Trait conflict definitions - traits that oppose each other
export const TRAIT_CONFLICTS = {
  fear_confidence: {
    trait_pairs: [
      ['fearful', 'brave'],
      ['fearful', 'confident'],
      ['insecure', 'confident'],
    ],
    conflict_strength: 0.9,
    suppression_factor: 0.6,
    description: 'Fear-based traits conflict with confidence traits',
  },
  reactive_calm: {
    trait_pairs: [
      ['reactive', 'calm'],
      ['reactive', 'patient'],
      ['volatile', 'stable'],
    ],
    conflict_strength: 0.8,
    suppression_factor: 0.7,
    description: 'Reactive traits conflict with calm stability',
  },
  social_antisocial: {
    trait_pairs: [
      ['social', 'antisocial'],
      ['outgoing', 'withdrawn'],
      ['affectionate', 'aloof'],
    ],
    conflict_strength: 0.85,
    suppression_factor: 0.65,
    description: 'Social and antisocial traits are mutually exclusive',
  },
  fragile_resilient: {
    trait_pairs: [
      ['fragile', 'resilient'],
      ['fragile', 'hardy'],
      ['delicate', 'robust'],
    ],
    conflict_strength: 0.7,
    suppression_factor: 0.75,
    description: 'Physical fragility conflicts with resilience',
  },
  impulsive_methodical: {
    trait_pairs: [
      ['impulsive', 'methodical'],
      ['spontaneous', 'deliberate'],
      ['hasty', 'careful'],
    ],
    conflict_strength: 0.6,
    suppression_factor: 0.8,
    description: 'Impulsive traits conflict with methodical approaches',
  },
};

// Trait dominance hierarchy - some traits are naturally more dominant
export const TRAIT_DOMINANCE = {
  high_dominance: {
    traits: ['confident', 'brave', 'intelligent', 'dominant', 'assertive'],
    dominance_score: 0.9,
    description: 'Highly dominant traits that tend to override others',
  },
  moderate_dominance: {
    traits: ['social', 'curious', 'adaptable', 'resilient', 'stable'],
    dominance_score: 0.6,
    description: 'Moderately dominant traits with balanced expression',
  },
  low_dominance: {
    traits: ['sensitive', 'gentle', 'patient', 'submissive', 'compliant'],
    dominance_score: 0.3,
    description: 'Low dominance traits that are easily suppressed',
  },
  recessive: {
    traits: ['fearful', 'fragile', 'insecure', 'withdrawn', 'timid'],
    dominance_score: 0.1,
    description: 'Recessive traits that are often masked by others',
  },
};

export const UNKNOWN_TRAIT_DOMINANCE = {
  dominance_score: 0.5,
  level: 'moderate_dominance',
  description: 'Unknown trait with moderate dominance',
};

// Properties that emerge when every contributing trait is present
export const EMERGENT_PROPERTIES = [
  {
    name: 'Natural Leadership',
    description:
      'Combination of confidence, intelligence, and social skills creates leadership potential',
    contributingTraits: ['confident', 'intelligent', 'social'],
    strength: 0.8,
  },
  {
    name: 'Emotional Intelligence',
    description:
      'Sensitivity combined with social and cognitive abilities creates emotional awareness',
    contributingTraits: ['sensitive', 'social', 'intelligent'],
    strength: 0.7,
  },
  {
    name: 'Resilient Adaptability',
    description: 'Adaptability with calmness and intelligence creates exceptional resilience',
    contributingTraits: ['adaptable', 'calm', 'intelligent'],
    strength: 0.75,
  },
  {
    name: 'Creative Problem Solving',
    description: 'Curiosity, intelligence, and bravery combine for innovative solutions',
    contributingTraits: ['curious', 'intelligent', 'brave'],
    strength: 0.65,
  },
];

// Temporal patterns that emerge when every required trait is present
export const TRAIT_PATTERNS = [
  {
    requires: ['curious', 'intelligent'],
    pattern: 'learning_acceleration',
    description: 'Curiosity and intelligence create accelerated learning potential',
    confidence: 0.75,
  },
  {
    requires: ['social', 'confident'],
    pattern: 'leadership_emergence',
    description: 'Social confidence may lead to leadership behaviors',
    confidence: 0.6,
  },
];
