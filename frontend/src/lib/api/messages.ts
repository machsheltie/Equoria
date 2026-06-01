/**
 * Direct Messages API client (Equoria-rfsml, Epic 19B-2).
 *
 *   GET   /api/v1/messages/inbox         → InboxResponse
 *   GET   /api/v1/messages/sent          → InboxResponse
 *   GET   /api/v1/messages/unread-count  → { count: number }
 *   GET   /api/v1/messages/:id           → { message: DirectMessage }
 *   POST  /api/v1/messages               → { message: DirectMessage }
 *   PATCH /api/v1/messages/:id/read      → { success: boolean }
 */

import { apiClient } from '../http/apiClient.js';

export interface DirectMessageUser {
  id: string;
  username: string;
}

export interface DirectMessage {
  id: number;
  senderId: string;
  sender: DirectMessageUser;
  recipientId: string;
  recipient: DirectMessageUser;
  subject: string;
  content: string;
  tag?: string;
  isRead: boolean;
  createdAt: string;
}

export interface InboxResponse {
  messages: DirectMessage[];
}

export interface SendMessageRequest {
  recipientId: string;
  subject: string;
  content: string;
  tag?: string;
}

export const messagesApi = {
  getInbox: () => apiClient.get<InboxResponse>('/api/v1/messages/inbox'),
  getSent: () => apiClient.get<InboxResponse>('/api/v1/messages/sent'),
  getUnreadCount: () => apiClient.get<{ count: number }>('/api/v1/messages/unread-count'),
  getMessage: (id: number) => apiClient.get<{ message: DirectMessage }>(`/api/v1/messages/${id}`),
  sendMessage: (req: SendMessageRequest) =>
    apiClient.post<{ message: DirectMessage }>('/api/v1/messages', req),
  markRead: (id: number) =>
    apiClient.patch<{ success: boolean }>(`/api/v1/messages/${id}/read`, {}),
};
