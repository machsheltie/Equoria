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

export { BREED_GENETIC_PROFILES, CANONICAL_BREEDS } from './data/breedGeneticProfiles.mjs';
export { preloadBreedProfiles } from './data/breedProfileLoader.mjs';
export { getFoalDevelopment } from './models/foalModel.mjs';
export { runFoalingJob } from './services/foalingService.mjs';
export { GENERIC_DEFAULTS, generateGenotype } from './services/genotypeGenerationService.mjs';
export { decayHoofConditions } from './services/hoofConditionDecayService.mjs';
export { createHorse, getHorseById } from './services/horseModelService.mjs';
export { generateStoreStats } from './services/horseStarterStats.mjs';
export { analyzeHorseTemperament } from './services/horseTemperamentAnalysis.mjs';
export { addXpToHorseCore } from './services/horseXpModelService.mjs';
export { generateMarkings } from './services/markingGenerationService.mjs';
export { calculatePhenotype } from './services/phenotypeCalculationService.mjs';
export {
  DEFAULT_TEMPERAMENT_BREED,
  generateTemperamentWithDefault,
  getTemperamentCompetitionModifiers,
  getTemperamentGroomSynergy,
  getTemperamentTrainingModifiers,
} from './services/temperamentService.mjs';

// Test-consumed only (other modules' tests; Equoria-7t1tn tracks moving those tests
// into the owning module, after which these lines go).
export { TEMPERAMENT_TYPES } from './data/breedGeneticProfiles.mjs';
export {
  CONFORMATION_REGIONS,
  calculateOverallConformation,
  clampScore,
  generateConformationScores,
  generateInheritedConformationScores,
  hasValidConformationScores,
  validateConformationScores,
} from './services/conformationService.mjs';
export { getLegacyScoreDefinitions } from './services/legacyScoreCalculator.mjs';
export {
  TEMPERAMENT_GROOM_SYNERGY,
  TEMPERAMENT_TRAINING_MODIFIERS,
} from './services/temperamentService.mjs';
