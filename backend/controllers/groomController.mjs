/**
 * Backwards-compat shim — real implementation in modules/grooms/controllers/groomController.mjs
 *
 * Equoria-94z3m: re-export through the grooms module barrel (index.mjs) to
 * satisfy the cross-module public-API boundary rule (no-restricted-imports /
 * Equoria-fy2tx). Named exports mirror the controller's public surface.
 */
export {
  assignGroom,
  ensureDefaultAssignment,
  getFoalAssignments,
  recordInteraction,
  getGroomHorseSynergyPreview,
  getUserGrooms,
  hireGroom,
  getGroomDefinitions,
  getGroomProfile,
  getGroomAssignmentLogs,
  getGroomBonusTraits,
  updateGroomBonusTraits,
} from '../modules/grooms/index.mjs';
