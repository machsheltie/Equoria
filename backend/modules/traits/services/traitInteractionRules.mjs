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
export const TRAIT_SYNERGIES = deepFreeze({
  confidenceCluster: {
    traits: ['brave', 'confident', 'social'],
    synergyStrength: 0.8,
    amplificationFactor: 1.3,
    description: 'Confidence and social traits reinforce each other',
    color: '#4CAF50',
  },
  intelligenceCluster: {
    traits: ['curious', 'intelligent', 'adaptable'],
    synergyStrength: 0.7,
    amplificationFactor: 1.25,
    description: 'Intelligence traits create learning synergies',
    color: '#2196F3',
  },
  stabilityCluster: {
    traits: ['calm', 'patient', 'stable'],
    synergyStrength: 0.9,
    amplificationFactor: 1.4,
    description: 'Stability traits create emotional balance',
    color: '#9C27B0',
  },
  socialCluster: {
    traits: ['social', 'affectionate', 'outgoing'],
    synergyStrength: 0.75,
    amplificationFactor: 1.2,
    description: 'Social traits enhance interpersonal connections',
    color: '#FF9800',
  },
  sensitivityCluster: {
    traits: ['sensitive', 'empathetic', 'intuitive'],
    synergyStrength: 0.6,
    amplificationFactor: 1.15,
    description: 'Sensitivity traits create emotional awareness',
    color: '#607D8B',
  },
});

// Trait conflict definitions - traits that oppose each other
export const TRAIT_CONFLICTS = deepFreeze({
  fearConfidence: {
    traitPairs: [
      ['fearful', 'brave'],
      ['fearful', 'confident'],
      ['insecure', 'confident'],
    ],
    conflictStrength: 0.9,
    suppressionFactor: 0.6,
    description: 'Fear-based traits conflict with confidence traits',
  },
  reactiveCalm: {
    traitPairs: [
      ['reactive', 'calm'],
      ['reactive', 'patient'],
      ['volatile', 'stable'],
    ],
    conflictStrength: 0.8,
    suppressionFactor: 0.7,
    description: 'Reactive traits conflict with calm stability',
  },
  socialAntisocial: {
    traitPairs: [
      ['social', 'antisocial'],
      ['outgoing', 'withdrawn'],
      ['affectionate', 'aloof'],
    ],
    conflictStrength: 0.85,
    suppressionFactor: 0.65,
    description: 'Social and antisocial traits are mutually exclusive',
  },
  fragileResilient: {
    traitPairs: [
      ['fragile', 'resilient'],
      ['fragile', 'hardy'],
      ['delicate', 'robust'],
    ],
    conflictStrength: 0.7,
    suppressionFactor: 0.75,
    description: 'Physical fragility conflicts with resilience',
  },
  impulsiveMethodical: {
    traitPairs: [
      ['impulsive', 'methodical'],
      ['spontaneous', 'deliberate'],
      ['hasty', 'careful'],
    ],
    conflictStrength: 0.6,
    suppressionFactor: 0.8,
    description: 'Impulsive traits conflict with methodical approaches',
  },
});

// Trait dominance hierarchy - some traits are naturally more dominant
export const TRAIT_DOMINANCE = deepFreeze({
  highDominance: {
    traits: ['confident', 'brave', 'intelligent', 'dominant', 'assertive'],
    dominanceScore: 0.9,
    description: 'Highly dominant traits that tend to override others',
  },
  moderateDominance: {
    traits: ['social', 'curious', 'adaptable', 'resilient', 'stable'],
    dominanceScore: 0.6,
    description: 'Moderately dominant traits with balanced expression',
  },
  lowDominance: {
    traits: ['sensitive', 'gentle', 'patient', 'submissive', 'compliant'],
    dominanceScore: 0.3,
    description: 'Low dominance traits that are easily suppressed',
  },
  recessive: {
    traits: ['fearful', 'fragile', 'insecure', 'withdrawn', 'timid'],
    dominanceScore: 0.1,
    description: 'Recessive traits that are often masked by others',
  },
});

export const UNKNOWN_TRAIT_DOMINANCE = deepFreeze({
  dominanceScore: 0.5,
  level: 'moderateDominance',
  description: 'Unknown trait with moderate dominance',
});

// Properties that emerge when every contributing trait is present
export const EMERGENT_PROPERTIES = deepFreeze([
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
]);

// Temporal patterns that emerge when every required trait is present
export const TRAIT_PATTERNS = deepFreeze([
  {
    requires: ['curious', 'intelligent'],
    pattern: 'learningAcceleration',
    description: 'Curiosity and intelligence create accelerated learning potential',
    confidence: 0.75,
  },
  {
    requires: ['social', 'confident'],
    pattern: 'leadershipEmergence',
    description: 'Social confidence may lead to leadership behaviors',
    confidence: 0.6,
  },
]);

/** Freeze a rule table and everything inside it, so no caller can edit game data. */
function deepFreeze(value) {
  for (const inner of Object.values(value)) {
    if (inner && typeof inner === 'object') {
      deepFreeze(inner);
    }
  }
  return Object.freeze(value);
}
