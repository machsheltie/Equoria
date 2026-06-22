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

// Equoria-axad9.2: explicit named re-exports for the two breeding-recommendation
// functions (mirrors the kwjav/pq3oi collision-avoidance pattern in
// horses/index.mjs). Both services historically exported a symbol literally
// named `generateBreedingRecommendations`, so the two `export *` lines above
// collided at the barrel and one silently shadowed the other (star-merge
// ambiguity / last-wins). The declarations were renamed to distinct canonical
// names; surfacing them explicitly here documents the contract and guards
// against a future re-collision regression (see the sentinel test
// breedingBarrelRecommendationCollision.sentinel.test.mjs). These two lines are
// intentionally NOT left to `export *` for these symbols.
export { generateGeneticBreedingRecommendations } from './services/enhancedGeneticProbabilityService.mjs';
export { generateLineageBreedingRecommendations } from './services/advancedLineageAnalysisService.mjs';
