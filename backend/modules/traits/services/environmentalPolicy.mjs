/**
 * Environmental policy: the authored climate and horse-comfort data the
 * environmental engine applies (Equoria-q4uem.7 S3).
 *
 * These are game-balance values owned by the project owner under the
 * no-mechanics-change ruling; the engine (environmentalFactorEngineService.mjs)
 * owns only the arithmetic. Every table is frozen. Lists that feed a running
 * product (`modifier *= factor`) are ORDERED: their order is the original
 * if-chain order, which keeps floating-point results bit-for-bit identical.
 * Imported only by the engine; not part of the traits barrel.
 */

const deepFreeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

// Per-region climate. Lookups use `table[region] || default`, so an unknown
// region falls back to the temperate values.
export const REGION_BASE_TEMPERATURE = deepFreeze({
  tropical: 28,
  temperate: 15,
  arctic: -5,
  desert: 25,
  coastal: 18,
});
export const DEFAULT_BASE_TEMPERATURE = 15;

export const REGION_HUMIDITY = deepFreeze({
  tropical: 80,
  temperate: 60,
  arctic: 70,
  desert: 25,
  coastal: 75,
});
export const DEFAULT_HUMIDITY = 60;

export const REGION_PRECIPITATION = deepFreeze({
  tropical: 0.4,
  temperate: 0.3,
  arctic: 0.2,
  desert: 0.05,
  coastal: 0.35,
});
export const DEFAULT_PRECIPITATION = 0.3;

export const REGION_WIND_SPEED = deepFreeze({
  tropical: 12,
  temperate: 15,
  arctic: 20,
  desert: 18,
  coastal: 22,
});
export const DEFAULT_WIND_SPEED = 15;

// Seasons by day of year: spring [80, 172), summer [172, 266), autumn
// [266, 355), winter otherwise.
export const SEASON_STARTS = deepFreeze({ spring: 80, summer: 172, autumn: 266, winter: 355 });

export const SEASON_FACTORS = deepFreeze({
  spring: {
    growthModifier: 1.2,
    healthModifier: 1.1,
    trainingEffectiveness: 1.15,
    description: 'Spring growth period with optimal development conditions',
  },
  summer: {
    growthModifier: 1.0,
    healthModifier: 0.95,
    trainingEffectiveness: 0.9,
    description: 'Summer heat requires careful management and hydration',
  },
  autumn: {
    growthModifier: 1.05,
    healthModifier: 1.05,
    trainingEffectiveness: 1.1,
    description: 'Autumn preparation period with moderate conditions',
  },
  winter: {
    growthModifier: 0.9,
    healthModifier: 0.9,
    trainingEffectiveness: 0.85,
    description: 'Winter challenges requiring shelter and extra care',
  },
});

// Season-change transitions: within TRANSITION_DAYS of a boundary, growth and
// training are scaled. The spring boundary boosts growth more, the winter
// boundary reduces it.
export const TRANSITION_DAYS = 10;
export const TRANSITION_BOUNDARIES = deepFreeze([80, 172, 266, 355]);
export const TRANSITION_GROWTH_EFFECT = deepFreeze({ 80: 0.2, 355: -0.1 });
export const DEFAULT_TRANSITION_GROWTH_EFFECT = 0.1;
export const TRANSITION_TRAINING_EFFECT = 0.05;

export const CONDITION_IMPACT = deepFreeze({
  sunny: 10,
  cloudy: 0,
  rainy: -15,
  stormy: -30,
  foggy: -10,
});

export const CONDITION_QUALITY = deepFreeze({
  sunny: 10,
  cloudy: 5,
  rainy: -10,
  stormy: -25,
  foggy: -5,
});

// The average horse's comfort zone, then per-trait adjustments (additive).
export const COMFORT_BASE = deepFreeze({
  tempMin: 5,
  tempMax: 30,
  tempOptimal: 18,
  humidityMin: 30,
  humidityMax: 70,
  humidityOptimal: 50,
});
export const COMFORT_TRAIT_ADJUSTMENTS = deepFreeze([
  ['heat_tolerant', { tempMax: 8, tempOptimal: 5, humidityMax: 15 }],
  ['cold_tolerant', { tempMin: -10, tempOptimal: -3 }],
  ['desert_adapted', { tempMax: 12, tempOptimal: 8, humidityMin: -10, humidityOptimal: -15 }],
  ['heat_sensitive', { tempMax: -5, tempOptimal: -3, humidityMax: -10 }],
  ['hardy', { tempMin: -5, tempMax: 5, humidityMin: -5, humidityMax: 10 }],
]);

// Ordered multipliers. An optional third element is a condition, as data, that
// the engine interprets: { whenTrigger: <type> } (that trigger is active),
// { whenAnyTrigger: true } (any trigger is active), { tempAbove: n } and
// { tempBelow: n } (the weather's temperature, strictly).
export const TRIGGER_TRAIT_FACTORS = deepFreeze([
  ['calm', 0.7, { whenTrigger: 'storm' }],
  ['nervous', 1.3, { whenAnyTrigger: true }],
  ['heat_tolerant', 0.5, { whenTrigger: 'extremeHeat' }],
  ['cold_tolerant', 0.5, { whenTrigger: 'extremeCold' }],
  ['hardy', 0.8],
]);
export const IMPACT_TRAIT_FACTORS = deepFreeze([
  ['adaptable', 0.9],
  ['sensitive', 1.2],
  ['heat_tolerant', 0.7, { tempAbove: 30 }],
  ['cold_tolerant', 0.7, { tempBelow: 10 }],
]);

// How each data condition in the factor tables is read (one key per condition).
const CONDITION_TESTS = {
  whenTrigger: (type, { triggers }) => triggers.includes(type),
  whenAnyTrigger: (_, { triggers }) => triggers.length > 0,
  tempAbove: (limit, { weather }) => weather.temperature > limit,
  tempBelow: (limit, { weather }) => weather.temperature < limit,
};

/**
 * The product of a factor table's factors for a horse's traits, multiplied in
 * table order (a conditioned factor applies only when its condition holds on
 * `context` = { triggers, weather }). The engine scales a value once by this
 * product, exactly as the pre-S3 if-chains did (`modifier *= f; value * modifier`).
 */
export function traitFactorProduct(factors, traits, context = {}) {
  let modifier = 1.0;
  for (const [trait, factor, condition] of factors) {
    if (traits.includes(trait) && (!condition || conditionHolds(condition, context))) {
      modifier *= factor;
    }
  }
  return modifier;
}

function conditionHolds(condition, context) {
  const [[kind, argument]] = Object.entries(condition);
  if (!CONDITION_TESTS[kind]) {
    throw new Error(`Unknown trait-factor condition: ${kind}`);
  }
  return CONDITION_TESTS[kind](argument, context);
}
