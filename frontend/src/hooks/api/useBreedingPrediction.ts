import { useQuery } from '@tanstack/react-query';
import { ApiError, breedingPredictionApi, horsesApi } from '@/lib/api-client';

export interface HorseBreedingData {
  horseName: string;
  breedingQuality: string;
  traitSummary: {
    totalTraits: number;
    [key: string]: unknown;
  };
  temperamentInfluence?: {
    temperament?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface InbreedingAnalysisResult {
  riskLevel: 'none' | 'low' | 'moderate' | 'high' | 'extreme' | string;
  inbreedingCoefficient: number;
  warnings: string[];
  recommendations: string[];
  [key: string]: unknown;
}

export interface GeneticProbabilityResult {
  estimatedTraitCount: {
    expected: number;
    min: number;
    max: number;
  };
  confidenceLevel: string;
  categoryProbabilities: Record<string, number>;
  [key: string]: unknown;
}

const breedingPredictionKeys = {
  root: ['breeding-prediction'] as const,
  horseBreedingData: (horseId: number) => ['horses', horseId, 'breeding-data'] as const,
  inbreeding: (stallionId: number, mareId: number) =>
    ['breeding-prediction', 'inbreeding', stallionId, mareId] as const,
  lineage: (stallionId: number, mareId: number) =>
    ['breeding-prediction', 'lineage', stallionId, mareId] as const,
  genetic: (stallionId: number, mareId: number) =>
    ['breeding-prediction', 'genetic', stallionId, mareId] as const,
  compatibility: (stallionId: number, mareId: number) =>
    ['breeding-prediction', 'compatibility', stallionId, mareId] as const,
};

/**
 * Fetch breeding data for a single horse
 */
export const useHorseBreedingData = (horseId: number) =>
  useQuery<HorseBreedingData, ApiError>({
    queryKey: breedingPredictionKeys.horseBreedingData(horseId),
    queryFn: () => horsesApi.getBreedingData(horseId) as Promise<HorseBreedingData>,
    enabled: Boolean(horseId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

/**
 * Calculate inbreeding analysis for a breeding pair
 */
export const useInbreedingAnalysis = (stallionId: number, mareId: number) =>
  useQuery<InbreedingAnalysisResult, ApiError>({
    queryKey: breedingPredictionKeys.inbreeding(stallionId, mareId),
    queryFn: () =>
      breedingPredictionApi.getInbreedingAnalysis({
        stallionId,
        mareId,
      }) as unknown as Promise<InbreedingAnalysisResult>,
    enabled: Boolean(stallionId && mareId),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

/**
 * Get lineage analysis for a breeding pair
 */
export const useLineageAnalysis = (stallionId: number, mareId: number) =>
  useQuery<unknown, ApiError>({
    queryKey: breedingPredictionKeys.lineage(stallionId, mareId),
    queryFn: () => breedingPredictionApi.getLineageAnalysis(stallionId, mareId),
    enabled: Boolean(stallionId && mareId),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

/**
 * Calculate genetic probability for offspring
 */
export const useGeneticProbability = (stallionId: number, mareId: number) =>
  useQuery<GeneticProbabilityResult, ApiError>({
    queryKey: breedingPredictionKeys.genetic(stallionId, mareId),
    queryFn: () =>
      breedingPredictionApi.getGeneticProbability({
        stallionId,
        mareId,
      }) as unknown as Promise<GeneticProbabilityResult>,
    enabled: Boolean(stallionId && mareId),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

/**
 * Get breeding compatibility score
 */
export const useBreedingCompatibility = (stallionId: number, mareId: number) =>
  useQuery<unknown, ApiError>({
    queryKey: breedingPredictionKeys.compatibility(stallionId, mareId),
    queryFn: () => breedingPredictionApi.getBreedingCompatibility({ stallionId, mareId }),
    enabled: Boolean(stallionId && mareId),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

export const breedingPredictionQueryKeys = breedingPredictionKeys;
