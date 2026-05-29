/**
 * Genetic Action Codes & Locale Mapping
 *
 * Semantic action codes for genetic-management recommendations and the
 * canonical English copy that pairs with each code. The geneticDiversity
 * subsystem emits these codes (or {code, params} objects); rendering layers
 * resolve them to user-facing strings via {@link resolveGeneticAction}.
 *
 * Decouples backend logic from UI copy so:
 *   - Tests can assert against stable codes instead of brittle strings.
 *   - Frontend / locale layers can override strings without backend redeploy.
 *   - A future i18n layer wraps this map without changing the service surface.
 *
 * Refs Equoria-1743t (god-file split AC #2: "Action-list strings moved to a
 * config/locale file; service emits semantic codes").
 */

export const GENETIC_ACTION_CODES = Object.freeze({
  // Urgent (executive summary)
  IMPLEMENT_GENETIC_RESCUE_PROGRAM: 'IMPLEMENT_GENETIC_RESCUE_PROGRAM',
  HALT_CLOSE_RELATIVE_BREEDING: 'HALT_CLOSE_RELATIVE_BREEDING',
  AVOID_HIGH_RISK_PAIRS: 'AVOID_HIGH_RISK_PAIRS',

  // Immediate action plan
  EXECUTE_PRIORITY_BREEDINGS: 'EXECUTE_PRIORITY_BREEDINGS',
  REVIEW_BREEDING_PROTOCOLS: 'REVIEW_BREEDING_PROTOCOLS',
  IMPLEMENT_GENETIC_MONITORING: 'IMPLEMENT_GENETIC_MONITORING',

  // Short-term
  DEVELOP_OUTCROSSING_PROGRAM: 'DEVELOP_OUTCROSSING_PROGRAM',
  ESTABLISH_MONITORING_PROTOCOLS: 'ESTABLISH_MONITORING_PROTOCOLS',
  TRAIN_STAFF_GENETIC_MANAGEMENT: 'TRAIN_STAFF_GENETIC_MANAGEMENT',

  // Long-term
  DEVELOP_TEN_YEAR_GENETIC_PLAN: 'DEVELOP_TEN_YEAR_GENETIC_PLAN',
  ESTABLISH_GENETIC_DATABASE: 'ESTABLISH_GENETIC_DATABASE',
  CREATE_BREEDING_ADVISORY_COMMITTEE: 'CREATE_BREEDING_ADVISORY_COMMITTEE',
  IMPLEMENT_POPULATION_IMPROVEMENT: 'IMPLEMENT_POPULATION_IMPROVEMENT',
});

/**
 * Canonical English copy for each genetic action code.
 * `{N}` placeholder is substituted from `params.count`.
 */
export const GENETIC_ACTION_STRINGS = Object.freeze({
  [GENETIC_ACTION_CODES.IMPLEMENT_GENETIC_RESCUE_PROGRAM]:
    'Implement genetic rescue program immediately',
  [GENETIC_ACTION_CODES.HALT_CLOSE_RELATIVE_BREEDING]: 'Halt all close relative breeding',
  [GENETIC_ACTION_CODES.AVOID_HIGH_RISK_PAIRS]: 'Avoid {N} high-risk breeding pairs',

  [GENETIC_ACTION_CODES.EXECUTE_PRIORITY_BREEDINGS]: 'Execute {N} priority breedings',
  [GENETIC_ACTION_CODES.REVIEW_BREEDING_PROTOCOLS]: 'Review and update breeding protocols',
  [GENETIC_ACTION_CODES.IMPLEMENT_GENETIC_MONITORING]: 'Implement genetic monitoring system',

  [GENETIC_ACTION_CODES.DEVELOP_OUTCROSSING_PROGRAM]: 'Develop outcrossing program',
  [GENETIC_ACTION_CODES.ESTABLISH_MONITORING_PROTOCOLS]: 'Establish genetic monitoring protocols',
  [GENETIC_ACTION_CODES.TRAIN_STAFF_GENETIC_MANAGEMENT]: 'Train staff on genetic management',

  [GENETIC_ACTION_CODES.DEVELOP_TEN_YEAR_GENETIC_PLAN]: 'Develop 10-year genetic management plan',
  [GENETIC_ACTION_CODES.ESTABLISH_GENETIC_DATABASE]:
    'Establish genetic database and tracking system',
  [GENETIC_ACTION_CODES.CREATE_BREEDING_ADVISORY_COMMITTEE]: 'Create breeding advisory committee',
  [GENETIC_ACTION_CODES.IMPLEMENT_POPULATION_IMPROVEMENT]:
    'Implement population genetic improvement program',
});

/**
 * Resolve a semantic action ({code, params?}) to its rendered English string.
 * @param {{code: string, params?: {count?: number}}|string} action
 * @returns {string}
 */
export function resolveGeneticAction(action) {
  if (typeof action === 'string') {
    return GENETIC_ACTION_STRINGS[action] ?? action;
  }
  if (action && typeof action === 'object' && action.code) {
    const template = GENETIC_ACTION_STRINGS[action.code];
    if (!template) {
      return action.code;
    }
    const count = action.params?.count;
    return count !== undefined ? template.replace('{N}', String(count)) : template;
  }
  return '';
}
