/**
 * The Steward's Office horse lookup (Equoria-puj1e.5). A lookup is asked for on
 * demand, so it is a mutation; its key sits under ['staff'] like every office hook.
 */

import { useMutation } from '@tanstack/react-query';
import { staffHorsesApi } from '@/lib/api/staffHorses';

export function useStaffHorseLookup() {
  return useMutation({
    mutationKey: ['staff', 'horse-lookup'],
    mutationFn: (q: string) => staffHorsesApi.lookup(q),
  });
}
