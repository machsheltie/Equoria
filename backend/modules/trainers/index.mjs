/**
 * trainers module public API (named-export service contract).
 *
 * Equoria-q4uem.4 (WS4 S4): this barrel lists exactly the names other modules, the
 * application layer (backend/app) and repository scripts import. Route modules are
 * wired only by backend/app/routers.mjs and are not exported here; HTTP controllers
 * are not domain capabilities and are not exported for production use. Cross-module
 * imports still go through this file (ESLint, CONTRIBUTING.md "Module public API
 * boundaries"); add a name here when a consumer genuinely needs it, never `export *`.
 */

export { incrementWeeklyCareerWeeks } from './services/riderTrainerProgressionService.mjs';
export { processRiderTrainerRetirement } from './services/riderTrainerRetirementService.mjs';
export { computeTrainerModifiers } from './services/trainerModifiers.mjs';

// Consumed only by modules/training/__tests__/trainerTrainingModifier.integration.test.mjs
// (a training test that pins the trainer-modifier caps); no production importer.
// Equoria-7t1tn: the marketplace names that used to sit here moved out with the
// tests that read them.
export {
  TRAINER_BONUS_CAP,
  TRAINER_CANONICAL_TEMPERAMENTS,
  TRAINER_PENALTY_CAP,
} from './services/trainerModifiers.mjs';
