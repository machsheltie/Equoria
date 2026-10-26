/**
 * Daily groom care hooks (Equoria-j765w.2, Equoria-akwyn; owner ruling q67).
 *
 * The care status key sits under ['horses', horseId] so anything that
 * invalidates the horse refreshes it. Grooming changes the horse's bond and
 * last-groomed date, the home reminders and the hub's next actions, so a
 * successful groom invalidates all of them.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCareStatus,
  fetchUngroomedToday,
  groomHorse,
  type CareStatus,
  type UngroomedHorse,
} from '@/lib/api/groomCare';
import { nextActionsKeys } from '@/hooks/api/useNextActions';
import type { ApiError } from '@/lib/api-client';

export const groomCareKeys = {
  status: (horseId: number) => ['horses', horseId, 'groom-care'] as const,
  ungroomedToday: ['groom-care', 'ungroomed-today'] as const,
};

export const useCareStatus = (horseId: number) =>
  useQuery<CareStatus, ApiError>({
    queryKey: groomCareKeys.status(horseId),
    queryFn: () => fetchCareStatus(horseId),
    enabled: Number.isFinite(horseId) && horseId > 0,
    staleTime: 30 * 1000,
  });

export const useGroomHorse = (horseId: number) => {
  const queryClient = useQueryClient();
  return useMutation<CareStatus, ApiError, { activity?: string }>({
    mutationFn: ({ activity }) => groomHorse(horseId, activity),
    onSuccess: (status) => {
      // The answer is the horse's care status after grooming: show it at once.
      queryClient.setQueryData(groomCareKeys.status(horseId), status);
      queryClient.invalidateQueries({ queryKey: ['horses', horseId] });
      queryClient.invalidateQueries({ queryKey: groomCareKeys.ungroomedToday });
      queryClient.invalidateQueries({ queryKey: nextActionsKeys.all });
    },
    onError: (error) => {
      // A 409 means the horse's state moved (groomed elsewhere, groom unassigned
      // or unable to work): re-read it so the Care area says why.
      if (error?.statusCode === 409) {
        queryClient.invalidateQueries({ queryKey: groomCareKeys.status(horseId) });
      }
    },
  });
};

export const useUngroomedToday = (enabled = true) =>
  useQuery<UngroomedHorse[], ApiError>({
    queryKey: groomCareKeys.ungroomedToday,
    queryFn: fetchUngroomedToday,
    enabled,
    staleTime: 60 * 1000,
  });
