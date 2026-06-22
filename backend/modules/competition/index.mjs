/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Direct deep imports
 * are deprecated and will be lint-blocked once consumers have migrated.
 *
 * Public API: exports from controllers, routes, services, shows, tests.
 */

export * from './controllers/competitionController.mjs';
export * from './controllers/conformationShowController.mjs';
export * from './controllers/traitCompetitionController.mjs';
export * from './routes/competitionRoutes.mjs';
export * from './routes/conformationShowRoutes.mjs';
export * from './services/competitionRouteQueries.mjs';
export * from './services/competitionScoring.mjs';
export * from './services/conformationShowService.mjs';
// Equoria-kwjav: resultModelService relocated from backend/models/resultModel.mjs.
export * from './services/resultModelService.mjs';
export * from './shows/showController.mjs';
export * from './shows/showRoutes.mjs';

// Equoria-v8l96.1: surface route default-exports through the barrel so the
// app composition root (app/routers.mjs) imports them via the module public
// API instead of the retired backend/routes/*.mjs compat shims. `export *`
// above re-exports NAMED symbols only; a default needs an explicit re-export.
export { default as competitionRoutes } from './routes/competitionRoutes.mjs';
export { default as showRoutes } from './shows/showRoutes.mjs';
