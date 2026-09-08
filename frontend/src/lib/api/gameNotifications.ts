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

/**
 * Equoria-m9lz1 — the game retired one of the player's grooms this week.
 *
 * Deliberately carries NO retirement age: the age at which a groom retires is
 * hidden until the week it takes effect, and this notification IS that week.
 * `horsesLeftUnattended` is how many active assignments the retirement ended, so
 * the row can tell the player what is now uncovered.
 */
export interface GroomRetiredNotificationPayload {
  groomId: number;
  groomName: string;
  speciality: string;
  skillLevel: string;
  level: number;
  careerWeeks: number;
  reason: string;
  horsesLeftUnattended: number;
}

export type GameNotificationType = 'stat_gain' | 'foal_born' | 'groom_retired' | string;

export interface GameNotification {
  id: string;
  type: GameNotificationType;
  isRead: boolean;
  createdAt: string;
  // Payload shape varies by `type`. Renderers must dispatch on `type` and
  // guard each field before reading. Stat-gain rows use
  // StatGainNotificationPayload; foal-born rows use
  // FoalBornNotificationPayload; groom-retired rows use
  // GroomRetiredNotificationPayload. Unknown types render a fallback row.
  payload: Partial<
    StatGainNotificationPayload & FoalBornNotificationPayload & GroomRetiredNotificationPayload
  > &
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
