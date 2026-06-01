/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Direct deep imports
 * are deprecated and will be lint-blocked once consumers have migrated.
 *
 * Public API: exports from controllers, routes, services, tests.
 */

export * from './controllers/trainerController.mjs';
export * from './controllers/trainerMarketplaceController.mjs';
export * from './routes/trainerRoutes.mjs';
export * from './services/riderTrainerProgressionService.mjs';
export * from './services/riderTrainerRetirementService.mjs';
export * from './services/trainerDiscoveryService.mjs';
export * from './services/trainerMarketplace.mjs';
