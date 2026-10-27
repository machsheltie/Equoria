/**
 * breeding module public API (named-export service contract).
 *
 * Equoria-q4uem.4 (WS4 S4): this barrel lists exactly the names other modules, the
 * application layer (backend/app) and repository scripts import. Route modules are
 * wired only by backend/app/routers.mjs and are not exported here; HTTP controllers
 * are not domain capabilities and are not exported for production use. Cross-module
 * imports still go through this file (ESLint, CONTRIBUTING.md "Module public API
 * boundaries"); add a name here when a consumer genuinely needs it, never `export *`.
 */

export { generateBreedingData } from './services/breedingPredictionService.mjs';
// Equoria-q4uem.9 slice 5: the marketplace stud search shows other players' stallions through
// the same projection the breeding predictions use (S-Q9 hidden traits; design §0 competition).
export { withoutUnrevealedTraits } from './services/predictionHorseView.mjs';
