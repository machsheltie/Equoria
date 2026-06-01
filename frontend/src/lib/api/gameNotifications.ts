/**
 * Game Notifications API client (Equoria-rfsml).
 *
 *   GET   /api/v1/users/me/game-notifications           → GameNotificationsResponse
 *   PATCH /api/v1/users/me/game-notifications/read-all   → void
 */

import { apiClient } from '../http/apiClient.js';

export interface StatGainNotificationPayload {
  horseName: string;
  stat: string;
  amount: number;
  feedName: string;
}

export interface FoalBornNotificationPayload {
  foalName: string;
  foalId: number;
  damName: string;
  sireName: string;
}

export type GameNotificationType = 'stat_gain' | 'foal_born' | string;

export interface GameNotification {
  id: string;
  type: GameNotificationType;
  isRead: boolean;
  createdAt: string;
  // Payload shape varies by `type`. Renderers must dispatch on `type` and
  // guard each field before reading. Stat-gain rows use
  // StatGainNotificationPayload; foal-born rows use
  // FoalBornNotificationPayload. Unknown types render a fallback row.
  payload: Partial<StatGainNotificationPayload & FoalBornNotificationPayload> &
    Record<string, unknown>;
}

export interface GameNotificationsResponse {
  notifications: GameNotification[];
  unreadCount: number;
}

export const gameNotificationsApi = {
  getAll: () => apiClient.get<GameNotificationsResponse>('/api/v1/users/me/game-notifications'),
  markAllRead: () => apiClient.patch<void>('/api/v1/users/me/game-notifications/read-all'),
};
