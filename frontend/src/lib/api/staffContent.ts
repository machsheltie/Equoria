/**
 * Steward's Office content moderation (Equoria-puj1e.3, owner rulings q375/q376):
 * renames, forum post edits and removals, and the held-post queue; the forum's
 * word lists (q380/q381) and players' reports of posts (q382).
 */

import { apiClient } from '../http/apiClient.js';
import type { ForumReportReason } from './forum.js';

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

/** q381: blocked words refuse a post; review words hold it for a moderator. */
export type ForumWordList = 'blocked' | 'review';

export interface ForumWordEntry {
  id: number;
  word: string;
}

export interface ForumWordLists {
  blocked: ForumWordEntry[];
  review: ForumWordEntry[];
}

export interface ForumReportView {
  id: number;
  reason: ForumReportReason;
  note: string | null;
  createdAt: string;
  reporter: { id: string; username: string };
  post: {
    id: number;
    content: string;
    status: 'published' | 'held';
    author: { id: string; username: string };
    thread: { id: number; title: string };
  };
}

export interface ForumReportsPage {
  reports: ForumReportView[];
  nextAfter: number | null;
}

export type ForumReportDecision = 'resolve' | 'dismiss';

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
  forumWords: () => apiClient.get<ForumWordLists>(`${BASE}/forum/words`),
  addForumWord: (list: ForumWordList, word: string) =>
    apiClient.post<ForumWordEntry & { list: ForumWordList }>(`${BASE}/forum/words`, {
      list,
      word,
    }),
  removeForumWord: (wordId: number) =>
    apiClient.post<{ id: number }>(`${BASE}/forum/words/${wordId}/remove`, {}),
  forumReports: (after?: number) =>
    apiClient.get<ForumReportsPage>(
      after === undefined ? `${BASE}/forum/reports` : `${BASE}/forum/reports?after=${after}`
    ),
  decideForumReport: (reportId: number, decision: ForumReportDecision, reason?: string) =>
    apiClient.post<{ id: number }>(
      `${BASE}/forum/reports/${reportId}/${decision}`,
      reason ? { reason } : {}
    ),
};
