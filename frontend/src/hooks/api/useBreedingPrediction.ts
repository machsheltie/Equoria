import { useQuery } from '@tanstack/react-query';
import { ApiError, breedingPredictionApi, horsesApi } from '@/lib/api-client';

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
  useQuery<any, ApiError>({
    queryKey: breedingPredictionKeys.horseBreedingData(horseId),
    queryFn: () => horsesApi.getBreedingData(horseId),
    enabled: Boolean(horseId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

/**
 * Calculate inbreeding analysis for a breeding pair
 */
export const useInbreedingAnalysis = (stallionId: number, mareId: number) =>
  useQuery<any, ApiError>({
    queryKey: breedingPredictionKeys.inbreeding(stallionId, mareId),
    queryFn: () => breedingPredictionApi.getInbreedingAnalysis({ stallionId, mareId }),
    enabled: Boolean(stallionId && mareId),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

/**
 * Get lineage analysis for a breeding pair
 */
export const useLineageAnalysis = (stallionId: number, mareId: number) =>
  useQuery<any, ApiError>({
    queryKey: breedingPredictionKeys.lineage(stallionId, mareId),
    queryFn: () => breedingPredictionApi.getLineageAnalysis(stallionId, mareId),
    enabled: Boolean(stallionId && mareId),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

/**
 * Calculate genetic probability for offspring
 */
export const useGeneticProbability = (stallionId: number, mareId: number) =>
  useQuery<any, ApiError>({
    queryKey: breedingPredictionKeys.genetic(stallionId, mareId),
    queryFn: () => breedingPredictionApi.getGeneticProbability({ stallionId, mareId }),
    enabled: Boolean(stallionId && mareId),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

/**
 * Get breeding compatibility score
 */
export const useBreedingCompatibility = (stallionId: number, mareId: number) =>
  useQuery<any, ApiError>({
    queryKey: breedingPredictionKeys.compatibility(stallionId, mareId),
    queryFn: () => breedingPredictionApi.getBreedingCompatibility({ stallionId, mareId }),
    enabled: Boolean(stallionId && mareId),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

export const breedingPredictionQueryKeys = breedingPredictionKeys;
