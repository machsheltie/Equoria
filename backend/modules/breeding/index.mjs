/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Direct deep imports
 * are deprecated and will be lint-blocked once consumers have migrated.
 *
 * Public API: exports from controllers, routes, services, tests.
 */

export * from './controllers/foalController.mjs';
export * from './routes/advancedBreedingGeneticsRoutes.mjs';
export * from './routes/foalRoutes.mjs';
export * from './services/advancedLineageAnalysisService.mjs';
export * from './services/breedingOwnershipQueries.mjs';
export * from './services/breedingPredictionService.mjs';
export * from './services/dynamicCompatibilityScoring.mjs';
export * from './services/enhancedGeneticProbabilityService.mjs';
