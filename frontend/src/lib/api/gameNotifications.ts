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

/** One horse this groom was looking after until the retirement ended it. */
export interface GroomRetiredHorse {
  id: number;
  /** Null only if the horse row somehow carries no name; the row falls back. */
  name: string | null;
}

/**
 * Equoria-m9lz1 — the game retired one of the player's grooms this week.
 *
 * Deliberately carries NO retirement age: the age at which a groom retires is
 * hidden until the week it takes effect, and this notification IS that week.
 *
 * `horses` is the horses the retirement left without a groom, BY NAME, scoped by
 * the backend to this recipient's own horses. `horsesLeftUnattended` is that
 * list's length — derived from it, so the number and the names in one row can
 * never disagree. The count came first and the names were added afterwards
 * (fix round 3): a bare "3 horses are without a groom" is not something this
 * game can say to a player who knows all three by name.
 */
export interface GroomRetiredNotificationPayload {
  groomId: number;
  groomName: string;
  speciality: string;
  skillLevel: string;
  level: number;
  /**
   * The groom's age in game-years at retirement (Equoria-maeba, owner ruling
   * 2026-09-14). Replaces `careerWeeks`, which was the retired career-weeks
   * reading of a groom's age.
   */
  ageYears: number;
  reason: string;
  horsesLeftUnattended: number;
  horses: GroomRetiredHorse[];
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
