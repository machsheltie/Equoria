/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Direct deep imports
 * are deprecated and will be lint-blocked once consumers have migrated.
 *
 * Public API: exports from controllers, data, routes, services, tests.
 */

export * from './controllers/breedController.mjs';
export * from './controllers/horseConformationController.mjs';
export * from './controllers/horseController.mjs';
export * from './controllers/horseFeedController.mjs';
export * from './controllers/horseFoalingController.mjs';
export * from './controllers/horseGeneticsController.mjs';
export * from './controllers/horseOverviewController.mjs';
export * from './controllers/horseStudController.mjs';
export * from './controllers/horseXpController.mjs';
export * from './data/breedGeneticProfiles.mjs';
export * from './data/breedProfileLoader.mjs';
export * from './routes/_validators.mjs';
export * from './routes/breedRoutes.mjs';
// Equoria-7p4xe follow-up: breedPublicRoutes is a default-exported router;
// star re-exports drop defaults, so the barrel surfaces it by name for the
// cross-module consumer (backend/app/routers.mjs onboarding mount).
export { default as breedPublicRoutes } from './routes/breedPublicRoutes.mjs';
export * from './routes/horseBreedingRoutes.mjs';
export * from './routes/horseFeedRoutes.mjs';
export * from './routes/horseFoalRoutes.mjs';
export * from './routes/horseGeneticsRoutes.mjs';
export * from './routes/horseHistoryRoutes.mjs';
export * from './routes/horseRoutes.mjs';
export * from './routes/horseXpRoutes.mjs';
export * from './services/breedingColorInheritanceService.mjs';
export * from './services/breedingColorPredictionService.mjs';
export * from './services/conformationService.mjs';
export * from './services/createHorseService.mjs';
export * from './services/deleteHorseService.mjs';
export * from './services/developmentalWindowSystem.mjs';
export * from './services/foalingService.mjs';
export * from './services/gaitService.mjs';
export * from './services/genotypeGenerationService.mjs';
export * from './services/hoofConditionDecayService.mjs';
export * from './services/horseFeedService.mjs';
export * from './services/horseModelService.mjs';
// Equoria-kwjav: horseXpModelService relocated from backend/models/horseXpModel.mjs.
// Explicit named re-export (not `export *`) because horseXpController already
// exports getHorseXpStatus / allocateStatPoint / getHorseXpHistory as the
// HTTP-handler versions — a star re-export would ambiguously collide and
// silently drop those names from the barrel. The model's distinct public
// symbols are surfaced here; same-module callers deep-import the service.
export {
  addXpToHorse,
  validateStatName,
  awardCompetitionXp,
} from './services/horseXpModelService.mjs';
export * from './services/horseRouteQueries.mjs';
export * from './services/horseStarterStats.mjs';
export * from './services/horseTemperamentAnalysis.mjs';
export * from './services/legacyScoreCalculator.mjs';
export * from './services/markingGenerationService.mjs';
export * from './services/personalityEvolutionSystem.mjs';
export * from './services/phenotypeCalculationService.mjs';
export * from './services/temperamentService.mjs';
