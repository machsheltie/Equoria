import { useQuery } from '@tanstack/react-query';
import { ApiError, HorseProgression, StatHistory, RecentGains, horsesApi } from '@/lib/api-client';

const progressionKeys = {
  all: ['progression'] as const,
  detail: (horseId: number) => ['progression', horseId] as const,
  statHistory: (horseId: number, timeRange?: string) =>
    ['progression', horseId, 'stats-history', timeRange] as const,
  recentGains: (horseId: number, days?: number) =>
    ['progression', horseId, 'recent-gains', days] as const,
};

export const useHorseProgression = (horseId: number) =>
  useQuery<HorseProgression, ApiError>({
    queryKey: progressionKeys.detail(horseId),
    queryFn: () => horsesApi.getProgression(horseId),
    enabled: Boolean(horseId),
    staleTime: 60 * 1000, // 1 minute
  });

export const useStatHistory = (horseId: number, timeRange = '30d') =>
  useQuery<StatHistory, ApiError>({
    queryKey: progressionKeys.statHistory(horseId, timeRange),
    queryFn: () => horsesApi.getStatHistory(horseId, timeRange),
    enabled: Boolean(horseId),
    staleTime: 30 * 1000, // 30 seconds
  });

export const useRecentGains = (horseId: number, days = 30) =>
  useQuery<RecentGains, ApiError>({
    queryKey: progressionKeys.recentGains(horseId, days),
    queryFn: () => horsesApi.getRecentGains(horseId, days),
    enabled: Boolean(horseId),
    staleTime: 30 * 1000, // 30 seconds
  });

export const progressionQueryKeys = progressionKeys;
