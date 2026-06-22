/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Direct deep imports
 * are deprecated and will be lint-blocked once consumers have migrated.
 *
 * Public API: exports from farrier, feedShop, inventory, services, tackShop, vet.
 */

export * from './services/financialLedgerService.mjs';
// Equoria-94z3m: re-export tackShop public surface so cross-module consumers
// (e.g. logic/simulateCompetition.mjs#resolveTackBonus) go through the barrel.
export * from './tackShop/controllers/tackShopController.mjs';

// Equoria-v8l96.1: surface route default-exports through the barrel so the
// app composition root (app/routers.mjs) imports them via the module public
// API instead of the retired backend/routes/*.mjs compat shims. `export *`
// above re-exports NAMED symbols only; a default needs an explicit re-export.
export { default as vetRoutes } from './vet/routes/vetRoutes.mjs';
export { default as tackShopRoutes } from './tackShop/routes/tackShopRoutes.mjs';
export { default as farrierRoutes } from './farrier/routes/farrierRoutes.mjs';
export { default as feedShopRoutes } from './feedShop/routes/feedShopRoutes.mjs';
export { default as inventoryRoutes } from './inventory/routes/inventoryRoutes.mjs';
