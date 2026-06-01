/**
 * Backwards-compat shim — real implementation in modules/competition/controllers/traitCompetitionController.mjs
 *
 * Equoria-94z3m: re-export through the competition module barrel (index.mjs)
 * to satisfy the cross-module public-API boundary rule (no-restricted-imports
 * / Equoria-fy2tx). Named exports mirror the controller's public surface.
 */
export {
  analyzeHorseTraitImpact,
  compareTraitImpactAcrossDisciplines,
  getDisciplineRecommendations,
  getTraitCompetitionEffects,
} from '../modules/competition/index.mjs';
