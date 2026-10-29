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

// A horse's discipline score before show-day percentages, from the nightly
// scorer's own flat-score function: the horse page's Discipline Scores read it
// (app layer, Equoria-a0fim).
export { disciplineStandingScore } from './services/competitionScoring.mjs';
// The competition discipline stat map (Equoria-576c0 B3): the bible's 24-discipline
// table. The shared stat-gain and competition-config helpers read it.
export {
  DISCIPLINE_STATS,
  COMPETITION_DISCIPLINES,
  competitionDisciplines,
  isKnownDiscipline,
  getDisciplineStats,
  TEMPERAMENTS,
  TEMPERAMENT_MATRIX,
  temperamentPercent,
} from './rules/disciplineRules.mjs';
// A horse's show ledger, paged: the visitor horse page reads it through
// app/queries/horseVisitRoutes.mjs (q205: visitors see everything, read-only).
export { getHorseShowResults } from './services/competitionResultRecord.mjs';
export { isValidConformationClass } from './services/conformationShowScoring.mjs';
// executeClosedShows is the overnight show executor: a service with an optional
// Express (req, res) signature, called by the nightly jobs
// (services/jobs/impl/retentionMaintenance.mjs, showExecutionReaper.mjs) with no
// req/res or a synthetic `{ body: { showIds } }`, and wired by shows/showRoutes.mjs
// as POST /shows/execute. Moved out of the controller file in WS4 S4 (review M2).
export { executeClosedShows } from './shows/showExecutionService.mjs';
// Equoria-ehlbj: the owner's quarantined-show tools (diagnose, preview, run). The app
// layer hands them to the staff routes' port (staff cannot import this module).
export { testRunQuarantinedShow, runQuarantinedShow } from './shows/showQuarantineResolution.mjs';
export { diagnoseQuarantinedShow } from './shows/showQuarantineDiagnosis.mjs';
// Equoria-yqi49: every failed try of a show is kept for the owner's Diagnose.
export { recordShowFailure } from './shows/showFailureLog.mjs';
