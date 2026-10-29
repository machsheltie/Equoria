/**
 * Pay Groom / Pay Rider hooks (Equoria-hc96y).
 *
 * Payday is a player action (owner rulings 2026-10-28; q268): one click pays one groom
 * or rider for this week. The POST answers with the refreshed pay state, which is
 * written straight into the cache so the Staff page updates in place — no receipt, no
 * confirm step. The balance in the header follows from the same answer.
 */

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/lib/api-client';
import { staffPayApi, type GroomPayStatus, type RiderPayStatus } from '@/lib/api/staffPay';
import { groomKeys } from './useGrooms';
import { riderKeys } from './useRiders';

export const staffPayKeys = {
  grooms: () => [...groomKeys.all, 'pay'] as const,
  riders: () => [...riderKeys.all, 'pay'] as const,
};

function setProfileMoney(queryClient: QueryClient, money: number) {
  queryClient.setQueryData(['profile'], (old: { user: Record<string, unknown> } | undefined) => {
    if (!old?.user) return old;
    return { ...old, user: { ...old.user, money } };
  });
}

export function useGroomPay(enabled = true) {
  return useQuery<GroomPayStatus, ApiError>({
    queryKey: staffPayKeys.grooms(),
    queryFn: staffPayApi.getGroomPay,
    enabled,
    networkMode: 'always',
  });
}

export function useRiderPay(enabled = true) {
  return useQuery<RiderPayStatus, ApiError>({
    queryKey: staffPayKeys.riders(),
    queryFn: staffPayApi.getRiderPay,
    enabled,
    networkMode: 'always',
  });
}

export function usePayGroom() {
  const queryClient = useQueryClient();
  return useMutation<GroomPayStatus, ApiError, number>({
    mutationFn: (groomId) => staffPayApi.payGroom(groomId),
    onSuccess: (status) => {
      queryClient.setQueryData(staffPayKeys.grooms(), status);
      setProfileMoney(queryClient, status.money);
      void queryClient.invalidateQueries({ queryKey: groomKeys.salaries() });
      void queryClient.invalidateQueries({ queryKey: staffPayKeys.riders() });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    // Already paid elsewhere, or the balance moved: show the real state again.
    onError: () => void queryClient.invalidateQueries({ queryKey: staffPayKeys.grooms() }),
  });
}

export function usePayRider() {
  const queryClient = useQueryClient();
  return useMutation<RiderPayStatus, ApiError, number>({
    mutationFn: (riderId) => staffPayApi.payRider(riderId),
    onSuccess: (status) => {
      queryClient.setQueryData(staffPayKeys.riders(), status);
      setProfileMoney(queryClient, status.money);
      void queryClient.invalidateQueries({ queryKey: [...riderKeys.all, 'user'] });
      void queryClient.invalidateQueries({ queryKey: staffPayKeys.grooms() });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: staffPayKeys.riders() }),
  });
}
