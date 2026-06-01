/**
 * Groom Management Controller
 *
 * Equoria-8kuhf: this file was a 1204-line god-file that tripped the 800-line
 * max-lines cap. It has been split by sub-domain into sibling controllers and
 * now re-exports their handlers, so every existing importer (including the
 * Epic 20 shim backend/controllers/groomController.mjs via the grooms barrel)
 * keeps working with zero changes. Handler names, signatures, behavior, and
 * response shapes are preserved exactly — this is a pure split, not a rewrite.
 *
 * Public surface (12 handlers):
 *   - assignment:    assignGroom, ensureDefaultAssignment, getFoalAssignments,
 *                    getGroomAssignmentLogs
 *   - interaction:   recordInteraction, getGroomHorseSynergyPreview
 *   - roster:        getUserGrooms, hireGroom, getGroomProfile,
 *                    getGroomDefinitions
 *   - bonus-traits:  getGroomBonusTraits, updateGroomBonusTraits
 */

export {
  assignGroom,
  ensureDefaultAssignment,
  getFoalAssignments,
  getGroomAssignmentLogs,
} from './groomAssignmentHandlers.mjs';

export { recordInteraction, getGroomHorseSynergyPreview } from './groomInteractionController.mjs';

export {
  getUserGrooms,
  hireGroom,
  getGroomProfile,
  getGroomDefinitions,
} from './groomRosterController.mjs';

export { getGroomBonusTraits, updateGroomBonusTraits } from './groomBonusTraitsController.mjs';
