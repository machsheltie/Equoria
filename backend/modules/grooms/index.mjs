/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Direct deep imports
 * are deprecated and will be lint-blocked once consumers have migrated.
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
