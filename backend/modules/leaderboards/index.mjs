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

export * from './controllers/leaderboardController.mjs';
export * from './routes/leaderboardRoutes.mjs';
export * from './services/leaderboardCompetitionQueries.mjs';
export * from './services/leaderboardService.mjs';
export * from './services/userRankSnapshotService.mjs';

// Equoria-v8l96.1: surface route default-exports through the barrel so the
// app composition root (app/routers.mjs) imports them via the module public
// API instead of the retired backend/routes/*.mjs compat shims. `export *`
// above re-exports NAMED symbols only; a default needs an explicit re-export.
export { default as leaderboardRoutes } from './routes/leaderboardRoutes.mjs';
