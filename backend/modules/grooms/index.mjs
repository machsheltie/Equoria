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

export * from './controllers/enhancedGroomController.mjs';
export * from './controllers/groomAssignmentController.mjs';
export * from './controllers/groomController.mjs';
export * from './controllers/groomHandlerController.mjs';
export * from './controllers/groomMarketplaceController.mjs';
export * from './controllers/groomPerformanceController.mjs';
export * from './controllers/groomSalaryController.mjs';
export * from './routes/enhancedGroomRoutes.mjs';
export * from './routes/groomAssignmentRoutes.mjs';
export * from './routes/groomHandlerRoutes.mjs';
export * from './routes/groomMarketplaceRoutes.mjs';
export * from './routes/groomPerformanceRoutes.mjs';
export * from './routes/groomRoutes.mjs';
export * from './routes/groomSalaryRoutes.mjs';
export * from './services/enhancedGroomInteractions.mjs';
export * from './services/groomAssignmentService.mjs';
export * from './services/groomBonusTraitService.mjs';
export * from './services/groomHandlerService.mjs';
export * from './services/groomLegacyService.mjs';
export * from './services/groomMarketplace.mjs';
export * from './services/groomPerformanceService.mjs';
export * from './services/groomPersonalityTraits.mjs';
export * from './services/groomProgressionService.mjs';
export * from './services/groomRetirementService.mjs';
export * from './services/groomSalaryService.mjs';
export * from './services/groomTalentService.mjs';

// Equoria-p7z26: BOTH controllers/groomController.mjs and
// services/groomProgressionService.mjs star-export `getGroomProfile`, which
// makes the name an AMBIGUOUS star export — any NAMED re-export of it through
// this barrel (e.g. the Epic-20 shim backend/controllers/groomController.mjs)
// throws "conflicting star exports for name 'getGroomProfile'" at link time.
// An explicit named re-export disambiguates per ESM resolution rules (explicit
// exports shadow star exports). The cross-module public surface is the
// controller HTTP handler; the service's getGroomProfile(groomId) remains
// reachable via same-module deep import (modules/grooms/services/...).
export { getGroomProfile } from './controllers/groomController.mjs';

// Equoria-v8l96.1: surface route default-exports through the barrel so the
// app composition root (app/routers.mjs) imports them via the module public
// API instead of the retired backend/routes/*.mjs compat shims. `export *`
// above re-exports NAMED symbols only; a default needs an explicit re-export.
export { default as groomRoutes } from './routes/groomRoutes.mjs';
export { default as groomMarketplaceRoutes } from './routes/groomMarketplaceRoutes.mjs';
export { default as enhancedGroomRoutes } from './routes/enhancedGroomRoutes.mjs';
export { default as groomAssignmentRoutes } from './routes/groomAssignmentRoutes.mjs';
export { default as groomHandlerRoutes } from './routes/groomHandlerRoutes.mjs';
export { default as groomSalaryRoutes } from './routes/groomSalaryRoutes.mjs';
export { default as groomPerformanceRoutes } from './routes/groomPerformanceRoutes.mjs';
