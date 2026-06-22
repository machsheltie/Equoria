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

export * from './controllers/dynamicCompatibilityController.mjs';
export * from './controllers/personalityEvolutionController.mjs';
export * from './routes/apiOptimizationRoutes.mjs';
export * from './routes/dynamicCompatibilityRoutes.mjs';
export * from './routes/enhancedReportingRoutes.mjs';
export * from './routes/environmentalRoutes.mjs';
export * from './routes/memoryManagementRoutes.mjs';
export * from './routes/personalityEvolutionRoutes.mjs';
export * from './services/enhancedReportingQueries.mjs';
export * from './services/enhancedReportingService.mjs';
export * from './services/environmentalFactorEngineService.mjs';
export * from './services/environmentalHorseService.mjs';
export * from './services/environmentalTriggerSystem.mjs';

// Equoria-v8l96.1: surface route default-exports through the barrel so the
// app composition root (app/routers.mjs) imports them via the module public
// API instead of the retired backend/routes/*.mjs compat shims. `export *`
// above re-exports NAMED symbols only; a default needs an explicit re-export.
export { default as enhancedReportingRoutes } from './routes/enhancedReportingRoutes.mjs';
export { default as dynamicCompatibilityRoutes } from './routes/dynamicCompatibilityRoutes.mjs';
export { default as personalityEvolutionRoutes } from './routes/personalityEvolutionRoutes.mjs';
export { default as apiOptimizationRoutes } from './routes/apiOptimizationRoutes.mjs';
export { default as memoryManagementRoutes } from './routes/memoryManagementRoutes.mjs';
export { default as environmentalRoutes } from './routes/environmentalRoutes.mjs';
