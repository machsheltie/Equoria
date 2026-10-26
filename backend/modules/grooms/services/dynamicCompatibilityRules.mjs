/**
 * Dynamic compatibility rules: the authored data the compatibility scoring
 * applies (Equoria-q4uem.7 S6).
 *
 * Owner-owned game data under the no-mechanics-change ruling; the scoring
 * (dynamicCompatibilityScoring.mjs, compatibilityFactorAnalysis.mjs) owns only
 * the arithmetic. The tables are data, deep-frozen: text rules carry their
 * conditions as { field, op, value } records (op: eq | in | gt | lt), never as
 * functions, and ruleTexts at the end is the one reader of them. Lists keep their
 * original if-chain order, which keeps every text list and every product
 * identical. Imported only by the compatibility services.
 */

const deepFreeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

// Each listed environmental factor multiplies the modifier (in the context's
// order); unlisted factors are ignored. The product is clamped to the range.
export const ENVIRONMENT_FACTOR_MULTIPLIERS = deepFreeze({
  quiet: 1.1,
  noisy: 0.9,
  familiar: 1.1,
  unfamiliar: 0.9,
  structured: 1.05,
  chaotic: 0.85,
  stimulating: 1.0,
});
export const ENVIRONMENT_MODIFIER_RANGE = deepFreeze([0.7, 1.3]);

export const TIME_OF_DAY_MODIFIERS = deepFreeze({
  morning: 1.1, // Generally better for interactions
  afternoon: 1.0,
  evening: 0.95,
});
export const TIME_OF_DAY_DEFAULT = 1.0;

// personality -> temperament -> match score (missing: 0.5).
export const PERSONALITY_MATCH_MATRIX = deepFreeze({
  calm: { nervous: 0.9, fearful: 0.9, reactive: 0.8, confident: 0.7, developing: 0.7 },
  energetic: { confident: 0.4, outgoing: 0.8, nervous: 0.3, fearful: 0.2, developing: 0.6 },
  methodical: { developing: 0.4, complex: 0.5, confident: 0.4, nervous: 0.5, reactive: 0.4 },
});
export const PERSONALITY_MATCH_DEFAULT = 0.5;

// personality -> temperament (or `all`) -> task effectiveness (missing: 0.6).
export const TASK_EFFECTIVENESS_MATRIX = deepFreeze({
  calm: { nervous: 0.9, fearful: 0.9, developing: 0.8 },
  energetic: { confident: 0.9, outgoing: 0.8, curious: 0.8 },
  methodical: { developing: 0.9, complex: 0.8, all: 0.7 },
});
export const TASK_EFFECTIVENESS_DEFAULT = 0.6;

// Text rules: every condition must hold. Facts: personality, temperament,
// bondScore, experienceLevel.
export const RISK_FACTOR_RULES = deepFreeze([
  {
    when: [
      { field: 'personality', op: 'eq', value: 'energetic' },
      { field: 'temperament', op: 'in', value: ['nervous', 'fearful'] },
    ],
    texts: ['Energetic groom may overwhelm nervous/fearful horse'],
  },
  {
    when: [
      { field: 'experienceLevel', op: 'eq', value: 'low' },
      { field: 'temperament', op: 'eq', value: 'complex' },
    ],
    texts: ['Inexperienced groom may struggle with complex temperament'],
  },
  {
    when: [
      { field: 'bondScore', op: 'lt', value: 15 },
      { field: 'personality', op: 'eq', value: 'methodical' },
    ],
    texts: ['Low-bonding horse may need more emotional approach than methodical'],
  },
]);

export const STRENGTH_FACTOR_RULES = deepFreeze([
  {
    when: [
      { field: 'personality', op: 'eq', value: 'calm' },
      { field: 'temperament', op: 'in', value: ['nervous', 'fearful'] },
    ],
    texts: ['Calm groom excellent for building trust with nervous horses'],
  },
  {
    when: [
      { field: 'personality', op: 'eq', value: 'energetic' },
      { field: 'temperament', op: 'eq', value: 'confident' },
    ],
    texts: ['Energetic groom can provide stimulation for confident horses'],
  },
  {
    when: [
      { field: 'personality', op: 'eq', value: 'methodical' },
      { field: 'temperament', op: 'eq', value: 'developing' },
    ],
    texts: ['Methodical approach ideal for developing consistent routines'],
  },
  {
    when: [{ field: 'experienceLevel', op: 'eq', value: 'high' }],
    texts: ['High experience level provides adaptability and skill'],
  },
]);

// Facts: overallScore.
export const PREDICTION_RECOMMENDATION_RULES = deepFreeze([
  {
    when: [{ field: 'overallScore', op: 'lt', value: 0.5 }],
    texts: ['Consider using a different groom for this interaction'],
  },
  {
    when: [{ field: 'overallScore', op: 'gt', value: 0.8 }],
    texts: ['Excellent compatibility - consider extending interaction time'],
  },
]);

// How the text rules are read: the texts of every rule whose conditions all
// hold on `facts`, in rule order.
export function ruleTexts(rules, facts) {
  return rules.flatMap(rule =>
    rule.when.every(condition => holds(condition, facts)) ? rule.texts : [],
  );
}

function holds({ field, op, value }, facts) {
  const actual = facts[field];
  switch (op) {
    case 'eq':
      return actual === value;
    case 'in':
      return value.includes(actual);
    case 'gt':
      return actual > value;
    case 'lt':
      return actual < value;
    default:
      throw new Error(`Unknown compatibility rule operator: ${op}`);
  }
}
