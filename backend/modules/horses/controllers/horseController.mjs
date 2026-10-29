/**
 * Horse Controller — Re-Export Barrel
 *
 * Equoria-xod8b (child A of Equoria-mh937): the original 1574-line god-file
 * was split into 5 domain-aligned controllers in the same directory. This
 * barrel preserves the existing public surface so every import site
 * (routes/middleware/tests) continues to resolve without per-file updates.
 *
 * Domain ownership of the extracted symbols:
 *
 *   horseOverviewController.mjs
 *     - getHorseCompetitionHistory
 *     - getHorseOverview
 *     - getHorsePersonalityImpact
 *
 *   horseConformationController.mjs
 *     - getConformation
 *     - getGaits
 *
 *   horseGeneticsController.mjs
 *     - getTemperamentDefinitions
 *     - getGenetics
 *
 *   horseStudController.mjs
 *     - listHorseAtStud
 *     - unlistHorseAtStud
 *
 *   horseFoalingController.mjs
 *     - createFoal
 *
 * No behavior changes. No opportunistic refactor. Per CLAUDE.md OPTIMAL_FIX
 * §3 (adjacent locations) any future symbol that grows past the per-file
 * 800-line lint cap should be moved to its domain-aligned controller, not
 * re-added here.
 */

// Equoria-q4uem.4 (WS4 S3): getHorseOverview composes Competition and Training
// data, so it moved above the domain into backend/app/queries/horseOverviewQuery.mjs.
// getHorseHistory went with GET /horses/:id/history (Equoria-a7f1p, q151).
export {
  getHorseCompetitionHistory,
  getHorsePersonalityImpact,
} from './horseOverviewController.mjs';

export { getConformation, getGaits } from './horseConformationController.mjs';

export { getTemperamentDefinitions, getGenetics } from './horseGeneticsController.mjs';

export { listHorseAtStud, unlistHorseAtStud } from './horseStudController.mjs';

export { createFoal } from './horseFoalingController.mjs';
