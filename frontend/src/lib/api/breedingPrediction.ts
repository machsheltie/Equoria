/**
 * Breeding Prediction API client (Equoria-rfsml).
 *
 * Inbreeding / lineage / genetic-probability / compatibility / coat-color
 * prediction wrappers for a sire/dam pair.
 */

import { apiClient } from '../http/apiClient.js';

export interface InbreedingAnalysis {
  coefficient: number;
  risk: string;
  commonAncestors: Array<{ name: string; generation: number }>;
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

export interface GeneticProbability {
  traitProbabilities: Array<{ trait: string; probability: number }>;
  statRanges: Record<string, { min: number; max: number; expected: number }>;
}

export interface BreedingCompatibility {
  score: number;
  rating: string;
  factors: Array<{ name: string; impact: number; description: string }>;
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
   * @param payload sireId/damId required, foalBreedId optional (defaults to dam's breed)
   * @returns BreedingColorPredictionResult | null (null = AC6 legacy horse)
   */
  getColorPrediction: (payload: { sireId: number; damId: number; foalBreedId?: number }) =>
    apiClient.post<BreedingColorPredictionResult | null>(
      '/api/v1/horses/breeding/color-prediction',
      payload
    ),
};
