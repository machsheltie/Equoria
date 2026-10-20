/**
 * Breeding Prediction API client (Equoria-rfsml).
 *
 * Inbreeding / lineage / genetic-probability / compatibility / coat-color
 * prediction wrappers for a sire/dam pair.
 */

import { apiClient } from '../http/apiClient.js';

/**
 * Real shape of POST /api/v1/genetics/inbreeding-analysis AFTER apiClient
 * unwraps the { success, data } envelope — the calculateDetailedInbreedingCoefficient()
 * result (backend/modules/breeding/services/genetics/inbreedingAnalysis.mjs).
 * Only the fields the frontend reads are named; the previous
 * { risk, commonAncestors[].generation } declaration and the hook's
 * { riskLevel, warnings, inbreedingCoefficient } one were fiction (Equoria-q4uem.12).
 */
export interface InbreedingCommonAncestor {
  id: number;
  name: string;
  /** Path-analysis contribution to the coefficient */
  contribution?: number;
  stallionPath?: unknown;
  marePath?: unknown;
}

export interface InbreedingAnalysis {
  /** 0–1, real path-analysis value (rounded to 3 dp by the backend) */
  coefficient: number;
  commonAncestors?: InbreedingCommonAncestor[];
  riskAssessment?: unknown;
  recommendations?: string[];
}

/**
 * A single ancestor node in the backend lineage tree (Equoria-qfdf9).
 * Produced by advancedLineageAnalysisService.mjs#buildHorseNode and
 * recursively nested via sire/dam. The deep stats/traits/discipline
 * blobs are typed loosely because their inner shape is not consumed by
 * the pedigree renderer (which reads id/name/generation/sire/dam only —
 * see components/breeding/pedigreeTreeFromLineage.ts, the canonical
 * mapper added by Equoria-55bo.2).
 */
export interface LineageTreeNode {
  id: number;
  name: string;
  generation: number;
  stats?: Record<string, number>;
  traits?: { positive: string[]; negative: string[]; hidden: string[] };
  disciplineScores?: Record<string, number>;
  competitionResults?: unknown[];
  sire: LineageTreeNode | null;
  dam: LineageTreeNode | null;
}

/**
 * Real shape of GET /api/v1/breeding/lineage-analysis/:stallionId/:mareId
 * AFTER apiClient unwraps the { success, data } envelope. The previous
 * flat { stallionLineage, mareLineage, commonAncestors } declaration was
 * fiction — no backend code ever produced it (corrected per Equoria-qfdf9;
 * real shape surfaced during Equoria-55bo.2).
 */
export interface LineageAnalysis {
  lineageTree: {
    root: {
      stallion: LineageTreeNode | null;
      mare: LineageTreeNode | null;
    };
  };
  diversityMetrics: Record<string, unknown>;
  performanceAnalysis: Record<string, unknown>;
  visualizationData: Record<string, unknown>;
}

/** Per-stat shape returned by POST /breeding/genetic-probability `statProbabilities` */
export interface StatProbability {
  expectedValue: number;
  expectedRange: { min: number; max: number };
  variance?: number;
  distribution?: unknown;
  parentalContribution?: unknown;
}

export interface TraitProbability {
  trait: string;
  /** The backend returns a percentage, 5–95 */
  probability: number;
  inheritancePattern: 'dominant' | 'heterozygous' | 'recessive' | string;
}

/**
 * Real shape of POST /api/v1/breeding/genetic-probability AFTER apiClient
 * unwraps the { success, data } envelope (the game's inheritance model).
 * Only the fields the frontend reads are named. The previous
 * { traitProbabilities[], statRanges } declaration and the hook's
 * { estimatedTraitCount, … } one were fiction (Equoria-q4uem.12).
 */
export interface GeneticProbability {
  statProbabilities?: Record<string, StatProbability>;
  traitProbabilities?: {
    positive?: TraitProbability[];
    negative?: TraitProbability[];
    hidden?: TraitProbability[];
  };
}

/**
 * Real shape of POST /api/v1/genetics/breeding-compatibility AFTER apiClient
 * unwraps the { success, data } envelope. Produced by
 * backend/modules/breeding/services/genetics/breedingCompatibility.mjs
 * #assessBreedingPairCompatibility. The previous
 * { score, rating, factors } declaration was fiction — no backend code ever
 * produced it (corrected per Equoria-m54lr).
 */
export interface BreedingCompatibility {
  /** 0–100 weighted pair score (genetic 40% + diversity 30%, inbreeding-penalized) */
  overallScore: number;
  /** 0–100 trait-overlap + stat-complement score */
  geneticCompatibility: number;
  /** 0–100 unique-trait diversity score minus shared-trait penalty */
  diversityImpact: number;
  /** 0–1 inbreeding coefficient (rounded to 3 dp by the backend) */
  inbreedingRisk: number;
  /** Predicted offspring outcomes (midpoint stats + likely traits) */
  expectedTraits: {
    expectedStats: Record<string, number>;
    likelyTraits: string[];
    diversityPotential: 'high' | 'medium' | string;
  };
  /** The game's real verdict for this pairing */
  recommendation: 'excellent' | 'good' | 'fair' | 'poor' | 'avoid' | string;
}

export interface BreedingColorPredictionEntry {
  colorName: string;
  probability: number;
  percentage: string;
}

export interface BreedingColorPredictionResult {
  sireId: number;
  damId: number;
  possibleColors: BreedingColorPredictionEntry[];
  totalCombinations: number;
  lethalCombinationsFiltered: number;
}

export const breedingPredictionApi = {
  /**
   * Calculate inbreeding coefficient for a breeding pair
   */
  getInbreedingAnalysis: (payload: { stallionId: number; mareId: number }) =>
    apiClient.post<InbreedingAnalysis>('/api/v1/genetics/inbreeding-analysis', payload),

  /**
   * Get lineage analysis for a breeding pair
   */
  getLineageAnalysis: (stallionId: number, mareId: number) =>
    apiClient.get<LineageAnalysis>(`/api/v1/breeding/lineage-analysis/${stallionId}/${mareId}`),

  /**
   * Calculate genetic probability for offspring
   */
  getGeneticProbability: (payload: { stallionId: number; mareId: number }) =>
    apiClient.post<GeneticProbability>('/api/v1/breeding/genetic-probability', payload),

  /**
   * Get breeding compatibility score
   */
  getBreedingCompatibility: (payload: { stallionId: number; mareId: number }) =>
    apiClient.post<BreedingCompatibility>('/api/v1/genetics/breeding-compatibility', payload),

  /**
   * Calculate offspring coat-color probability distribution for a sire/dam pair.
   *
   * Backend implements per-locus Punnett -> Cartesian product across all coat loci,
   * filters lethal combinations, renormalizes, and aggregates by phenotype.
   * AC6 legacy-horse case: when either parent lacks colorGenotype, the response
   * returns `{ success: true, data: null }` — caller MUST handle null data.
   *
   * @param payload sireId and damId. The foal's breed is always the dam's; there is no override.
   * @returns BreedingColorPredictionResult | null (null = AC6 legacy horse)
   */
  getColorPrediction: (payload: { sireId: number; damId: number }) =>
    apiClient.post<BreedingColorPredictionResult | null>(
      '/api/v1/horses/breeding/color-prediction',
      payload
    ),
};
