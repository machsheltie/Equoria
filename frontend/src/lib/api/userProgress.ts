/**
 * User Progress API client (Equoria-jog8w, Equoria-aodym slice 2).
 *
 * Path registry:
 *   GET /api/v1/users/:userId/progress       → UserProgress
 *   GET /api/v1/users/dashboard/:userId       → DashboardData
 *   GET /api/v1/users/:userId/activity         → ActivityFeedItem[]
 *   GET /api/v1/users/community/activity       → ActivityFeedItem[]
 *   GET /api/v1/users/:userId                  → user details
 */

import { apiClient } from '../http/apiClient.js';
import type { ActivityFeedItem, DashboardData, UserProgress } from './types.js';

export const userProgressApi = {
  getProgress: (userId: string | number) =>
    apiClient.get<UserProgress>(`/api/v1/users/${userId}/progress`),
  getDashboard: (userId: string | number) =>
    apiClient.get<DashboardData>(`/api/v1/users/dashboard/${userId}`),
  getActivity: (userId: string | number) =>
    apiClient.get<ActivityFeedItem[]>(`/api/v1/users/${userId}/activity`),

  /** Get global community activity feed */
  getCommunityActivity: () => apiClient.get<ActivityFeedItem[]>('/api/v1/users/community/activity'),

  /** Get user details */
  getUser: (userId: string | number) =>
    apiClient.get<{
      id: string;
      username: string;
      money: number;
      level: number;
      currentHorses: number;
      stableLimit: number;
    }>(`/api/v1/users/${userId}`),
};
