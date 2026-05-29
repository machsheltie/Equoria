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
 *     - getHorseHistory
 *     - getHorseCompetitionHistory
 *     - getHorseOverview
 *     - getHorsePersonalityImpact
 *
 *   horseConformationController.mjs
 *     - getConformation
 *     - getConformationAnalysis
 *     - getGaits
 *
 *   horseGeneticsController.mjs
 *     - getTemperamentDefinitions
 *     - getGenetics
 *     - getColor
 *     - getBreedingColorPrediction
 *
 *   horseStudController.mjs
 *     - listHorseAtStud
 *     - unlistHorseAtStud
 *
 *   horseFoalingController.mjs
 *     - createFoal
 *     - resetHorseLastFed
 *
 * No behavior changes. No opportunistic refactor. Per CLAUDE.md OPTIMAL_FIX
 * §3 (adjacent locations) any future symbol that grows past the per-file
 * 800-line lint cap should be moved to its domain-aligned controller, not
 * re-added here.
 */

export {
  getHorseHistory,
  getHorseCompetitionHistory,
  getHorseOverview,
  getHorsePersonalityImpact,
} from './horseOverviewController.mjs';

export {
  getConformation,
  getConformationAnalysis,
  getGaits,
} from './horseConformationController.mjs';

export {
  getTemperamentDefinitions,
  getGenetics,
  getColor,
  getBreedingColorPrediction,
} from './horseGeneticsController.mjs';

export { listHorseAtStud, unlistHorseAtStud } from './horseStudController.mjs';

export { createFoal, resetHorseLastFed } from './horseFoalingController.mjs';
