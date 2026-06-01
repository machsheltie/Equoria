/**
 * Backwards-compat shim — real implementation in modules/horses/controllers/horseController.mjs
 *
 * Equoria-94z3m: re-export through the horses module barrel (index.mjs) to
 * satisfy the cross-module public-API boundary rule (no-restricted-imports /
 * Equoria-fy2tx). Named exports mirror the horseController re-export barrel's
 * public surface (which itself fans out to the domain-aligned controllers).
 */
export {
  getHorseHistory,
  getHorseCompetitionHistory,
  getHorseOverview,
  getHorsePersonalityImpact,
  getConformation,
  getConformationAnalysis,
  getGaits,
  getTemperamentDefinitions,
  getGenetics,
  getColor,
  getBreedingColorPrediction,
  listHorseAtStud,
  unlistHorseAtStud,
  createFoal,
  resetHorseLastFed,
} from '../modules/horses/index.mjs';
