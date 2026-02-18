/**
 * User Progress API Hooks
 *
 * Centralized hooks for user progress and dashboard data:
 * - User progress with XP and level info
 * - Dashboard summary with horses, shows, activity
 * - Activity feed
 */

import { useQuery } from '@tanstack/react-query';
import {
  userProgressApi,
  ApiError,
  UserProgress,
  DashboardData,
  ActivityFeedItem,
} from '@/lib/api-client';

// Query Keys
export const progressKeys = {
  all: ['userProgress'] as const,
  user: (userId: string | number) => [...progressKeys.all, userId] as const,
  dashboard: (userId: string | number) => [...progressKeys.all, 'dashboard', userId] as const,
  activity: (userId: string | number) => [...progressKeys.all, 'activity', userId] as const,
};

// Hooks
export function useUserProgress(userId: string | number) {
  return useQuery<UserProgress, ApiError>({
    queryKey: progressKeys.user(userId),
    queryFn: () => userProgressApi.getProgress(userId),
    enabled: Boolean(userId),
    staleTime: 30 * 1000, // 30 seconds (AC: balance currency freshness)
  });
}

export function useDashboard(userId: string | number) {
  return useQuery<DashboardData, ApiError>({
    queryKey: progressKeys.dashboard(userId),
    queryFn: () => userProgressApi.getDashboard(userId),
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useActivityFeed(userId: string | number) {
  return useQuery<ActivityFeedItem[], ApiError>({
    queryKey: progressKeys.activity(userId),
    queryFn: () => userProgressApi.getActivity(userId),
    enabled: Boolean(userId),
    staleTime: 30 * 1000, // 30 seconds (AC: keep activity feed current)
  });
}

export function useUser(userId: string | number) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => userProgressApi.getUser(userId),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
