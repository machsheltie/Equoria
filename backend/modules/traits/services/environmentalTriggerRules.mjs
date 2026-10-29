/**
 * Environmental trigger rules: the authored data the environmental trigger
 * analysis applies to a horse's groom interactions (Equoria-q4uem.7 S4).
 *
 * Owner-owned game data under the no-mechanics-change ruling; the analysis
 * (environmentalTriggerSystem.mjs) owns only the arithmetic. Everything here is
 * data, deep-frozen: conditions are written as { field, op, value } records the
 * analysis interprets, never as functions. Lists whose entries are summed are
 * ORDERED; their order is the original if-chain order, which keeps the
 * floating-point sums bit-for-bit identical. Imported only by the analysis.
 */

const deepFreeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

export const ENVIRONMENTAL_TRIGGERS = deepFreeze({
  harshEnvironment: {
    name: 'Harsh Environment',
    factors: ['roughHandling', 'timePressure'],
    traitsAffected: ['fearful', 'reactive', 'insecure', 'fragile'],
  },
  confidenceBuilding: {
    name: 'Confidence Building Environment',
    factors: ['calmAtmosphere', 'patientHandling', 'positiveReinforcement', 'gradualExposure'],
    traitsAffected: ['brave', 'confident', 'social', 'curious'],
  },
  socialStimulation: {
    name: 'Social Stimulation Environment',
    factors: ['multipleHandlers', 'groupActivities', 'variedInteractions', 'socialExposure'],
    traitsAffected: ['social', 'affectionate', 'outgoing'],
  },
  isolation: {
    name: 'Isolation Environment',
    factors: ['limitedContact', 'minimalInteraction', 'solitaryConfinement', 'neglect'],
    traitsAffected: ['antisocial', 'withdrawn', 'insecure'],
  },
  sensoryEnrichment: {
    name: 'Sensory Enrichment Environment',
    factors: ['variedTextures', 'differentSounds', 'visualStimulation', 'tactileExperiences'],
    traitsAffected: ['curious', 'intelligent', 'adaptable'],
  },
  routineStability: {
    name: 'Routine Stability Environment',
    factors: ['consistentSchedule', 'familiarHandlers', 'predictableEnvironment', 'stableRoutine'],
    traitsAffected: ['calm', 'patient', 'stable'],
  },
});

/**
 * Per trigger type, the points one interaction contributes when a condition on
 * it holds, in the original order (the points are summed in this order).
 * Condition: { field, op, value } with op in eq | in | gt | lt | lte; `field`
 * may be a dotted path (groom.epigeneticInfluenceType).
 */
export const TRIGGER_SCORE_RULES = deepFreeze({
  harshEnvironment: [
    [{ field: 'quality', op: 'eq', value: 'poor' }, 0.2],
    [{ field: 'bondingChange', op: 'lt', value: 0 }, 0.2],
  ],
  confidenceBuilding: [
    [{ field: 'bondingChange', op: 'gt', value: 1 }, 0.3],
    [{ field: 'quality', op: 'eq', value: 'excellent' }, 0.2],
  ],
  socialStimulation: [
    [{ field: 'interactionType', op: 'eq', value: 'enrichment' }, 0.2],
    [{ field: 'duration', op: 'gt', value: 30 }, 0.1],
  ],
  isolation: [
    [{ field: 'bondingChange', op: 'lt', value: -1 }, 0.3],
    [{ field: 'duration', op: 'lt', value: 15 }, 0.2],
  ],
  sensoryEnrichment: [
    [{ field: 'taskType', op: 'eq', value: 'desensitization' }, 0.3],
    [{ field: 'taskType', op: 'eq', value: 'showgroundExposure' }, 0.2],
  ],
  routineStability: [
    [{ field: 'groom.epigeneticInfluenceType', op: 'eq', value: 'calm' }, 0.2],
    [{ field: 'quality', op: 'in', value: ['good', 'excellent'] }, 0.1],
  ],
});

// A trigger is detected when its score exceeds this.
export const TRIGGER_DETECTION_THRESHOLD = 0.3;
export const TRIGGER_WINDOW_DAYS = 30;

/**
 * When a trigger's environmental factor counts as present among the
 * interactions. Kinds: anyInteraction (some interaction meets every condition),
 * distinctGroomsAbove, countBelow, countAbove. A factor with no rule is decided
 * by a random draw (DEFAULT_FACTOR_PRESENT_ABOVE), unchanged from before S4;
 * whether that should stay is owner question WS7-Q2.
 */
export const FACTOR_PRESENCE_RULES = deepFreeze({
  calmAtmosphere: {
    anyInteraction: [
      { field: 'bondingChange', op: 'gt', value: 1 },
      { field: 'quality', op: 'eq', value: 'excellent' },
    ],
  },
  patientHandling: {
    anyInteraction: [
      { field: 'bondingChange', op: 'gt', value: 1 },
      { field: 'quality', op: 'eq', value: 'excellent' },
    ],
  },
  multipleHandlers: { distinctGroomsAbove: 1 },
  limitedContact: { countBelow: 3 },
  variedTextures: { anyInteraction: [{ field: 'taskType', op: 'eq', value: 'desensitization' }] },
  differentSounds: { anyInteraction: [{ field: 'taskType', op: 'eq', value: 'desensitization' }] },
  consistentSchedule: { countAbove: 5 },
});
export const DEFAULT_FACTOR_PRESENT_ABOVE = 0.7;

// Threshold sensitivity: base x age x bond (multiplied in this order).
export const BASE_TRIGGER_THRESHOLD = 0.5;
// [maxAgeDays, modifier]; the first band whose max the age does not exceed.
export const THRESHOLD_AGE_BANDS = deepFreeze([
  [7, 0.6],
  [30, 0.7],
  [90, 0.8],
  [Infinity, 1.0],
]);

// Exposure per interaction: hours of contact, scaled (in this order).
export const EXPOSURE_SCALING = deepFreeze([
  [{ field: 'bondingChange', op: 'gt', value: 2 }, 1.3],
  [{ field: 'quality', op: 'eq', value: 'excellent' }, 1.2],
  [{ field: 'quality', op: 'eq', value: 'poor' }, 0.8],
]);
export const CUMULATIVE_EFFECTS_EVERY = 5;
export const QUALITY_SCORES = deepFreeze({ poor: 1, fair: 2, good: 3, excellent: 4 });
export const DEFAULT_QUALITY_SCORE = 2;
