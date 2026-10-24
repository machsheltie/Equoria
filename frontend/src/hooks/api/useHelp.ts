/** Need Help? staff list (Equoria-vc5x1). Online status is refreshed every minute. */

import { useQuery } from '@tanstack/react-query';
import { helpApi } from '@/lib/api-client';

const helpStaffStaleTime = 30_000;
const helpStaffRefetchMs = 60_000;

export function useHelpStaff() {
  return useQuery({
    queryKey: ['help', 'staff'],
    queryFn: () => helpApi.getStaff(),
    staleTime: helpStaffStaleTime,
    refetchInterval: helpStaffRefetchMs,
    networkMode: 'always',
  });
}
