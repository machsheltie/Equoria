/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Direct deep imports
 * are deprecated and will be lint-blocked once consumers have migrated.
 *
 * Public API: exports from controllers, routes, services, tests.
 */

export * from './controllers/gdprAccountController.mjs';
export * from './controllers/nextActionsController.mjs';
export * from './controllers/userController.mjs';
export * from './controllers/wyagController.mjs';
export * from './routes/gdprAccountRoutes.mjs';
export * from './routes/nextActionsRoutes.mjs';
export * from './routes/userRoutes.mjs';
export * from './routes/wyagRoutes.mjs';
export * from './services/gdprAccountService.mjs';
export * from './services/settingsValidation.mjs';
export * from './services/userDocumentationService.mjs';
export * from './services/userPrizeHistoryService.mjs';
