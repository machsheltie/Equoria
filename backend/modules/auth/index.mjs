/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Reaching into another
 * module's internals (controllers/services/routes/models/data/...) is
 * ENFORCED against by ESLint (no-restricted-imports, per-module barrel
 * boundary blocks in backend/eslint.config.mjs, Equoria-v8l96.4). Same-module
 * deep imports remain allowed.
 *
 * Public API: exports from constants, controllers, routes, services, tests.
 */

export * from './constants/authConstants.mjs';
export * from './controllers/authController.mjs';
export * from './controllers/emailVerificationController.mjs';
export * from './controllers/mfaController.mjs';
export * from './controllers/onboardingController.mjs';
export * from './controllers/passwordController.mjs';
export * from './controllers/profileController.mjs';
export * from './routes/authRoutes.mjs';
export * from './routes/authenticatedAuthRoutes.mjs';
export * from './services/authSessionService.mjs';
export * from './services/mfaLockoutService.mjs';
export * from './services/mfaReplayProtectionService.mjs';
export * from './services/mfaService.mjs';
export * from './services/onboardingService.mjs';

// Equoria-v8l96.1: surface route default-exports through the barrel so the
// app composition root (app/routers.mjs) imports them via the module public
// API instead of the retired backend/routes/*.mjs compat shims. `export *`
// above re-exports NAMED symbols only; a default needs an explicit re-export.
export { default as authRoutes } from './routes/authRoutes.mjs';
