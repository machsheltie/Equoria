/**
 * Forum API client (Equoria-rfsml) — message board threads and posts.
 */

import { apiClient } from '../http/apiClient.js';

export type ForumSection = 'general' | 'art' | 'sales' | 'services' | 'venting';

export interface ForumAuthor {
  id: string;
  username: string;
}

export interface ForumThread {
  id: number;
  section: ForumSection;
  title: string;
  author: ForumAuthor;
  tags: string[];
  isPinned: boolean;
  viewCount: number;
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
}

export interface ForumPost {
  id: number;
  threadId: number;
  author: ForumAuthor;
  content: string;
  createdAt: string;
}

export interface ThreadsResponse {
  threads: ForumThread[];
  total: number;
  page: number;
}

export interface ThreadDetailResponse {
  thread: ForumThread;
  posts: ForumPost[];
}

export interface CreateThreadRequest {
  section: ForumSection;
  title: string;
  content: string;
  tags?: string[];
}

export const forumApi = {
  getThreads: (section?: ForumSection, page = 1) => {
    const params = new URLSearchParams({ page: String(page) });
    if (section) params.set('section', section);
    return apiClient.get<ThreadsResponse>(`/api/v1/forum/threads?${params.toString()}`);
  },

  getThread: (id: number) => apiClient.get<ThreadDetailResponse>(`/api/v1/forum/threads/${id}`),

  createThread: (req: CreateThreadRequest) =>
    apiClient.post<{ thread: ForumThread; firstPost: ForumPost }>('/api/v1/forum/threads', req),

  createPost: (threadId: number, content: string) =>
    apiClient.post<{ post: ForumPost }>(`/api/v1/forum/threads/${threadId}/posts`, { content }),

  incrementView: (threadId: number) =>
    apiClient.post<Record<string, never>>(`/api/v1/forum/threads/${threadId}/view`, {}),
};
