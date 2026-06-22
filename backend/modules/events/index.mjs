/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Reaching into another
 * module's internals (controllers/services/routes/models/data/...) is
 * ENFORCED against by ESLint (no-restricted-imports, per-module barrel
 * boundary blocks in backend/eslint.config.mjs, Equoria-v8l96.4). Same-module
 * deep imports remain allowed.
 *
 * Public API: exports from controllers, routes.
 */

export * from './controllers/eventStreamController.mjs';
export * from './routes/eventRoutes.mjs';
// Equoria-94z3m: re-export the default router under a named symbol so
// cross-module consumers (app.mjs) can mount it through the barrel.
// `export *` does not forward default exports.
export { default as eventRoutes } from './routes/eventRoutes.mjs';
