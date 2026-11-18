/**
 * The port a steward's horse rename asks the horse-name rule through (Equoria-puj1e.3).
 *
 * The rule (horseNamePolicy, owner rulings 2026-09-14) belongs to the horses
 * module, and a steward's rename must obey exactly the rule a player's rename does.
 * The staff module cannot import horses without a module cycle (horses -> staff),
 * so the app layer, which may import both barrels, hands the rule over once at
 * start-up: backend/app/routers.mjs calls registerHorseNameRule.
 */

let horseNameRule = null;

/**
 * @param {(name: unknown) => string | null} rejectionReason null for an acceptable
 *   name, otherwise why it is refused
 */
export function registerHorseNameRule(rejectionReason) {
  horseNameRule = rejectionReason;
}

/** Why a horse name is refused, or null; throws when the rule was not registered. */
export function horseNameRejection(name) {
  if (!horseNameRule) {
    throw new Error('The horse-name rule was not registered at start-up');
  }
  return horseNameRule(name);
}
