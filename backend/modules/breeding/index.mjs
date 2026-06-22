/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Reaching into another
 * module's internals (controllers/services/routes/models/data/...) is
 * ENFORCED against by ESLint (no-restricted-imports, per-module barrel
 * boundary blocks in backend/eslint.config.mjs, Equoria-v8l96.4). Same-module
 * deep imports remain allowed.
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
// Equoria-v8l96.3: surface the genetics-diversity aggregator so the
// cross-module consumer (tests/unit/geneticDiversityTracking.test.mjs) goes
// through the barrel instead of deep-importing services/genetics/. NOTE: this
// is a TEST-DRIVEN barrel addition — no PRODUCTION path consumes this service
// today (v8l96.2 only surfaced prod-needed symbols), so this is the one symbol
// set the test sweep added beyond the prod migration. The aggregator is a clean
// named-re-export module (no `export *`), and its 10 names do not collide with
// any existing breeding-barrel export (verified at landing).
export * from './services/genetics/geneticDiversityTrackingService.mjs';

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

// Equoria-v8l96.1: surface route default-exports through the barrel so the
// app composition root (app/routers.mjs) imports them via the module public
// API instead of the retired backend/routes/*.mjs compat shims. `export *`
// above re-exports NAMED symbols only; a default needs an explicit re-export.
export { default as foalRoutes } from './routes/foalRoutes.mjs';
export { default as advancedBreedingGeneticsRoutes } from './routes/advancedBreedingGeneticsRoutes.mjs';
