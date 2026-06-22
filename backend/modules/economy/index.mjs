/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Reaching into another
 * module's internals (controllers/services/routes/models/data/...) is
 * ENFORCED against by ESLint (no-restricted-imports, per-module barrel
 * boundary blocks in backend/eslint.config.mjs, Equoria-v8l96.4). Same-module
 * deep imports remain allowed.
 *
 * Public API: exports from farrier, feedShop, inventory, services, tackShop, vet.
 */

export * from './services/financialLedgerService.mjs';
// Equoria-94z3m: re-export tackShop public surface so cross-module consumers
// (e.g. logic/simulateCompetition.mjs#resolveTackBonus) go through the barrel.
export * from './tackShop/controllers/tackShopController.mjs';
// Equoria-v8l96.2: surface feedShop public surface so cross-module consumers
// (horses/horseFeedController + horseFeedService import FEED_CATALOG) go
// through the barrel instead of deep-importing the feedShop controller.
export * from './feedShop/controllers/feedShopController.mjs';

// Equoria-v8l96.1: surface route default-exports through the barrel so the
// app composition root (app/routers.mjs) imports them via the module public
// API instead of the retired backend/routes/*.mjs compat shims. `export *`
// above re-exports NAMED symbols only; a default needs an explicit re-export.
export { default as vetRoutes } from './vet/routes/vetRoutes.mjs';
export { default as tackShopRoutes } from './tackShop/routes/tackShopRoutes.mjs';
export { default as farrierRoutes } from './farrier/routes/farrierRoutes.mjs';
export { default as feedShopRoutes } from './feedShop/routes/feedShopRoutes.mjs';
export { default as inventoryRoutes } from './inventory/routes/inventoryRoutes.mjs';
