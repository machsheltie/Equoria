/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Direct deep imports
 * are deprecated and will be lint-blocked once consumers have migrated.
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
