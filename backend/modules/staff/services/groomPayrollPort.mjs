/**
 * The port the owner's manual groom payday calls through (Equoria-opdt7).
 *
 * Owner ruling 2026-10-28 (q262): the manual "pay grooms now" trigger is kept for
 * the Owner alone, behind the emailed staff check-in. Players pay their own grooms with
 * the Pay Groom button (owner rulings 2026-10-28/29, q268, Equoria-hc96y); this lets the
 * owner run the whole collection pass by hand.
 *
 * The payday itself belongs to the grooms module, which imports the staff barrel,
 * so staff cannot import grooms without a module cycle; and the staff device
 * cookie is scoped to /api/v1/staff, so the trigger has to live on the staff
 * routes. The app layer hands the staff module the payday once at start-up:
 * backend/app/routers.mjs calls registerGroomPayrollRun (as it does for
 * quarantinedShowToolsPort.mjs).
 */

let runPayroll = null;

/** @param {() => Promise<object>} implementation the weekly groom payday, unscoped */
export function registerGroomPayrollRun(implementation) {
  runPayroll = implementation;
}

/** The registered payday; throws when the app layer has not registered it. */
export function groomPayrollRun() {
  if (!runPayroll) {
    throw new Error('The groom payday was not registered at start-up');
  }
  return runPayroll;
}
