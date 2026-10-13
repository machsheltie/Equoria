/**
 * Staff hooks — the Steward's Office (Equoria-puj1e.1).
 *
 * Every key sits under ['staff'] so a fresh check-in can invalidate the whole
 * office at once. Mutations carry a ['staff', ...] mutationKey too, so the
 * office can tell its own failures apart. Query functions propagate errors;
 * nothing is defaulted.
 */

import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  staffApi,
  type FileTicketPayload,
  type StaffLogFilter,
  type TicketStatus,
} from '@/lib/api/staff';
import type { ApiError } from '@/lib/http/types';

export const staffKeys = {
  all: ['staff'] as const,
  me: ['staff', 'me'] as const,
  log: ['staff', 'log'] as const,
  roles: ['staff', 'roles'] as const,
  tickets: ['staff', 'tickets'] as const,
  ticket: (id: number) => ['staff', 'tickets', id] as const,
};

/** The refusal a capability-guarded route gives when this browser is not checked in. */
export function isCheckinRequired(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as ApiError).statusCode === 403 &&
    (error as ApiError).code === 'STAFF_CHECKIN_REQUIRED'
  );
}

/** HTTP status of a transport error, or undefined. */
export function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null
    ? (error as Partial<ApiError>).statusCode
    : undefined;
}

/**
 * A 404 from any staff area means the guard no longer sees a steward (a
 * moderator revoked mid-visit), or at least that /me is worth asking again.
 * Re-read /me at once so a revoked steward is sent home now, not at the next
 * background refetch. /me's own 404 is the page's job and is not watched.
 */
export function useStaffRevocationWatch() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const recheckOn404 = (error: unknown) => {
      if (statusOf(error) === 404) {
        void queryClient.invalidateQueries({ queryKey: staffKeys.me });
      }
    };
    const stopQueries = queryClient.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey;
      if (
        event.type === 'updated' &&
        event.action.type === 'error' &&
        key[0] === staffKeys.all[0] &&
        key[1] !== 'me'
      ) {
        recheckOn404(event.action.error);
      }
    });
    const stopMutations = queryClient.getMutationCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.action.type === 'error' &&
        event.mutation.options.mutationKey?.[0] === staffKeys.all[0]
      ) {
        recheckOn404(event.action.error);
      }
    });
    return () => {
      stopQueries();
      stopMutations();
    };
  }, [queryClient]);
}

export function useStaffMe() {
  return useQuery({ queryKey: staffKeys.me, queryFn: staffApi.me });
}

export function useRequestCheckin() {
  return useMutation({
    mutationKey: [...staffKeys.all, 'checkin-request'],
    mutationFn: () => staffApi.requestCheckin(),
  });
}

export function useVerifyCheckin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...staffKeys.all, 'checkin-verify'],
    mutationFn: (code: string) => staffApi.verifyCheckin(code),
    // Every other staff read may hold a stale "check in first" refusal: drop
    // them so the areas load fresh, and re-read /me before the caller's own
    // onSuccess runs (TanStack awaits this promise first).
    onSuccess: async () => {
      queryClient.removeQueries({
        queryKey: staffKeys.all,
        predicate: (query) => query.queryKey[1] !== 'me',
      });
      await queryClient.invalidateQueries({ queryKey: staffKeys.me });
    },
  });
}

/** One cache entry per filter, so a new filter starts again from the newest entry. */
export function useStaffLog(filter: StaffLogFilter = {}) {
  const actorId = filter.actorId ?? '';
  const capability = filter.capability ?? '';
  return useInfiniteQuery({
    queryKey: [...staffKeys.log, { actorId, capability }],
    queryFn: ({ pageParam }) => staffApi.log({ actorId, capability }, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useStaffList(enabled: boolean) {
  return useQuery({ queryKey: staffKeys.roles, queryFn: staffApi.listStaff, enabled });
}

export function useLookupUser() {
  return useMutation({
    mutationKey: [...staffKeys.all, 'lookup'],
    mutationFn: (username: string) => staffApi.lookupUser(username),
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...staffKeys.all, 'set-role'],
    mutationFn: (args: { userId: string; role: 'moderator' | 'user'; reason: string }) =>
      staffApi.setRole(args.userId, args.role, args.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.roles });
      queryClient.invalidateQueries({ queryKey: staffKeys.log });
    },
  });
}

export function useStaffTickets() {
  return useQuery({ queryKey: staffKeys.tickets, queryFn: staffApi.listTickets });
}

export function useStaffTicket(id: number) {
  return useQuery({ queryKey: staffKeys.ticket(id), queryFn: () => staffApi.getTicket(id) });
}

export function useFileTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...staffKeys.all, 'file-ticket'],
    mutationFn: (payload: FileTicketPayload) => staffApi.fileTicket(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.tickets });
      queryClient.invalidateQueries({ queryKey: staffKeys.log });
    },
  });
}

export function useReplyToTicket(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...staffKeys.all, 'reply'],
    mutationFn: (body: string) => staffApi.replyToTicket(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKeys.ticket(id) }),
  });
}

export function useSetTicketStatus(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...staffKeys.all, 'set-status'],
    mutationFn: (status: TicketStatus) => staffApi.setTicketStatus(id, status),
    onSuccess: () => {
      // The prefix covers both the list and this ticket's thread.
      queryClient.invalidateQueries({ queryKey: staffKeys.tickets });
      queryClient.invalidateQueries({ queryKey: staffKeys.log });
    },
  });
}
