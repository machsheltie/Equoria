/**
 * useUserBalance hook
 * Fetches the current user's balance. Cache spec: staleTime 30s, gcTime 2min, refetchOnWindowFocus true.
 * Query key: ['user', 'balance', userId]
 */
import { useQuery } from '@tanstack/react-query';
import { fetchUserBalance } from '@/lib/api/user';

export function useUserBalance(userId: number | null | undefined) {
  return useQuery({
    queryKey: ['user', 'balance', userId],
    queryFn: () => fetchUserBalance(userId!),
    enabled: userId != null,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
