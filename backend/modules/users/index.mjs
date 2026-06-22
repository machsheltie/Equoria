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
// Equoria-kwjav: userModelService + xpLogModelService relocated from
// backend/models/{userModel,xpLogModel}.mjs into the users domain module.
export * from './services/userModelService.mjs';
export * from './services/xpLogModelService.mjs';
export * from './services/userPrizeHistoryService.mjs';

// Equoria-v8l96.1: surface route default-exports through the barrel so the
// app composition root (app/routers.mjs) imports them via the module public
// API instead of the retired backend/routes/*.mjs compat shims. `export *`
// above re-exports NAMED symbols only; a default needs an explicit re-export.
export { default as userRoutes } from './routes/userRoutes.mjs';
export { default as gdprAccountRoutes } from './routes/gdprAccountRoutes.mjs';
export { default as nextActionsRoutes } from './routes/nextActionsRoutes.mjs';
export { default as wyagRoutes } from './routes/wyagRoutes.mjs';
