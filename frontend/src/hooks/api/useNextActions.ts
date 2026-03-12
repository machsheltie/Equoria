/**
 * useNextActions hook (Task 23-1 / 23-4)
 *
 * Fetches prioritised action list from GET /api/v1/next-actions.
 * Server computes priorities based on cooldowns, foal ages, pending results.
 * Client formats narrative text in NextActionsBar.
 *
 * Cache: 2min staleTime (actions change on user activity, not real-time)
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface NextAction {
  type:
    | 'train'
    | 'compete'
    | 'breed'
    | 'groom-foal'
    | 'claim-prize'
    | 'check-results'
    | 'visit-vet';
  priority: number;
  horseId?: number;
  horseName?: string;
  metadata?: Record<string, unknown>;
}

interface NextActionsResponse {
  actions: NextAction[];
}

export const nextActionsKeys = {
  all: ['next-actions'] as const,
};

export function useNextActions() {
  return useQuery({
    queryKey: nextActionsKeys.all,
    queryFn: async () => {
      const result = await apiClient.get<NextActionsResponse>('/api/v1/next-actions');
      return result.actions ?? [];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
}
