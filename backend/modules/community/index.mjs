/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Direct deep imports
 * are deprecated and will be lint-blocked once consumers have migrated.
 *
 * Public API: exports from controllers, routes, tests.
 */

export * from './controllers/clubController.mjs';
export * from './controllers/forumController.mjs';
export * from './controllers/messageController.mjs';
export * from './routes/clubRoutes.mjs';
export * from './routes/forumRoutes.mjs';
export * from './routes/messageRoutes.mjs';
