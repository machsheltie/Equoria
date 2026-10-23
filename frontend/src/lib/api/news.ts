/**
 * News API client (Equoria-wbt8l). Shapes mirror backend/modules/news.
 *
 *   GET    /api/v1/news?before&limit        → NewsPage (players)
 *   GET    /api/v1/admin/news               → NewsDesk (staff)
 *   POST   /api/v1/admin/news               → { post }
 *   PUT    /api/v1/admin/news/:id           → { post }
 *   DELETE /api/v1/admin/news/:id           → { id }
 *   POST   /api/v1/admin/news/images?filename → { imageUrl } (the picture is the body)
 */

import { apiClient, fetchWithAuth } from '../http/apiClient.js';

/** Written at the News Desk. */
export type StaffNewsPostType =
  | 'seasonalEvent'
  | 'headAdminLetter'
  | 'adminLetter'
  | 'update'
  | 'contest';

/** Written by the game at the start of a game day. */
export type GameNewsPostType =
  | 'newItem'
  | 'clubNews'
  | 'seasonalCompetitionOpen'
  | 'seasonalCompetitionClose'
  | 'seasonalCraft';

export type NewsPostType = StaffNewsPostType | GameNewsPostType;

export interface NewsTile {
  imageUrl: string;
  caption: string;
}

export interface NewsItem {
  id: number;
  /** Plain text from the server; unknown future types render as a quiet row. */
  postType: NewsPostType | string;
  title: string;
  body: string;
  tiles: NewsTile[];
  /** Null for game entries, and for a staff post whose writer's account is gone. */
  authorName: string | null;
  authorRoleLabel: string | null;
  linkPath: string | null;
  publishAt: string;
  /** The Eastern game date it was posted, 'YYYY-MM-DD'. */
  gameDate: string;
  endsAt: string | null;
  /** The last Eastern game day before endsAt, 'YYYY-MM-DD'. */
  lastGameDate: string | null;
}

export interface NewsPage {
  /** Today's Eastern game date, 'YYYY-MM-DD'. */
  today: string;
  items: NewsItem[];
  nextCursor: string | null;
  /** First page only: published entries whose end is still to come. */
  ahead: NewsItem[] | null;
}

export interface NewsDeskPost extends NewsItem {
  scheduled: boolean;
  /** Seasonal event: 'YYYY-MM'. */
  month: string | null;
  /** Contest: its last open day, 'YYYY-MM-DD'. */
  closesOn: string | null;
  canChange: boolean;
}

export interface NewsDesk {
  allowedTypes: StaffNewsPostType[];
  signature: { name: string; roleLabel: string | null };
  imageUploadsReady: boolean;
  today: string;
  posts: NewsDeskPost[];
}

export interface NewsPostInput {
  postType: StaffNewsPostType;
  title: string;
  body: string;
  tiles?: NewsTile[];
  month?: string;
  closesOn?: string | null;
}

export type NewsPostEdit = Omit<NewsPostInput, 'postType'>;

export const newsApi = {
  feed: (before?: string) =>
    apiClient.get<NewsPage>(
      before ? `/api/v1/news?before=${encodeURIComponent(before)}` : '/api/v1/news'
    ),
  desk: () => apiClient.get<NewsDesk>('/api/v1/admin/news'),
  create: (input: NewsPostInput) =>
    apiClient.post<{ post: NewsDeskPost }>('/api/v1/admin/news', input),
  update: (id: number, input: NewsPostEdit) =>
    apiClient.put<{ post: NewsDeskPost }>(`/api/v1/admin/news/${id}`, input),
  remove: (id: number) => apiClient.delete<{ id: number }>(`/api/v1/admin/news/${id}`),
  /** Sends the picture's own bytes with its own Content-Type. */
  uploadImage: (file: File) =>
    fetchWithAuth<{ imageUrl: string }>(
      `/api/v1/admin/news/images?filename=${encodeURIComponent(file.name)}`,
      { method: 'POST', body: file, headers: { 'Content-Type': file.type } }
    ),
};
