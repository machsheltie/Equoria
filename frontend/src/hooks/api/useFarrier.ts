/**
 * Farrier API Hooks (Epic 10; one weekly action since Equoria-zmqzf)
 *
 * - Shoe a horse (once a week, 50 coins)
 *
 * Follows useVet.ts / useGrooms.ts pattern.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { farrierApi, ApiError, FarrierShoeingResult } from '@/lib/api-client';

export type { FarrierShoeingResult };

export function useShoeHorse() {
  const queryClient = useQueryClient();

  return useMutation<FarrierShoeingResult, ApiError, { horseId: number }>({
    mutationFn: (data) => farrierApi.shoeHorse(data),
    onSuccess: () => {
      // Invalidate horse data so lastShod and the stat that rose refresh
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      // Shoeing spends coins: refresh the live balance (nav + Bank) — Equoria-z3yv3
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
