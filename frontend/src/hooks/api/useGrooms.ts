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
import {
  groomsApi,
  ApiError,
  Groom,
  GroomAssignment,
  GroomProfile,
  GroomAssignmentLogEntry,
  MarketplaceData,
  SalarySummary,
} from '@/lib/api-client';
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
  });
}

export function useGroomAssignments() {
  return useQuery<GroomAssignment[], ApiError>({
    queryKey: groomKeys.assignments(),
    queryFn: groomsApi.getAssignments,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useGroomSalaries() {
  return useQuery<SalarySummary, ApiError>({
    queryKey: groomKeys.salaries(),
    queryFn: groomsApi.getSalarySummary,
    staleTime: 5 * 60 * 1000, // 5 minutes
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

  return useMutation<
    { success: boolean; data: { groom: Groom; cost: number; remainingMoney: number } },
    ApiError,
    string
  >({
    mutationFn: (marketplaceId) => groomsApi.hireGroom(marketplaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groomKeys.all });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useRefreshMarketplace() {
  const queryClient = useQueryClient();

  return useMutation<MarketplaceData, ApiError, boolean | undefined>({
    mutationFn: (force) => groomsApi.refreshMarketplace(force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groomKeys.marketplace() });
    },
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
      priority: number;
      notes?: string;
      replacePrimary?: boolean;
    }
  >({
    mutationFn: (data) => groomsApi.assignGroom(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groomKeys.assignments() });
      queryClient.invalidateQueries({ queryKey: groomKeys.all });
    },
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

// Equoria-cbkw — GroomMetrics from GET /api/v1/grooms/:id/profile.
// Backend wraps the profile in { success, groom } (no .data key), so the
// api-client returns the whole body; we select `.groom` here.
export function useGroomProfile(groomId: number | null, options: { enabled?: boolean } = {}) {
  return useQuery<GroomProfile, ApiError>({
    queryKey: groomKeys.profile(groomId as number),
    queryFn: async () => {
      const res = await groomsApi.getProfile(groomId as number);
      return res.groom;
    },
    enabled: Boolean(groomId) && (options.enabled ?? true),
    staleTime: 2 * 60 * 1000,
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
  });
}
