/**
 * The staff hiring pools: riders and grooms back for hire (Equoria-266h7).
 *
 * Owner rulings 2026-10-28: there is a hiring pool where released and unpaid staff
 * return (q153), at their current level with what they have revealed intact (q177),
 * and hiring is one click with the fee on the button (q230).
 *
 * The pool queries sit under the riders / grooms key prefixes, so every existing
 * invalidation of those prefixes (a hire, a dismissal) refreshes the pool too.
 */

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ridersApi, groomsApi, type ApiError } from '@/lib/api-client';
import type { PoolGroomList, PoolRiderList } from '@/lib/api/staffPoolTypes';
import { riderKeys } from './useRiders';
import { groomKeys } from './useGrooms';

export const riderPoolKey = [...riderKeys.all, 'freeAgents'] as const;
export const groomPoolKey = [...groomKeys.all, 'freeAgents'] as const;

function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined;
  const status = (error as { statusCode: unknown }).statusCode;
  return typeof status === 'number' ? status : undefined;
}

/** A spent balance shows everywhere the player's coins are read. */
function settleBalance(queryClient: QueryClient, remainingMoney: number | undefined) {
  if (typeof remainingMoney === 'number') {
    queryClient.setQueryData(['profile'], (old: { user: Record<string, unknown> } | undefined) =>
      old?.user ? { ...old, user: { ...old.user, money: remainingMoney } } : old
    );
  }
  void queryClient.invalidateQueries({ queryKey: ['profile'] });
}

/**
 * 404 (no longer in the pool) and 409 (another stable hired them first) both mean the
 * list on screen is out of date; fetch it again so the card goes away.
 */
function refreshStalePool(queryClient: QueryClient, error: unknown, poolKey: readonly unknown[]) {
  const status = statusOf(error);
  if (status === 404 || status === 409) {
    void queryClient.invalidateQueries({ queryKey: poolKey });
  }
}

export function useRiderPool() {
  return useQuery<PoolRiderList, ApiError>({
    queryKey: riderPoolKey,
    queryFn: ridersApi.getFreeAgents,
    staleTime: 60 * 1000,
  });
}

export function useHireRiderFromPool() {
  const queryClient = useQueryClient();
  return useMutation<Awaited<ReturnType<typeof ridersApi.hireFreeAgent>>, ApiError, number>({
    mutationFn: (riderId) => ridersApi.hireFreeAgent(riderId),
    onSuccess: (result) => {
      settleBalance(queryClient, result?.remainingMoney);
      // The rider joins the roster and leaves the pool; both live under riderKeys.all.
      void queryClient.invalidateQueries({ queryKey: riderKeys.all });
    },
    onError: (error) => refreshStalePool(queryClient, error, riderPoolKey),
  });
}

export function useGroomPool() {
  return useQuery<PoolGroomList, ApiError>({
    queryKey: groomPoolKey,
    queryFn: groomsApi.getFreeAgents,
    staleTime: 60 * 1000,
  });
}

export function useHireGroomFromPool() {
  const queryClient = useQueryClient();
  return useMutation<Awaited<ReturnType<typeof groomsApi.hireFreeAgent>>, ApiError, number>({
    mutationFn: (groomId) => groomsApi.hireFreeAgent(groomId),
    onSuccess: (result) => {
      settleBalance(queryClient, result?.remainingMoney);
      // The groom joins the roster (and the weekly fees) and leaves the pool.
      void queryClient.invalidateQueries({ queryKey: groomKeys.all });
    },
    onError: (error) => refreshStalePool(queryClient, error, groomPoolKey),
  });
}
