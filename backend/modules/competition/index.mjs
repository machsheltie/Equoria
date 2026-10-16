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
// executeClosedShows is the overnight show executor: a service with an optional
// Express (req, res) signature, called by the nightly jobs
// (services/jobs/impl/retentionMaintenance.mjs, showExecutionReaper.mjs) with no
// req/res or a synthetic `{ body: { showIds } }`, and wired by shows/showRoutes.mjs
// as POST /shows/execute. Moved out of the controller file in WS4 S4 (review M2).
export { executeClosedShows } from './shows/showExecutionService.mjs';
