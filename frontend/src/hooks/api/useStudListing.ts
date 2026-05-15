/**
 * useStudListing hooks (Equoria-q072)
 *
 * React Query mutations for listing / unlisting a stallion at stud.
 *   - useListAtStud()   → POST /api/v1/horses/:id/stud-listing
 *   - useUnlistAtStud() → DELETE /api/v1/horses/:id/stud-listing
 *
 * Both invalidate the per-horse query so the UI reflects new
 * studStatus + studFee immediately.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { horsesApi } from '@/lib/api-client';
import { toast } from 'sonner';

export function useListAtStud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ horseId, studFee }: { horseId: number; studFee: number }) =>
      horsesApi.listAtStud(horseId, studFee),
    onSuccess: (_data, vars) => {
      toast.success(`Listed at stud for ${vars.studFee.toLocaleString()} coins`);
      qc.invalidateQueries({ queryKey: ['horses'] });
      qc.invalidateQueries({ queryKey: ['horse', vars.horseId] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to list horse at stud');
    },
  });
}

export function useUnlistAtStud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (horseId: number) => horsesApi.unlistAtStud(horseId),
    onSuccess: (_data, horseId) => {
      toast.success('Stud listing removed');
      qc.invalidateQueries({ queryKey: ['horses'] });
      qc.invalidateQueries({ queryKey: ['horse', horseId] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to unlist horse from stud');
    },
  });
}
