/**
 * useHorseCareStatus: the horse page's Last Shod / Last Trained / Last Groomed
 * data and the server's can-train / can-groom verdicts (Equoria-0l0tq).
 *
 * The key sits under ['horses', horseId], so the invalidations that training,
 * grooming, shoeing and feeding already issue for the horse refresh it.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchHorseCareStatus, type HorseCareStatus } from '@/lib/api/horseCareStatus';
import type { ApiError } from '@/lib/api-client';

export const horseCareStatusKey = (horseId: number) => ['horses', horseId, 'care-status'] as const;

export const useHorseCareStatus = (horseId: number) =>
  useQuery<HorseCareStatus, ApiError>({
    queryKey: horseCareStatusKey(horseId),
    queryFn: () => fetchHorseCareStatus(horseId),
    enabled: Number.isFinite(horseId) && horseId > 0,
    staleTime: 30 * 1000,
  });
