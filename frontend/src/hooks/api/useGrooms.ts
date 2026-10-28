/**
 * Groom Management API Hooks
 *
 * Centralized hooks for groom-related API calls:
 * - List user's grooms
 * - Groom assignments
 * - Groom marketplace
 * - Hire and assign grooms
 * - Salary summaries
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  groomsApi,
  ApiError,
  Groom,
  GroomAssignment,
  GroomAssignmentLogEntry,
  MarketplaceData,
  SalarySummary,
} from '@/lib/api-client';
// Equoria-8cnzr — single error-taxonomy mapping point. Used for mutation
// failure toasts so a raw server body message is never surfaced (§3).
import { userMessageFor } from '@/lib/http/userMessage';
// Equoria-oey96.6 — talent-tree selection shape (backend is source of truth).
import type { TalentSelections } from '@/types/groomTalent';

// Query Keys
export const groomKeys = {
  all: ['grooms'] as const,
  user: (userId: string | number) => [...groomKeys.all, 'user', userId] as const,
  assignments: () => [...groomKeys.all, 'assignments'] as const,
  assignmentsForHorse: (horseId: number) => [...groomKeys.assignments(), 'horse', horseId] as const,
  salaries: () => [...groomKeys.all, 'salaries'] as const,
  marketplace: () => [...groomKeys.all, 'marketplace'] as const,
  // Equoria-cbkw
  profile: (groomId: number) => [...groomKeys.all, 'profile', groomId] as const,
  assignmentLogs: (groomId: number) => [...groomKeys.all, 'assignment-logs', groomId] as const,
  // Equoria-oey96.6 — talent-tree selections for a groom
  talents: (groomId: number) => [...groomKeys.all, 'talents', groomId] as const,
};

// Hooks
export function useUserGrooms(userId: string | number) {
  return useQuery<Groom[], ApiError>({
    queryKey: groomKeys.user(userId),
    queryFn: () => groomsApi.getUserGrooms(userId),
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    // Owner ruling 2026-10-23 (Equoria-i2xxj): an offline read ends in the
    // Manage tab's error with Try Again. The default networkMode 'online'
    // paused it, and the paused tab fell through to a false "none hired".
    networkMode: 'always',
  });
}

export function useGroomAssignments() {
  return useQuery<GroomAssignment[], ApiError>({
    queryKey: groomKeys.assignments(),
    queryFn: groomsApi.getAssignments,
    staleTime: 60 * 1000, // 1 minute
    // Owner ruling 2026-10-23 (Equoria-i2xxj): an offline read ends in the
    // Manage tab's error with Try Again. The default networkMode 'online'
    // paused it, and the paused tab fell through to a false "none hired".
    networkMode: 'always',
  });
}

export function useGroomSalaries() {
  return useQuery<SalarySummary, ApiError>({
    queryKey: groomKeys.salaries(),
    queryFn: groomsApi.getSalaryCost,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Owner ruling 2026-10-23 (Equoria-i2xxj): an offline read ends in the
    // Manage tab's error with Try Again. The default networkMode 'online'
    // paused it, and the paused tab fell through to a false "none hired".
    networkMode: 'always',
  });
}

export function useGroomMarketplace(options: { enabled?: boolean } = {}) {
  return useQuery<MarketplaceData, ApiError>({
    queryKey: groomKeys.marketplace(),
    queryFn: groomsApi.getMarketplace,
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
}

export function useHireGroom() {
  const queryClient = useQueryClient();

  return useMutation<{ groom: Groom; cost: number; remainingMoney: number }, ApiError, string>({
    mutationFn: (marketplaceId) => groomsApi.hireGroom(marketplaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groomKeys.all });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    // Equoria-dosig — NO hook onError here on purpose. The sole consumer
    // (GroomList's hire dialog) shows the refusal at the call site as an
    // InlineError that names the exact reason (roster full vs. balance short),
    // and doctrine §2 mandates exactly ONE feedback per mutation (hook OR call
    // site, not both). The earlier hook toast (Equoria-mljz9) said only "could
    // not hire" and would double the feedback.
  });
}

export function useRefreshMarketplace() {
  const queryClient = useQueryClient();

  return useMutation<MarketplaceData, ApiError, boolean | undefined>({
    mutationFn: (force) => groomsApi.refreshMarketplace(force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groomKeys.marketplace() });
    },
    // NO hook onError on purpose: GroomList shows a refused refresh beside the
    // refresh button (owner ruling q161: errors show next to the button that
    // failed, in plain words). Old contract: a floating toast (Equoria-mljz9).
  });
}

export function useAssignGroom() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean },
    ApiError,
    {
      groomId: number;
      horseId: number;
      replacePrimary?: boolean;
    }
  >({
    mutationFn: (data) => groomsApi.assignGroom(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groomKeys.assignments() });
      queryClient.invalidateQueries({ queryKey: groomKeys.all });
    },
    // Equoria-mljz9 — NO hook onError here on purpose. The sole consumer
    // (AssignGroomModal) already surfaces assign failures at the call site via
    // its own onError → inline error, and doctrine §2 mandates exactly ONE
    // feedback per mutation (hook OR call site, not both). Adding a hook toast
    // would double the feedback. (The modal maps the error through userMessageFor,
    // so no server text reaches the player — Equoria-eivq9.)
  });
}

// Equoria-w1vq — temperament x personality synergy preview
export interface SynergyPreview {
  synergyModifier: number;
  temperament: string | null;
  personality: string | null;
  message: string;
}

export function useGroomHorseSynergy(groomId: number | null, horseId: number | null) {
  return useQuery<SynergyPreview, ApiError>({
    queryKey: ['groom-horse-synergy', groomId, horseId],
    queryFn: () => groomsApi.getSynergy(groomId as number, horseId as number),
    enabled: Boolean(groomId) && Boolean(horseId),
    staleTime: 5 * 60 * 1000, // 5 minutes — temperament + personality rarely change
    gcTime: 30 * 60 * 1000,
  });
}

// Equoria-cbkw — GroomAssignmentLog history from
// GET /api/v1/grooms/:id/assignment-logs. Backend wraps in { success, logs }.
export function useGroomAssignmentLogs(
  groomId: number | null,
  options: { enabled?: boolean } = {}
) {
  return useQuery<GroomAssignmentLogEntry[], ApiError>({
    queryKey: groomKeys.assignmentLogs(groomId as number),
    queryFn: async () => {
      const res = await groomsApi.getAssignmentLogs(groomId as number);
      return res.logs ?? [];
    },
    enabled: Boolean(groomId) && (options.enabled ?? true),
    staleTime: 2 * 60 * 1000,
  });
}

// Equoria-oey96.6 — the groom's committed talent selections (tier1/2/3), read
// from GET /grooms/:id/talents. The BACKEND is authoritative for what is
// selected; the tree component derives available/locked/selected state from
// these + the groom's level. `null` means "no selections yet" (honest empty
// tree — every tier that meets its level gate shows as available).
export function useGroomTalents(groomId: number | null, options: { enabled?: boolean } = {}) {
  return useQuery<TalentSelections | null, ApiError>({
    queryKey: groomKeys.talents(groomId as number),
    queryFn: () => groomsApi.getTalents(groomId as number),
    enabled: Boolean(groomId) && (options.enabled ?? true),
    staleTime: 2 * 60 * 1000,
  });
}

// Equoria-oey96.6 — permanent talent selection (no respec). On success both the
// talent-tree query AND the groom profile must refetch (per the issue: a
// selection changes what the tree shows and can affect the groom's derived
// state), so we invalidate the talents key + the profile key + the groom list
// (which carries level). On an invalid selection the backend returns 400 and
// the transport throws — the caller renders the error, never swallows it.
export function useSelectTalent() {
  const queryClient = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof groomsApi.selectTalent>>,
    ApiError,
    { groomId: number; tier: 'tier1' | 'tier2' | 'tier3'; talentId: string }
  >({
    mutationFn: ({ groomId, tier, talentId }) =>
      groomsApi.selectTalent(groomId, { tier, talentId }),
    onSuccess: (_data, { groomId }) => {
      queryClient.invalidateQueries({ queryKey: groomKeys.talents(groomId) });
      queryClient.invalidateQueries({ queryKey: groomKeys.profile(groomId) });
      queryClient.invalidateQueries({ queryKey: groomKeys.all });
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, ApiError, number>({
    mutationFn: (assignmentId) => groomsApi.deleteAssignment(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groomKeys.assignments() });
    },
    // Equoria-mljz9 — visible failure feedback (§2). The unassign confirm
    // dialog closes on click, so without this a failed unassign was silent.
    // userMessageFor keeps the raw server body off the screen (§3).
    onError: (error) => {
      toast.error('Could not unassign the groom', {
        description: userMessageFor(error).message,
      });
    },
  });
}
