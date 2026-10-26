/**
 * Hosting a show (Equoria-oey96.13).
 *
 * Path registry:
 *   POST /api/v1/shows/create   → { show }     host a show; the prize (10 x the
 *                                              entry fee) is taken from the host
 *   GET  /api/v1/shows/hosting  → ShowHosting  how many shows this host has made
 *                                              this game-time week, and the limit
 *
 * The prize is never sent: the server derives it from the entry fee.
 */

import { apiClient } from '../http/apiClient.js';

export interface CreateShowInput {
  name: string;
  discipline: string;
  /** 1 to 20; the show runs one level. */
  level: number;
  /** Whole coins, 0 to 100,000. */
  entryFee: number;
}

export interface HostedShow {
  id: number;
  name: string;
  discipline: string;
  entryFee: number;
  /** What the server took from the host: 10 x the entry fee. */
  prize: number;
  levelMin: number;
  levelMax: number;
  runDate: string;
}

export interface ShowHosting {
  hostedThisWeek: number;
  weeklyLimit: number;
  weekStartedAt: string;
}

export const showsApi = {
  create: (input: CreateShowInput) =>
    apiClient.post<{ show: HostedShow }>('/api/v1/shows/create', input),
  hosting: () => apiClient.get<ShowHosting>('/api/v1/shows/hosting'),
};
