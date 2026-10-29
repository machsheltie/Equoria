/**
 * grooms module public API (named-export service contract).
 *
 * Equoria-q4uem.4 (WS4 S4): this barrel lists exactly the names other modules, the
 * application layer (backend/app) and repository scripts import. Route modules are
 * wired only by backend/app/routers.mjs and are not exported here; HTTP controllers
 * are not domain capabilities and are not exported for production use. Cross-module
 * imports still go through this file (ESLint, CONTRIBUTING.md "Module public API
 * boundaries"); add a name here when a consumer genuinely needs it, never `export *`.
 */

export { checkBonusEligibility, getBonusTraits } from './services/groomBonusTraitService.mjs';
export { processWeeklyCareerProgression } from './services/groomCareerProgressionService.mjs';
export { updateGroomSynergy } from './services/groomProgressionService.mjs';
export { processWeeklySalaries } from './services/groomSalaryService.mjs';
export { settleEndedGroomPayWeek } from './services/groomPlayerPayService.mjs';
export { canGroomToday } from './services/groomVerdict.mjs';
