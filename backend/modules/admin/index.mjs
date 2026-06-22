/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Direct deep imports
 * are deprecated and will be lint-blocked once consumers have migrated.
 *
 * Public API: exports from controllers, routes, services, tests.
 */

export * from './controllers/adminController.mjs';
export * from './routes/adminRoutes.mjs';
export * from './services/auditLogRetentionService.mjs';
export * from './services/featureFlagService.mjs';

// Equoria-v8l96.1: surface route default-exports through the barrel so the
// app composition root (app/routers.mjs) imports them via the module public
// API instead of the retired backend/routes/*.mjs compat shims. `export *`
// above re-exports NAMED symbols only; a default needs an explicit re-export.
export { default as adminRoutes } from './routes/adminRoutes.mjs';
