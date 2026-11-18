/**
 * The Owner's outage tools (Equoria-puj1e.5): the nightly-job hold, outage
 * time-back and its undo, and "deliver overdue foals now". Keys sit under
 * ['staff'] like every Steward's Office hook, so a fresh check-in refreshes
 * them too.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  staffTimeBackApi,
  type TimeBackCodePurpose,
  type TimeBackWindow,
} from '@/lib/api/staffTimeBack';

export const timeBackKeys = {
  hold: ['staff', 'jobs-hold'] as const,
  list: ['staff', 'time-back'] as const,
  preview: (outage: TimeBackWindow | null) => ['staff', 'time-back', 'preview', outage] as const,
};

export function useJobHold() {
  return useQuery({ queryKey: timeBackKeys.hold, queryFn: staffTimeBackApi.jobHold });
}

/** Hold (with a note) or release the nightly jobs; the status line re-reads the hold. */
export function useSetJobHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['staff', 'set-job-hold'],
    mutationFn: ({ held, reason }: { held: boolean; reason?: string }) =>
      held ? staffTimeBackApi.holdJobs(reason ?? '') : staffTimeBackApi.releaseJobs(),
    onSuccess: (data) => {
      queryClient.setQueryData(timeBackKeys.hold, data);
    },
  });
}

export function useTimeBacks() {
  return useQuery({ queryKey: timeBackKeys.list, queryFn: staffTimeBackApi.timeBacks });
}

/** The dry run for a window; only asked for once both ends are entered. */
export function useTimeBackPreview(outage: TimeBackWindow | null) {
  return useQuery({
    queryKey: timeBackKeys.preview(outage),
    queryFn: () => staffTimeBackApi.preview(outage as TimeBackWindow),
    enabled: outage !== null,
  });
}

export function useSendTimeBackCode() {
  return useMutation({
    mutationKey: ['staff', 'time-back-code'],
    mutationFn: (purpose: TimeBackCodePurpose) => staffTimeBackApi.sendCode(purpose),
  });
}

/** Apply and undo change game clocks everywhere, so every horse view re-reads. */
function useTimeBackWrite<TVars>(
  key: string,
  write: (vars: TVars) => ReturnType<typeof staffTimeBackApi.apply>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['staff', key],
    mutationFn: write,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeBackKeys.list });
      queryClient.invalidateQueries({ queryKey: ['horses'] });
    },
  });
}

export function useApplyTimeBack() {
  return useTimeBackWrite(
    'apply-time-back',
    ({ outage, code }: { outage: TimeBackWindow; code: string }) =>
      staffTimeBackApi.apply(outage, code)
  );
}

export function useUndoTimeBack() {
  return useTimeBackWrite('undo-time-back', ({ id, code }: { id: number; code: string }) =>
    staffTimeBackApi.undo(id, code)
  );
}

export function useDeliverOverdueFoals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['staff', 'deliver-overdue-foals'],
    mutationFn: (_vars: void) => staffTimeBackApi.deliverOverdueFoals(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['horses'] });
    },
  });
}
