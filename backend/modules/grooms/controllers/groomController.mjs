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
 * Public surface (hireGroom retired by Equoria-bvddn.7):
 *   - assignment:    assignGroom, getGroomAssignmentLogs
 *                    (ensureDefaultAssignment deleted: no default groom, q153)
 *   - interaction:   getGroomHorseSynergyPreview (grooming itself: groomCareController)
 *   - roster:        getUserGrooms, getGroomProfile
 *
 * getFoalAssignments, getGroomDefinitions and the bonus-traits handlers went with
 * their duplicate lookup routes (owner ruling 2026-10-28, q151, Equoria-a7f1p).
 */

export {
  assignGroom,
  getGroomAssignmentLogs,
} from './groomAssignmentHandlers.mjs';

export { getGroomHorseSynergyPreview } from './groomInteractionController.mjs';

export { getUserGrooms, getGroomProfile } from './groomRosterController.mjs';
