/**
 * The port the owner's payroll Test run and Re-run call through (Equoria-brh8c).
 *
 * Replaying a payroll pass for one groom or rider belongs to the grooms and riders
 * modules, which import the staff barrel, so staff cannot import them without a
 * module cycle; and the staff device check-in guards live on the staff routes. The
 * app layer hands the staff module both replays once at start-up:
 * backend/app/routers.mjs calls registerPayrollReplays (as it does for
 * quarantinedShowToolsPort.mjs and groomPayrollPort.mjs).
 *
 * A replay runs inside the caller's transaction and returns
 * `{ outcome, amount, afterCommit }`.
 */

let replays = null;

/**
 * @param {{ groom: Function, rider: Function }} implementation
 */
export function registerPayrollReplays(implementation) {
  replays = Object.freeze({ groom: implementation.groom, rider: implementation.rider });
}

/**
 * The registered replay for a staff kind; throws when the app layer has not registered it.
 * @param {'groom'|'rider'} staffType
 */
export function payrollReplay(staffType) {
  const replay = replays?.[staffType];
  if (typeof replay !== 'function') {
    throw new Error('The payroll re-run was not registered at start-up');
  }
  return replay;
}
