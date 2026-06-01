/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Direct deep imports
 * are deprecated and will be lint-blocked once consumers have migrated.
 *
 * Public API: exports from controllers, routes, services, tests.
 */

export * from './controllers/enhancedMilestoneController.mjs';
export * from './controllers/trainingController.mjs';
export * from './routes/enhancedMilestoneRoutes.mjs';
export * from './routes/trainingRoutes.mjs';
export * from './services/trainingAnalyticsService.mjs';
