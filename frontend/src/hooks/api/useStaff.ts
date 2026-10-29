/**
 * Staff hooks — the Steward's Office (Equoria-puj1e.1).
 *
 * Every key sits under ['staff'] so a fresh check-in can invalidate the whole
 * office at once. Mutations carry a ['staff', ...] mutationKey too, so the
 * office can tell its own failures apart. Query functions propagate errors;
 * nothing is defaulted.
 */

import { useEffect, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  staffApi,
  type ConductAction,
  type PayrollStaffType,
  type FileTicketPayload,
  type StaffLogFilter,
  type TicketStatus,
} from '@/lib/api/staff';
import type { ApiError } from '@/lib/http/types';

export const staffKeys = {
  all: ['staff'] as const,
  me: ['staff', 'me'] as const,
  log: ['staff', 'log'] as const,
  // Under the ledger's prefix, so anything that refreshes the ledger refreshes it too.
  logActors: ['staff', 'log', 'actors'] as const,
  roles: ['staff', 'roles'] as const,
  conduct: (userId: string) => ['staff', 'conduct', userId] as const,
  linkedAccounts: (userId: string) => ['staff', 'linked-accounts', userId] as const,
  flaggedAddresses: ['staff', 'flagged-addresses'] as const,
  tickets: ['staff', 'tickets'] as const,
  quarantinedShows: ['staff', 'quarantined-shows'] as const,
  payrollSearch: (staffType: string, query: string) =>
    ['staff', 'payroll', 'search', staffType, query] as const,
  payrollFailures: (staffType: string, staffId: number) =>
    ['staff', 'payroll', 'failures', staffType, staffId] as const,
  serverHealth: ['staff', 'server-health'] as const,
  ticket: (id: number) => ['staff', 'tickets', id] as const,
};

/** The code a capability-guarded route refuses with when this browser is not checked in. */
export const checkinRequiredCode = 'staffCheckinRequired';

// The old server's spelling covers the minutes a deploy serves this client
// against the old server (Equoria-pjvp8 phase 6 removes it).
const legacyCheckinRequiredCode = 'STAFF_CHECKIN_REQUIRED';

/** The refusal a capability-guarded route gives when this browser is not checked in. */
export function isCheckinRequired(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as ApiError).statusCode === 403 &&
    ((error as ApiError).code === checkinRequiredCode ||
      (error as ApiError).code === legacyCheckinRequiredCode)
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
 *
 * An action refused because this browser's check-in has lapsed (403
 * staffCheckinRequired) calls `onCheckinRequired`, so the page returns to
 * check-in as it does when a read is refused that way (STAFF-RR-11).
 *
 * Owner ruling 2026-10-28 (q263, Equoria-jqdho): when a background /me check
 * fails with a server error or no connection, the office stays open, and the
 * steward's next action (any staff request) checks /me again, so lost access
 * still closes the office at once.
 */
export function useStaffRevocationWatch(onCheckinRequired?: () => void) {
  const queryClient = useQueryClient();
  const checkinRequired = useRef(onCheckinRequired);
  useEffect(() => {
    checkinRequired.current = onCheckinRequired;
  }, [onCheckinRequired]);
  useEffect(() => {
    const recheckOn404 = (error: unknown) => {
      if (statusOf(error) === 404) {
        void queryClient.invalidateQueries({ queryKey: staffKeys.me });
      }
    };
    const recheckAfterFailedCheck = () => {
      const me = queryClient.getQueryState(staffKeys.me);
      if (me?.status === 'error' && me.fetchStatus === 'idle') {
        void queryClient.invalidateQueries({ queryKey: staffKeys.me });
      }
    };
    const stopQueries = queryClient.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey;
      if (
        event.type === 'updated' &&
        event.action.type === 'fetch' &&
        key[0] === staffKeys.all[0] &&
        key[1] !== 'me'
      ) {
        recheckAfterFailedCheck();
      }
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
        event.action.type === 'pending' &&
        event.mutation.options.mutationKey?.[0] === staffKeys.all[0]
      ) {
        recheckAfterFailedCheck();
      }
      if (
        event.type === 'updated' &&
        event.action.type === 'error' &&
        event.mutation.options.mutationKey?.[0] === staffKeys.all[0]
      ) {
        recheckOn404(event.action.error);
        if (isCheckinRequired(event.action.error)) {
          checkinRequired.current?.();
        }
      }
    });
    return () => {
      stopQueries();
      stopMutations();
    };
  }, [queryClient]);
}

/** `enabled` is false for a signed-out visitor, who is never asked about (STAFF-CR-17). */
export function useStaffMe(enabled = true) {
  return useQuery({ queryKey: staffKeys.me, queryFn: staffApi.me, enabled });
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

/**
 * Everyone who has ever written to the ledger, for the admin's steward filter
 * (STAFF-CR-16): drawn from the whole log, so former stewards stay choosable.
 */
export function useStaffLogActors(enabled: boolean) {
  return useQuery({ queryKey: staffKeys.logActors, queryFn: staffApi.logActors, enabled });
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

export function useLookupConductPlayer() {
  return useMutation({
    mutationKey: [...staffKeys.all, 'conduct-lookup'],
    mutationFn: (username: string) => staffApi.lookupConductPlayer(username),
  });
}

export function useConductRecord(userId: string) {
  return useQuery({
    queryKey: staffKeys.conduct(userId),
    queryFn: () => staffApi.conductRecord(userId),
  });
}

export function useLinkedAccounts(userId: string) {
  return useQuery({
    queryKey: staffKeys.linkedAccounts(userId),
    queryFn: () => staffApi.linkedAccounts(userId),
  });
}

export function useFlaggedAddresses() {
  return useQuery({ queryKey: staffKeys.flaggedAddresses, queryFn: staffApi.flaggedAddresses });
}

export function useConductAction(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...staffKeys.all, 'conduct-act'],
    mutationFn: (args: { action: ConductAction; reason: string; days?: 1 | 3 | 7 }) =>
      staffApi.conductAct(userId, args.action, args.reason, args.days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.conduct(userId) });
      queryClient.invalidateQueries({ queryKey: staffKeys.log });
    },
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...staffKeys.all, 'set-role'],
    mutationFn: (args: { userId: string; role: 'moderator' | 'admin' | 'user'; reason: string }) =>
      staffApi.setRole(args.userId, args.role, args.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.roles });
      queryClient.invalidateQueries({ queryKey: staffKeys.log });
    },
  });
}

/** The ticket list, newest first, one page at a time (STAFF-CR-03). */
export function useStaffTickets() {
  return useInfiniteQuery({
    queryKey: staffKeys.tickets,
    queryFn: ({ pageParam }) => staffApi.listTickets(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

/**
 * One ticket: the first page carries the latest replies; each further page
 * carries the replies before it (STAFF-CR-09).
 */
export function useStaffTicket(id: number) {
  return useInfiniteQuery({
    queryKey: staffKeys.ticket(id),
    queryFn: ({ pageParam }) => staffApi.getTicket(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.olderRepliesCursor ?? undefined,
  });
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
    // A reply writes a ledger entry in the same transaction (STAFF-CR-15).
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.ticket(id) });
      queryClient.invalidateQueries({ queryKey: staffKeys.log });
    },
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

/** The shows held back after three failed runs; owner only (Equoria-ehlbj). */
export function useQuarantinedShows(enabled: boolean) {
  return useQuery({
    queryKey: staffKeys.quarantinedShows,
    queryFn: staffApi.listQuarantinedShows,
    enabled,
  });
}

/** Diagnose is a read; it is a mutation here only because it runs on a click. */
export function useDiagnoseQuarantinedShow() {
  return useMutation({
    mutationKey: [...staffKeys.all, 'diagnose-show'],
    mutationFn: (showId: number) => staffApi.diagnoseQuarantinedShow(showId),
  });
}

/**
 * Test run: the real settlement, always rolled back (Equoria-yqi49). The list
 * refreshes because a passed test run is what unlocks Run Show.
 */
export function useTestRunQuarantinedShow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...staffKeys.all, 'test-run-show'],
    mutationFn: (showId: number) => staffApi.testRunQuarantinedShow(showId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.quarantinedShows });
      queryClient.invalidateQueries({ queryKey: staffKeys.log });
    },
  });
}

/** Run Show: settle once. The ledger and the list both change, on failure too. */
export function useRunQuarantinedShow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...staffKeys.all, 'run-show'],
    mutationFn: (showId: number) => staffApi.runQuarantinedShow(showId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.quarantinedShows });
      queryClient.invalidateQueries({ queryKey: staffKeys.log });
    },
    // The owner may be the host or an entrant: her own coin balance can change.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

/** Equoria-brh8c: grooms or riders by name; with no name, those with logged payroll failures. */
export function usePayrollStaffSearch(staffType: PayrollStaffType, query: string) {
  return useQuery({
    queryKey: staffKeys.payrollSearch(staffType, query),
    queryFn: () => staffApi.searchPayrollStaff(staffType, query),
  });
}

/** One groom's or rider's logged payroll failures and whether Re-run is unlocked. */
export function usePayrollFailures(staffType: PayrollStaffType, staffId: number) {
  return useQuery({
    queryKey: staffKeys.payrollFailures(staffType, staffId),
    queryFn: () => staffApi.payrollFailures(staffType, staffId),
  });
}

/** Diagnose is a read; it is a mutation here only because it runs on a click. */
export function useDiagnosePayroll() {
  return useMutation({
    mutationKey: [...staffKeys.all, 'diagnose-payroll'],
    mutationFn: ({ staffType, staffId }: { staffType: PayrollStaffType; staffId: number }) =>
      staffApi.diagnosePayroll(staffType, staffId),
  });
}

interface PayrollToolVars {
  staffType: PayrollStaffType;
  staffId: number;
  failureId: number;
}

/** Test run: the failed pass replayed and always rolled back. A pass unlocks Re-run. */
export function useTestRunPayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...staffKeys.all, 'test-run-payroll'],
    mutationFn: ({ staffType, staffId, failureId }: PayrollToolVars) =>
      staffApi.testRunPayroll(staffType, staffId, failureId),
    onSettled: (_data, _error, { staffType, staffId }) => {
      queryClient.invalidateQueries({ queryKey: staffKeys.payrollFailures(staffType, staffId) });
      queryClient.invalidateQueries({ queryKey: staffKeys.log });
    },
  });
}

/** Re-run: once, after a passed test run on the code running now. */
export function useRerunPayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...staffKeys.all, 'rerun-payroll'],
    mutationFn: ({ staffType, staffId, failureId }: PayrollToolVars) =>
      staffApi.rerunPayroll(staffType, staffId, failureId),
    onSettled: (_data, _error, { staffType, staffId }) => {
      queryClient.invalidateQueries({ queryKey: staffKeys.payrollFailures(staffType, staffId) });
      queryClient.invalidateQueries({ queryKey: staffKeys.log });
    },
  });
}

/** Equoria-brh8c: the server's memory and speed, read when the owner asks. */
export function useServerHealth() {
  return useQuery({ queryKey: staffKeys.serverHealth, queryFn: staffApi.serverHealth });
}
