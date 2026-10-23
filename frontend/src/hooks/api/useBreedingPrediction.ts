import { useQuery } from '@tanstack/react-query';
import { ApiError, breedingPredictionApi, horsesApi } from '@/lib/api-client';
import type {
  BreedingCompatibility,
  GeneticProbability,
  HorseBreedingData,
  InbreedingAnalysis,
  LineageAnalysis,
} from '@/lib/api-client';

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
 * Owner ruling 2026-10-23 (Equoria-m00gp / Equoria-3jnsz, option a): the breeding
 * compatibility screen shows an honest error with Try again when its data cannot
 * load. TanStack's default networkMode 'online' PAUSES an offline query instead
 * (no data, no error), so the confirmation summary analysed forever. 'always'
 * runs the request, which fails offline and ends in the error state.
 */
const honestOffline = { networkMode: 'always' } as const;

/**
 * Fetch breeding data for a single horse
 */
export const useHorseBreedingData = (horseId: number) =>
  useQuery<HorseBreedingData, ApiError>({
    queryKey: breedingPredictionKeys.horseBreedingData(horseId),
    queryFn: () => horsesApi.getBreedingData(horseId),
    enabled: Boolean(horseId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

/**
 * Calculate inbreeding analysis for a breeding pair
 */
export const useInbreedingAnalysis = (stallionId: number, mareId: number) =>
  useQuery<InbreedingAnalysis, ApiError>({
    queryKey: breedingPredictionKeys.inbreeding(stallionId, mareId),
    queryFn: () => breedingPredictionApi.getInbreedingAnalysis({ stallionId, mareId }),
    enabled: Boolean(stallionId && mareId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...honestOffline,
  });

/**
 * Get lineage analysis for a breeding pair
 */
export const useLineageAnalysis = (stallionId: number, mareId: number) =>
  useQuery<LineageAnalysis, ApiError>({
    queryKey: breedingPredictionKeys.lineage(stallionId, mareId),
    queryFn: () => breedingPredictionApi.getLineageAnalysis(stallionId, mareId),
    enabled: Boolean(stallionId && mareId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...honestOffline,
  });

/**
 * Calculate genetic probability for offspring
 */
export const useGeneticProbability = (stallionId: number, mareId: number) =>
  useQuery<GeneticProbability, ApiError>({
    queryKey: breedingPredictionKeys.genetic(stallionId, mareId),
    queryFn: () => breedingPredictionApi.getGeneticProbability({ stallionId, mareId }),
    enabled: Boolean(stallionId && mareId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...honestOffline,
  });

/**
 * Get breeding compatibility score — typed to the REAL backend response
 * (assessBreedingPairCompatibility shape; see lib/api/breedingPrediction.ts,
 * Equoria-m54lr).
 */
export const useBreedingCompatibility = (stallionId: number, mareId: number) =>
  useQuery<BreedingCompatibility, ApiError>({
    queryKey: breedingPredictionKeys.compatibility(stallionId, mareId),
    queryFn: () => breedingPredictionApi.getBreedingCompatibility({ stallionId, mareId }),
    enabled: Boolean(stallionId && mareId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...honestOffline,
  });

export const breedingPredictionQueryKeys = breedingPredictionKeys;
