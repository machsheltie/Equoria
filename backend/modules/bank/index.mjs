/**
 * bank module public API (named-export service contract).
 *
 * Equoria-q4uem.4 (WS4 S4): this barrel lists exactly the names other modules, the
 * application layer (backend/app) and repository scripts import. Route modules are
 * wired only by backend/app/routers.mjs and are not exported here; HTTP controllers
 * are not domain capabilities and are not exported for production use. Cross-module
 * imports still go through this file (ESLint, CONTRIBUTING.md "Module public API
 * boundaries"); add a name here when a consumer genuinely needs it, never `export *`.
 */

// No production consumer imports this module through the barrel today.

// Test-consumed only (other modules' tests; Equoria-7t1tn tracks moving those tests
// into the owning module, after which these lines go).
export { getCurrentWeekStart } from './controllers/bankController.mjs';
