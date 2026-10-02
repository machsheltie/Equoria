/**
 * Groom/horse compatibility task policy (Equoria-q4uem.3).
 *
 * The single owner of which task types the compatibility feature accepts and how
 * each groom personality is weighted for each task. The route validator, the
 * GET /compatibility/config `taskTypes` list and the scorer's task modifier all
 * read this object, so they cannot drift apart.
 *
 * Values are the pre-refactor scorer's, verbatim. `balanced` (the Groom schema
 * default) and coat_check / tying_practice / early_touch previously fell through
 * to an implicit 1.0; they are now explicit neutral entries. Changing any number
 * is a game-mechanics change and needs the owner's approval.
 *
 * The 8 tasks are a subset of the canonical foal task lists in
 * config/groomConfig.mjs (enrichment + foal grooming, 12 tasks); gentle_touch,
 * feeding_assistance, environment_exploration and mane_tail_grooming have no
 * compatibility weighting and are not accepted here.
 */

const NEUTRAL = Object.freeze({ calm: 1, energetic: 1, methodical: 1, balanced: 1 });

export const GROOM_HORSE_COMPATIBILITY_TASK_POLICY = Object.freeze({
  trust_building: Object.freeze({ calm: 1.3, methodical: 1.1, energetic: 0.8, balanced: 1 }),
  desensitization: Object.freeze({ energetic: 1.1, calm: 1.2, methodical: 0.9, balanced: 1 }),
  hoof_handling: Object.freeze({ methodical: 1.2, calm: 1.1, energetic: 0.8, balanced: 1 }),
  showground_exposure: Object.freeze({ energetic: 1.2, calm: 0.9, methodical: 1, balanced: 1 }),
  sponge_bath: Object.freeze({ calm: 1.2, methodical: 1.3, energetic: 0.9, balanced: 1 }),
  coat_check: NEUTRAL,
  tying_practice: NEUTRAL,
  early_touch: NEUTRAL,
});

export const GROOM_HORSE_COMPATIBILITY_TASK_TYPES = Object.freeze(
  Object.keys(GROOM_HORSE_COMPATIBILITY_TASK_POLICY),
);

export const GROOM_HORSE_COMPATIBILITY_PERSONALITIES = Object.freeze(Object.keys(NEUTRAL));

/** Throws unless `taskType` is one of GROOM_HORSE_COMPATIBILITY_TASK_TYPES. */
export function assertCompatibilityTaskType(taskType) {
  if (!Object.hasOwn(GROOM_HORSE_COMPATIBILITY_TASK_POLICY, taskType)) {
    throw new Error(`Unsupported compatibility task type: ${taskType}`);
  }
}

/** The task modifier for a groom personality; throws for an unsupported task or personality. */
export function getTaskCompatibilityModifier(taskType, personality) {
  assertCompatibilityTaskType(taskType);
  const byPersonality = GROOM_HORSE_COMPATIBILITY_TASK_POLICY[taskType];
  if (!Object.hasOwn(byPersonality, personality)) {
    throw new Error(`Unsupported groom personality: ${personality}`);
  }
  return byPersonality[personality];
}
