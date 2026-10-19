import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  BreedRequest,
  BreedResponse,
  Foal,
  FoalActivity,
  FoalDevelopment,
  breedingApi,
} from '@/lib/api-client';
import { retryOnMountUnlessClientError } from '@/lib/queryClient';

const breedingKeys = {
  root: ['breeding'] as const,
  pairs: ['breeding', 'pairs'] as const,
  foal: (foalId: number) => ['foals', foalId] as const,
  development: (foalId: number) => ['foals', foalId, 'development'] as const,
  activities: (foalId: number) => ['foals', foalId, 'activities'] as const,
};

export const useBreedFoal = () => {
  const queryClient = useQueryClient();

  return useMutation<BreedResponse, ApiError, BreedRequest>({
    mutationFn: (payload) => breedingApi.breedFoal(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: breedingKeys.pairs });
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      if (data.foalId) {
        queryClient.invalidateQueries({ queryKey: breedingKeys.foal(data.foalId) });
        queryClient.invalidateQueries({ queryKey: breedingKeys.development(data.foalId) });
      }
    },
  });
};

export const useFoal = (foalId: number) =>
  useQuery<Foal, ApiError>({
    queryKey: breedingKeys.foal(foalId),
    queryFn: () => breedingApi.getFoal(foalId),
    enabled: Boolean(foalId),
    staleTime: 60 * 1000,
  });

export const useFoalDevelopment = (foalId: number) =>
  // Equoria-n3yw6: data can be null when the backend has no development
  // record yet — consumers branch on `!development` for an honest empty state.
  useQuery<FoalDevelopment | null, ApiError>({
    queryKey: breedingKeys.development(foalId),
    queryFn: () => breedingApi.getFoalDevelopment(foalId),
    enabled: Boolean(foalId),
    staleTime: 30 * 1000,
    // Equoria-v61q2: FoalDetailPage gates on this query's loading state and
    // then mounts FoalDevelopmentTracker, which subscribes to it again. The
    // default mount re-fetch of a 404 ("Horse is not a foal") looped.
    retryOnMount: retryOnMountUnlessClientError,
  });

export const useFoalActivities = (foalId: number) =>
  useQuery<FoalActivity[], ApiError>({
    queryKey: breedingKeys.activities(foalId),
    queryFn: () => breedingApi.getFoalActivities(foalId),
    enabled: Boolean(foalId),
    staleTime: 15 * 1000,
  });

export const useRevealFoalTraits = (foalId: number) => {
  const queryClient = useQueryClient();

  return useMutation<{ traits: string[] }, ApiError>({
    mutationFn: () => breedingApi.revealTraits(foalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: breedingKeys.foal(foalId) });
    },
  });
};

export const breedingQueryKeys = breedingKeys;
