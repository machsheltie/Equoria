/**
 * Genetic Diversity Tracking Service — facade
 *
 * Public surface for the genetic-diversity subsystem. The original 2085-line
 * "god file" was split (refs Equoria-1743t) into focused modules under
 * `./genetics/`; this file is now a thin re-export so external imports keep
 * working unchanged:
 *
 *   backend/services/genetics/geneticDiversityMetrics.mjs
 *     Shannon / Simpson / heterozygosity / allele frequencies / distance matrix
 *     composite diversity score / effective population size / founders
 *
 *   backend/services/genetics/inbreedingAnalysis.mjs
 *     Wright path-analysis inbreeding coefficient, common-ancestor detection,
 *     risk assessment
 *
 *   backend/services/genetics/breedingCompatibility.mjs
 *     Pair compatibility, optimal-pair search, diversity goals, timeline
 *     (re-exports calculateDetailedInbreedingCoefficient for back-compat)
 *
 *   backend/services/genetics/populationHealth.mjs
 *     trackPopulationGeneticHealth, A-F grading, bottleneck identification,
 *     population-wide inbreeding distribution
 *
 *   backend/services/genetics/recommendationGenerators.mjs
 *     Genetic trends, diversity-over-time timeline, comprehensive report,
 *     semantic-action generators (codes from backend/config/geneticActionCodes.mjs)
 *
 * AC #2 satisfaction: action-list strings live in
 * `backend/config/geneticActionCodes.mjs`; the service emits
 * `{code, text, params?}` records — `.code` is the stable semantic, `.text`
 * is the canonical English copy (back-compat).
 */

export {
  calculateAdvancedGeneticDiversity,
  calculateEffectivePopulationSize,
  identifyGeneticFounders,
} from './genetics/geneticDiversityMetrics.mjs';

export {
  calculateDetailedInbreedingCoefficient,
  assessBreedingPairCompatibility,
  generateOptimalBreedingRecommendations,
} from './genetics/breedingCompatibility.mjs';

export { trackPopulationGeneticHealth } from './genetics/populationHealth.mjs';

export {
  analyzeGeneticTrends,
  trackGeneticDiversityOverTime,
  generateGeneticDiversityReport,
} from './genetics/recommendationGenerators.mjs';
