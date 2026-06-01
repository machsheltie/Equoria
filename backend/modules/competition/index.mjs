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
export * from './shows/showController.mjs';
export * from './shows/showRoutes.mjs';
