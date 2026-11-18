/**
 * Steward's Office content moderation (Equoria-puj1e.3, owner rulings q375/q376):
 * renames, forum post edits and removals, and the held-post queue.
 */

import { apiClient } from '../http/apiClient.js';

const BASE = '/api/v1/staff';

export interface HorseNameView {
  id: number;
  name: string;
  ownerUsername: string | null;
}

export interface ShowNameView {
  id: number;
  name: string;
  hostUsername: string | null;
}

export interface HeldPost {
  id: number;
  content: string;
  createdAt: string;
  author: { id: string; username: string };
  thread: { id: number; title: string; section: string };
  /** Accepting this post opens its thread to everyone. */
  startsThread: boolean;
}

export interface HeldPostsPage {
  posts: HeldPost[];
  nextAfter: number | null;
}

export const staffContentApi = {
  horse: (horseId: number) => apiClient.get<HorseNameView>(`${BASE}/content/horses/${horseId}`),
  renameHorse: (horseId: number, name: string, reason: string) =>
    apiClient.post<{ id: number; name: string }>(`${BASE}/content/horses/${horseId}/rename`, {
      name,
      reason,
    }),
  show: (showId: number) => apiClient.get<ShowNameView>(`${BASE}/content/shows/${showId}`),
  renameShow: (showId: number, name: string, reason: string) =>
    apiClient.post<{ id: number; name: string }>(`${BASE}/content/shows/${showId}/rename`, {
      name,
      reason,
    }),
  renamePlayer: (username: string, newUsername: string, reason: string) =>
    apiClient.post<{ id: string; username: string }>(`${BASE}/content/players/rename`, {
      username,
      newUsername,
      reason,
    }),
  editPost: (postId: number, content: string, reason: string) =>
    apiClient.post<{ id: number; content: string }>(`${BASE}/forum/posts/${postId}/edit`, {
      content,
      reason,
    }),
  removePost: (postId: number, reason: string) =>
    apiClient.post<{ id: number; removed: 'post' | 'thread' }>(
      `${BASE}/forum/posts/${postId}/remove`,
      { reason }
    ),
  heldPosts: (after?: number) =>
    apiClient.get<HeldPostsPage>(
      after === undefined ? `${BASE}/forum/held` : `${BASE}/forum/held?after=${after}`
    ),
  acceptPost: (postId: number) =>
    apiClient.post<{ id: number }>(`${BASE}/forum/held/${postId}/accept`, {}),
  rejectPost: (postId: number, reason: string) =>
    apiClient.post<{ id: number }>(`${BASE}/forum/held/${postId}/reject`, { reason }),
};
