/**
 * horses module public API (named-export service contract).
 *
 * Equoria-q4uem.4 (WS4 S4): this barrel lists exactly the names other modules, the
 * application layer (backend/app) and repository scripts import. Route modules are
 * wired only by backend/app/routers.mjs and are not exported here; HTTP controllers
 * are not domain capabilities and are not exported for production use. Cross-module
 * imports still go through this file (ESLint, CONTRIBUTING.md "Module public API
 * boundaries"); add a name here when a consumer genuinely needs it, never `export *`.
 */

export { preloadBreedProfiles } from './data/breedProfileLoader.mjs';
export { getFoalDevelopment } from './models/foalModel.mjs';
// Production since WS4 S6 (Equoria-q4uem.4): competition's conformationShowScoring.mjs reads the
// overall conformation score through this barrel.
export { calculateOverallConformation } from './services/conformationService.mjs';
// Equoria-q4uem.9: breeding's stud-booking controller applies the same breeding rules and
// pregnancy claim as the own-pair route (one set of rules, one set of messages).
// Equoria-kha18: users' next-actions asks the same mare-only cooldown rule.
export {
  validateBreedingPair,
  pregnancyClaimData,
  pendingRequestMessage,
  damBreedingCooldownEndsAt,
} from './services/breedingPairRules.mjs';
// Equoria-q4uem.9: a sale ends the stallion's pending stud requests and the mare's (marketplace).
export {
  declinePendingRequestsForSire,
  cancelPendingRequestForMare,
} from './services/studRequestCleanup.mjs';
export { runFoalingJob } from './services/foalingService.mjs';
export { GENERIC_DEFAULTS, generateGenotype } from './services/genotypeGenerationService.mjs';
export { decayHoofConditions } from './services/hoofConditionDecayService.mjs';
export { createHorse } from './services/horseCreation.mjs';
export { getHorseById } from './services/horseRouteQueries.mjs';
// The horse-name rule (Equoria-zalyb): auth's onboarding writes a player-typed horse name and
// meets the same rule; WS4 S4 took the routes out of this barrel, so the former module-root
// publishing file is gone and the rule is reached here like every other capability.
export {
  firstHorseNameRejectionMessage,
  horseNameRejectionReason,
} from './services/horseNamePolicy.mjs';
export { generateStoreStats } from './services/horseStarterStats.mjs';
export { analyzeHorseTemperament } from './services/horseTemperamentAnalysis.mjs';
export { addXpToHorseCore, invalidateHorseXpCaches } from './services/horseXpModelService.mjs';
export { generateMarkings } from './services/markingGenerationService.mjs';
export { calculatePhenotype } from './services/phenotypeCalculationService.mjs';
export {
  DEFAULT_TEMPERAMENT_BREED,
  generateTemperamentWithDefault,
  getTemperamentGroomSynergy,
} from './services/temperamentService.mjs';

// Consumed only by other modules' tests that check a stored temperament against the
// canonical list: auth/__tests__/onboardingStarterHorseLocked.integration.test.mjs,
// auth/__tests__/starterHorseTemperament.integration.test.mjs and
// training/__tests__/trainerTrainingModifier.integration.test.mjs. No production
// importer. Equoria-7t1tn moved the other test-only names out with their tests.
export { TEMPERAMENT_TYPES } from './data/temperamentTypes.mjs';
