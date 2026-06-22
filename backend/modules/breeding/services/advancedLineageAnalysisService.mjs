/**
 * Advanced Lineage Analysis Service — public-API re-export hub.
 *
 * Equoria-urqic.6: this file used to be a 1206-line monolith. Its 7 exported
 * async functions were split into three cohesive sibling modules under
 * services/ while keeping THIS path's public export surface byte-for-byte
 * stable so the 3 production importers (advancedBreedingGeneticsRoutes.mjs,
 * breeding/index.mjs, and the fix-wkdwx script reference) and every existing
 * test are unaffected:
 *
 *   - lineageTree.mjs       — generateLineageTree, createVisualizationData
 *                             (+ the shared organizeByGenerations producer and
 *                              the batched ancestor pre-fetch helpers)
 *   - lineageDiversity.mjs  — calculateGeneticDiversityMetrics,
 *                             identifyGeneticBottlenecks,
 *                             calculateInbreedingCoefficient (delegates the
 *                             coefficient core to backend/utils/inbreedingCoefficient.mjs)
 *   - lineagePerformance.mjs — analyzeLineagePerformance
 *   - lineageBreedingRecommendations.mjs — generateLineageBreedingRecommendations
 *
 * `generateLineageBreedingRecommendations` (Equoria-axad9.2 rename) is
 * preserved exactly. Do NOT add new logic here — add it to the owning sibling
 * module and re-export it through this hub if it must be part of the public
 * surface.
 */

export { generateLineageTree, createVisualizationData } from './lineageTree.mjs';

export {
  calculateGeneticDiversityMetrics,
  identifyGeneticBottlenecks,
  calculateInbreedingCoefficient,
} from './lineageDiversity.mjs';

export { analyzeLineagePerformance } from './lineagePerformance.mjs';

export { generateLineageBreedingRecommendations } from './lineageBreedingRecommendations.mjs';
