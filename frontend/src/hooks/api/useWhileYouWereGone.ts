/**
 * useWhileYouWereGone hook (Task 24-2)
 *
 * Fetches activity summary for events since user's last visit.
 * Triggered manually (not on mount) — call after checking 4hr absence threshold.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface WYAGItem {
  type:
    | 'competition-result'
    | 'foal-milestone'
    | 'message'
    | 'club-activity'
    | 'training-complete'
    | 'market-sale';
  priority: number;
  title: string;
  description: string;
  timestamp: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

interface WYAGResponse {
  items: WYAGItem[];
  since: string;
  hasMore: boolean;
}

export const wyagKeys = {
  all: (since: string) => ['wyag', since] as const,
};

export function useWhileYouWereGone(since: string | null, enabled: boolean) {
  return useQuery({
    queryKey: wyagKeys.all(since ?? ''),
    queryFn: () =>
      apiClient.get<WYAGResponse>(
        `/api/v1/while-you-were-gone?since=${encodeURIComponent(since!)}`
      ),
    enabled: !!since && enabled,
    staleTime: Infinity, // Once fetched per session, don't refetch
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
}
