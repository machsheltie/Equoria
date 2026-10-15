/**
 * competition module public API (named-export service contract).
 *
 * Equoria-q4uem.4 (WS4 S4): this barrel lists exactly the names other modules, the
 * application layer (backend/app) and repository scripts import. Route modules are
 * wired only by backend/app/routers.mjs and are not exported here; HTTP controllers
 * are not domain capabilities and are not exported for production use. Cross-module
 * imports still go through this file (ESLint, CONTRIBUTING.md "Module public API
 * boundaries"); add a name here when a consumer genuinely needs it, never `export *`.
 */

export { applyRiderCompatibility } from './services/competitionScoring.mjs';
export { isValidConformationClass } from './services/conformationShowScoring.mjs';
export { getResultsByHorse } from './services/resultModelService.mjs';
// executeClosedShows is an Express handler (req, res) that the nightly jobs
// (services/jobs/impl/retentionMaintenance.mjs, showExecutionReaper.mjs) call with
// a synthetic `{ body: { showIds } }`. That is a controller used as a capability
// (spec: HTTP controllers are never domain capabilities); it predates WS4 and
// separating the settlement use case from the handler is a behaviour-bearing
// change outside Equoria-q4uem.4. Kept as-is; reported in the WS4 report.
export { executeClosedShows } from './shows/showController.mjs';

// Test-consumed only (other modules' tests; Equoria-7t1tn tracks moving those tests
// into the owning module, after which these lines go).
export { createShow, enterShow } from './shows/showController.mjs';
export { settleShowFeeEscrow } from './shows/showEscrowTx.mjs';
