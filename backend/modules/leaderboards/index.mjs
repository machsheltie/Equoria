/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Direct deep imports
 * are deprecated and will be lint-blocked once consumers have migrated.
 *
 * Public API: exports from controllers, routes, services, tests.
 */

export * from './controllers/leaderboardController.mjs';
export * from './routes/leaderboardRoutes.mjs';
export * from './services/leaderboardCompetitionQueries.mjs';
export * from './services/leaderboardService.mjs';
export * from './services/userRankSnapshotService.mjs';
