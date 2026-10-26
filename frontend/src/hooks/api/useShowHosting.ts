/**
 * Hosting a show: the weekly count and the create mutation (Equoria-oey96.13).
 *
 * Creating a show moves coins (the prize leaves the host at creation), so a
 * success refreshes every live balance consumer, the open-show list the new show
 * joins, and the weekly count.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api-client';
import {
  showsApi,
  type CreateShowInput,
  type HostedShow,
  type ShowHosting,
} from '@/lib/api/showsApi';
import { competitionKeys } from './useCompetitions';

export const showHostingKeys = {
  all: ['shows', 'hosting'] as const,
};

export function useShowHosting(enabled = true) {
  return useQuery<ShowHosting, ApiError>({
    queryKey: showHostingKeys.all,
    queryFn: showsApi.hosting,
    enabled,
    staleTime: 0,
  });
}

export function useCreateShow() {
  const queryClient = useQueryClient();
  const { refetchProfile } = useAuth();
  return useMutation<{ show: HostedShow }, ApiError, CreateShowInput>({
    mutationFn: showsApi.create,
    onSuccess: async () => {
      await Promise.all([
        refetchProfile(),
        queryClient.invalidateQueries({ queryKey: showHostingKeys.all }),
        queryClient.invalidateQueries({ queryKey: competitionKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);
    },
  });
}
